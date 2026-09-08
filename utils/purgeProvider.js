/**
 * Hard-delete one service listing (a service_providers row) and everything
 * attached to it. If it was the owning user's LAST listing, delete the user
 * account too. trial_history is preserved by default (anti-abuse hash).
 *
 * TiDB does not enforce ON DELETE CASCADE, so every child row is removed
 * explicitly. Child tables are resolved from information_schema by column name
 * so nothing is missed. Cloudinary images are destroyed after the DB commit.
 *
 * Used by the admin "reject" email link (routes/auth.js) and reusable elsewhere.
 */

const crypto = require('crypto');
const { query, transaction } = require('../config/database');

let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (e) {
  console.warn('purgeProvider: cloudinary module unavailable —', e.message);
}

// public_id from a Cloudinary URL — same parsing as routes/upload.js
function publicIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  return parts[1].replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
}

function cloudinaryUrlsFrom(row, cols) {
  const urls = new Set();
  for (const col of cols) {
    const v = row[col];
    if (!v) continue;
    let arr = v;
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try { arr = JSON.parse(v); } catch (e) { arr = [v]; }
    }
    (Array.isArray(arr) ? arr : [arr]).forEach(u => {
      if (typeof u === 'string' && u.includes('res.cloudinary.com')) urls.add(u);
    });
  }
  return [...urls];
}

async function destroyImages(urls, log) {
  if (!cloudinary || urls.length === 0) return;
  for (const url of urls) {
    const pid = publicIdFromUrl(url);
    if (!pid) continue;
    try {
      const r = await cloudinary.uploader.destroy(pid);
      log.push(`cloudinary ${pid}: ${r.result}`);
    } catch (e) {
      log.push(`cloudinary ${pid} FAILED: ${e.message}`);
    }
  }
}

async function tablesWithColumn(cols) {
  return query(
    `SELECT DISTINCT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN (${cols.map(() => '?').join(',')})`,
    cols
  );
}

/**
 * @param {number} providerId  service_providers.id
 * @param {object} opts
 * @param {boolean} [opts.deleteAccountIfLast=true]  also delete the users row when no other listing remains
 * @param {boolean} [opts.keepTrial=true]            keep trial_history rows (set false to also purge them)
 * @returns {Promise<{found:boolean, accountDeleted:boolean, serviceType?:string, userId?:number, log:string[]}>}
 */
async function purgeProviderService(providerId, opts = {}) {
  const { deleteAccountIfLast = true, keepTrial = true } = opts;
  const log = [];

  const prov = await query('SELECT * FROM service_providers WHERE id = ?', [providerId]);
  if (prov.length === 0) return { found: false, accountDeleted: false, log };
  const provider = prov[0];
  const userId = provider.user_id;

  const provImgs = cloudinaryUrlsFrom(provider, ['profile_image', 'profile_images']);
  const provChild = await tablesWithColumn(['provider_id']);
  const userChild = await tablesWithColumn(['user_id', 'reviewer_user_id', 'client_user_id', 'userId']);

  let accountDeleted = false;
  let userImgs = [];

  await transaction(async (conn) => {
    for (const { TABLE_NAME } of provChild) {
      if (TABLE_NAME === 'service_providers') continue;
      const [r] = await conn.query(`DELETE FROM \`${TABLE_NAME}\` WHERE provider_id = ?`, [providerId]);
      if (r.affectedRows) log.push(`${TABLE_NAME}: ${r.affectedRows}`);
    }

    const [spr] = await conn.query('DELETE FROM service_providers WHERE id = ?', [providerId]);
    log.push(`service_providers: ${spr.affectedRows}`);

    if (!deleteAccountIfLast) return;

    const [countRows] = await conn.query('SELECT COUNT(*) c FROM service_providers WHERE user_id = ?', [userId]);
    const remaining = countRows[0].c;

    if (remaining > 0) {
      // account kept — don't leave users.service_type pointing at the deleted listing
      if (provider.service_type) {
        try {
          await conn.query(
            'UPDATE users SET service_type = NULL WHERE id = ? AND service_type = ?',
            [userId, provider.service_type]
          );
        } catch (e) { /* legacy column may not exist */ }
      }
      return;
    }

    const [urows] = await conn.query('SELECT * FROM users WHERE id = ?', [userId]);
    const userRow = urows[0];
    if (!userRow) return;
    userImgs = cloudinaryUrlsFrom(userRow, ['profile_image', 'profile_image_path']);

    for (const { TABLE_NAME, COLUMN_NAME } of userChild) {
      if (TABLE_NAME === 'users' || TABLE_NAME === 'service_providers') continue;
      const [r] = await conn.query(`DELETE FROM \`${TABLE_NAME}\` WHERE \`${COLUMN_NAME}\` = ?`, [userId]);
      if (r.affectedRows) log.push(`${TABLE_NAME}.${COLUMN_NAME}: ${r.affectedRows}`);
    }

    if (!keepTrial) {
      try {
        const emailHash = crypto.createHash('sha256')
          .update(String(userRow.email || '').toLowerCase().trim()).digest('hex');
        const [r] = await conn.query(
          'DELETE FROM trial_history WHERE original_user_id = ? OR email_hash = ?', [userId, emailHash]
        );
        if (r.affectedRows) log.push(`trial_history: ${r.affectedRows}`);
      } catch (e) { log.push(`trial_history skip: ${e.message}`); }
    }

    const [ur] = await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    log.push(`users: ${ur.affectedRows}`);
    accountDeleted = true;
  });

  // external, best-effort, after the DB is committed
  await destroyImages([...provImgs, ...userImgs], log);

  return {
    found: true,
    accountDeleted,
    serviceType: provider.service_type,
    userId: accountDeleted ? userId : undefined,
    log,
  };
}

module.exports = { purgeProviderService };
