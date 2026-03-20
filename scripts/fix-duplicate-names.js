/**
 * Fix duplicate names caused by registration bug.
 * When a user registered with only a first name (e.g. "yossef"),
 * the bug set last_name = first_name, resulting in "yossef yossef".
 * This script sets last_name = '' for all affected users.
 */

const { query, closePool } = require('../config/database');

async function fixDuplicateNames() {
  try {
    // Preview affected users
    const affected = await query(
      `SELECT id, first_name, last_name, email
       FROM users
       WHERE first_name = last_name AND last_name != ''`
    );

    console.log(`Found ${affected.length} affected user(s):`);
    affected.forEach(u =>
      console.log(`  id=${u.id} | "${u.first_name} ${u.last_name}" | ${u.email}`)
    );

    if (affected.length === 0) {
      console.log('Nothing to fix.');
      return;
    }

    // Apply fix
    const result = await query(
      `UPDATE users
       SET last_name = ''
       WHERE first_name = last_name AND last_name != ''`
    );

    console.log(`\nFixed ${result.affectedRows} user(s). last_name set to ''.`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

fixDuplicateNames();
