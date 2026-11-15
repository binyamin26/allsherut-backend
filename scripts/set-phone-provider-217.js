// Remplace users.phone du prestataire service_providers.id = 217 par 0548961675.
// whatsapp_phone n'est pas touche.
//   node scripts/set-phone-provider-217.js --dry | (sans --dry = ecriture)
const { query, closePool } = require('../config/database');
const PROVIDER_ID = 217;
const NEW_PHONE = '0548961675';
const DRY = process.argv.includes('--dry');

(async () => {
  try {
    const rows = await query(
      `SELECT sp.id AS provider_id, sp.service_type, u.id AS user_id, u.first_name, u.last_name, u.phone, u.whatsapp_phone
         FROM service_providers sp JOIN users u ON u.id = sp.user_id WHERE sp.id = ?`, [PROVIDER_ID]);
    if (rows.length !== 1) { console.log('Fiche ' + PROVIDER_ID + ' introuvable : rien modifie.'); return; }
    const r = rows[0];
    console.log('Avant :', JSON.stringify(r));
    const others = await query('SELECT id FROM service_providers WHERE user_id = ? AND id <> ?', [r.user_id, PROVIDER_ID]);
    console.log('Autres fiches du meme compte (partagent ce numero) :', JSON.stringify(others));
    if (DRY) { console.log('--dry : rien ecrit. ' + r.phone + ' -> ' + NEW_PHONE); return; }
    await query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [NEW_PHONE, r.user_id]);
    const after = await query('SELECT id, phone, whatsapp_phone FROM users WHERE id = ?', [r.user_id]);
    console.log('OK - apres :', JSON.stringify(after[0]));
  } catch (e) { console.error('Erreur :', e.message); process.exitCode = 1; }
  finally { await closePool(); }
})();
