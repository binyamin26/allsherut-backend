// controllers/locationController.js
const Location = require('../models/Location');
const israelLocations = require('../data/israelLocations');

class LocationController {
  /**
   * API endpoint: Rechercher des services par localisation
   * GET /api/location/search/:serviceType
   */
  static async searchServices(req, res) {
    try {
      const { serviceType } = req.params;
      const {
        city,
        neighborhood,
        radius,
        lat,
        lon,
        limit = 20,
        offset = 0,
        extended = false
      } = req.query;

      // Validation des paramètres
      if (!serviceType) {
        return res.status(400).json({
          success: false,
          error: 'Type de service requis'
        });
      }

      if (!city) {
        return res.status(400).json({
          success: false,
          error: 'Ville requise'
        });
      }

      // Valider et normaliser la ville
      const normalizedCity = normalizeCity(city);
      if (!normalizedCity) {
        return res.status(400).json({
          success: false,
          error: 'Ville non reconnue',
          suggestions: await Location.getLocationSuggestions(city, serviceType)
        });
      }

      const searchParams = {
        serviceType,
        city: normalizedCity,
        neighborhood,
        radius: radius ? parseFloat(radius) : null,
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      // Recherche normale ou étendue
      const results = extended === 'true' 
        ? await Location.extendedLocationSearch(searchParams)
        : await Location.searchServicesByLocation(searchParams);

      res.json(results);
    } catch (error) {
      console.error('Erreur endpoint recherche localisation:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: error.message
      });
    }
  }

  /**
   * API endpoint: Autocomplétion pour les localisations
   * GET /api/location/suggestions
   */
  static async getSuggestions(req, res) {
    try {
      const { q: query, serviceType } = req.query;

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          suggestions: []
        });
      }

      const results = await Location.getLocationSuggestions(query, serviceType);
      res.json(results);
    } catch (error) {
      console.error('Erreur endpoint suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        suggestions: []
      });
    }
  }

  /**
   * API endpoint: Statistiques par localisation
   * GET /api/location/stats/:city
   */
  static async getLocationStats(req, res) {
    try {
      const { city } = req.params;
      const normalizedCity = normalizeCity(city);
      
      if (!normalizedCity) {
        return res.status(400).json({
          success: false,
          error: 'Ville non reconnue'
        });
      }

      const stats = {};
      const serviceTypes = ['babysitting', 'menage', 'jardinage', 'aide_personne_agee', 'soutien_scolaire', 'garde_animaux'];

      // Compter les services par type
      for (const serviceType of serviceTypes) {
        const countResult = await Location.getServiceCountByCity(normalizedCity, serviceType);
        stats[serviceType] = countResult.count || 0;
      }

      res.json({
        success: true,
        city: normalizedCity,
        stats,
        total: Object.values(stats).reduce((sum, count) => sum + count, 0)
      });
    } catch (error) {
      console.error('Erreur endpoint stats localisation:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur serveur'
      });
    }
  }

  /**
   * API endpoint: Mettre à jour coordonnées GPS
   * POST /api/location/coordinates/:serviceType/:serviceId
   */
  static async updateCoordinates(req, res) {
    try {
      const { serviceType, serviceId } = req.params;
      const { lat, lon } = req.body;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées GPS requises'
        });
      }

      const result = await Location.updateServiceCoordinates(
        serviceType, 
        serviceId, 
        parseFloat(lat), 
        parseFloat(lon)
      );

      res.json(result);
    } catch (error) {
      console.error('Erreur mise à jour coordonnées:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur serveur'
      });
    }
  }
}

module.exports = LocationController;