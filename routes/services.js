// routes/services.js - Refactorisé avec ErrorHandler et Messages unifiés
const express = require('express');
const router = express.Router();
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS, getServiceLabel } = require('../constants/messages');
const ResponseHelper = require('../utils/responseHelper');
const ServiceSubcategory = require('../models/ServiceSubcategory');
const { authenticateToken } = require('../middleware/authMiddleware');
const User = require('../models/User')

// =============================================
// CONFIGURATION DES SERVICES HOMESHERUT
// =============================================

const SERVICES_CONFIG = {
  babysitting: {
    key: 'babysitting',
    name: getServiceLabel('babysitting'),
    description: 'טיפול מקצועי בילדים ותינוקות בבטיחות מלאה',
    icon: 'baby',
    category: 'family',
    priceRange: { min: 35, max: 80, currency: 'ILS' },
    demand: 'גבוה מאוד',
    payingModel: 'clients_pay', // הלקוחות משלמים
    freeMonth: false,
    features: [
      'עבודה במישה בשעות הנוחות לך',
      'שכר גבוה ותנאים מעולים', 
      'עבודה משמחת עם ילדים',
      'ביקוש קבוע ויציב',
      'אפשרות לעבודה קבועה או חד-פעמית'
    ],
    requirements: [
      'ניסיון בטיפול בילדים',
      'סבלנות ואהבה לילדים',
      'זמינות במישה',
      'המלצות ואישורים'
    ],
    popularCities: ['תל אביב', 'ירושלים', 'חיפה', 'רעננה', 'הרצליה']
  },
  
  cleaning: {
    key: 'cleaning',
    name: getServiceLabel('cleaning'),
    description: 'שירותי ניקיון מקצועיים לבתים פרטיים ומשרדים',
    icon: 'home',
    category: 'household',
    priceRange: { min: 40, max: 65, currency: 'ILS' },
    demand: 'גבוה',
    payingModel: 'provider_pays', // הספק משלם עמלה
    freeMonth: true, // חודש ראשון חינם
    features: [
      'ביקוש קבוע ויציב כל השנה',
      'עבודה עצמאית ועבודה בצוות',
      'שכר טוב ותשלום מיידי',
      'לקוחות קבועים ונאמנים',
      'גמישות בזמנים ובתדירות'
    ],
    requirements: [
      'ניסיון בניקיון מקצועי',
      'מהימנות ואמינות מלאה',
      'יכולת עבודה פיזית',
      'זמינות קבועה'
    ],
    popularCities: ['תל אביב', 'פתח תקווה', 'ראשון לציון', 'חיפה', 'נתניה']
  },

  gardening: {
    key: 'gardening',
    name: getServiceLabel('gardening'),
    description: 'עיצוב, טיפוח ותחזוקת גינות פרטיות וציבוריות',
    icon: 'scissors',
    category: 'outdoor',
    priceRange: { min: 50, max: 90, currency: 'ILS' },
    demand: 'בינוני-גבוה',
    payingModel: 'provider_pays',
    freeMonth: true,
    features: [
      'שכר מעולה ופרויקטים גדולים',
      'עבודה בחוץ באוויר הפתוח',
      'יצירתיות ועיצוב נופי',
      'פרויקטים מגוונים ומעניינים',
      'עונתיות עם פסגות ברווחיות'
    ],
    requirements: [
      'ידע בגינון וצמחייה',
      'כישורי עיצוב נופי',
      'כלי עבודה מקצועיים',
      'יכולת עבודה פיזית בחוץ'
    ],
    popularCities: ['רעננה', 'הרצליה', 'כפר סבא', 'רמת גן', 'גבעתיים']
  },

  petcare: {
    key: 'petcare',
    name: getServiceLabel('petcare'),
    description: 'טיפול אוהב ומקצועי בכלבים, חתולים וחיות מחמד',
    icon: 'pawprint',
    category: 'animals',
    priceRange: { min: 25, max: 55, currency: 'ILS' },
    demand: 'בינוני',
    payingModel: 'provider_pays',
    freeMonth: true,
    features: [
      'עבודה חמה ומתגמלת עם חיות',
      'גמישות מלאה בשעות העבודה',
      'קהילה חמה של אוהבי חיות',
      'שילוב של טיפול ומשחק',
      'אפשרות לטיפול בבית הלקוח או אצלך'
    ],
    requirements: [
      'אהבה גדולה לחיות',
      'ניסיון בטיפול בחיות מחמד',
      'סבלנות ורגישות',
      'זמינות למצבי חירום'
    ],
    popularCities: ['תל אביב', 'רמת גן', 'חיפה', 'יפו', 'בת ים']
  },

  tutoring: {
    key: 'tutoring',
    name: getServiceLabel('tutoring'),
    description: 'הוראה פרטית וחיזוק לימודי בכל הגילאים ובכל המקצועות',
    icon: 'book',
    category: 'education',
    priceRange: { min: 60, max: 120, currency: 'ILS' },
    demand: 'גבוה מאוד',
    payingModel: 'provider_pays',
    freeMonth: true,
    features: [
      'השכר הגבוה ביותר בפלטפורמה',
      'עבודה אינטלקטואלית מתגמלת',
      'השפעה חיובית על עתיד הילדים',
      'ביקוש קבוע כל השנה',
      'אפשרות להתמחות במקצועות ספציפיים'
    ],
    requirements: [
      'השכלה אקדמית או הכשרה מקצועית',
      'ניסיון הוראה או הסברה',
      'סבלנות וכישורי הסברה',
      'התמחות במקצוע אחד או יותר'
    ],
    popularCities: ['ירושלים', 'תל אביב', 'בני ברק', 'פתח תקווה', 'מודיעין']
  },

  eldercare: {
    key: 'eldercare',
    name: getServiceLabel('eldercare'),
    description: 'טיפול מסור ולווי אישי לאנשים מבוגרים וקשישים',
    icon: 'user',
    category: 'healthcare',
    priceRange: { min: 45, max: 75, currency: 'ILS' },
    demand: 'גבוה',
    payingModel: 'clients_pay',
    freeMonth: false,
    features: [
      'עבודה משמעותית ומתגמלת רגשית',
      'שכר יציב ותנאים טובים',
      'קשר אנושי עמוק ומשמעותי',
      'ביקוש גדל עקב הזדקנות האוכלוסייה',
      'אפשרות לטיפול יומי או לינה'
    ],
    requirements: [
      'ניסיון בטיפול בקשישים',
      'סבלנות ואמפתיה רבה',
      'יכולת התמודדות עם מצבים רפואיים',
      'זמינות לשעות ארוכות'
    ],
    popularCities: ['ירושלים', 'תל אביב', 'חיפה', 'באר שבע', 'נתניה']
  },
  
  laundry: {
    key: 'laundry',
    name: getServiceLabel('laundry'),
    description: 'שירותי כביסה, גיהוץ וניקוי יבש מקצועיים',
    icon: 'shirt',
    category: 'household',
    priceRange: { min: 30, max: 70, currency: 'ILS' },
    demand: 'בינוני-גבוה',
    payingModel: 'provider_pays',
    freeMonth: true,
    features: [
      'עבודה גמישה עם לקוחות קבועים',
      'שכר טוב ותשלום מיידי',
      'ביקוש קבוע כל השנה',
      'אפשרות לעבודה מהבית',
      'גמישות בזמנים ובתדירות'
    ],
    requirements: [
      'ניסיון בכביסה וגיהוץ',
      'מהימנות ודייקנות',
      'ציוד מקצועי (מגהץ, מכונת כביסה)',
      'זמינות קבועה'
    ],
    popularCities: ['תל אביב', 'פתח תקווה', 'ראשון לציון', 'חיפה', 'נתניה']
  }
};

// =============================================
// ROUTES PUBLIQUES
// =============================================

/**
 * GET /api/services/available
 * Liste complète des services disponibles sur HomeSherut
 * @desc Catalogue des 6 services avec détails, tarifs et caractéristiques
 * @access Public
 */
router.get('/available', async (req, res) => {
  try {
    const { category, payingModel, withStats } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'services/available', { category, payingModel, withStats });

    let services = Object.values(SERVICES_CONFIG);

    // Filtrage par catégorie si demandé
    if (category) {
      const validCategories = ['family', 'household', 'outdoor', 'animals', 'education', 'healthcare'];
      if (!validCategories.includes(category)) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'category',
          message: MESSAGES.ERROR.VALIDATION.INVALID_CATEGORY
        }]);
        return res.status(statusCode).json(errorResponse);
      }
      
      services = services.filter(service => service.category === category);
      console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Filtrage par catégorie: ${category}, ${services.length} services`);
    }

    // Filtrage par modèle de paiement
    if (payingModel) {
      const validModels = ['clients_pay', 'provider_pays'];
      if (!validModels.includes(payingModel)) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'payingModel',
          message: MESSAGES.ERROR.VALIDATION.INVALID_PAYMENT_MODEL
        }]);
        return res.status(statusCode).json(errorResponse);
      }
      
      services = services.filter(service => service.payingModel === payingModel);
      console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Filtrage par modèle: ${payingModel}, ${services.length} services`);
    }

    // Enrichissement avec statistiques si demandé
    if (withStats === 'true') {
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, 'Chargement statistiques services');
      
      const User = require('../models/User');
      
      for (let service of services) {
        try {
          // Statistiques rapides par service
          const statsQuery = `
            SELECT 
              COUNT(*) as providers_count,
              AVG(sp.hourly_rate) as avg_rate,
              COUNT(CASE WHEN sp.verification_status = 'verified' THEN 1 END) as verified_count
            FROM users u
            LEFT JOIN service_providers sp ON u.id = sp.user_id
            WHERE u.role = 'provider' 
              AND u.service_type = ? 
              AND u.is_active = 1
          `;
          
          const [stats] = await User.executeQuery(statsQuery, [service.key]);
          
          service.stats = {
            totalProviders: stats.providers_count || 0,
            averageRate: Math.round(stats.avg_rate || 0),
            verifiedProviders: stats.verified_count || 0,
            verificationRate: stats.providers_count > 0 
              ? Math.round((stats.verified_count / stats.providers_count) * 100)
              : 0
          };
          
        } catch (statsError) {
          console.error(DEV_LOGS.DATABASE.QUERY_ERROR, `Erreur stats ${service.key}:`, statsError.message);
          service.stats = { error: 'Stats temporairement indisponibles' };
        }
      }
    }

    // Formatage final pour la réponse
    const formattedServices = services.map(service => ({
      ...service,
      priceDisplay: `${service.priceRange.min}-${service.priceRange.max} ₪/שעה`,
      isPopular: ['babysitting', 'tutoring', 'cleaning'].includes(service.key),
      marketPosition: getMarketPosition(service.key),
      estimatedEarnings: calculateEstimatedEarnings(service.priceRange, service.demand)
    }));

    console.log(DEV_LOGS.API.RESPONSE_SENT, `${formattedServices.length} services retournés`);

    res.success(MESSAGES.SUCCESS.SYSTEM.SERVICES_LOADED, {
      services: formattedServices,
      meta: {
        totalServices: formattedServices.length,
        categories: [...new Set(formattedServices.map(s => s.category))],
        paymentModels: [...new Set(formattedServices.map(s => s.payingModel))],
        withStatistics: withStats === 'true',
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Erreur chargement services:', error.message);
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'services/available', error.stack);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/services/:serviceType/stats
 * Statistiques détaillées d'un service spécifique
 * @desc Analytics complets : providers, tarifs, géographie, tendances
 * @access Public
 */
router.get('/:serviceType/stats', async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { period = 'month', includeGeography = 'true' } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `services/${serviceType}/stats`, { period, includeGeography });

    // Validation du service
    const validServices = Object.keys(SERVICES_CONFIG);
    if (!validServices.includes(serviceType)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'serviceType',
        message: MESSAGES.ERROR.VALIDATION.INVALID_SERVICE_TYPE
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation de la période
    const validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'period',
        message: MESSAGES.ERROR.VALIDATION.INVALID_PERIOD
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    const User = require('../models/User');
    const serviceConfig = SERVICES_CONFIG[serviceType];

    console.log(DEV_LOGS.BUSINESS.STATS_CALCULATION, `Calcul stats ${serviceType} pour période ${period}`);

    // ==========================================
    // 1. STATISTIQUES GÉNÉRALES DU SERVICE
    // ==========================================
    const generalStatsQuery = `
      SELECT 
        COUNT(*) as total_providers,
        COUNT(CASE WHEN u.is_active = 1 THEN 1 END) as active_providers,
        COUNT(CASE WHEN sp.verification_status = 'verified' THEN 1 END) as verified_providers,
        COUNT(CASE WHEN sp.is_premium = 1 THEN 1 END) as premium_providers,
        COUNT(CASE WHEN sp.is_featured = 1 THEN 1 END) as featured_providers,
        AVG(sp.hourly_rate) as avg_hourly_rate,
        MIN(sp.hourly_rate) as min_rate,
        MAX(sp.hourly_rate) as max_rate,
        AVG(sp.average_rating) as avg_rating,
        SUM(sp.total_reviews) as total_reviews,
        AVG(sp.experience_years) as avg_experience
      FROM users u
      LEFT JOIN service_providers sp ON u.id = sp.user_id
      WHERE u.role = 'provider' 
        AND u.service_type = ?
    `;

    const [generalStats] = await User.executeQuery(generalStatsQuery, [serviceType]);

    // ==========================================
    // 2. TENDANCES TEMPORELLES
    // ==========================================
    const periodMapping = {
      week: { interval: '7 DAY', format: '%Y-%m-%d' },
      month: { interval: '30 DAY', format: '%Y-%m-%d' },
      quarter: { interval: '90 DAY', format: '%Y-%m' },
      year: { interval: '365 DAY', format: '%Y-%m' }
    };

    const periodConfig = periodMapping[period];
    
    const trendsQuery = `
      SELECT 
        DATE_FORMAT(u.created_at, '${periodConfig.format}') as period,
        COUNT(*) as new_providers,
        AVG(sp.hourly_rate) as period_avg_rate
      FROM users u
      LEFT JOIN service_providers sp ON u.id = sp.user_id
      WHERE u.role = 'provider' 
        AND u.service_type = ?
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL ${periodConfig.interval})
      GROUP BY DATE_FORMAT(u.created_at, '${periodConfig.format}')
      ORDER BY period ASC
    `;

    const trends = await User.executeQuery(trendsQuery, [serviceType]);

    // ==========================================
    // 3. ANALYSE GÉOGRAPHIQUE
    // ==========================================
    let geographyData = null;
    
    if (includeGeography === 'true') {
      const geographyQuery = `
        SELECT 
          sp.location_city as city,
          sp.location_area as area,
          COUNT(*) as providers_count,
          AVG(sp.hourly_rate) as avg_rate,
          AVG(sp.average_rating) as avg_rating,
          COUNT(CASE WHEN sp.verification_status = 'verified' THEN 1 END) as verified_count
        FROM service_providers sp
        JOIN users u ON sp.user_id = u.id
        WHERE u.service_type = ? 
          AND u.is_active = 1
          AND sp.location_city IS NOT NULL
        GROUP BY sp.location_city, sp.location_area
        ORDER BY providers_count DESC
        LIMIT 20
      `;

      const geographyResults = await User.executeQuery(geographyQuery, [serviceType]);
      
      geographyData = {
        topCities: geographyResults.map(row => ({
          city: row.city,
          area: row.area,
          providersCount: row.providers_count,
          averageRate: Math.round(row.avg_rate || 0),
          averageRating: Number((row.avg_rating || 0).toFixed(1)),
          verifiedProviders: row.verified_count,
          marketShare: Math.round((row.providers_count / generalStats.active_providers) * 100)
        })),
        totalCities: new Set(geographyResults.map(r => r.city)).size
      };
    }

    // ==========================================
    // 4. ANALYSE DES TARIFS PAR TRANCHE
    // ==========================================
    const priceRangesQuery = `
      SELECT 
        CASE 
          WHEN sp.hourly_rate < 30 THEN 'budget'
          WHEN sp.hourly_rate BETWEEN 30 AND 60 THEN 'standard'
          WHEN sp.hourly_rate BETWEEN 61 AND 100 THEN 'premium'
          ELSE 'luxury'
        END as price_category,
        COUNT(*) as providers_count,
        AVG(sp.average_rating) as avg_rating
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.service_type = ? 
        AND u.is_active = 1
        AND sp.hourly_rate IS NOT NULL
      GROUP BY price_category
      ORDER BY 
        CASE price_category
          WHEN 'budget' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'premium' THEN 3
          WHEN 'luxury' THEN 4
        END
    `;

    const priceRanges = await User.executeQuery(priceRangesQuery, [serviceType]);

    // ==========================================
    // 5. COMPILATION DES RÉSULTATS
    // ==========================================
    const statsReport = {
      serviceType,
      serviceName: serviceConfig.name,
      period,
      
      overview: {
        totalProviders: generalStats.total_providers || 0,
        activeProviders: generalStats.active_providers || 0,
        verifiedProviders: generalStats.verified_providers || 0,
        premiumProviders: generalStats.premium_providers || 0,
        featuredProviders: generalStats.featured_providers || 0,
        verificationRate: generalStats.active_providers > 0 
          ? Math.round((generalStats.verified_providers / generalStats.active_providers) * 100)
          : 0
      },
      
      pricing: {
        averageRate: Math.round(generalStats.avg_hourly_rate || 0),
        minRate: Math.floor(generalStats.min_rate || 0),
        maxRate: Math.ceil(generalStats.max_rate || 0),
        configuredRange: serviceConfig.priceRange,
        distribution: priceRanges.map(range => ({
          category: range.price_category,
          providersCount: range.providers_count,
          averageRating: Number((range.avg_rating || 0).toFixed(1)),
          marketShare: Math.round((range.providers_count / generalStats.active_providers) * 100)
        }))
      },
      
      quality: {
        averageRating: Number((generalStats.avg_rating || 0).toFixed(1)),
        totalReviews: generalStats.total_reviews || 0,
        averageExperience: Number((generalStats.avg_experience || 0).toFixed(1))
      },
      
      trends: trends.map(trend => ({
        period: trend.period,
        newProviders: trend.new_providers,
        averageRate: Math.round(trend.period_avg_rate || 0)
      })),
      
      geography: geographyData,
      
      marketInsights: {
        demand: serviceConfig.demand,
        payingModel: serviceConfig.payingModel,
        freeMonth: serviceConfig.freeMonth,
        competitiveness: calculateCompetitiveness(generalStats.active_providers, serviceConfig.demand),
        growthRate: calculateGrowthRate(trends),
        recommendations: generateRecommendations(serviceType, generalStats, geographyData)
      },
      
      lastUpdated: new Date().toISOString()
    };

    console.log(DEV_LOGS.API.RESPONSE_SENT, `Stats ${serviceType} calculées: ${statsReport.overview.activeProviders} providers actifs`);

    res.success(MESSAGES.SUCCESS.SYSTEM.STATS_LOADED, statsReport);

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, `Erreur stats ${serviceType}:`, error.message);
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'services/stats', error.stack);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/services/:serviceType/info
 * Informations détaillées sur un service spécifique
 * @desc Guide complet : description, requis, avantages, process d'inscription
 * @access Public
 */
router.get('/:serviceType/info', async (req, res) => {
  try {
    const { serviceType } = req.params;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `services/${serviceType}/info`);

    // Validation du service
    if (!SERVICES_CONFIG[serviceType]) {
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('service',
        MESSAGES.ERROR.RESOURCE.SERVICE_NOT_FOUND
      );
      return res.status(statusCode).json(errorResponse);
    }

    const serviceInfo = SERVICES_CONFIG[serviceType];
    
    // Enrichir avec des informations supplémentaires
    const enrichedInfo = {
      ...serviceInfo,
      
      // Processus d'inscription spécifique
      onboardingProcess: [
        { step: 1, title: 'הרשמה ראשונית', description: 'מילוי פרטים אישיים בסיסיים' },
        { step: 2, title: 'השלמת פרופיל', description: 'הוספת תיאור, תמונה ופרטי ניסיון' },
        { step: 3, title: 'אימות זהות', description: 'העלאת מסמכים ואישור פרטים' },
        { step: 4, title: 'בדיקות רקע', description: 'אישור תעודת זהות והיעדר רישום פלילי' },
        { step: 5, title: 'הפעלת פרופיל', description: 'פרסום הפרופיל והתחלת קבלת הודעות' }
      ],
      
      // Documents requis pour ce service
      requiredDocuments: getRequiredDocuments(serviceType),
      
      // FAQ spécifique au service
      faq: getServiceFAQ(serviceType),
      
      // Success stories / témoignages
      successStory: getSuccessStory(serviceType)
    };

    console.log(DEV_LOGS.API.RESPONSE_SENT, `Info détaillées ${serviceType} retournées`);

    res.success(MESSAGES.SUCCESS.SYSTEM.SERVICE_INFO_LOADED, {
      service: enrichedInfo
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'services/info', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Calculer la position sur le marché d'un service
 */
function getMarketPosition(serviceKey) {
  const positions = {
    babysitting: 'leader',
    tutoring: 'premium',
    cleaning: 'stable',
    eldercare: 'growing',
    gardening: 'seasonal',
    petcare: 'niche'
  };
  return positions[serviceKey] || 'standard';
}

/**
 * Estimer les revenus potentiels
 */
function calculateEstimatedEarnings(priceRange, demand) {
  const demandMultiplier = {
    'גבוה מאוד': 1.2,
    'גבוה': 1.0,
    'בינוני-גבוה': 0.8,
    'בינוני': 0.6
  };
  
  const avgRate = (priceRange.min + priceRange.max) / 2;
  const multiplier = demandMultiplier[demand] || 0.5;
  
  // Estimation basée sur 20h/semaine
  const weeklyHours = 20;
  const monthlyEarnings = Math.round(avgRate * weeklyHours * 4 * multiplier);
  
  return {
    hourly: `${priceRange.min}-${priceRange.max} ₪`,
    monthly: `${Math.round(monthlyEarnings * 0.7)}-${monthlyEarnings} ₪`,
    annual: `${Math.round(monthlyEarnings * 8.4)}-${Math.round(monthlyEarnings * 12)} ₪`
  };
}

/**
 * Documents requis par service
 */
function getRequiredDocuments(serviceType) {
  const common = [
    'תעודת זהות',
    'תמונת פרופיל איכותית',
    'אישור על היעדר רישום פלילי'
  ];
  
  const specific = {
    babysitting: ['קורס עזרה ראשונה', 'המלצות מהורים קודמים', 'אישור רפואי'],
    tutoring: ['תעודות השכלה', 'תעודות הוראה (אם יש)', 'דוגמאות עבודה'],
    cleaning: ['ביטוח אישי', 'ציוד עבודה', 'המלצות מעבודות קודמות'],
    eldercare: ['הכשרה בטיפול בקשישים', 'אישור רפואי מורחב', 'המלצות מעבודות דומות'],
    gardening: ['ידע מקצועי בצמחים', 'ציוד גינון', 'תמונות עבודות קודמות'],
    petcare: ['ביטוח חיות', 'קורס טיפול בחיות (מומלץ)', 'המלצות מבעלי חיות']
  };
  
  return [...common, ...(specific[serviceType] || [])];
}

/**
 * FAQ spécifique par service
 */
function getServiceFAQ(serviceType) {
  const faqs = {
    babysitting: [
      { q: 'כמה שעות בשבוע אני יכול לעבוד?', a: 'אתה קובע! מבייביסיטר אחת לשבוע ועד עבודה במשרה מלאה.' },
      { q: 'מה הגיל המינימלי לעבודה?', a: '18 שנים מינימום, עם ניסיון מוכח בטיפול בילדים.' },
      { q: 'האם אני צריך קורס עזרה ראשונה?', a: 'כן, זה חובה לכל המטפלים בילדים בפלטפורמה.' }
    ],
    tutoring: [
      { q: 'באילו מקצועות אני יכול ללמד?', a: 'כל המקצועות! ממתמטיקה ואנגלית ועד מוזיקה ואמנות.' },
      { q: 'האם אני צריך תואר להוראה?', a: 'לא חובה, אבל ידע מקצועי מוכח בתחום כן נדרש.' },
      { q: 'כמה אני יכול לגבות בשעה?', a: 'בין 60-120 ₪ בהתאם לרמה, מקצוע וניסיון.' }
    ],
    cleaning: [
      { q: 'האם אני צריך לספק ציוד?', a: 'תלוי בלקוח - חלק מספקים וחלק מעדיפים שתביא איתך.' },
      { q: 'כמה זמן לוקח ניקיון ממוצע?', a: '2-4 שעות בהתאם לגודל הבית ורמת הניקיון.' },
      { q: 'האם יש ביטוח מהנזקים?', a: 'כן, יש ביטוח בסיסי אבל מומלץ ביטוח אישי נוסף.' }
    ]
  };
  
  return faqs[serviceType] || [];
}

/**
 * Success story par service
 */
function getSuccessStory(serviceType) {
  const stories = {
    babysitting: {
      name: 'שרה מ.',
      story: 'התחלתי כבייביסיטר במקביל ללימודי. תוך חצי שנה בניתי בסיס לקוחות קבועים ועבדתי 25 שעות בשבוע. הרווחתי מספיק כדי לממן את הלימודים ועוד!',
      monthlyEarning: '4,500 ₪'
    },
    tutoring: {
      name: 'דוד כ.',
      story: 'אחרי השחרור מהצבא התחלתי ללמד מתמטיקה. היום יש לי 12 תלמידים קבועים ואני מרוויח יותר ממורים במשרה מלאה!',
      monthlyEarning: '8,200 ₪'
    },
    cleaning: {
      name: 'מירב ל.',
      story: 'עבדתי בניקיון במשך שנים אצל חברות. כאן אני עצמאית, קובעת מחירים ובוחרת לקוחות. הכנסתי עלתה ב-40%!',
      monthlyEarning: '5,800 ₪'
    }
  };
  
  return stories[serviceType] || null;
}

/**
 * Calculer le niveau de compétitivité
 */
function calculateCompetitiveness(providersCount, demand) {
  if (demand === 'גבוה מאוד' && providersCount < 50) return 'low';
  if (demand === 'גבוה' && providersCount < 100) return 'medium';
  if (providersCount > 200) return 'high';
  return 'medium';
}

/**
 * Calculer le taux de croissance
 */
function calculateGrowthRate(trends) {
  if (trends.length < 2) return 0;
  
  const recent = trends.slice(-3).reduce((sum, t) => sum + t.new_providers, 0);
  const earlier = trends.slice(0, 3).reduce((sum, t) => sum + t.new_providers, 0);
  
  if (earlier === 0) return 100;
  return Math.round(((recent - earlier) / earlier) * 100);
}

/**
 * Générer des recommandations personnalisées
 */
function generateRecommendations(serviceType, stats, geography) {
  const recommendations = [];
  
  if (stats.active_providers < 20) {
    recommendations.push('שוק לא רווי - הזדמנות מעולה להצטרף!');
  }
  
  if (stats.avg_hourly_rate > SERVICES_CONFIG[serviceType].priceRange.max) {
    recommendations.push('תעריפים גבוהים בשוק - פוטנציאל רווח גבוה');
  }
  
  if (geography && geography.totalCities < 5) {
    recommendations.push('השירות זמין במעט ערים - הזדמנות להיות הראשוני');
  }
  
  return recommendations;
}
/**
 * GET /api/services/:serviceId/subcategories
 * Récupère les sous-catégories d'un service
 * @desc Liste des 69 sous-catégories pour tutoring (service_id=5)
 * @access Public
 * @query {string} grouped - 'true' pour grouper par thème, 'false' pour liste simple
 */
router.get('/:serviceId/subcategories', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { grouped = 'false' } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `services/${serviceId}/subcategories`, { grouped });

    // Validation du service ID
    const validServiceIds = [1, 2, 3, 4, 5, 6];
    const numericServiceId = parseInt(serviceId);
    
    if (!validServiceIds.includes(numericServiceId)) {
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('service',
        MESSAGES.ERROR.RESOURCE.SERVICE_NOT_FOUND
      );
      return res.status(statusCode).json(errorResponse);
    }

    // Récupération des sous-catégories
    if (grouped === 'true') {
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `Récupération sous-catégories groupées pour service ${serviceId}`);
      const groups = await ServiceSubcategory.getGrouped(numericServiceId);
      
      console.log(DEV_LOGS.API.RESPONSE_SENT, `${Object.keys(groups).length} groupes de sous-catégories retournés`);
      
      return res.success(MESSAGES.SUCCESS.SYSTEM.SERVICES_LOADED, {
        serviceId: numericServiceId,
        grouped: true,
        groups,
        totalGroups: Object.keys(groups).length,
        totalSubcategories: Object.values(groups).reduce((sum, group) => sum + group.items.length, 0)
      });
    } else {
      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `Récupération sous-catégories simples pour service ${serviceId}`);
      const subcategories = await ServiceSubcategory.getByServiceId(numericServiceId);
      
      console.log(DEV_LOGS.API.RESPONSE_SENT, `${subcategories.length} sous-catégories retournées`);
      
      return res.success(MESSAGES.SUCCESS.SYSTEM.SERVICES_LOADED, {
        serviceId: numericServiceId,
        grouped: false,
        subcategories,
        total: subcategories.length
      });
    }

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Erreur récupération sous-catégories:', error.message);
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'services/subcategories', error.stack);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// ============================================
// SUPPRESSION D'UN SERVICE SPÉCIFIQUE
// ============================================

/**
 * DELETE /api/services/:serviceType
 * Supprimer un service spécifique du compte provider
 */
router.delete('/:serviceType', authenticateToken, async (req, res) => {
  try {
    const { serviceType } = req.params;
    const userId = req.user.id;
    
    console.log(`[DELETE Service] User ${userId} demande suppression du service: ${serviceType}`);
    
    // Vérifier que l'utilisateur est un provider
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les prestataires peuvent supprimer des services'
      });
    }
    
    // Charger l'utilisateur
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier que le service existe
    const validServices = [
      'babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare',
      'electrician', 'plumbing', 'air_conditioning', 'gas_technician', 'drywall',
      'carpentry', 'home_organization', 'event_entertainment', 'private_chef',
      'painting', 'waterproofing', 'contractor', 'aluminum', 'glass_works',
      'locksmith', 'property_management', 'laundry'
    ];
    
    if (!validServices.includes(serviceType)) {
      return res.status(400).json({
        success: false,
        message: 'Type de service invalide'
      });
    }
    
    // ✅ AJOUTER : Marquer le trial comme supprimé pour CE service
    const TrialHistory = require('../models/TrialHistory');
    await TrialHistory.markAccountDeletedForService(user.email, serviceType);
    console.log(`✅ Trial history marqué comme supprimé pour service ${serviceType}`);
    
    // Supprimer le service
    const result = await user.deleteService(serviceType);
    
    // Si c'était le dernier service, le compte a été supprimé
    if (result.accountDeleted) {
      // ✅ Si tout le compte est supprimé, marquer TOUS les services
      await TrialHistory.markAccountDeleted(user.email);
      
      return res.json({
        success: true,
        accountDeleted: true,
        message: 'Dernier service supprimé, compte entier supprimé'
      });
    }
    
    // Recharger l'utilisateur mis à jour
    const updatedUser = await User.findById(userId);
    
    res.json({
      success: true,
      accountDeleted: false,
      message: `Service ${serviceType} supprimé avec succès`,
      data: {
        remainingServices: result.remainingServices,
        newActiveService: result.newActiveService,
        user: updatedUser
      }
    });
    
  } catch (error) {
    console.error('[DELETE Service] Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la suppression du service'
    });
  }
});
module.exports = router;