// backend/migrate-fix.cjs — run from repo root: node backend/migrate-fix.cjs
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  console.log('Connected to DB:', process.env.DB_HOST);

  // 1. Pending email tokens for provider_id=175 or 94
  console.log('\n--- Pending review tokens for Noam (provider_id 175 or 94) ---');
  const [tokens] = await conn.query(`
    SELECT id, email, provider_id, service_type, reviewer_name,
           verification_code, expires_at, used_at, created_at
    FROM review_email_tokens
    WHERE provider_id IN (175, 94)
    ORDER BY created_at DESC
  `);
  if (tokens.length === 0) console.log('None.');
  else tokens.forEach(t => console.log(
    ' id=' + t.id + ' email=' + t.email + ' reviewer=' + t.reviewer_name +
    ' provider_id=' + t.provider_id + ' used_at=' + t.used_at +
    ' expires=' + t.expires_at
  ));

  // 2. ALL pending tokens (any provider) created in last 7 days
  console.log('\n--- All pending tokens last 7 days ---');
  const [allTokens] = await conn.query(`
    SELECT id, email, provider_id, reviewer_name, used_at, expires_at, created_at
    FROM review_email_tokens
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    ORDER BY created_at DESC
  `);
  if (allTokens.length === 0) console.log('None.');
  else allTokens.forEach(t => console.log(
    ' id=' + t.id + ' provider_id=' + t.provider_id +
    ' reviewer=' + t.reviewer_name + ' email=' + t.email +
    ' used=' + (t.used_at ? 'YES' : 'NO') + ' expires=' + t.expires_at
  ));

  // 3. Any reviews stored at provider 310 that mention Noam
  console.log('\n--- Any remaining reviews at provider 310 ---');
  const [at310] = await conn.query(`
    SELECT id, reviewer_name, rating, LEFT(comment,100) as preview
    FROM reviews WHERE provider_id = 310
  `);
  if (at310.length === 0) console.log('None.');
  else at310.forEach(r => console.log(' id=' + r.id + ' reviewer=' + r.reviewer_name + ' | ' + r.preview));

  await conn.end();
  console.log('\nDone.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
