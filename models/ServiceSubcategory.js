const { query } = require('../config/database');

class ServiceSubcategory {
  /**
   * Récupère toutes les sous-catégories actives d'un service
   * @param {number} serviceId - ID du service (5 pour tutoring)
   * @returns {Array} Liste des sous-catégories
   */
static async getByServiceId(serviceId) {
    try {
      return await query(`
        SELECT
          id,
          name_he,
          name_en,
          name_fr,
          name_ru,
          icon,
          display_order
        FROM service_subcategories
        WHERE service_id = ? AND is_active = true
        ORDER BY display_order ASC
      `, [serviceId]);
    } catch (error) {
      console.error('שגיאה בטעינת תת-קטגוריות:', error);
      throw error;
    }
  }

  /**
   * Récupère les sous-catégories groupées par thème
   * @param {number} serviceId - ID du service
   * @returns {Object} Sous-catégories groupées par catégorie principale
   */
  static async getGrouped(serviceId) {
    try {
      const subcategories = await this.getByServiceId(serviceId);
      
      // Groupement basé sur display_order (défini dans votre SQL)
      const groups = {
          academic: { 
    title: 'מקצועות לימוד', 
    items: subcategories.filter(s => s.display_order >= 200 && s.display_order <= 223) 
  },
        music: { 
          title: 'מוזיקה וכלי נגינה', 
          items: subcategories.filter(s => s.display_order >= 1 && s.display_order <= 7) 
        },
        art: { 
          title: 'אמנות חזותית', 
          items: subcategories.filter(s => s.display_order >= 10 && s.display_order <= 16) 
        },
        dance: { 
          title: 'מחול ותנועה', 
          items: subcategories.filter(s => s.display_order >= 20 && s.display_order <= 24) 
        },
        theater: { 
          title: 'תיאטרון ובמה', 
          items: subcategories.filter(s => s.display_order >= 30 && s.display_order <= 33) 
        },
        languages: { 
          title: 'שפות ותרבויות', 
          items: subcategories.filter(s => s.display_order >= 40 && s.display_order <= 46) 
        },
        crafts: { 
          title: 'יצירה ועבודות יד', 
          items: subcategories.filter(s => s.display_order >= 50 && s.display_order <= 54) 
        },
        tech: { 
          title: 'טכנולוגיה ומדע יישומי', 
          items: subcategories.filter(s => s.display_order >= 60 && s.display_order <= 64) 
        },
        cooking: { 
          title: 'קולינריה', 
          items: subcategories.filter(s => s.display_order >= 70 && s.display_order <= 73) 
        },
        personal: { 
          title: 'פיתוח אישי ומיומנויות', 
          items: subcategories.filter(s => s.display_order >= 80 && s.display_order <= 84) 
        },
        sports: { 
          title: 'ספורט', 
          items: subcategories.filter(s => s.display_order >= 90 && s.display_order <= 109) 
        }
      };
      
      // Retourne seulement les groupes qui ont des items
      return Object.fromEntries(
        Object.entries(groups).filter(([key, group]) => group.items.length > 0)
      );
    } catch (error) {
      console.error('שגיאה בקיבוץ תת-קטגוריות:', error);
      throw error;
    }
  }

  /**
   * Récupère une sous-catégorie spécifique par ID
   * @param {number} subcategoryId - ID de la sous-catégorie
   * @returns {Object|null} Sous-catégorie ou null
   */
  static async getById(subcategoryId) {
    try {
      const results = await query(`
        SELECT 
          id, 
          service_id,
          name_he, 
          name_en, 
          icon, 
          display_order,
          is_active
        FROM service_subcategories
        WHERE id = ?
      `, [subcategoryId]);
      
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('שגיאה בטעינת תת-קטגוריה:', error);
      throw error;
    }
  }

  /**
   * Vérifie si une sous-catégorie existe et est active
   * @param {number} subcategoryId - ID de la sous-catégorie
   * @returns {boolean} true si existe et active
   */
  static async isActive(subcategoryId) {
    try {
      const results = await query(`
        SELECT id 
        FROM service_subcategories
        WHERE id = ? AND is_active = true
      `, [subcategoryId]);
      
      return results.length > 0;
    } catch (error) {
      console.error('שגיאה בבדיקת סטטוס תת-קטגוריה:', error);
      return false;
    }
  }
}

module.exports = ServiceSubcategory;