// Migration: ajoute les 6 services de la catégorie "Sécurité, réseaux & maison intelligente"
// aux colonnes service_type de type ENUM + une ligne par service dans `services`.
// Sans cela, l'inscription échoue avec "Data truncated for column 'service_type'".
// Idempotent : ne touche que les ENUM qui n'ont pas encore la valeur. Option --dry = apercu.
// Lancement en prod : voir la procédure flyctl ssh (base64) — le chemin /app/config/database
// est celui de l'image Fly.
// En local : DB_MODULE=../config/database (par défaut le chemin de l'image Fly)
const { query } = require(process.env.DB_MODULE || '/app/config/database');
const DRY = process.argv.includes('--dry');

const SERVICES = [
  { key: 'security_cameras', he: 'מצלמות אבטחה', en: 'Security Cameras', dhe: 'התקנה ותחזוקה של מצלמות אבטחה לבית ולעסק', den: 'Installation and maintenance of security cameras for homes and businesses', icon: '📹' },
  { key: 'security_alarms', he: 'מערכות אזעקה', en: 'Security Alarms', dhe: 'התקנה ותחזוקה של מערכות אזעקה', den: 'Installation and maintenance of alarm systems', icon: '🚨' },
  { key: 'intercom_access', he: 'אינטרקום ובקרת כניסה', en: 'Intercoms & Access Control', dhe: 'התקנת אינטרקום, בקרת כניסה ומנעולים חשמליים', den: 'Installation of intercoms, access control and electric locks', icon: '🔔' },
  { key: 'networking', he: 'רשתות תקשורת וכבילה', en: 'Networking & Cabling', dhe: 'התקנת רשתות תקשורת, כבילה וציוד Wi-Fi', den: 'Installation of networks, cabling and Wi-Fi equipment', icon: '🌐' },
  { key: 'audio_systems', he: 'מערכות שמע וסאונד', en: 'Audio & Sound Systems', dhe: 'התקנת מערכות שמע לבית ולעסק', den: 'Installation of audio systems for homes and businesses', icon: '🔊' },
  { key: 'smart_home', he: 'בית חכם ואוטומציה', en: 'Smart Home & Automation', dhe: 'התקנת מערכות בית חכם ואוטומציה', den: 'Installation of smart home and automation systems', icon: '🏠' },
];

(async () => {
  try {
    const cols = await query(
      `SELECT TABLE_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'service_type'`
    );
    for (const c of cols) {
      const type = c.COLUMN_TYPE;
      if (!/^enum\(/i.test(type)) { console.log(`- ${c.TABLE_NAME}: ${type} (pas un ENUM, rien a faire)`); continue; }
      const missing = SERVICES.filter(s => !type.includes(`'${s.key}'`));
      if (missing.length === 0) { console.log(`- ${c.TABLE_NAME}: valeurs deja presentes`); continue; }
      const newType = type.replace(/\)$/, missing.map(s => `,'${s.key}'`).join('') + ')');
      const nullSql = c.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
      const defSql = c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined
        ? `DEFAULT '${String(c.COLUMN_DEFAULT).replace(/'/g, "''")}'` : '';
      const sql = `ALTER TABLE \`${c.TABLE_NAME}\` MODIFY COLUMN service_type ${newType} ${nullSql} ${defSql}`;
      console.log(`> ${DRY ? '[DRY] ' : ''}${sql}`);
      if (!DRY) await query(sql);
    }

    for (const s of SERVICES) {
      console.log(`> ${DRY ? '[DRY] ' : ''}INSERT IGNORE services ${s.key}`);
      if (!DRY) {
        await query(
          `INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
           VALUES (?, ?, ?, ?, ?, ?, 199.00)`,
          [s.key, s.he, s.en, s.dhe, s.den, s.icon]
        );
      }
    }
    console.log('Termine.');
    process.exit(0);
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exit(1);
  }
})();
