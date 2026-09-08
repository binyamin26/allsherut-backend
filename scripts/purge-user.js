/**
 * One-off: fully purge a user and everything attached to them.
 *
 * TiDB does NOT reliably enforce ON DELETE CASCADE, so this deletes from every
 * child table explicitly, in FK-safe order, inside a transaction.
 *
 * USAGE (run inside the Fly container so it uses the app's prod DB config):
 *
 *   # 1. Investigate — find candidates, show everything that would be deleted:
 *   node scripts/purge-user.js --search="bouchoucha" --dry
 *
 *   # 2. Once you know the id, dry-run scoped to it:
 *   node scripts/purge-user.js --user-id=123 --dry
 *
 *   # 3. Apply (must pass BOTH the id and --yes):
 *   node scripts/purge-user.js --user-id=123 --yes
 *
 * Notes:
 * - Refuses to delete unless exactly one user is targeted via --user-id.
 * - --search matches first_name / last_name / email (LIKE, case-insensitive)
 *   plus the service_details JSON service_first_name / service_last_name.
 * - Also destroys the user's Cloudinary images (profile + gallery) unless
 *   --keep-images is passed. Needs CLOUDINARY_* env vars (present in the Fly VM).
 * - Also removes trial_history rows (by original_user_id / email_hash) unless
 *   --keep-trial is passed (keep = the email stays blocked from a new free trial).
 */

const crypto = require('crypto');
const { pool, query, transaction } = require('../config/database');

// same as TrialHistory.hashEmail
function emailHash(email) {
  if (!email) return null;
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (e) {
  console.log('(cloudinary module unavailable:', e.message, ')');
}

// public_id from a Cloudinary URL — same logic as routes/upload.js deleteFromCloudinary
function publicIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  return parts[1].replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
}

function collectImageUrls(user, providers) {
  const urls = new Set();
  const add = (v) => {
    if (!v) return;
    let arr = v;
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try { arr = JSON.parse(v); } catch (e) { arr = [v]; }
    }
    (Array.isArray(arr) ? arr : [arr]).forEach(u => {
      if (typeof u === 'string' && u.includes('res.cloudinary.com')) urls.add(u);
    });
  };
  add(user.profile_image);
  add(user.profile_image_path);
  providers.forEach(p => { add(p.profile_image); add(p.profile_images); });
  return [...urls];
}

async function destroyImages(urls) {
  if (!cloudinary || urls.length === 0) return;
  for (const url of urls) {
    const pid = publicIdFromUrl(url);
    if (!pid) { console.log(`  ? could not parse public_id: ${url}`); continue; }
    try {
      const res = await cloudinary.uploader.destroy(pid);
      console.log(`  - cloudinary destroy ${pid}: ${res.result}`);
    } catch (err) {
      console.log(`  ! cloudinary destroy ${pid} failed: ${err.message}`);
    }
  }
}

function arg(name, def = undefined) {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
}

const SEARCH = arg('search');
const USER_ID = arg('user-id');
const DRY = !!arg('dry');
const YES = !!arg('yes');
const KEEP_IMAGES = !!arg('keep-images');
const KEEP_TRIAL = !!arg('keep-trial');

const DEFAULT_PATTERNS = [
  '%bouchoucha%', '%bouchoucha%', '%boushousha%', '%bochoucha%',
  '%בושושה%', '%בושוש%',
  '%baroukh%', '%barouh%', '%barukh%', '%ברוך%',
];

async function listTablesWithColumn(colNames) {
  const rows = await query(
    `SELECT DISTINCT TABLE_NAME, COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME IN (${colNames.map(() => '?').join(',')})`,
    colNames
  );
  return rows;
}

async function findCandidates() {
  if (USER_ID) {
    return query('SELECT * FROM users WHERE id = ?', [USER_ID]);
  }
  const patterns = SEARCH ? [`%${String(SEARCH).toLowerCase()}%`] : DEFAULT_PATTERNS;
  const likeUser = patterns
    .map(() => `LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ?`)
    .join(' OR ');
  const userParams = patterns.flatMap(p => [p, p, p]);
  const byUser = await query(`SELECT * FROM users WHERE ${likeUser}`, userParams);

  // also match the name stored in service_providers.service_details JSON
  let byDetails = [];
  try {
    const likeSp = patterns
      .map(() => `LOWER(sp.service_details->>'$.service_first_name') LIKE ? OR LOWER(sp.service_details->>'$.service_last_name') LIKE ?`)
      .join(' OR ');
    const spParams = patterns.flatMap(p => [p, p]);
    byDetails = await query(
      `SELECT u.* FROM users u
         JOIN service_providers sp ON sp.user_id = u.id
        WHERE ${likeSp}`,
      spParams
    );
  } catch (e) {
    console.log('(service_details JSON search skipped:', e.message, ')');
  }

  const seen = new Map();
  [...byUser, ...byDetails].forEach(u => seen.set(u.id, u));
  return [...seen.values()];
}

async function report(user) {
  const uid = user.id;
  console.log(`\n──────── user id=${uid} ────────`);
  console.log({
    id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name,
    phone: user.phone, role: user.role, is_active: user.is_active,
    created_at: user.created_at, last_login: user.last_login,
  });

  const providers = await query('SELECT * FROM service_providers WHERE user_id = ?', [uid]);
  console.log(`service_providers (${providers.length}):`);
  providers.forEach(p => console.log(`  provider id=${p.id} | ${p.service_type} | title=${JSON.stringify(p.title)} | active=${p.is_active}`));
  const providerIds = providers.map(p => p.id);

  const userTables = await listTablesWithColumn(['user_id', 'reviewer_user_id', 'client_user_id', 'userId']);
  const provTables = await listTablesWithColumn(['provider_id']);

  console.log('rows keyed by user:');
  for (const { TABLE_NAME, COLUMN_NAME } of userTables) {
    if (TABLE_NAME === 'users') continue;
    const r = await query(`SELECT COUNT(*) c FROM \`${TABLE_NAME}\` WHERE \`${COLUMN_NAME}\` = ?`, [uid]);
    if (r[0].c > 0) console.log(`  ${TABLE_NAME}.${COLUMN_NAME}: ${r[0].c}`);
  }

  console.log('rows keyed by provider_id:');
  if (providerIds.length) {
    for (const { TABLE_NAME } of provTables) {
      if (TABLE_NAME === 'service_providers') continue;
      const r = await query(
        `SELECT COUNT(*) c FROM \`${TABLE_NAME}\` WHERE provider_id IN (${providerIds.map(() => '?').join(',')})`,
        providerIds
      );
      if (r[0].c > 0) console.log(`  ${TABLE_NAME}: ${r[0].c}`);
    }
  }

  try {
    const th = await query(
      'SELECT COUNT(*) c FROM trial_history WHERE original_user_id = ? OR email_hash = ?',
      [uid, emailHash(user.email)]
    );
    if (th[0].c > 0) console.log(`  trial_history (original_user_id / email_hash): ${th[0].c}`);
  } catch (e) { console.log('  trial_history check failed:', e.message); }

  const imageUrls = collectImageUrls(user, providers);
  console.log(`cloudinary images (${imageUrls.length})${KEEP_IMAGES ? ' [--keep-images: will NOT delete]' : ''}:`);
  imageUrls.forEach(u => console.log(`  ${u}`));

  return { providers, providerIds, imageUrls };
}

async function purge(user, providerIds) {
  await transaction(async (conn) => {
    const uid = user.id;
    const inProv = providerIds.length ? `(${providerIds.map(() => '?').join(',')})` : null;

    const provChildTables = await listTablesWithColumn(['provider_id']);
    for (const { TABLE_NAME } of provChildTables) {
      if (TABLE_NAME === 'service_providers' || !inProv) continue;
      const [res] = await conn.query(
        `DELETE FROM \`${TABLE_NAME}\` WHERE provider_id IN ${inProv}`, providerIds
      );
      if (res.affectedRows) console.log(`  - ${TABLE_NAME}: ${res.affectedRows}`);
    }

    const userChildTables = await listTablesWithColumn(['user_id', 'reviewer_user_id', 'client_user_id', 'userId']);
    for (const { TABLE_NAME, COLUMN_NAME } of userChildTables) {
      if (TABLE_NAME === 'users' || TABLE_NAME === 'service_providers') continue;
      const [res] = await conn.query(
        `DELETE FROM \`${TABLE_NAME}\` WHERE \`${COLUMN_NAME}\` = ?`, [uid]
      );
      if (res.affectedRows) console.log(`  - ${TABLE_NAME}.${COLUMN_NAME}: ${res.affectedRows}`);
    }

    const [spRes] = await conn.query('DELETE FROM service_providers WHERE user_id = ?', [uid]);
    if (spRes.affectedRows) console.log(`  - service_providers: ${spRes.affectedRows}`);

    if (!KEEP_TRIAL) {
      try {
        const [thRes] = await conn.query(
          'DELETE FROM trial_history WHERE original_user_id = ? OR email_hash = ?',
          [uid, emailHash(user.email)]
        );
        if (thRes.affectedRows) console.log(`  - trial_history: ${thRes.affectedRows}`);
      } catch (e) { console.log('  ! trial_history delete failed:', e.message); }
    }

    const [uRes] = await conn.query('DELETE FROM users WHERE id = ?', [uid]);
    console.log(`  - users: ${uRes.affectedRows}`);
  });
}

async function listRejected() {
  const rows = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active,
            GROUP_CONCAT(sp.service_type) AS services,
            SUM(sp.verification_status = 'rejected') AS rejected_count,
            COUNT(*) AS total_services
       FROM users u
       JOIN service_providers sp ON sp.user_id = u.id
      WHERE u.role = 'provider'
      GROUP BY u.id
     HAVING rejected_count > 0
      ORDER BY u.id`
  );
  console.log(`Users with at least one 'rejected' listing: ${rows.length}`);
  rows.forEach(r => console.log(
    `  user id=${r.id} | ${r.first_name} ${r.last_name} | ${r.email} | ` +
    `${r.rejected_count}/${r.total_services} rejected | services: ${r.services}`
  ));
  console.log('\nPurge one with:  node scripts/purge-user.js --user-id=<id> --yes');
}

async function main() {
  if (arg('list-rejected')) {
    await listRejected();
    return;
  }

  const candidates = await findCandidates();

  if (candidates.length === 0) {
    console.log('No matching user found.');
    return;
  }

  console.log(`Found ${candidates.length} candidate user(s).`);
  const scoped = [];
  for (const u of candidates) {
    const { providerIds, imageUrls } = await report(u);
    scoped.push({ u, providerIds, imageUrls });
  }

  if (DRY || !YES) {
    console.log('\n(dry / not confirmed) — nothing deleted. Re-run with --user-id=<id> --yes to purge.');
    return;
  }
  if (!USER_ID || candidates.length !== 1) {
    console.log('\nREFUSING to delete: pass --user-id=<id> and make sure it resolves to exactly one user.');
    return;
  }

  if (!KEEP_IMAGES) {
    console.log(`\nDestroying ${scoped[0].imageUrls.length} Cloudinary image(s) ...`);
    await destroyImages(scoped[0].imageUrls);
  }

  console.log(`\nPurging user id=${candidates[0].id} ...`);
  await purge(scoped[0].u, scoped[0].providerIds);
  console.log('Done.');

  const check = await query('SELECT COUNT(*) c FROM users WHERE id = ?', [candidates[0].id]);
  console.log(`Verify: users row remaining = ${check[0].c} (expect 0)`);
}

main()
  .catch(err => { console.error('ERROR:', err); process.exitCode = 1; })
  .finally(() => pool.end());
