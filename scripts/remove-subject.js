// Retire une valeur de service_details.subjects d'un prestataire.
// Usage : node remove-subject.js <providerId> <valeur-en-base64> [--yes]   (sans --yes : apercu seulement)
const pool = require('/app/config/database');
const db = pool.pool || pool;
const id = Number(process.argv[2]); const val = process.argv[3] ? Buffer.from(process.argv[3], "base64").toString("utf8") : ""; const yes = process.argv.includes('--yes');
if (!id || !val) { console.log('Usage: node remove-subject.js <providerId> "<valeur>" [--yes]'); process.exit(1); }
(async () => {
  const [[p]] = await db.query('SELECT id, service_type, service_details FROM service_providers WHERE id = ?', [id]);
  if (!p) { console.log('Fiche introuvable'); process.exit(0); }
  const d = typeof p.service_details === 'string' ? JSON.parse(p.service_details) : (p.service_details || {});
  const subjects = Array.isArray(d.subjects) ? d.subjects : [];
  console.log(`Fiche ${p.id} [${p.service_type}] subjects actuels :`, JSON.stringify(subjects));
  if (!subjects.includes(val)) { console.log('Valeur absente, rien a faire.'); process.exit(0); }
  const next = subjects.filter(s => s !== val);
  console.log('Apres suppression :', JSON.stringify(next));
  if (!yes) { console.log('APERCU seulement (ajoute -Apply pour appliquer).'); process.exit(0); }
  d.subjects = next;
  await db.query('UPDATE service_providers SET service_details = ? WHERE id = ?', [JSON.stringify(d), id]);
  console.log('OK, mis a jour.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
