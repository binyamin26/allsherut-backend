/**
 * One-off: create an admin-only account (no provider listing, not visible on the site).
 * Used to open /admin/stats. Login works from the normal login form.
 *
 * USAGE (inside the Fly container, so it uses the prod DB config):
 *
 *   node scripts/create-admin.js --email=moi@exemple.com --password="MonMotDePasse8+" --yes
 *
 * Without --yes it only checks and prints what it would do.
 * Refuses if the email already exists (never touches an existing account).
 * The email must also be listed in ADMIN_EMAILS, OR keep role=admin (set here).
 */
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

const arg = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

(async () => {
  const email = (arg('email') || '').toLowerCase().trim();
  const password = arg('password') || '';
  const apply = process.argv.includes('--yes');

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('--email invalide');
  if (password.length < 8) throw new Error('--password : 8 caractères minimum');

  const existing = await query('SELECT id, role FROM users WHERE email = ?', [email]);
  if (existing.length) {
    console.log(`❌ Un compte existe déjà avec cet email (id=${existing[0].id}, role=${existing[0].role}). Rien modifié.`);
    return;
  }

  if (!apply) {
    console.log(`DRY-RUN : créerait un compte admin pour ${email}. Ajoute --yes pour appliquer.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO users (email, password, first_name, last_name, role, is_active, email_verified)
     VALUES (?, ?, 'Admin', 'AllSherut', 'admin', TRUE, TRUE)`,
    [email, hash]
  );
  const rows = await query('SELECT id, email, role FROM users WHERE email = ?', [email]);
  console.log('✅ Compte admin créé :', rows[0]);
})()
  .catch((e) => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(() => pool && pool.end && pool.end().catch(() => {}));
