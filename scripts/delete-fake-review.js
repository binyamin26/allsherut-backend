// Sans argument : LISTE (lecture seule) les avis recents postes avec l'email indique.
// Avec --ids=12,13 --yes : supprime ces avis (uniquement s'ils portent bien cet email) et recalcule la note du prestataire.
// Usage : node delete-fake-review.js <email> [--days=7] [--ids=1,2 --yes]
const pool = require('/app/config/database');
const db = pool.pool || pool;
const args = process.argv.slice(2);
const EMAIL = (args.find(a => !a.startsWith('--')) || '').trim().toLowerCase();
const opt = (n) => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1];
const DAYS = Number(opt('days')) || 7;
const IDS = (opt('ids') || '').split(',').map(Number).filter(Boolean);
const YES = args.includes('--yes');
if (!EMAIL) { console.log('Usage: node delete-fake-review.js <email> [--days=7] [--ids=1,2 --yes]'); process.exit(1); }
(async () => {
  const [rows] = await db.query(
    `SELECT r.id, r.provider_id, r.service_type, r.rating, r.reviewer_name, r.comment, r.created_at, u.first_name, u.last_name
     FROM reviews r LEFT JOIN service_providers sp ON sp.id = r.provider_id LEFT JOIN users u ON u.id = sp.user_id
     WHERE LOWER(TRIM(r.reviewer_email)) = ? AND r.created_at > DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY r.created_at DESC`,
    [EMAIL, DAYS]);
  if (!rows.length) { console.log(`Aucun avis avec ${EMAIL} sur les ${DAYS} derniers jours.`); process.exit(0); }
  for (const r of rows) console.log(`#${r.id} | ${r.created_at.toISOString ? r.created_at.toISOString() : r.created_at} | prestataire ${r.provider_id} (${r.first_name || ''} ${r.last_name || ''}) [${r.service_type}] | note ${r.rating} | nom "${r.reviewer_name}" | "${String(r.comment).slice(0, 80)}"`);
  if (!IDS.length || !YES) { console.log('\nAPERCU seulement. Pour supprimer : relancer avec -Ids "<id>" -Apply'); process.exit(0); }
  const targets = rows.filter(r => IDS.includes(r.id));
  for (const r of targets) {
    await db.query('DELETE FROM reviews WHERE id = ? AND LOWER(TRIM(reviewer_email)) = ?', [r.id, EMAIL]);
    const [[a]] = await db.query('SELECT AVG(rating) avg_rating, COUNT(*) n FROM reviews WHERE provider_id = ? AND is_verified = TRUE AND is_published = TRUE', [r.provider_id]);
    const avg = a.n ? Number(a.avg_rating).toFixed(1) : 0;
    await db.query('UPDATE service_providers SET average_rating = ? WHERE id = ?', [avg, r.provider_id]);
    console.log(`Supprime avis #${r.id} ; note du prestataire ${r.provider_id} recalculee = ${avg} (${a.n} avis)`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
