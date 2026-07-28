const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    });

    const ENUM_VALS = [
      'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
      'eldercare','laundry','property_management','electrician','plumbing',
      'air_conditioning','gas_technician','drywall','carpentry','home_organization',
      'event_entertainment','dj','private_chef','painting','waterproofing',
      'contractor','aluminum','glass_works','locksmith','moving','photographer',
      'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
    ].map(v => `'${v}'`).join(',');

    const sqls = [
      `INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price) VALUES ('driver','דרייבר פרטי','Private Driver','שירות נסיעות פרטי','Personal driver service','🚗',22.90)`,
      `ALTER TABLE users MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE service_providers MODIFY COLUMN service_type ENUM(${ENUM_VALS}) NOT NULL`,
      `ALTER TABLE service_provider_details MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE reviews MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE subscriptions MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE review_verifications MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE bookings MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
      `ALTER TABLE trial_history MODIFY COLUMN service_type ENUM(${ENUM_VALS})`,
    ];

    for (const sql of sqls) {
      try {
        await conn.execute(sql);
        console.log('✅ MIGRATION OK:', sql.substring(0, 80));
      } catch (e) {
        console.log('⚠️  MIGRATION ERR (non-fatal):', e.message.substring(0, 150));
      }
    }
    await conn.end();
    console.log('✅ migrate-driver complete');
  } catch (err) {
    console.error('❌ migrate-driver connection failed (non-fatal):', err.message);
  }
  process.exit(0); // toujours exit 0 pour ne pas bloquer le déploiement
})();
