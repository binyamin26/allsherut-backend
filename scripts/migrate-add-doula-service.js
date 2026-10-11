// Migration: ajoute 'doula' aux colonnes service_type de type ENUM + ligne dans `services`.
// Cause du bug d'inscription : "Data truncated for column 'service_type'" (doula absent des ENUM).
// Idempotent : ne touche que les ENUM qui n'ont pas encore 'doula'. Option --dry = apercu.
const { query } = require('/app/config/database');
const DRY = process.argv.includes('--dry');

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
      if (type.includes("'doula'")) { console.log(`- ${c.TABLE_NAME}: doula deja present`); continue; }
      const newType = type.replace(/\)$/, ",'doula')");
      const nullSql = c.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
      const defSql = c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined
        ? `DEFAULT '${String(c.COLUMN_DEFAULT).replace(/'/g, "''")}'` : '';
      const sql = `ALTER TABLE \`${c.TABLE_NAME}\` MODIFY COLUMN service_type ${newType} ${nullSql} ${defSql}`;
      console.log(`> ${DRY ? '[DRY] ' : ''}${sql}`);
      if (!DRY) await query(sql);
    }

    const sql = `INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
      VALUES ('doula', 'דולה', 'Doula', 'ליווי והעצמה של נשים לפני, במהלך ואחרי הלידה', 'Support and guidance for women before, during and after childbirth', '🤱', 199.00)`;
    console.log(`> ${DRY ? '[DRY] ' : ''}INSERT IGNORE services doula`);
    if (!DRY) await query(sql);
    console.log('Termine.');
    process.exit(0);
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exit(1);
  }
})();
