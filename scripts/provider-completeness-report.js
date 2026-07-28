// Run on the Fly.io backend machine: node scripts/provider-completeness-report.js
// Prints a CSV to stdout listing every provider profile and what's missing
// (language, years of experience, profile photo, work gallery photos, reviews, pricing grid).
const mysql = require('mysql2/promise');

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const jsonArrayLength = (raw) => {
  if (!raw) return 0;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const SERVICE_LABELS = {
  babysitting: 'Babysitting',
  cleaning: 'Ménage',
  gardening: 'Jardinage',
  petcare: 'Animaux',
  tutoring: 'Cours particuliers',
  eldercare: 'Aide aux seniors',
};

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const [rows] = await conn.query(`
    SELECT
      sp.id AS provider_id,
      u.id AS user_id,
      CONCAT(u.first_name, ' ', u.last_name) AS name,
      u.email,
      u.phone,
      sp.service_type,
      sp.is_active,
      sp.verification_status,
      sp.experience_years,
      sp.languages,
      sp.profile_images,
      COALESCE(NULLIF(sp.profile_image, ''), NULLIF(u.profile_image, '')) AS photo,
      sp.average_rating,
      sp.created_at,
      (SELECT COUNT(*) FROM reviews r WHERE r.provider_id = sp.id AND r.is_published = 1) AS review_count,
      (SELECT COUNT(*) FROM provider_pricing pp WHERE pp.provider_id = sp.id) AS pricing_count,
      (SELECT GROUP_CONCAT(DISTINCT sp2.service_type SEPARATOR ', ')
         FROM service_providers sp2
        WHERE sp2.user_id = sp.user_id AND sp2.id != sp.id) AS other_services
    FROM service_providers sp
    JOIN users u ON u.id = sp.user_id
    ORDER BY sp.created_at DESC
  `);

  await conn.end();

  const header = [
    'ID', 'Nom', 'Email', 'Telephone', 'Service principal', 'Autres services',
    'Actif', 'Verification', 'Note moyenne', 'Nb avis',
    'Annees experience', 'Langues renseignees', 'Photo de profil', 'Nb photos travaux', 'Nb prix renseignes',
    'Score manquant (/6)', 'Ce qui manque', 'Date inscription',
  ];

  const lines = [header.map(csvEscape).join(',')];

  for (const row of rows) {
    const missing = [];
    if (jsonArrayLength(row.languages) === 0) missing.push('langue');
    if (!row.experience_years || row.experience_years === 0) missing.push('experience');
    if (!row.photo) missing.push('photo profil');
    const galleryCount = jsonArrayLength(row.profile_images);
    if (galleryCount === 0) missing.push('photos travaux');
    if (!row.review_count || row.review_count === 0) missing.push('avis/notes');
    if (!row.pricing_count || row.pricing_count === 0) missing.push('prix');

    const line = [
      row.provider_id,
      row.name,
      row.email,
      row.phone || '',
      SERVICE_LABELS[row.service_type] || row.service_type,
      row.other_services
        ? row.other_services.split(',').map((s) => SERVICE_LABELS[s.trim()] || s.trim()).join(', ')
        : '',
      row.is_active ? 'oui' : 'non',
      row.verification_status,
      row.average_rating ?? '',
      row.review_count || 0,
      row.experience_years || 0,
      jsonArrayLength(row.languages),
      row.photo ? 'oui' : 'non',
      galleryCount,
      row.pricing_count || 0,
      missing.length,
      missing.join(' | '),
      row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    ];
    lines.push(line.map(csvEscape).join(','));
  }

  process.stdout.write('===CSV_START===\n');
  process.stdout.write(lines.join('\n'));
  process.stdout.write('\n===CSV_END===\n');
}

run().catch((e) => {
  console.error('ERR:', e.message);
  process.exit(1);
});
