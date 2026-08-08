// Critères identiques à ProfileCompletionCard.jsx (frontend) :
// photo, galerie, expérience, description, langues — chacun pèse 20%.
// Un profil à 100% passe automatiquement en verification_status='verified',
// sans validation manuelle par l'admin.

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
  } catch {
    return {};
  }
}

function isProfileComplete({ profile_image, profile_images, service_details }) {
  const details = parseJsonObject(service_details);

  const hasPhoto = !!profile_image;
  const hasGallery = parseJsonArray(profile_images).length > 0;
  const hasExperience = Number(details.experience_years) > 0;
  const hasDescription = !!(details.description || '').trim();
  const hasLanguages = parseJsonArray(details.languages).length > 0;

  return hasPhoto && hasGallery && hasExperience && hasDescription && hasLanguages;
}

// runQuery: (sql, params) => Promise<rows[]> — compatible avec query() du pool
// ou avec un adaptateur autour de connection.execute() dans une transaction.
async function autoVerifyProviderIfComplete(runQuery, whereSql, whereParams) {
  const rows = await runQuery(
    `SELECT id, profile_image, profile_images, service_details, verification_status
     FROM service_providers WHERE ${whereSql}`,
    whereParams
  );

  const provider = rows[0];
  if (!provider || provider.verification_status !== 'pending') return false;
  if (!isProfileComplete(provider)) return false;

  await runQuery(
    `UPDATE service_providers SET verification_status = 'verified' WHERE id = ?`,
    [provider.id]
  );
  return true;
}

module.exports = { isProfileComplete, autoVerifyProviderIfComplete };
