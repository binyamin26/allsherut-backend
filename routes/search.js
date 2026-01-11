// routes/search.js - Backend complet avec compteur reviews DYNAMIQUE
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS, getServiceLabel } = require('../constants/messages');
const ResponseHelper = require('../utils/responseHelper');

// Middleware pour les réponses standardisées
router.use(ResponseHelper.middleware);

// Configuration des filtres avancés côté backend
const buildAdvancedFilters = (serviceType, filters) => {
  const conditions = [];
  const params = [];
  
  console.log(`[buildAdvancedFilters] Service: ${serviceType}, Filtres reçus:`, filters);

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value === '') {
      console.log(`[buildAdvancedFilters] Filtre ${key} ignoré (vide)`);
      return;
    }

    console.log(`[buildAdvancedFilters] Traitement ${key}:`, value);

    switch (key) {
      case 'ageGroups':
        const ageGroupsArray = value.split(',').map(v => v.trim());
        if (ageGroupsArray.length > 0) {
          const placeholders = ageGroupsArray.map(() => '?').join(',');
          conditions.push(`JSON_OVERLAPS(sp.availability->'$.ageGroups', JSON_ARRAY(${placeholders}))`);
          params.push(...ageGroupsArray);
          console.log(`[buildAdvancedFilters] Condition ageGroups ajoutée:`, ageGroupsArray);
        }
        break;

      case 'availability':
        const availabilityArray = value.split(',').map(v => v.trim());
        if (availabilityArray.length > 0) {
          const placeholders = availabilityArray.map(() => '?').join(',');
          conditions.push(`JSON_OVERLAPS(sp.availability->'$.timeSlots', JSON_ARRAY(${placeholders}))`);
          params.push(...availabilityArray);
          console.log(`[buildAdvancedFilters] Condition availability ajoutée:`, availabilityArray);
        }
        break;

      case 'canSleepOver':
        conditions.push(`sp.availability->>'$.canSleepOver' = ?`);
        params.push(value);
        console.log(`[buildAdvancedFilters] Condition canSleepOver ajoutée:`, value);
        break;

      case 'hasVehicle':
        conditions.push(`sp.availability->>'$.hasVehicle' = ?`);
        params.push(value);
        console.log(`[buildAdvancedFilters] Condition hasVehicle ajoutée:`, value);
        break;

    case 'religiousLevel':
  if (value && value !== '') {
    conditions.push(`sp.service_details->>'$.religiosity' = ?`);
    params.push(value);
    console.log(`[buildAdvancedFilters] Condition religiousLevel ajoutée:`, value);
  }
  break;

      case 'additionalServices':
        const servicesArray = value.split(',').map(v => v.trim());
        if (servicesArray.length > 0) {
          const placeholders = servicesArray.map(() => '?').join(',');
          conditions.push(`JSON_OVERLAPS(sp.availability->'$.additionalServices', JSON_ARRAY(${placeholders}))`);
          params.push(...servicesArray);
          console.log(`[buildAdvancedFilters] Condition additionalServices ajoutée:`, servicesArray);
        }
        break;
case 'languages':
  const languagesArray = value.split(',').map(v => v.trim());
  if (languagesArray.length > 0) {
    const placeholders = languagesArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.languages, JSON_ARRAY(${placeholders}))`);
    params.push(...languagesArray);
    console.log(`[buildAdvancedFilters] Condition languages ajoutée:`, languagesArray);
  }
  break;

  // ✅ NOUVEAUX FILTRES BABYSITTING
case 'availability_days':
  const daysArray = value.split(',').map(v => v.trim());
  if (daysArray.length > 0) {
    const placeholders = daysArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.availability_days, JSON_ARRAY(${placeholders}))`);
    params.push(...daysArray);
    console.log(`[buildAdvancedFilters] Condition availability_days ajoutée:`, daysArray);
  }
  break;

case 'availability_hours':
  const hoursArray = value.split(',').map(v => v.trim());
  if (hoursArray.length > 0) {
    const placeholders = hoursArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.availability_hours, JSON_ARRAY(${placeholders}))`);
    params.push(...hoursArray);
    console.log(`[buildAdvancedFilters] Condition availability_hours ajoutée:`, hoursArray);
  }
  break;

case 'babysitting_types':
  const typesArray = value.split(',').map(v => v.trim());
  if (typesArray.length > 0) {
    const placeholders = typesArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.babysitting_types, JSON_ARRAY(${placeholders}))`);
    params.push(...typesArray);
    console.log(`[buildAdvancedFilters] Condition babysitting_types ajoutée:`, typesArray);
  }
  break;

case 'can_travel_alone':
  const canTravelValue = value === 'yes' ? 1 : 0;
  conditions.push(`sp.can_travel_alone = ?`);
  params.push(canTravelValue);
  console.log(`[buildAdvancedFilters] Condition can_travel_alone ajoutée:`, canTravelValue);
  break;
case 'minAge':
  if (!isNaN(parseInt(value))) {
    conditions.push(`sp.service_details->>'$.age' >= ?`);
    params.push(parseInt(value));
    console.log(`[buildAdvancedFilters] Condition minAge ajoutée:`, value);
  }
  break;

case 'maxAge':
  if (!isNaN(parseInt(value))) {
    conditions.push(`sp.service_details->>'$.age' <= ?`);
    params.push(parseInt(value));
    console.log(`[buildAdvancedFilters] Condition maxAge ajoutée:`, value);
  }
  break;

case 'certifications':
  conditions.push(`sp.service_details->>'$.certifications' = ?`);
  params.push(value);
  console.log(`[buildAdvancedFilters] Condition certifications ajoutée:`, value);
  break;
  
case 'subjects':
  const subjectsArray = value.split(',').map(v => v.trim());
  if (subjectsArray.length > 0) {
    const placeholders = subjectsArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.service_details->'$.subjects', JSON_ARRAY(${placeholders}))`);
    params.push(...subjectsArray);
    console.log(`[buildAdvancedFilters] Condition subjects ajoutée:`, subjectsArray);
  }
  break;

case 'levels':
  const levelsArray = value.split(',').map(v => v.trim());
  if (levelsArray.length > 0) {
    const placeholders = levelsArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.service_details->'$.levels', JSON_ARRAY(${placeholders}))`);
    params.push(...levelsArray);
    console.log(`[buildAdvancedFilters] Condition levels ajoutée:`, levelsArray);
  }
  break;

case 'specializations':
  const specsArray = value.split(',').map(v => v.trim());
  if (specsArray.length > 0) {
    const placeholders = specsArray.map(() => '?').join(',');
    conditions.push(`JSON_OVERLAPS(sp.service_details->'$.specializations', JSON_ARRAY(${placeholders}))`);
    params.push(...specsArray);
    console.log(`[buildAdvancedFilters] Condition specializations ajoutée:`, specsArray);
  }
  break;

case 'teachingMode':
  if (value && value !== '') {
    conditions.push(`sp.service_details->>'$.teachingMode' = ?`);
    params.push(value);
    console.log(`[buildAdvancedFilters] Condition teachingMode ajoutée:`, value);
  }
  break;

case 'qualifications':
  if (value === 'yes') {
    // Provider a rempli le champ (non vide et différent de 'לא צוין')
    conditions.push(`(
      sp.service_details->>'$.qualifications' IS NOT NULL 
      AND sp.service_details->>'$.qualifications' != '' 
      AND sp.service_details->>'$.qualifications' != 'לא צוין'
    )`);
    console.log(`[buildAdvancedFilters] Condition qualifications=yes ajoutée`);
  } else if (value === 'no') {
    // Provider n'a pas rempli ou a 'לא צוין'
    conditions.push(`(
      sp.service_details->>'$.qualifications' IS NULL 
      OR sp.service_details->>'$.qualifications' = '' 
      OR sp.service_details->>'$.qualifications' = 'לא צוין'
    )`);
    console.log(`[buildAdvancedFilters] Condition qualifications=no ajoutée`);
  }
  break;

      // Filtres spécifiques cleaning
      case 'legalStatus':
        conditions.push(`sp.availability->>'$.legalStatus' = ?`);
        params.push(value);
        break;

      case 'cleaningTypes':
        const cleaningArray = value.split(',').map(v => v.trim());
        if (cleaningArray.length > 0) {
          const placeholders = cleaningArray.map(() => '?').join(',');
          conditions.push(`JSON_OVERLAPS(sp.availability->'$.cleaningTypes', JSON_ARRAY(${placeholders}))`);
          params.push(...cleaningArray);
        }
        break;

      case 'frequency':
        const frequencyArray = value.split(',').map(v => v.trim());
        if (frequencyArray.length > 0) {
          const placeholders = frequencyArray.map(() => '?').join(',');
          conditions.push(`JSON_OVERLAPS(sp.availability->'$.frequency', JSON_ARRAY(${placeholders}))`);
          params.push(...frequencyArray);
        }
        break;

      case 'materialsProvided':
        conditions.push(`sp.availability->>'$.materialsProvided' = ?`);
        params.push(value);
        break;

      // Filtres range (comme experienceYears)
      case 'experienceYears':
        if (typeof value === 'object' && value !== null) {
          if (value.min && !isNaN(value.min)) {
            conditions.push(`sp.experience_years >= ?`);
            params.push(parseInt(value.min));
          }
          if (value.max && !isNaN(value.max)) {
            conditions.push(`sp.experience_years <= ?`);
            params.push(parseInt(value.max));
          }
        }
        break;

      default:
        console.log(`[buildAdvancedFilters] Filtre non reconnu: ${key} = ${value}`);
    }
  });

  console.log(`[buildAdvancedFilters] ${conditions.length} conditions générées`);
  console.log(`[buildAdvancedFilters] Conditions SQL:`, conditions);
  console.log(`[buildAdvancedFilters] Params:`, params);

  return { conditions, params };
};

// @route   GET /api/search/providers
// @desc    Rechercher des providers avec TOUS les filtres
// @access  Public
router.get('/providers', async (req, res) => {
  try {
    const {
      service,
      city,
      neighborhood,
      minPrice,
      maxPrice,
      sortBy = 'newest',
      page = 1,
      limit = 10,
      featured,
      // Filtres génériques
      experience,
      verified,
      premium,
      // Tous les autres filtres avancés
      ...advancedFilters
    } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `search/providers`, {
      service, 
      city, 
      featured,
      filtersCount: Object.keys(advancedFilters).length
    });

    // Validation du service si fourni
    if (service) {
const validServices = ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare', 'laundry', 'property_management', 'electrician', 'plumbing','air_conditioning', 'gas_technician','gas_technician','drywall', 'carpentry', 'home_organization', 'event_entertainment', 'private_chef', 'painting', 'waterproofing', 'contractor','aluminum','glass_works', 'locksmith']; // Ajout du service 'contractor'
      if (!validServices.includes(service)) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'service',
          message: MESSAGES.ERROR.VALIDATION.INVALID_SERVICE_TYPE
        }]);
        return res.status(statusCode).json(errorResponse);
      }
    }

    // Validation des paramètres de pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Construction de la requête WHERE - CONDITIONS DE BASE
    let whereConditions = [`u.role = 'provider'`, `u.is_active = 1`, `sp.is_active = 1`];
    const params = [];

    // Application des filtres BASIQUES
    if (service) {
  whereConditions.push(`sp.service_type = ?`);
  params.push(service);
  console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Filtre service: ${service}`);
}

    if (city) {
      whereConditions.push(`sp.location_city LIKE ?`);
      params.push(`%${city}%`);
    }

    if (neighborhood) {
      whereConditions.push(`sp.location_area LIKE ?`);
      params.push(`%${neighborhood}%`);
    }

    if (minPrice && !isNaN(parseFloat(minPrice))) {
      whereConditions.push(`sp.hourly_rate >= ?`);
      params.push(parseFloat(minPrice));
    }

    if (maxPrice && !isNaN(parseFloat(maxPrice))) {
      whereConditions.push(`sp.hourly_rate <= ?`);
      params.push(parseFloat(maxPrice));
    }

    // Filtres GÉNÉRIQUES
    if (experience) {
      switch (experience) {
        case '1-2':
          whereConditions.push(`sp.experience_years BETWEEN 1 AND 2`);
          break;
        case '3-5':
          whereConditions.push(`sp.experience_years BETWEEN 3 AND 5`);
          break;
        case '6+':
          whereConditions.push(`sp.experience_years >= 6`);
          break;
        default:
          if (experience.includes('-')) {
            const [min, max] = experience.split('-');
            if (min && max) {
              whereConditions.push(`sp.experience_years BETWEEN ? AND ?`);
              params.push(parseInt(min), parseInt(max));
            }
          } else if (experience.includes('+')) {
            const min = experience.replace('+', '');
            if (min) {
              whereConditions.push(`sp.experience_years >= ?`);
              params.push(parseInt(min));
            }
          }
      }
    }

    if (verified === 'true') {
      whereConditions.push(`sp.verification_status = 'verified'`);
    }

    if (premium === 'true') {
      whereConditions.push(`u.premium_until > NOW()`);
    }

    // ✅ AJOUTER ICI - Filtre rating minimum
if (advancedFilters.minRating && !isNaN(parseInt(advancedFilters.minRating))) {
  const minRatingValue = parseInt(advancedFilters.minRating);
  whereConditions.push(`sp.average_rating >= ?`);
  params.push(minRatingValue);
  console.log(`[Filtre minRating] Ajouté: >= ${minRatingValue}`);
  // Supprimer de advancedFilters pour ne pas le traiter 2 fois
  delete advancedFilters.minRating;
}

    if (featured === 'true') {
      whereConditions.push(`sp.is_featured = 1`);
    }

    // FILTRES AVANCÉS spécifiques au service
    if (service && Object.keys(advancedFilters).length > 0) {
      console.log(DEV_LOGS.BUSINESS.FILTERS_PROCESSING || 'FILTERS', 'Application filtres avancés', advancedFilters);
      
      try {
        const { conditions: advancedConditions, params: advancedParams } = buildAdvancedFilters(service, advancedFilters);
        
        if (advancedConditions.length > 0) {
          whereConditions.push(...advancedConditions);
          params.push(...advancedParams);
          console.log(`✅ ${advancedConditions.length} filtres avancés appliqués avec succès`);
        } else {
          console.log('⚠️ Aucun filtre avancé généré');
        }
      } catch (filterError) {
        console.error('❌ Erreur filtres avancés:', filterError.message);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Définition du tri
    let orderClause = 'ORDER BY u.created_at DESC';
    const validSortOptions = ['newest', 'oldest', 'price_asc', 'price_desc', 'rating', 'experience'];
    
    if (validSortOptions.includes(sortBy)) {
      switch (sortBy) {
        case 'oldest':
          orderClause = 'ORDER BY u.created_at ASC';
          break;
        case 'price_asc':
          orderClause = 'ORDER BY sp.hourly_rate ASC';
          break;
        case 'price_desc':
          orderClause = 'ORDER BY sp.hourly_rate DESC';
          break;
        case 'rating':
          orderClause = 'ORDER BY sp.average_rating DESC, sp.total_reviews DESC';
          break;
        case 'experience':
          orderClause = 'ORDER BY sp.experience_years DESC';
          break;
        default:
          orderClause = `ORDER BY 
            (u.premium_until > NOW()) DESC,
            sp.is_featured DESC,
            sp.average_rating DESC,
            u.created_at DESC`;
      }
    }

    // ✅ REQUÊTE PRINCIPALE AVEC COMPTEUR DYNAMIQUE
   const searchQuery = `
  SELECT 
    u.id,
    u.first_name,
    u.last_name,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    u.email,
    u.phone,
    u.service_type,
    u.premium_until,
    u.profile_image,
u.created_at,
sp.id as provider_id,
sp.profile_image as provider_profile_image,
    sp.title,
    sp.description,
    sp.hourly_rate,
    sp.currency,
   (SELECT pwa.city FROM provider_working_areas pwa WHERE pwa.provider_id = sp.id LIMIT 1) as location_city,
(SELECT pwa.neighborhood FROM provider_working_areas pwa WHERE pwa.provider_id = sp.id LIMIT 1) as location_area,
    sp.experience_years,
    sp.verification_status,
    sp.is_featured,
    sp.average_rating,
    sp.profile_images,
    sp.availability,
    sp.languages,
    sp.certifications,        
    sp.view_count,            
    sp.contact_count,
    sp.created_at as profile_created_at,
    sp.updated_at as profile_updated_at,
(SELECT COUNT(DISTINCT r.id) 
 FROM reviews r 
 WHERE r.provider_id = sp.id 
 AND r.is_verified = TRUE 
 AND r.is_published = TRUE) as actual_reviews_count
  FROM users u
  JOIN service_providers sp ON u.id = sp.user_id
      ${whereClause}
      ${orderClause}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED || 'QUERY', searchQuery.replace(/\s+/g, ' ').trim());
    console.log('🔍 Params de la requête:', params);

    const providers = await query(searchQuery, params);

    console.log('🔍 DIAGNOSTIC - Premiers providers avant formatage:');
    providers.slice(0, 2).forEach(p => {
      console.log(`Provider ${p.id}:`, {
        name: `${p.first_name} ${p.last_name}`,
        actual_reviews_count: p.actual_reviews_count,
        availability_raw: p.availability,
        availability_type: typeof p.availability,
        availability_length: p.availability ? p.availability.length : 'null'
      });
    });

    // Requête de comptage total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      JOIN service_providers sp ON u.id = sp.user_id
      ${whereClause}
    `;

    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    console.log(DEV_LOGS.API.RESPONSE_SENT || 'RESPONSE', `${providers.length} providers trouvés sur ${total} total`);

    const formattedProviders = providers.map(provider => {
      // Parse des données JSON
      let availability = null;
      let languages = null;
      let certifications = null;
      let profileImages = null;

      try {
        availability = provider.availability;
        if (typeof provider.availability === 'string') {
          availability = JSON.parse(provider.availability);
        }
        
        languages = provider.languages;
        if (typeof provider.languages === 'string') {
          languages = JSON.parse(provider.languages);
        }
        
        certifications = provider.certifications;
        if (typeof provider.certifications === 'string') {
          certifications = JSON.parse(provider.certifications);
        }
        
        profileImages = provider.profile_images;
        if (typeof provider.profile_images === 'string') {
          profileImages = JSON.parse(provider.profile_images);
        }
        
        console.log('✅ JSON processing OK pour provider', provider.id);
      } catch (parseError) {
        console.error('❌ JSON parse error pour provider', provider.id, parseError.message);
        availability = null;
        languages = null;
        certifications = null;
        profileImages = null;
      }

      return {
        // IDs
        id: provider.id,
        user_id: provider.id,
        providerId: provider.provider_id,
        
        // Noms (avec tous les alias)
        name: provider.full_name,
        full_name: provider.full_name,
        first_name: provider.first_name,
        last_name: provider.last_name,
        
        // Contact
        email: provider.email,
        phone: provider.phone,
        
        // Service
        serviceType: provider.service_type,
        service_type: provider.service_type,
        serviceLabel: getServiceLabel ? getServiceLabel(provider.service_type) : provider.service_type,
        title: provider.title || `ספק ${getServiceLabel ? getServiceLabel(provider.service_type) : provider.service_type} מקצועי`,
        
        // Description (avec tous les alias)
        description: provider.description || 'אין תיאור זמין',
        bio: provider.description || 'אין תיאור זמין',
        
        // Tarifs et expérience (avec tous les alias)
        hourlyRate: provider.hourly_rate || 0,
        hourly_rate: provider.hourly_rate || 0,
        price: provider.hourly_rate || 0,
        currency: provider.currency || 'ILS',
        experience: provider.experience_years || 0,
        experience_years: provider.experience_years || 0,
        experienceYears: provider.experience_years || 0,
        
        // Localisation (avec tous les alias)
        city: provider.location_city || 'לא צוין',
        neighborhood: provider.location_area || '',
        location: {
          city: provider.location_city || 'לא צוין',
          area: provider.location_area || ''
        },
        location_city: provider.location_city,
        location_area: provider.location_area,
        
        // Images
profileImage: provider.provider_profile_image || provider.profile_image,
profile_image: provider.provider_profile_image || provider.profile_image,
profileImages: profileImages || [],
        
        // Ratings (avec tous les alias)
        rating: provider.average_rating || 0,
        average_rating: provider.average_rating || 0,
        reviewsCount: provider.actual_reviews_count || 0,
        reviews_count: provider.actual_reviews_count || 0,
        
        // Stats
        viewCount: provider.view_count || 0,
        view_count: provider.view_count || 0,
        contactCount: provider.contact_count || 0,
        contact_count: provider.contact_count || 0,
        
        // Statuts et badges (avec tous les alias)
        verified: provider.verification_status === 'verified',
        isVerified: provider.verification_status === 'verified',
        verification_status: provider.verification_status,
        verificationStatus: provider.verification_status,
        
        premium: provider.premium_until && new Date(provider.premium_until) > new Date(),
        isPremium: provider.premium_until && new Date(provider.premium_until) > new Date(),
        premium_until: provider.premium_until,
        
        featured: provider.is_featured === 1,
        isFeatured: provider.is_featured === 1,
        is_featured: provider.is_featured,
        
        is_active: true,
        
        // Données JSON
        availability: availability,
        languages: languages,
        certifications: certifications,
        specialties: null,
        service_details: null,
        
        // Métadonnées
        joinedAt: provider.created_at,
        profileCreatedAt: provider.profile_created_at,
        lastUpdated: provider.profile_updated_at,
        created_at: provider.created_at
      };
    });

    // Réponse standardisée
    res.success(MESSAGES?.INFO?.SEARCH?.RESULTS_FOUND?.replace('{count}', total) || `נמצאו ${total} תוצאות`, {
      providers: formattedProviders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalResults: total,
        hasNext: (pageNum * limitNum) < total,
        hasPrev: pageNum > 1,
        limit: limitNum
      },
      filters: {
        service,
        city,
        neighborhood,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        sortBy,
        experience,
        verified: verified === 'true',
        premium: premium === 'true',
        featured: featured === 'true',
        advanced: advancedFilters,
        advancedCount: Object.keys(advancedFilters).length
      },
      meta: {
        searchDuration: Date.now(),
        filtersApplied: whereConditions.length - 3,
        serviceLabel: service && getServiceLabel ? getServiceLabel(service) : null
      }
    });

  } catch (error) {
    console.error('❌ Erreur search/providers:', error.message);
    console.error('Stack:', error.stack);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError ? 
      ErrorHandler.serverError(error) : 
      { errorResponse: { success: false, message: 'Erreur serveur' }, statusCode: 500 };
    
    res.status(statusCode).json(errorResponse);
  }
});

// @route   GET /api/search/filters
// @desc    Obtenir les filtres disponibles pour la recherche
// @access  Public
router.get('/filters', async (req, res) => {
  try {
    console.log('🔥 Requête filters reçue');

    // Services disponibles avec comptage
    const servicesQuery = `
      SELECT 
     sp.service_type,
        COUNT(*) as count,
        AVG(sp.hourly_rate) as avg_rate,
        AVG(sp.average_rating) as avg_rating,
        COUNT(CASE WHEN sp.verification_status = 'verified' THEN 1 END) as verified_count
      FROM users u
      JOIN service_providers sp ON u.id = sp.user_id
      WHERE u.role = 'provider' AND u.is_active = 1 AND sp.is_active = 1 AND (u.premium_until > NOW() OR u.subscription_status = 'active')
      GROUP BY u.service_type
      ORDER BY count DESC
    `;
    
    const services = await query(servicesQuery, []);

    // Villes les plus populaires
    const citiesQuery = `
      SELECT 
        sp.location_city as city, 
        COUNT(*) as count,
        AVG(sp.hourly_rate) as avg_rate
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.role = 'provider' AND u.is_active = 1 AND sp.is_active = 1
        AND sp.location_city IS NOT NULL
        AND sp.location_city != ''
      GROUP BY sp.location_city
      ORDER BY count DESC
      LIMIT 20
    `;
    
    const cities = await query(citiesQuery, []);

    // Fourchette de prix
    const priceRangeQuery = `
      SELECT 
        MIN(sp.hourly_rate) as minPrice,
        MAX(sp.hourly_rate) as maxPrice,
        AVG(sp.hourly_rate) as avgPrice,
        COUNT(*) as providersWithPrice
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.role = 'provider' AND u.is_active = 1 AND sp.is_active = 1
        AND sp.hourly_rate IS NOT NULL
        AND sp.hourly_rate > 0
    `;
    
    const priceRangeResult = await query(priceRangeQuery, []);
    const priceRange = priceRangeResult[0];

    // Statistiques générales
    const statsQuery = `
      SELECT 
        COUNT(*) as totalProviders,
        COUNT(CASE WHEN sp.verification_status = 'verified' THEN 1 END) as verifiedProviders,
        COUNT(CASE WHEN sp.is_featured = 1 THEN 1 END) as featuredProviders
      FROM users u
      JOIN service_providers sp ON u.id = sp.user_id
      WHERE u.role = 'provider' AND u.is_active = 1 AND sp.is_active = 1
    `;
    
    const statsResult = await query(statsQuery, []);
    const stats = statsResult[0];

    const responseData = {
      services: services.map(s => ({
        type: s.service_type,
        count: s.count,
        label: getServiceLabel ? getServiceLabel(s.service_type) : s.service_type,
        averageRate: Math.round(s.avg_rate || 0),
        averageRating: Number((s.avg_rating || 0).toFixed(1)),
        verifiedCount: s.verified_count
      })),
      cities: cities.map(c => ({
        name: c.city,
        count: c.count,
        averageRate: Math.round(c.avg_rate || 0)
      })),
      priceRange: {
        min: Math.floor(priceRange?.minPrice || 0),
        max: Math.ceil(priceRange?.maxPrice || 200),
        average: Math.round(priceRange?.avgPrice || 50),
        providersWithPrice: priceRange?.providersWithPrice || 0
      },
      statistics: {
        totalProviders: stats.totalProviders || 0,
        verifiedProviders: stats.verifiedProviders || 0,
        featuredProviders: stats.featuredProviders || 0
      },
      sortOptions: [
        { value: 'newest', label: 'הכי חדשים' },
        { value: 'oldest', label: 'הכי ותיקים' },
        { value: 'price_asc', label: 'מחיר נמוך לגבוה' },
        { value: 'price_desc', label: 'מחיר גבוה לנמוך' },
        { value: 'rating', label: 'דירוג הגבוה ביותר' }
      ]
    };

    res.success(MESSAGES?.SUCCESS?.SYSTEM?.DATA_LOADED || 'נתונים נטענו בהצלחה', responseData);

  } catch (error) {
    console.error('❌ Erreur search/filters:', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError ? 
      ErrorHandler.serverError(error) : 
      { errorResponse: { success: false, message: 'Erreur serveur' }, statusCode: 500 };
    
    res.status(statusCode).json(errorResponse);
  }
});

// @route   GET /api/search/suggestions
// @desc    Autocomplétion pour la recherche
// @access  Public
router.get('/suggestions', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          query: q,
          type
        }
      });
    }

    const searchTerm = q.trim();
    let suggestions = [];

    if (type === 'all' || type === 'cities') {
      const cityQuery = `
        SELECT DISTINCT sp.location_city as value, 'city' as type, COUNT(*) as count
        FROM service_providers sp
        JOIN users u ON sp.user_id = u.id
        WHERE u.role = 'provider' AND u.is_active = 1 AND sp.is_active = 1
          AND sp.location_city LIKE ?
          AND sp.location_city IS NOT NULL
        GROUP BY sp.location_city
        ORDER BY count DESC
        LIMIT 5
      `;
      
      const cities = await query(cityQuery, [`%${searchTerm}%`]);
      suggestions.push(...cities.map(city => ({
        value: city.value,
        type: 'city',
        label: `${city.value} (${city.count} ספקים)`,
        count: city.count
      })));
    }

    suggestions.sort((a, b) => {
      const aExact = a.value.toLowerCase().startsWith(searchTerm.toLowerCase());
      const bExact = b.value.toLowerCase().startsWith(searchTerm.toLowerCase());
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return b.count - a.count;
    });

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 10),
        query: searchTerm,
        type
      }
    });

  } catch (error) {
    console.error('❌ Erreur search/suggestions:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      data: { suggestions: [] }
    });
  }
});

module.exports = router;