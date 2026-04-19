// backend/scripts/runMigrations.js
// Run: node scripts/runMigrations.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const migrations = [
  'add_recruitment.sql',
  'add_location_to_listings.sql',
  'fix_experience_enum.sql',
  'fix_service_type_varchar.sql',
];

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('✅ Connected to DB');

  for (const file of migrations) {
    const filePath = path.join(__dirname, '../migrations', file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Not found, skipping: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await conn.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      console.error(`❌ ${file}: ${err.message}`);
    }
  }

  await conn.end();
  console.log('Done.');
}

run().catch(console.error);
