// routes/location.js - Refactorisé avec ErrorHandler et Messages unifiés
const express = require('express');
const router = express.Router();
const LocationController = require('../controllers/locationController');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');
const ResponseHelper = require('../utils/responseHelper');

// Middlewares d'authentification
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');

// =============================================
// ROUTES PUBLIQUES (pas d'auth requise)
// =============================================

/**
 * GET /api/location/search/:serviceType
 * Rechercher des services par localisation avec géolocalisation avancée
 * 
 * Paramètres URL:
 * - serviceType: babysitting, cleaning, gardening, petcare, tutoring, eldercare
 * 
 * Query params:
 * - city: nom de la ville (requis)
 * - neighborhood: nom du quartier (optionnel)
 * - radius: rayon en km (défaut: 10, max: 50)
 * - lat, lon: coordonnées GPS (optionnel pour recherche précise)
 * - limit: nombre de résultats (défaut: 20, max: 100)
 * - offset: pagination (défaut: 0)
 * - extended: recherche étendue aux villes voisines (défaut: false)
 * - sortBy: distance, price, rating, newest (défaut: distance si coordonnées, sinon newest)
 */
router.get('/search/:serviceType', async (req, res) => {
  try {
    const { serviceType } = req.params;
    const {
      city,
      neighborhood,
      radius = 10,
      lat,
      lon,
      limit = 20,
      offset = 0,
      extended = false,
      sortBy = 'distance'
    } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `location/search/${serviceType}`, req.query);

    // Validation du type de service
    const validServices = ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare'];
    if (!validServices.includes(serviceType)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'serviceType',
        message: MESSAGES.ERROR.VALIDATION.INVALID_SERVICE_TYPE
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation de la ville (requis)
    if (!city || city.trim().length < 2) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'city',
        message: MESSAGES.ERROR.VALIDATION.CITY_REQUIRED
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation des coordonnées si fournies
    if ((lat && !lon) || (!lat && lon)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'coordinates',
        message: MESSAGES.ERROR.VALIDATION.COORDINATES_INCOMPLETE
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation du rayon
    const radiusNum = Math.min(50, Math.max(1, parseInt(radius) || 10));
    if (radiusNum !== parseInt(radius) && radius) {
      console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Rayon ajusté: ${radius} -> ${radiusNum}`);
    }

    // Validation pagination
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offsetNum = Math.max(0, parseInt(offset) || 0);

    console.log(DEV_LOGS.BUSINESS.SEARCH_STARTED, `Service: ${serviceType}, Ville: ${city}`);

    // Appel au contrôleur avec paramètres validés
    const searchParams = {
      serviceType,
      city: city.trim(),
      neighborhood: neighborhood?.trim(),
      radius: radiusNum,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      limit: limitNum,
      offset: offsetNum,
      extended: extended === 'true' || extended === true,
      sortBy
    };

    const results = await LocationController.searchServices(searchParams);

    if (!results || results.providers.length === 0) {
      console.log(DEV_LOGS.API.RESPONSE_SENT, `Aucun résultat pour: ${serviceType} à ${city}`);
      
      return res.success(MESSAGES.INFO.SEARCH.NO_RESULTS, {
        providers: [],
        total: 0,
        searchParams,
        suggestions: {
          extendRadius: radiusNum < 25,
          searchNearby: !extended,
          tryOtherServices: true
        }
      });
    }

    console.log(DEV_LOGS.API.RESPONSE_SENT, `${results.providers.length} services trouvés`);

    res.success(MESSAGES.INFO.SEARCH.RESULTS_FOUND.replace('{count}', results.total), {
      providers: results.providers,
      total: results.total,
      searchParams,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: results.total > (offsetNum + limitNum)
      },
      geoData: results.geoData || null
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'location/search', error.message);
    
    if (error.code === 'INVALID_COORDINATES') {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'coordinates',
        message: MESSAGES.ERROR.VALIDATION.INVALID_COORDINATES
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/location/suggestions
 * Autocomplétion intelligente pour les localisations israéliennes
 * 
 * Query params:
 * - q: terme de recherche (minimum 2 caractères)
 * - serviceType: type de service pour filtrer les suggestions (optionnel)
 * - limit: nombre max de suggestions (défaut: 10, max: 20)
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q, serviceType, limit = 10 } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'location/suggestions', { q, serviceType });

    // Validation de la recherche
    if (!q || q.trim().length < 2) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'q',
        message: MESSAGES.ERROR.VALIDATION.SEARCH_TOO_SHORT
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation du type de service si fourni
    const validServices = ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare'];
    if (serviceType && !validServices.includes(serviceType)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'serviceType',
        message: MESSAGES.ERROR.VALIDATION.INVALID_SERVICE_TYPE
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    const limitNum = Math.min(20, Math.max(1, parseInt(limit) || 10));

    const suggestions = await LocationController.getSuggestions({
      query: q.trim(),
      serviceType,
      limit: limitNum
    });

    console.log(DEV_LOGS.API.RESPONSE_SENT, `${suggestions.length} suggestions générées`);

    res.success(MESSAGES.SUCCESS.SYSTEM.SUGGESTIONS_LOADED, {
      suggestions,
      query: q.trim(),
      serviceType: serviceType || null
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'location/suggestions', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/location/stats/:city
 * Statistiques détaillées des services par ville
 * 
 * Paramètres URL:
 * - city: nom de la ville
 * 
 * Query params:
 * - period: day, week, month, year (défaut: month)
 */
router.get('/stats/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { period = 'month' } = req.query;

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `location/stats/${city}`, { period });

    // Validation de la ville
    if (!city || city.trim().length < 2) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'city',
        message: MESSAGES.ERROR.VALIDATION.CITY_REQUIRED
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    // Validation de la période
    const validPeriods = ['day', 'week', 'month', 'year'];
    if (!validPeriods.includes(period)) {
      const { errorResponse, statusCode } = ErrorHandler.validationError([{
        field: 'period',
        message: MESSAGES.ERROR.VALIDATION.INVALID_PERIOD
      }]);
      return res.status(statusCode).json(errorResponse);
    }

    const stats = await LocationController.getLocationStats({
      city: city.trim(),
      period
    });

    if (!stats || stats.totalProviders === 0) {
      console.log(DEV_LOGS.API.RESPONSE_SENT, `Aucune donnée pour la ville: ${city}`);
      
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('city', 
        MESSAGES.ERROR.RESOURCE.CITY_NOT_FOUND.replace('{city}', city)
      );
      return res.status(statusCode).json(errorResponse);
    }

    console.log(DEV_LOGS.API.RESPONSE_SENT, `Statistiques chargées pour ${city}`);

    res.success(MESSAGES.SUCCESS.SYSTEM.STATS_LOADED, {
      city: city.trim(),
      period,
      statistics: stats,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'location/stats', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// ROUTES PROTÉGÉES (auth requise)
// =============================================

/**
 * POST /api/location/coordinates/:serviceType/:serviceId
 * Mettre à jour les coordonnées GPS d'un service provider
 * 
 * Paramètres URL:
 * - serviceType: type de service
 * - serviceId: ID du service provider
 * 
 * Body:
 * - lat: latitude (requis)
 * - lon: longitude (requis)
 * - address: adresse complète (optionnel)
 * 
 * Auth: Token JWT requis (propriétaire du service ou admin)
 */
router.post('/coordinates/:serviceType/:serviceId', 
  authenticateToken,
  async (req, res) => {
    try {
      const { serviceType, serviceId } = req.params;
      const { lat, lon, address } = req.body;

      console.log(DEV_LOGS.API.REQUEST_RECEIVED, `location/coordinates/${serviceType}/${serviceId}`, req.body);

      // Validation des paramètres URL
      const validServices = ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare'];
      if (!validServices.includes(serviceType)) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'serviceType',
          message: MESSAGES.ERROR.VALIDATION.INVALID_SERVICE_TYPE
        }]);
        return res.status(statusCode).json(errorResponse);
      }

      if (!serviceId || isNaN(parseInt(serviceId))) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'serviceId',
          message: MESSAGES.ERROR.VALIDATION.INVALID_ID
        }]);
        return res.status(statusCode).json(errorResponse);
      }

      // Validation des coordonnées
      if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'coordinates',
          message: MESSAGES.ERROR.VALIDATION.COORDINATES_REQUIRED
        }]);
        return res.status(statusCode).json(errorResponse);
      }

      // Validation des coordonnées d'Israël
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);
      
      if (latNum < 29.5 || latNum > 33.5 || lonNum < 34.2 || lonNum > 35.9) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'coordinates',
          message: MESSAGES.ERROR.VALIDATION.COORDINATES_OUTSIDE_ISRAEL
        }]);
        return res.status(statusCode).json(errorResponse);
      }

      const updateData = {
        serviceId: parseInt(serviceId),
        serviceType,
        lat: latNum,
        lon: lonNum,
        address: address?.trim(),
        userId: req.user.id
      };

      const result = await LocationController.updateCoordinates(updateData);

      if (!result.success) {
        if (result.error === 'SERVICE_NOT_FOUND') {
          const { errorResponse, statusCode } = ErrorHandler.notFoundError('service');
          return res.status(statusCode).json(errorResponse);
        }
        
        if (result.error === 'ACCESS_DENIED') {
          const { errorResponse, statusCode } = ErrorHandler.permissionError('denied');
          return res.status(statusCode).json(errorResponse);
        }
        
        throw new Error(result.error);
      }

      console.log(DEV_LOGS.BUSINESS.LOCATION_UPDATED, `Service ${serviceId} coordonnées mises à jour`);

      res.success(MESSAGES.SUCCESS.PROVIDER.LOCATION_UPDATED, {
        serviceId: parseInt(serviceId),
        coordinates: { lat: latNum, lon: lonNum },
        address: address?.trim() || null,
        updatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(DEV_LOGS.API.ERROR_OCCURRED, 'location/coordinates', error.message);
      
      const { errorResponse, statusCode } = ErrorHandler.serverError(error);
      res.status(statusCode).json(errorResponse);
    }
  }
);

/**
 * DELETE /api/location/coordinates/:serviceId
 * Supprimer les coordonnées GPS d'un service
 * 
 * Auth: Token JWT requis (propriétaire ou admin)
 */
router.delete('/coordinates/:serviceId',
  authenticateToken,
  async (req, res) => {
    try {
      const { serviceId } = req.params;

      console.log(DEV_LOGS.API.REQUEST_RECEIVED, `location/coordinates/delete/${serviceId}`);

      if (!serviceId || isNaN(parseInt(serviceId))) {
        const { errorResponse, statusCode } = ErrorHandler.validationError([{
          field: 'serviceId',
          message: MESSAGES.ERROR.VALIDATION.INVALID_ID
        }]);
        return res.status(statusCode).json(errorResponse);
      }

      const result = await LocationController.deleteCoordinates({
        serviceId: parseInt(serviceId),
        userId: req.user.id
      });

      if (!result.success) {
        if (result.error === 'SERVICE_NOT_FOUND') {
          const { errorResponse, statusCode } = ErrorHandler.notFoundError('service');
          return res.status(statusCode).json(errorResponse);
        }
        
        if (result.error === 'ACCESS_DENIED') {
          const { errorResponse, statusCode } = ErrorHandler.permissionError('denied');
          return res.status(statusCode).json(errorResponse);
        }
        
        throw new Error(result.error);
      }

      console.log(DEV_LOGS.BUSINESS.LOCATION_DELETED, `Service ${serviceId} coordonnées supprimées`);

      res.success(MESSAGES.SUCCESS.PROVIDER.LOCATION_DELETED, {
        serviceId: parseInt(serviceId)
      });

    } catch (error) {
      console.error(DEV_LOGS.API.ERROR_OCCURRED, 'location/coordinates/delete', error.message);
      
      const { errorResponse, statusCode } = ErrorHandler.serverError(error);
      res.status(statusCode).json(errorResponse);
    }
  }
);

// =============================================
// ROUTES DE TEST (développement uniquement)
// =============================================

/**
 * GET /api/location/test
 * Route de test pour vérifier le bon fonctionnement
 */
router.get('/test', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const { errorResponse, statusCode } = ErrorHandler.notFoundError('resource');
      return res.status(statusCode).json(errorResponse);
    }

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'location/test');

    res.success(MESSAGES.SUCCESS.SYSTEM.API_OPERATIONAL, {
      service: 'Location API HomeSherut',
      version: '2.0',
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /api/location/search/:serviceType',
        'GET /api/location/suggestions',
        'GET /api/location/stats/:city',
        'POST /api/location/coordinates/:serviceType/:serviceId [AUTH]',
        'DELETE /api/location/coordinates/:serviceId [AUTH]'
      ]
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Route error:', error.message);
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

module.exports = router;