// Critères identiques à ProfileCompletionCard.jsx (frontend) :
// photo, galerie, expérience, description, langues — chacun pèse 20%.
// Exception : pour les services de GALLERY_OPTIONAL_SERVICES la galerie n'est pas
// requise (4 critères restants, 25% chacun).
const GALLERY_OPTIONAL_SERVICES = ['babysitting', 'property_management', 'doula', 'tutoring', 'art_therapy', 'eldercare', 'kinesiology', 'accountant', 'osteopath'];
// Un profil à 100% passe automatiquement en verification_status='verified',
// sans validation manuelle par l'admin.
//
// 6ᵉ critère « tarifs » : au moins une ligne de prix (hors titre) dans provider_pricing,
// exigé pour tous les services SAUF ceux ci-dessous (chantiers sur devis, prix non
// affichables). Doit rester aligné avec src/utils/pricingRequirement.js (frontend).
const PRICING_NOT_REQUIRED_SERVICES = ['contractor', 'waterproofing', 'aluminum', 'glass_works', 'metalwork', 'carpentry'];

function isPricingRequired(serviceType) {
  return !PRICING_NOT_REQUIRED_SERVICES.includes(serviceType);
}

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

// hasPricing : undefined => critère tarifs ignoré (anciens appelants / scripts).
function isProfileComplete({ profile_image, profile_images, service_details, service_type, experience_years }, hasPricing) {
  const details = parseJsonObject(service_details);

  const hasPhoto = !!profile_image;
  const hasGallery = GALLERY_OPTIONAL_SERVICES.includes(service_type) || parseJsonArray(profile_images).length > 0;
  // À l'inscription, l'expérience est stockée dans la colonne experience_years et sous la clé `experience`
  // du JSON ; depuis le dashboard, sous service_details.experience_years. On accepte les trois.
  const hasExperience = Number(details.experience_years) > 0 || Number(details.experience) > 0 || Number(experience_years) > 0;
  const hasDescription = !!(details.description || '').trim();
  const hasLanguages = parseJsonArray(details.languages).length > 0;

  const pricingOk = hasPricing === undefined || !isPricingRequired(service_type) || hasPricing === true;

  return hasPhoto && hasGallery && hasExperience && hasDescription && hasLanguages && pricingOk;
}

// runQuery: (sql, params) => Promise<rows[]> — compatible avec query() du pool
// ou avec un adaptateur autour de connection.execute() dans une transaction.
// DÉSACTIVÉ (2026-11-15) : la validation est désormais 100% manuelle. L'admin contacte
// lui-même le prestataire (avis d'anciens clients, factures) puis approuve via le lien du
// mail d'inscription (POST /api/auth/verify-provider/:token). Mettre à true pour réactiver.
const AUTO_VERIFY_ENABLED = false;

async function autoVerifyProviderIfComplete(runQuery, whereSql, whereParams) {
  if (!AUTO_VERIFY_ENABLED) return false;
  const rows = await runQuery(
    `SELECT id, service_type, profile_image, profile_images, service_details, experience_years, verification_status
     FROM service_providers WHERE ${whereSql}`,
    whereParams
  );

  const provider = rows[0];
  if (!provider || provider.verification_status !== 'pending') return false;
  let hasPricing = true;
  if (isPricingRequired(provider.service_type)) {
    const priceRows = await runQuery(
      'SELECT COUNT(*) AS n FROM provider_pricing WHERE provider_id = ? AND is_title = 0',
      [provider.id]
    );
    hasPricing = Number(priceRows[0]?.n) > 0;
  }
  if (!isProfileComplete(provider, hasPricing)) return false;

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

module.exports = { isProfileComplete, autoVerifyProviderIfComplete, isPricingRequired, PRICING_NOT_REQUIRED_SERVICES };
