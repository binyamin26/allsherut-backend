const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const emailService = require('../services/emailService');

class Review {
  constructor(reviewData) {
    this.id = reviewData.id;
    this.provider_id = reviewData.provider_id;
    this.reviewer_email = reviewData.reviewer_email;
    this.reviewer_name = reviewData.reviewer_name;
    this.service_type = reviewData.service_type;
    this.rating = reviewData.rating;
    this.title = reviewData.title;
    this.comment = reviewData.comment;
    this.is_verified = reviewData.is_verified;
    this.is_published = reviewData.is_published;
    this.helpful_count = reviewData.helpful_count;
    this.created_at = reviewData.created_at;
    this.updated_at = reviewData.updated_at;
    // Nouvelle propriété pour les réponses
    this.provider_response = reviewData.provider_response;
  }

  // =============================================
  // VÉRIFICATION EMAIL ET TOKENS (CONSERVÉ)
  // =============================================

  /**
   * Générer un code de vérification aléatoire
   */
  static generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres
  }

  /**
   * Envoyer un code de vérification par email
   */
  static async sendVerificationCode(name, email, providerId, serviceType) {
    return transaction(async (connection) => {
      try {
        const verificationCode = Review.generateVerificationCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Supprimer les anciens tokens pour cette combinaison email/provider
        await connection.execute(`
          DELETE FROM review_email_tokens 
          WHERE email = ? AND provider_id = ?
        `, [email, providerId]);

        // Insérer le nouveau token
        await connection.execute(`
          INSERT INTO review_email_tokens (
            email, provider_id, service_type, verification_code, 
            reviewer_name, expires_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [email, providerId, serviceType, verificationCode, name, expiresAt]);

        // Envoyer l'email de vérification
        const emailResult = await emailService.sendReviewVerificationEmail(
          email, verificationCode, name, serviceType
        );

        if (emailResult.success) {
          return { 
            success: true, 
            message: 'קוד אימות נשלח בהצלחה',
            expiresAt 
          };
        } else {
          throw new Error('שגיאה בשליחת אימייל: ' + emailResult.error);
        }

      } catch (error) {
        console.error('שגיאה בשליחת קוד אימות:', error);
        throw error;
      }
    });
  }

  /**
   * Vérifier le code de vérification
   */
  static async verifyCode(email, verificationCode, providerId, serviceType) {
    try {
      const tokens = await query(`
        SELECT id, expires_at, reviewer_name, used_at
        FROM review_email_tokens 
        WHERE email = ? AND provider_id = ? AND service_type = ? 
        AND verification_code = ? AND expires_at > NOW()
      `, [email, providerId, serviceType, verificationCode]);

      if (tokens.length === 0) {
        return { 
          success: false, 
          message: 'קוד אימות שגוי או פג תוקף' 
        };
      }

      const token = tokens[0];
      
      if (token.used_at) {
        return { 
          success: false, 
          message: 'קוד האימות כבר נוצל' 
        };
      }

      // Marquer le token comme utilisé
      await query(`
        UPDATE review_email_tokens 
        SET used_at = NOW() 
        WHERE id = ?
      `, [token.id]);

      return { 
        success: true, 
        message: 'קוד אימות תקין',
        reviewerName: token.reviewer_name
      };

    } catch (error) {
      console.error('שגיאה באימות קוד:', error);
      return { 
        success: false, 
        message: 'שגיאה בבדיקת הקוד' 
      };
    }
  }

  // =============================================
  // GESTION DES AVIS SIMPLIFIÉE (SANS MODÉRATION)
  // =============================================

  /**
   * Vérifier si le provider existe
   */
  static async checkProviderExists(providerId, serviceType) {
    try {
      const providers = await query(`
        SELECT id FROM service_providers 
        WHERE id = ? AND is_active = TRUE
      `, [providerId]);

      return providers.length > 0;
    } catch (error) {
      console.error('שגיאה בבדיקת קיום ספק:', error);
      return false;
    }
  }

  /**
   * Vérifier si l'email a déjà laissé un avis pour ce provider
   */
  static async findExistingReview(email, providerId) {
    try {
      const reviews = await query(`
        SELECT id FROM reviews 
        WHERE reviewer_email = ? AND provider_id = ?
      `, [email, providerId]);

      return reviews.length > 0 ? reviews[0] : null;
    } catch (error) {
      console.error('שגיאה בחיפוש ביקורת קיימת:', error);
      return null;
    }
  }

  /**
   * Créer une nouvelle review (PUBLICATION IMMÉDIATE)
   */
 static async createReview(reviewData) {
  return transaction(async (connection) => {
    try {
      const { 
        email, verificationCode, providerId, serviceType, 
        rating, title, comment, displayNameOption = 'private' // AJOUTER ICI
      } = reviewData;

// ✅ CORRECTION: Convertir user_id en service_providers.id si nécessaire
let actualProviderId = providerId;
const [spCheck] = await connection.execute(`
  SELECT sp.id as sp_id 
  FROM service_providers sp 
  WHERE sp.id = ? OR sp.user_id = ?
  LIMIT 1
`, [providerId, providerId]);

if (spCheck.length > 0) {
  actualProviderId = spCheck[0].sp_id;
  console.log(`🔄 Provider ID résolu: ${providerId} → ${actualProviderId}`);
} else {
  return { 
    success: false, 
    message: 'ספק לא נמצא' 
  };
}

// Vérifier que le token existe et a été utilisé récemment
const tokens = await connection.execute(`
  SELECT reviewer_name FROM review_email_tokens 
  WHERE email = ? AND provider_id = ? AND service_type = ? AND verification_code = ?
  AND used_at IS NOT NULL AND used_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
`, [email, providerId, serviceType, verificationCode]);

if (tokens[0].length === 0) {
  return { 
    success: false, 
    message: 'אימות נכשל - קוד לא תקין או פג תוקף' 
  };
}

const fullName = tokens[0][0].reviewer_name || 'לקוח אנונימי';

console.log('🔍 Nom complet récupéré:', fullName);
console.log('🔍 Option d\'affichage:', displayNameOption);

// Générer le nom affiché selon l'option choisie
let reviewerName;
if (displayNameOption === 'anonymous') {
  reviewerName = 'לקוח אנונימי';
} else if (displayNameOption === 'firstname') {
  // Extraire seulement le prénom
  reviewerName = fullName.split(' ')[0];
} else if (displayNameOption === 'full') {
  // Nom complet
  reviewerName = fullName;
} else { // 'private' par défaut
  // Prénom + première lettre du nom de famille
  const nameParts = fullName.split(' ');
  if (nameParts.length > 1) {
    reviewerName = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
  } else {
    reviewerName = nameParts[0];
  }
}

        // NOUVEAU SYSTÈME : PUBLICATION IMMÉDIATE pour tous les avis
      const [result] = await connection.execute(`
  INSERT INTO reviews (
    provider_id, reviewer_email, reviewer_name, service_type,
    rating, comment, is_verified, is_published, helpful_count, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE, 0, NOW())
`, [
  actualProviderId, email, reviewerName, serviceType,
  rating, comment
]);

        const reviewId = result.insertId;


// Mettre à jour le rating moyen du provider
const [avgResult] = await connection.execute(`
  SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
  FROM reviews 
 WHERE provider_id = ? AND is_verified = TRUE AND is_published = TRUE
`, [actualProviderId]);

if (avgResult.length > 0) {
  const avgRating = parseFloat(avgResult[0].avg_rating).toFixed(1);
  await connection.execute(`
    UPDATE service_providers 
    SET average_rating = ? 
    WHERE id = ?
  `, [avgRating, actualProviderId]);
  
  console.log(`📊 Rating moyen mis à jour pour provider ${providerId}: ${avgRating}`);
}
// JUSQU'ICI ↑

// Nettoyer le token
await connection.execute(`
  DELETE FROM review_email_tokens 
  WHERE email = ? AND provider_id = ? AND verification_code = ?
`, [email, providerId, verificationCode]);

        // NOUVEAU : Notification au prestataire pour tous les avis
        await Review.notifyProviderNewReview(actualProviderId, {
          rating,
          reviewerName,
          comment,
          title,
          serviceType
        });

        // Email confirmation au client
        await emailService.sendReviewConfirmationEmail(email, reviewerName, serviceType);
        
        return { 
          success: true, 
          reviewId,
          message: 'הביקורת נוצרה בהצלחה ופורסמה'
        };

      } catch (error) {
        console.error('שגיאה ביצירת ביקורת:', error);
        throw error;
      }
    });
  }

  /**
   * NOUVEAU : Notifier le prestataire d'un nouvel avis
   */
  static async notifyProviderNewReview(providerId, reviewData) {
    try {
      // Récupérer les infos du prestataire
      const providerInfo = await query(`
        SELECT sp.title, u.email as provider_email, u.first_name, u.last_name
        FROM service_providers sp 
        JOIN users u ON sp.user_id = u.id 
        WHERE sp.id = ?
      `, [providerId]);

      if (providerInfo.length > 0) {
        const provider = providerInfo[0];
        
        // Envoyer notification email
        await emailService.sendProviderNewReviewNotification(provider.provider_email, {
          providerName: `${provider.first_name} ${provider.last_name}`,
          providerTitle: provider.title,
          ...reviewData
        });
      }

      return { success: true };
    } catch (error) {
      console.error('שגיאה בשליחת התראה לספק:', error);
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // RÉCUPÉRATION DES AVIS (VERSION SÉCURISÉE) - CORRECTION PRINCIPALE
  // =============================================

/**
 * Récupérer les avis d'un provider avec réponses - VERSION CORRIGÉE
 */
static async getProviderReviews(providerId, options = {}) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'newest' 
    } = options;
    
    const offset = (page - 1) * limit;
    
    // Déterminer l'ordre de tri
    let orderClause = 'r.created_at DESC'; // Par défaut: plus récents
    
    if (sortBy === 'oldest') {
      orderClause = 'r.created_at ASC';
    } else if (sortBy === 'highest_rating') {
      orderClause = 'r.rating DESC, r.created_at DESC';
    } else if (sortBy === 'lowest_rating') {
      orderClause = 'r.rating ASC, r.created_at DESC';
    } else if (sortBy === 'most_helpful') {
      orderClause = 'r.helpful_count DESC, r.created_at DESC';
    }

    console.log(`📖 Récupération avis provider ${providerId} avec réponses, page ${page}`);

    // ✅ AJOUT DU LEFT JOIN AVEC provider_responses
    const reviews = await query(`
      SELECT 
        r.id, 
        r.reviewer_name, 
        r.service_type, 
        r.rating, 
        r.title, 
        r.comment,
        r.helpful_count, 
        r.created_at,
        r.updated_at,
        pr.response_text as provider_response,
        pr.created_at as response_created_at,
        pr.provider_user_id as response_author_id
      FROM reviews r
      LEFT JOIN provider_responses pr ON r.id = pr.review_id
      WHERE r.provider_id = ? 
        AND r.is_verified = TRUE 
        AND r.is_published = TRUE
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `, [providerId, limit, offset]);

    // Compter le total d'avis
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM reviews r
      WHERE r.provider_id = ? 
        AND r.is_verified = TRUE 
        AND r.is_published = TRUE
    `, [providerId]);

    const totalReviews = countResult[0].total;
    const totalPages = Math.ceil(totalReviews / limit);

    // Récupérer les statistiques
    const stats = await Review.getProviderStats(providerId);

    console.log(`✅ Trouvé ${reviews.length} avis pour provider ${providerId}`);

    return {
      success: true,
      reviews: reviews.map(review => {
        const reviewObj = new Review(review);
        // Ajouter la réponse prestataire si elle existe
        if (review.provider_response) {
          reviewObj.provider_response = {
            responseText: review.provider_response,
            createdAt: review.response_created_at,
            authorId: review.response_author_id
          };
        }
        return reviewObj;
      }),
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalReviews: totalReviews,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: limit
      },
      stats: stats
    };

  } catch (error) {
    console.error('❌ Erreur getProviderReviews:', error.message);
    return { 
      success: false, 
      message: 'שגיאה בטעינת הביקורות',
      reviews: [],
      pagination: null,
      stats: null
    };
  }
}

  /**
   * Récupérer les statistiques d'un provider
   */
  static async getProviderStats(providerId) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
          SUM(helpful_count) as total_helpful
        FROM reviews 
        WHERE provider_id = ? AND is_verified = TRUE AND is_published = TRUE
      `, [providerId]);

      if (stats.length === 0) {
        return {
          total_reviews: 0,
          average_rating: 0,
          rating_distribution: [0, 0, 0, 0, 0],
          total_helpful: 0
        };
      }

      const stat = stats[0];
      return {
        total_reviews: stat.total_reviews,
        average_rating: parseFloat(stat.average_rating || 0).toFixed(1),
        rating_distribution: [
          stat.one_star || 0,
          stat.two_stars || 0, 
          stat.three_stars || 0,
          stat.four_stars || 0,
          stat.five_stars || 0
        ],
        total_helpful: stat.total_helpful || 0
      };

    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות:', error);
      return null;
    }
  }

  // =============================================
  // NOUVEAU SYSTÈME DE RÉPONSES PRESTATAIRES
  // =============================================

  /**
   * Créer une réponse prestataire
   */
  static async createProviderResponse(reviewId, providerUserId, responseText) {
    try {
      // Vérifier que le prestataire peut répondre à cet avis
      const canRespond = await query(`
        SELECT r.id, r.reviewer_name, r.reviewer_email, r.service_type
        FROM reviews r 
        JOIN service_providers sp ON r.provider_id = sp.id 
        WHERE r.id = ? AND sp.user_id = ? AND r.is_verified = TRUE
      `, [reviewId, providerUserId]);

      if (canRespond.length === 0) {
        return { 
          success: false, 
          message: 'אינך מורשה להגיב על ביקורת זו' 
        };
      }

      // Vérifier s'il y a déjà une réponse
      const existingResponse = await query(`
        SELECT id FROM provider_responses WHERE review_id = ?
      `, [reviewId]);

      if (existingResponse.length > 0) {
        return { 
          success: false, 
          message: 'כבר השבת על הביקורת הזו' 
        };
      }

// Créer la réponse
const result = await query(`
  INSERT INTO provider_responses (review_id, provider_user_id, response_text, created_at)
  VALUES (?, ?, ?, NOW())
`, [reviewId, providerUserId, responseText]);

return { 
  success: true, 
  responseId: result.insertId,
        message: 'התגובה נוספה בהצלחה'
      };

    } catch (error) {
      console.error('שגיאה ביצירת תגובה:', error);
      return { success: false, message: 'שגיאה ביצירת התגובה' };
    }
  }

  /**
   * Récupérer les avis d'un prestataire pour son dashboard
   */
 static async getProviderDashboardReviews(providerUserId, options = {}) {
    try {
      const { page = 1, limit = 10, includeResponded = true, serviceType } = options; // ✅ AJOUTER serviceType
      const offset = (page - 1) * limit;
 console.log('🔍 Dashboard reviews - userId:', providerUserId, 'serviceType:', serviceType); // ← AJOUTER

      let whereClause = '';
      if (!includeResponded) {
        whereClause = 'AND pr.id IS NULL';
      }
      
      // ✅ AJOUTER: Filtre par service_type si fourni
      if (serviceType) {
        whereClause += ' AND r.service_type = ?';
      }

      // ✅ MODIFIER: Paramètres dynamiques
      const params = serviceType 
        ? [providerUserId, serviceType, limit, offset]
        : [providerUserId, limit, offset];
 console.log('🔍 Params:', params); // ← AJOUTER
      console.log('🔍 WhereClause:', whereClause); // ← AJOUTER
      const reviews = await query(`
        SELECT 
          r.id, r.reviewer_name, r.service_type, r.rating, r.title, r.comment,
          r.helpful_count, r.created_at,
          DATE_FORMAT(r.created_at, '%d/%m/%Y') as formatted_date,
          pr.response_text as provider_response,
          pr.created_at as response_created_at,
          CASE WHEN pr.id IS NULL THEN FALSE ELSE TRUE END as has_response
        FROM reviews r
        JOIN service_providers sp ON r.provider_id = sp.id
        LEFT JOIN provider_responses pr ON r.id = pr.review_id
        WHERE sp.user_id = ? AND r.is_verified = TRUE AND r.is_published = TRUE
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `, params); // ✅ UTILISER params

    // Compter le total - ✅ AJOUTER filtre serviceType
      const countWhereClause = serviceType ? 'AND r.service_type = ?' : '';
      const countParams = serviceType ? [providerUserId, serviceType] : [providerUserId];
      
      const totalResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(pr.id) as with_response,
          COUNT(*) - COUNT(pr.id) as without_response
        FROM reviews r
        JOIN service_providers sp ON r.provider_id = sp.id
        LEFT JOIN provider_responses pr ON r.id = pr.review_id
        WHERE sp.user_id = ? AND r.is_verified = TRUE AND r.is_published = TRUE
        ${countWhereClause}
      `, countParams);

      const stats = totalResult[0];

      return {
        success: true,
        reviews: reviews.map(review => new Review(review)),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(stats.total / limit),
          totalReviews: stats.total,
          hasNext: page < Math.ceil(stats.total / limit),
          hasPrev: page > 1
        },
        responseStats: {
          total: stats.total,
          withResponse: stats.with_response,
          withoutResponse: stats.without_response,
          responseRate: stats.total > 0 ? ((stats.with_response / stats.total) * 100).toFixed(1) : 0
        }
      };

    } catch (error) {
      console.error('שגיאה בטעינת ביקורות לדשבורד:', error);
      return { success: false, message: 'שגיאה בטעינת הביקורות' };
    }
  }

  // =============================================
  // UTILITAIRES (CONSERVÉS)
  // =============================================

  /**
   * Marquer une review comme utile
   */
  static async markHelpful(reviewId) {
    try {
      const result = await query(`
        UPDATE reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = ? AND is_verified = TRUE AND is_published = TRUE
      `, [reviewId]);

      if (result.affectedRows === 0) {
        return { success: false, message: 'ביקורת לא נמצאה' };
      }

      // Récupérer le nouveau nombre
      const updated = await query(`
        SELECT helpful_count FROM reviews WHERE id = ?
      `, [reviewId]);

      return { 
        success: true, 
        helpfulCount: updated[0].helpful_count 
      };

    } catch (error) {
      console.error('שגיאה בסימון ביקורת כמועילה:', error);
      return { success: false, message: 'שגיאה בעדכון הביקורת' };
    }
  }

  /**
   * Nettoyer les tokens expirés
   */
  static async cleanupExpiredTokens() {
    try {
      const result = await query(`
        DELETE FROM review_email_tokens 
        WHERE expires_at < NOW() OR used_at IS NOT NULL
      `);

      console.log(`נוקו ${result.affectedRows} קודי אימות פגי תוקף`);
      return result.affectedRows || 0;

    } catch (error) {
      console.error('שגיאה בניקוי קודים:', error);
      return 0;
    }
  }

  /**
   * Récupérer les avis récents (pour debug)
   */
  static async getRecentReviews(limit = 50) {
    try {
      const reviews = await query(`
        SELECT 
          r.id, r.provider_id, r.reviewer_name, r.service_type,
          r.rating, r.title, r.comment, r.is_published, r.created_at,
          sp.title as provider_name
        FROM reviews r
        LEFT JOIN service_providers sp ON r.provider_id = sp.id
        WHERE r.is_verified = TRUE
        ORDER BY r.created_at DESC
        LIMIT ?
      `, [limit]);

      return reviews.map(review => new Review(review));

    } catch (error) {
      console.error('שגיאה בטעינת ביקורות לבדיקה:', error);
      return [];
    }
  }

  /**
   * Obtenir la représentation JSON
   */
  toJSON() {
    return {
      id: this.id,
      providerId: this.provider_id,
      reviewerName: this.reviewer_name,
      serviceType: this.service_type,
      rating: this.rating,
      title: this.title,
      comment: this.comment,
      isVerified: this.is_verified,
      isPublished: this.is_published,
      helpfulCount: this.helpful_count,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      providerResponse: this.provider_response
    };
  }
}

module.exports = Review;