const { query } = require('../config/database');

class Location {
  
  /**
   * Recherche des services par localisation - VERSION SIMPLIFIÉE POUR MySQL
   */
  static async searchServicesByLocation(searchParams) {
    try {
      const {
        serviceType,
        city,
        neighborhood,
        limit = 20,
        offset = 0
      } = searchParams;

      // Construire la requête SQL directement (sans paramètres préparés)
      let sqlQuery = `
        SELECT 
          sp.*,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.premium_until
        FROM service_providers sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.is_active = 1 
          AND u.is_active = 1
          AND sp.location_city = '${city}'
      `;

      // Ajouter les filtres
      if (serviceType && serviceType !== 'all') {
        sqlQuery += ` AND sp.service_type = '${serviceType}'`;
      }

      if (neighborhood) {
        sqlQuery += ` AND sp.location_area = '${neighborhood}'`;
      }

      sqlQuery += `
        ORDER BY 
          (u.premium_until > NOW()) DESC,
          sp.is_featured DESC,
          sp.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      console.log('Requête SQL finale:', sqlQuery);

      const results = await query(sqlQuery);

      return {
        success: true,
        results: results.map(service => ({
          id: service.id,
          userId: service.user_id,
          name: `${service.first_name} ${service.last_name}`,
          serviceType: service.service_type,
          title: service.title,
          description: service.description,
          hourlyRate: service.hourly_rate,
          location: {
            city: service.location_city,
            area: service.location_area
          },
          isPremium: service.premium_until && new Date(service.premium_until) > new Date(),
          contact: {
            phone: service.phone,
            email: service.email
          }
        })),
        count: results.length,
        search: {
          serviceType,
          city,
          neighborhood
        }
      };

    } catch (error) {
      console.error('Erreur recherche services:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Suggestions d'autocomplétion - VERSION SIMPLIFIÉE
   */
  static async getLocationSuggestions(searchTerm, serviceType = null) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return {
          success: true,
          suggestions: []
        };
      }

      // Chercher les villes dans ta table service_providers
      let cityQuery = `
        SELECT DISTINCT location_city as city, COUNT(*) as count
        FROM service_providers 
        WHERE location_city LIKE ? 
          AND location_city IS NOT NULL 
          AND is_active = 1
      `;
      
      const cityParams = [`%${searchTerm}%`];
      
      if (serviceType && serviceType !== 'all') {
        cityQuery += ' AND service_type = ?';
        cityParams.push(serviceType);
      }
      
      cityQuery += ' GROUP BY location_city ORDER BY count DESC LIMIT 8';

      const cities = await query(cityQuery, cityParams);

      // Chercher les quartiers
      let neighborhoodQuery = `
        SELECT DISTINCT 
          location_city as city, 
          location_area as neighborhood,
          COUNT(*) as count
        FROM service_providers 
        WHERE location_area LIKE ? 
          AND location_area IS NOT NULL 
          AND is_active = 1
      `;
      
      const neighborhoodParams = [`%${searchTerm}%`];
      
      if (serviceType && serviceType !== 'all') {
        neighborhoodQuery += ' AND service_type = ?';
        neighborhoodParams.push(serviceType);
      }
      
      neighborhoodQuery += ' GROUP BY location_city, location_area ORDER BY count DESC LIMIT 8';

      const neighborhoods = await query(neighborhoodQuery, neighborhoodParams);

      return {
        success: true,
        suggestions: [
          ...cities.map(row => ({
            type: 'city',
            value: row.city,
            label: `${row.city} (${row.count} services)`,
            count: row.count
          })),
          ...neighborhoods.map(row => ({
            type: 'neighborhood',
            value: `${row.city}, ${row.neighborhood}`,
            label: `${row.neighborhood}, ${row.city} (${row.count} services)`,
            city: row.city,
            neighborhood: row.neighborhood,
            count: row.count
          }))
        ]
      };

    } catch (error) {
      console.error('Erreur suggestions:', error);
      return {
        success: false,
        suggestions: []
      };
    }
  }

  /**
   * Recherche étendue - VERSION SIMPLIFIÉE (pour plus tard)
   */
  static async extendedLocationSearch(searchParams) {
    try {
      // Pour l'instant, juste faire une recherche normale
      const normalResults = await this.searchServicesByLocation(searchParams);
      
      console.log('Recherche étendue pas encore implémentée - utilisation recherche normale');
      return normalResults;

    } catch (error) {
      console.error('Erreur recherche étendue:', error);
      throw error;
    }
  }

  /**
   * Compter les services par ville
   */
  static async getServiceCountByCity(city, serviceType = null) {
    try {
      let countQuery = `
        SELECT COUNT(*) as count
        FROM service_providers 
        WHERE location_city = ? AND is_active = 1
      `;
      
      const queryParams = [city];
      
      if (serviceType && serviceType !== 'all') {
        countQuery += ' AND service_type = ?';
        queryParams.push(serviceType);
      }

      const result = await query(countQuery, queryParams);
      
      return {
        success: true,
        count: result[0]?.count || 0
      };

    } catch (error) {
      console.error('Erreur count services:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Mettre à jour les coordonnées GPS d'un service
   */
  static async updateServiceCoordinates(serviceType, serviceId, lat, lon) {
    try {
      // Update dans ta table service_providers
      const result = await query(`
        UPDATE service_providers 
        SET latitude = ?, longitude = ?, updated_at = NOW()
        WHERE id = ? AND service_type = ?
      `, [lat, lon, serviceId, serviceType]);

      return {
        success: true,
        message: 'Coordonnées mises à jour',
        updated: result.affectedRows > 0
      };

    } catch (error) {
      console.error('Erreur update coordinates:', error);
      return {
        success: false,
        message: 'Erreur lors de la mise à jour'
      };
    }
  }
}

module.exports = Location;