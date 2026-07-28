const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });
  const sqls = [
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS quality_rating TINYINT NULL',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS price_rating TINYINT NULL',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS availability_rating TINYINT NULL',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS professionalism_rating TINYINT NULL',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS legacy_rating_converted BOOLEAN NOT NULL DEFAULT FALSE',
    "CREATE TABLE IF NOT EXISTS contact_clicks (id INT PRIMARY KEY AUTO_INCREMENT, provider_id INT NOT NULL, click_type ENUM('call','whatsapp') NOT NULL, clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_provider_id (provider_id), INDEX idx_clicked_at (clicked_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    "CREATE TABLE IF NOT EXISTS provider_responses (id INT PRIMARY KEY AUTO_INCREMENT, review_id INT NOT NULL, provider_user_id INT NOT NULL, response_text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY unique_review_response (review_id), INDEX idx_provider_user_id (provider_user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  ];
  for (const sql of sqls) {
    try {
      await conn.execute(sql);
      console.log('OK:', sql.substring(0, 70));
    } catch(e) {
      console.log('ERR:', e.message.substring(0, 120));
    }
  }
  await conn.end();
  console.log('Migration complete!');
  process.exit(0);
})();
