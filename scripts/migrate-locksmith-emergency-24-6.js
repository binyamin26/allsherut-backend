/**
 * One-off data migration: locksmith "emergency opening" option renamed 24/7 -> 24/6.
 *
 * The locksmith `door_opening_types` option value changed from
 *   'פתיחה חירום 24/7'  ->  'פתיחה חירום 24/6'
 * This rewrites the value inside `service_providers.service_details` (JSON column)
 * for every existing locksmith provider that had the old value selected, so their
 * choice keeps showing as checked in the dashboard and keeps matching search filters.
 *
 * `availability_hours` needs no migration: '24/6' is a brand-new option there.
 *
 * Usage (from backend/):
 *   node scripts/migrate-locksmith-emergency-24-6.js --dry   # preview only
 *   node scripts/migrate-locksmith-emergency-24-6.js         # apply
 *
 * On production (Fly.io) run it inside the app container:
 *   flyctl ssh console -a <app> -C "node scripts/migrate-locksmith-emergency-24-6.js --dry"
 *   flyctl ssh console -a <app> -C "node scripts/migrate-locksmith-emergency-24-6.js"
 */

const { query, closePool } = require('../config/database');

const OLD_VALUE = 'פתיחה חירום 24/7';
const NEW_VALUE = 'פתיחה חירום 24/6';

const isDryRun = process.argv.includes('--dry');

function parseDetails(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function run() {
  try {
    const rows = await query(
      `SELECT id, service_details
         FROM service_providers
        WHERE service_type = 'locksmith'
          AND service_details IS NOT NULL`
    );

    console.log(`Scanned ${rows.length} locksmith provider row(s).`);

    const toFix = [];

    for (const row of rows) {
      const details = parseDetails(row.service_details);
      if (!details) continue;

      const list = details.door_opening_types;
      if (!Array.isArray(list) || !list.includes(OLD_VALUE)) continue;

      details.door_opening_types = list.map(v => (v === OLD_VALUE ? NEW_VALUE : v));
      toFix.push({ id: row.id, details });
    }

    console.log(`${toFix.length} provider(s) have the old "${OLD_VALUE}" value.`);
    toFix.forEach(p => console.log(`  provider id=${p.id}`));

    if (toFix.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    if (isDryRun) {
      console.log('\n--dry: no changes written.');
      return;
    }

    let updated = 0;
    for (const p of toFix) {
      const res = await query(
        `UPDATE service_providers SET service_details = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(p.details), p.id]
      );
      updated += res.affectedRows || 0;
    }

    console.log(`\nDone. Updated ${updated} provider row(s).`);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

run();
