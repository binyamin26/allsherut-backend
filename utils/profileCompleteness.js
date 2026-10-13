// Critères identiques à ProfileCompletionCard.jsx (frontend) :
// photo, galerie, expérience, description, langues — chacun pèse 20%.
// Exception : pour les services de GALLERY_OPTIONAL_SERVICES la galerie n'est pas
// requise (4 critères restants, 25% chacun).
const GALLERY_OPTIONAL_SERVICES = ['babysitting', 'property_management', 'doula'];
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

function isProfileComplete({ profile_image, profile_images, service_details, service_type }) {
  const details = parseJsonObject(service_details);

  const hasPhoto = !!profile_image;
  const hasGallery = GALLERY_OPTIONAL_SERVICES.includes(service_type) || parseJsonArray(profile_images).length > 0;
  const hasExperience = Number(details.experience_years) > 0;
  const hasDescription = !!(details.description || '').trim();
  const hasLanguages = parseJsonArray(details.languages).length > 0;

  return hasPhoto && hasGallery && hasExperience && hasDescription && hasLanguages;
}

// runQuery: (sql, params) => Promise<rows[]> — compatible avec query() du pool
// ou avec un adaptateur autour de connection.execute() dans une transaction.
async function autoVerifyProviderIfComplete(runQuery, whereSql, whereParams) {
  const rows = await runQuery(
    `SELECT id, service_type, profile_image, profile_images, service_details, verification_status
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

  // Le profil vient d'atteindre 100% (transition pending -> verified, une seule
  // fois). Notifie l'admin par email. On lit les infos maintenant, pendant que
  // la connexion/transaction est encore ouverte, puis on envoie en
  // fire-and-forget : ça ne doit jamais bloquer ni faire échouer la MAJ profil.
  try {
    const infoRows = await runQuery(
      `SELECT sp.service_type, u.first_name, u.last_name, u.email, u.phone
       FROM service_providers sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?`,
      [provider.id]
    );
    const info = infoRows[0];
    if (info) {
      const payload = {
        name: `${info.first_name || ''} ${info.last_name || ''}`.trim(),
        phone: info.phone,
        email: info.email,
        serviceType: info.service_type
      };
      require('../services/emailService')
        .sendProfileCompletedNotificationEmail(payload)
        .catch((err) => console.error('[autoVerifyProviderIfComplete] Échec email 100%:', err.message));
    }
  } catch (err) {
    console.error('[autoVerifyProviderIfComplete] Lecture infos notif 100% échouée:', err.message);
  }

  return true;
}

module.exports = { isProfileComplete, autoVerifyProviderIfComplete };
