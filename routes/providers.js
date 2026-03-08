// routes/providers.js - Complètement refactorisé avec ErrorHandler et Messages unifiés
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS, getServiceLabel } = require('../constants/messages');
const ResponseHelper = require('../utils/responseHelper');

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Parser JSON sécurisé pour les données complexes des providers
 * @param {string|object} jsonString - Données à parser
 * @returns {object|array|null} Données parsées ou null si erreur
 */
const safeJsonParse = (jsonString) => {
  if (!jsonString) return null;
  
  try {
    // Si c'est déjà un objet/array, le retourner
    if (typeof jsonString === 'object') return jsonString;
    
    // Tenter de parser comme JSON valide
    if (typeof jsonString === 'string' && (jsonString.startsWith('[') || jsonString.startsWith('{'))) {
      return JSON.parse(jsonString);
    }
    
    // Si c'est une chaîne simple, traiter comme liste séparée par virgules
    if (typeof jsonString === 'string') {
      const cleanStr = jsonString.replace(/[\[\]"']/g, '').trim();
      if (cleanStr.includes(',')) {
        return cleanStr.split(',').map(item => item.trim()).filter(item => item);
      }
      return cleanStr ? [cleanStr] : null;
    }
    
    return null;
  } catch (error) {
    console.error(DEV_LOGS.DATABASE.PARSE_ERROR, 'JSON parse failed:', jsonString, error.message);
    return null;
  }
};

/**
 * Valider l'ID d'un provider
 * @param {string} id - ID à valider
 * @returns {number|null} ID validé ou null si invalide
 */
const validateProviderId = (id) => {
  // Gérer les IDs préfixés (eldercare-18 -> 18)
  let actualId = id;
  if (typeof id === 'string' && id.includes('-')) {
    actualId = id.split('-')[1];
  }
  
  const parsedId = parseInt(actualId);
  if (isNaN(parsedId) || parsedId <= 0) {
    return null;
  }
  return parsedId;
};

// =============================================
// ROUTES DE DEBUG (développement uniquement)
// =============================================

/**
 * GET /api/providers/debug/tables
 * Vérification de l'état des tables de la base de données
 * @desc Diagnostic des tables providers pour debugging
 * @access Public (dev only)
 */
router.get('/debug/tables', async (req, res) => {
  try {
    // Bloquer en production pour sécurité
    if (process.env.NODE_ENV === 'production') {
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('resource');
      return res.status(statusCode).json(errorResponse);
    }

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'providers/debug/tables');

    const tests = {};
    
    // Test 1: service_provider_details
    try {
      const detailsTest = await query('SELECT COUNT(*) as count FROM service_provider_details');
      tests.service_provider_details = { 
        exists: true, 
        count: detailsTest[0].count,
        status: 'OK'
      };
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `service_provider_details: ${detailsTest[0].count} records`);
    } catch (error) {
      tests.service_provider_details = { 
        exists: false, 
        error: error.message,
        status: 'ERROR'
      };
      console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'service_provider_details:', error.message);
    }
    
    // Test 2: provider_working_areas  
    try {
      const areasTest = await query('SELECT COUNT(*) as count FROM provider_working_areas');
      tests.provider_working_areas = { 
        exists: true, 
        count: areasTest[0].count,
        status: 'OK'
      };
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `provider_working_areas: ${areasTest[0].count} records`);
    } catch (error) {
      tests.provider_working_areas = { 
        exists: false, 
        error: error.message,
        status: 'ERROR'
      };
      console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'provider_working_areas:', error.message);
    }
    
    // Test 3: service_providers
    try {
      const providersTest = await query('SELECT COUNT(*) as count FROM service_providers WHERE is_active = TRUE');
      tests.service_providers = { 
        exists: true, 
        count: providersTest[0].count,
        status: 'OK'
      };
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `service_providers active: ${providersTest[0].count} records`);
    } catch (error) {
      tests.service_providers = { 
        exists: false, 
        error: error.message,
        status: 'ERROR'
      };
      console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'service_providers:', error.message);
    }
    
    // Test 4: reviews
    try {
      const reviewsTest = await query('SELECT COUNT(*) as count FROM reviews WHERE is_published = TRUE');
      tests.reviews = { 
        exists: true, 
        count: reviewsTest[0].count,
        status: 'OK'
      };
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `reviews published: ${reviewsTest[0].count} records`);
    } catch (error) {
      tests.reviews = { 
        exists: false, 
        error: error.message,
        status: 'ERROR'
      };
      console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'reviews:', error.message);
    }
    
    console.log(DEV_LOGS.API.RESPONSE_SENT, 'Database tables diagnostic completed');

    res.success(MESSAGES.SUCCESS.SYSTEM.DATABASE_CHECK_COMPLETED, { 
      tests,
      summary: {
        totalTables: Object.keys(tests).length,
        healthyTables: Object.values(tests).filter(t => t.status === 'OK').length,
        errorTables: Object.values(tests).filter(t => t.status === 'ERROR').length
      }
    });
    
  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Tables debug check failed:', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/providers/debug/structure
 * Inspection de la structure des tables providers
 * @desc Structure détaillée des tables pour debugging
 * @access Public (dev only)
 */
router.get('/debug/structure', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('resource');
      return res.status(statusCode).json(errorResponse);
    }

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'providers/debug/structure');

    // Structure des tables
    const areasStructure = await query('DESCRIBE provider_working_areas');
    const detailsStructure = await query('DESCRIBE service_provider_details');
    const providersStructure = await query('DESCRIBE service_providers');
    
    // Échantillons de données
    const sampleAreas = await query('SELECT * FROM provider_working_areas LIMIT 3');
    const sampleDetails = await query('SELECT * FROM service_provider_details LIMIT 1');
    const sampleProviders = await query('SELECT * FROM service_providers WHERE is_active = TRUE LIMIT 2');
    
    console.log(DEV_LOGS.API.RESPONSE_SENT, 'Database structure analysis completed');

    res.success(MESSAGES.SUCCESS.SYSTEM.DATABASE_STRUCTURE_LOADED, {
      structures: {
        provider_working_areas: areasStructure,
        service_provider_details: detailsStructure,
        service_providers: providersStructure
      },
      samples: {
        areas: sampleAreas,
        details: sampleDetails,
        providers: sampleProviders.map(p => ({
          ...p,
          // Masquer les données sensibles même en debug
          email: p.email ? '***@***.***' : null,
          phone: p.phone ? '***-***-****' : null
        }))
      },
      analytics: {
        areasCount: sampleAreas.length,
        detailsCount: sampleDetails.length,
        providersCount: sampleProviders.length
      }
    });

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Structure debug failed:', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/providers/test/simple
 * Test simple de connectivité des routes providers
 * @desc Vérification basique du bon fonctionnement
 * @access Public
 */
router.get('/test/simple', async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'providers/test/simple');
    
    res.success(MESSAGES.SUCCESS.SYSTEM.API_OPERATIONAL, {
      service: 'Providers API HomeSherut',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      availableEndpoints: [
        'GET /api/providers/:id',
        'GET /api/providers/:id/reviews',
        'GET /api/providers/debug/tables [DEV]',
        'GET /api/providers/debug/structure [DEV]',
        'GET /api/providers/test/simple'
      ],
      status: 'operational'
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Route error:', error.message);
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// ROUTES PRINCIPALES
// =============================================

/**
 * GET /api/providers/:id/reviews
 * Récupération des avis d'un provider avec pagination
 * @desc Liste paginée des reviews publiées d'un provider
 * @access Public
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 10), 50); // Entre 1 et 50
    const offset = (page - 1) * limit;
    
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `providers/${id}/reviews`, { page, limit });
    
    // Validation de l'ID provider
    const providerId = validateProviderId(id);
    if (!providerId) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'id',
        message: MESSAGES.ERROR.VALIDATION.INVALID_ID
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Vérifier l'existence du provider
    const providerExists = await query(
      'SELECT id FROM service_providers WHERE id = ? AND is_active = TRUE',
      [providerId]
    );

    if (providerExists.length === 0) {
      console.log(DEV_LOGS.API.RESPONSE_SENT, `Provider ${providerId} not found for reviews`);
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('provider');
      return res.status(statusCode).json(errorResponse);
    }


    const reviewsQuery = `
      SELECT 
        id,
        rating,
        comment,
        title,
        created_at,
        helpful_count,
        reviewer_name,
        DATE_FORMAT(created_at, '%d/%m/%Y') as formatted_date
      FROM reviews 
      WHERE provider_id = ? 
        AND is_published = TRUE
      ORDER BY created_at DESC
    `;

    const reviews = await query(reviewsQuery, [providerId.toString()]);

    // Comptage total pour pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reviews r
      WHERE r.provider_id = ? AND r.is_published = TRUE
    `;

    const totalCount = await query(countQuery, [providerId]);
    const total = totalCount[0].total;
    const totalPages = Math.ceil(total / limit);

    console.log(DEV_LOGS.API.RESPONSE_SENT, `Found ${reviews.length}/${total} reviews for provider ${providerId}`);

    // CORRIGÉ - Formatage des reviews avec les bons champs
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      title: review.title,
      createdAt: review.created_at,
      helpfulCount: review.helpful_count || 0,
      reviewer: {
        name: review.reviewer_name,
        avatar: null // Pas d'avatar pour les reviewers anonymes
      },
      formatted_date: review.formatted_date,
      isHelpful: false // TODO: Implémenter système de helpful basé sur l'utilisateur connecté
    }));

    res.success('ביקורות נטענו בהצלחה', {
      reviews: formattedReviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      providerId: providerId
    });

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Provider reviews fetch failed:', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/providers/:id
 * Récupération complète des données d'un provider
 * @desc Profil complet du provider avec toutes ses informations
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `providers/${id}/details`);
    
    // Validation sécurisée de l'ID
    const providerId = validateProviderId(id);
    if (!providerId) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'id',
        message: MESSAGES.ERROR.VALIDATION.INVALID_ID
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `Fetching provider ${providerId} complete profile`);

    // ✅ CORRIGÉ - Requête qui cherche par user_id OU sp.id
   const providerQuery = `
  SELECT 
    -- Données de base du provider
    sp.id,
    sp.user_id,
    sp.service_type,
    sp.title,
    sp.description,
    sp.experience_years,
    sp.hourly_rate,
    sp.location_city,
    sp.location_area,
    sp.location_address,
    sp.latitude,
    sp.longitude,
    sp.is_active,
    sp.verification_status,
    sp.view_count,
    sp.contact_count,
    sp.created_at,
    sp.updated_at,
    sp.service_details,
    sp.availability,
    sp.languages,
    sp.certifications,
    
    -- ✅ COLONNES SPÉCIFIQUES BABYSITTING
    sp.availability_days,
    sp.availability_hours,
    sp.babysitting_types,
    sp.can_travel_alone,
    
    -- Données utilisateur (sécurisées)
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.premium_until,
    sp.profile_image as provider_profile_image,
    sp.profile_images as provider_gallery_images,
u.profile_image as user_profile_image,
    u.is_active as user_active,
    
    -- Statistiques reviews
    AVG(r.rating) as average_rating,
    COUNT(DISTINCT r.id) as reviews_count
    
  FROM service_providers sp
  JOIN users u ON sp.user_id = u.id
  LEFT JOIN reviews r ON sp.id = r.provider_id AND r.is_published = TRUE
  
  WHERE (sp.user_id = ? OR sp.id = ?)
    AND sp.is_active = TRUE 
    AND u.is_active = TRUE
  
  GROUP BY sp.id, u.id
`;

    const provider = await query(providerQuery, [providerId, providerId]);

    // Gestion provider non trouvé
    if (provider.length === 0) {
      console.log(DEV_LOGS.API.ERROR_OCCURRED, `Provider ${providerId} not found, inactive, or not verified`);
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('provider');
      return res.status(statusCode).json(errorResponse);
    }

    const providerData = provider[0];

    // Récupération des zones de travail avec le BON provider_id
    const workingAreasQuery = `
      SELECT 
        pwa.city,
        pwa.neighborhood
      FROM provider_working_areas pwa
      WHERE pwa.provider_id = ?
      ORDER BY pwa.city, pwa.neighborhood
    `;

    const workingAreas = await query(workingAreasQuery, [providerData.id]);

    // Parser les données JSON depuis service_details
    const parseJsonSafe = (value) => {
      if (!value || value === '' || value === 'null') return null;
      try {
        return typeof value === 'object' ? value : JSON.parse(value);
      } catch (e) {
        return null;
      }
    };

    const serviceDetailsFromJson = parseJsonSafe(providerData.service_details) || {};

    // Incrémenter les vues de manière asynchrone
    query('UPDATE service_providers SET view_count = view_count + 1 WHERE id = ?', [providerData.id])
      .catch(err => console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'View count update failed:', err.message));

    // Construction de la réponse complète
    const formattedProvider = {
      // Informations de base
      id: providerData.id,
      userId: providerData.user_id,
      name: `${providerData.first_name} ${providerData.last_name}`,
      firstName: providerData.first_name,
      lastName: providerData.last_name,
      email: providerData.email,
      phone: providerData.phone,
      verified: providerData.verification_status === 'verified',
      premium: providerData.premium_until && new Date(providerData.premium_until) > new Date(),
      
      // Service
      serviceType: providerData.service_type,
      serviceLabel: getServiceLabel(providerData.service_type),
      title: providerData.title,
      description: providerData.description,
      experienceYears: providerData.experience_years,
      hourlyRate: providerData.hourly_rate,
      
      // Localisation
      location: {
        city: providerData.location_city,
        area: providerData.location_area,
        address: providerData.location_address,
        coordinates: providerData.latitude && providerData.longitude ? {
          lat: parseFloat(providerData.latitude),
          lng: parseFloat(providerData.longitude)
        } : null
      },
      
      // Zones de travail
      workingAreas: workingAreas.map(area => ({
        city: area.city,
        neighborhood: area.neighborhood || null
      })),
      
   // ✅ NOUVEAU - Parser avec colonnes babysitting
serviceDetails: {
  // Infos de base
  experience_years: providerData.experience_years,
  hourly_rate: providerData.hourly_rate,
  description: providerData.description,
  availability: parseJsonSafe(providerData.availability) || [],
  languages: parseJsonSafe(providerData.languages) || [],
  certifications: parseJsonSafe(providerData.certifications) || [],
  
  // ✅ Colonnes spécifiques babysitting
  ...(providerData.availability_days && { availability_days: parseJsonSafe(providerData.availability_days) }),
  ...(providerData.availability_hours && { availability_hours: parseJsonSafe(providerData.availability_hours) }),
  ...(providerData.babysitting_types && { babysitting_types: parseJsonSafe(providerData.babysitting_types) }),
  ...(providerData.can_travel_alone !== null && { can_travel_alone: providerData.can_travel_alone === 1 }),
  
  // ✅ Détails spécifiques du JSON service_details
  ...serviceDetailsFromJson
},
      
      // Évaluations et réputation
      rating: {
        average: providerData.average_rating ? parseFloat(providerData.average_rating).toFixed(1) : null,
        count: parseInt(providerData.reviews_count) || 0,
        breakdown: null
      },
      
      // Statut et badges
      status: {
        isPremium: providerData.premium_until && new Date(providerData.premium_until) > new Date(),
        isVerified: providerData.verification_status === 'verified',
        verificationLevel: providerData.verification_status,
        isActive: providerData.is_active && providerData.user_active
      },
      
      // Statistiques publiques
      stats: {
        viewCount: providerData.view_count || 0,
        contactCount: providerData.contact_count || 0,
        memberSince: providerData.created_at,
        lastUpdated: providerData.updated_at,
        profileCompleteness: calculateProfileCompleteness(providerData, serviceDetailsFromJson, workingAreas)
      },
      
      // Contact
      contact: {
        phone: providerData.phone,
        hasPhone: !!providerData.phone,
        responseTime: 'לא צוין'
      },
      
      // Médias
     media: {
  profileImage: providerData.provider_profile_image || providerData.user_profile_image,
 gallery: (() => {
  const raw = providerData.provider_gallery_images;
  if (!raw) return [];
  try { return typeof raw === 'object' ? raw : JSON.parse(raw); } catch { return []; }
})()
}
    };


    console.log(DEV_LOGS.API.RESPONSE_SENT, `Provider ${providerId} complete profile loaded successfully`);

    res.success(MESSAGES.SUCCESS.SYSTEM.PROVIDER_PROFILE_LOADED, formattedProvider);

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Provider fetch failed:', error.message);
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'providers/profile', error.stack);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Calculer le pourcentage de complétude d'un profil provider
 * @param {Object} providerData - Données de base du provider
 * @param {Object} details - Détails spécifiques au service
 * @param {Array} workingAreas - Zones de travail
 * @returns {number} Pourcentage de complétude (0-100)
 */
function calculateProfileCompleteness(providerData, details, workingAreas) {
  const requiredFields = [
    'title', 'description', 'hourly_rate', 'location_city', 'experience_years'
  ];
  
  const optionalFields = [
    'location_area', 'location_address', 'profile_image'
  ];

  let completedRequired = 0;
  let completedOptional = 0;

  // Vérifier les champs requis (70% du score)
  requiredFields.forEach(field => {
    if (providerData[field] && providerData[field] !== '' && providerData[field] !== null) {
      completedRequired++;
    }
  });

  // Vérifier les champs optionnels (20% du score)
  optionalFields.forEach(field => {
    if (providerData[field] && providerData[field] !== '' && providerData[field] !== null) {
      completedOptional++;
    }
  });

  // Zones de travail (10% du score)
  const hasWorkingAreas = workingAreas && workingAreas.length > 0 ? 1 : 0;

  const requiredScore = (completedRequired / requiredFields.length) * 70;
  const optionalScore = (completedOptional / optionalFields.length) * 20;
  const areasScore = hasWorkingAreas * 10;

  return Math.round(requiredScore + optionalScore + areasScore);
}

module.exports = router;