const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3307,
    user: 'root', password: 'rootpassword',
    database: 'homesherut_db', charset: 'utf8mb4'
  });

  const [[{ sid }]] = await conn.execute(
    "SELECT id AS sid FROM services WHERE service_key = 'sports_activities'"
  );

  await conn.execute(
    "UPDATE service_subcategories SET icon = ? WHERE display_order = 55 AND service_id = ?",
    ['🎨', sid]
  );
  await conn.execute(
    "UPDATE service_subcategories SET icon = ? WHERE display_order = 56 AND service_id = ?",
    ['🎂', sid]
  );

  const [rows] = await conn.execute(
    'SELECT display_order, name_he, icon FROM service_subcategories WHERE display_order IN (55, 56) AND service_id = ?',
    [sid]
  );
  console.log('✅ Done:', rows);
  await conn.end();
})().catch(err => { console.error('❌', err.message); process.exit(1); });
