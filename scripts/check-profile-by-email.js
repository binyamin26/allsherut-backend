// LECTURE SEULE : ce qui manque au(x) profil(s) d'un email. Criteres = utils/profileCompleteness.js
const pool = require('/app/config/database');
const db = pool.pool || pool;
const EMAIL = (process.argv[2] || '').trim().toLowerCase();
if (!EMAIL) { console.log('Usage: node check-profile-by-email.js <email>'); process.exit(1); }
const GALLERY_OPTIONAL = ['babysitting', 'property_management', 'doula', 'tutoring', 'art_therapy', 'eldercare'];
const arr = (v) => { if (!v) return []; if (Array.isArray(v)) return v; try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } };
const obj = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; } };
(async () => {
  const [users] = await db.query('SELECT id, first_name, last_name, phone, email FROM users WHERE LOWER(TRIM(email)) = ?', [EMAIL]);
  if (!users.length) { console.log('AUCUN utilisateur avec cet email'); process.exit(0); }
  for (const u of users) {
    console.log(`### ${u.first_name || ''} ${u.last_name || ''} (user ${u.id}, ${u.email}, ${u.phone})`);
    const [provs] = await db.query('SELECT id, service_type, profile_image, profile_images, service_details, experience_years, verification_status, created_at FROM service_providers WHERE user_id = ?', [u.id]);
    if (!provs.length) console.log('  Aucune fiche prestataire creee');
    for (const p of provs) {
      const d = obj(p.service_details);
      const missing = [];
      if (!p.profile_image) missing.push('photo de profil');
      if (!GALLERY_OPTIONAL.includes(p.service_type) && arr(p.profile_images).length === 0) missing.push('galerie photos');
      if (!(Number(d.experience_years) > 0 || Number(d.experience) > 0 || Number(p.experience_years) > 0)) missing.push("annees d'experience");
      if (!(d.description || '').trim()) missing.push('description');
      if (arr(d.languages).length === 0) missing.push('langues');
      const [[pr]] = await db.query('SELECT COUNT(*) n FROM provider_pricing WHERE provider_id = ? AND is_title = 0', [p.id]);
      const [[rv]] = await db.query('SELECT COUNT(*) n FROM reviews WHERE provider_id = ?', [p.id]).catch(() => [[{ n: '?' }]]);
      console.log(`  Fiche ${p.id} [${p.service_type}] statut=${p.verification_status} -> ${missing.length ? 'MANQUE : ' + missing.join(', ') : 'COMPLET'}`);
      console.log(`  galerie=${arr(p.profile_images).length} photo(s), exp=${d.experience_years}, langues=${JSON.stringify(arr(d.languages))}, prix=${pr.n} ligne(s), avis=${rv.n}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
