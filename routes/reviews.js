const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const emailService = require('../services/emailService');
const Review = require('../models/Review');
const jwt = require('jsonwebtoken');

// =============================================
// MIDDLEWARE D'AUTHENTIFICATION
// =============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'נדרש אימות'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'טוקן לא תקין'
      });
    }
    req.user = user;
    next();
  });
};

// =============================================
// FONCTIONS UTILITAIRES
// =============================================
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// =============================================
// ROUTES SYSTÈME D'AVIS (CONSERVÉES MAIS SIMPLIFIÉES)
// =============================================

// ROUTE 1: ENVOYER CODE DE VÉRIFICATION
router.post('/send-verification', async (req, res) => {
  try {
    console.log('📧 Demande code vérification avis');
    const { name, email, providerId, serviceType } = req.body;
    
    // Validation des données
    if (!name || !email || !providerId || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'נתונים חסרים - נדרש שם, אימייל, ספק ושירות'
      });
    }
    
    // Vérifier format email
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email.trim())) {
  return res.status(400).json({
        success: false,
        message: 'כתובת אימייל לא תקינה'
      });
    }

    // Vérifier si cet email a déjà laissé un avis pour ce provider
const existingReview = await Review.findExistingReview(email, providerId);
if (existingReview) {
  return res.status(400).json({
    success: false,
    message: 'כבר השארת ביקורת לספק זה עם כתובת אימייל זו'
  });
}
    
    // Générer code de vérification
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    console.log(`🔑 Code généré: ${verificationCode} pour ${email} (expire: ${expiresAt})`);
    
    // Supprimer les anciens tokens pour cette combinaison
    await query(`
      DELETE FROM review_email_tokens 
      WHERE email = ? AND provider_id = ? AND service_type = ?
   `, [email.trim(), providerId, serviceType]);
    
    // Insérer le nouveau token
    await query(`
      INSERT INTO review_email_tokens (
        email, provider_id, service_type, verification_code, 
        reviewer_name, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [email, providerId, serviceType, verificationCode, name, expiresAt]);
    
    console.log('💾 Token sauvegardé en base de données');
    
    // Envoyer l'email
    const emailResult = await emailService.sendReviewVerificationEmail(
      email, verificationCode, name, serviceType
    );
    
    if (emailResult.success) {
      console.log('✅ Email de vérification envoyé');
      res.json({
        success: true,
        message: 'קוד אימות נשלח לכתובת האימייל'
      });
    } else {
      console.error('❌ Erreur envoi email:', emailResult.error);
      res.status(500).json({
        success: false,
        message: 'שגיאה בשליחת אימייל אימות'
      });
    }
    
  } catch (error) {
    console.error('🔴 Erreur send-verification:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאת שרת פנימית'
    });
  }
});

// ROUTE 2: VÉRIFIER CODE REÇU PAR EMAIL
router.post('/verify-code', async (req, res) => {
  try {
    console.log('🔍 Vérification code avis');
    const { email, verificationCode, providerId, serviceType } = req.body;
    
    // Validation des données
    if (!email || !verificationCode || !providerId || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'נתונים חסרים לאימות קוד'
      });
    }
    
    console.log(`🔑 Vérification code: ${verificationCode} pour ${email}`);
    
    // Chercher le token valide
    const tokens = await query(`
      SELECT id, expires_at, reviewer_name, used_at
      FROM review_email_tokens 
      WHERE email = ? AND provider_id = ? AND service_type = ? 
      AND verification_code = ? AND expires_at > NOW()
    `, [email, providerId, serviceType, verificationCode]);
    
    if (tokens.length === 0) {
      console.log('❌ Code invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'קוד אימות שגוי או פג תוקף'
      });
    }
    
    const token = tokens[0];
    
    // Vérifier si déjà utilisé
    if (token.used_at) {
      console.log('❌ Code déjà utilisé');
      return res.status(400).json({
        success: false,
        message: 'קוד האימות כבר נוצל'
      });
    }
    
    // Marquer le token comme utilisé
    await query(`
      UPDATE review_email_tokens 
      SET used_at = NOW() 
      WHERE id = ?
    `, [token.id]);
    
    console.log('✅ Code valide - marqué comme utilisé');
    
    res.json({
      success: true,
      message: 'קוד אימות תקין',
      reviewerName: token.reviewer_name
    });
    
  } catch (error) {
    console.error('🔴 Erreur verify-code:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בבדיקת הקוד'
    });
  }
});

// ROUTE 3: CRÉER L'AVIS APRÈS VÉRIFICATION (SIMPLIFIÉ - PUBLICATION IMMÉDIATE)
router.post('/create', async (req, res) => {
  try {
    console.log('📝 Création avis avec publication immédiate');
    console.log('📋 Données reçues:', JSON.stringify(req.body, null, 2));
    
    const { email, verificationCode, providerId, serviceType, rating, title, comment, displayNameOption } = req.body;
    
    // Validation des données obligatoires
    if (!email || !verificationCode || !providerId || !serviceType || !rating || !comment) {
      console.log('❌ ÉCHEC: Données manquantes');
      return res.status(400).json({
        success: false,
        message: 'נתונים חסרים - נדרש אימייל, קוד, ספק, שירות, דירוג והערה'
      });
    }
    
    // Validation du rating
    if (rating < 1 || rating > 5) {
      console.log('❌ ÉCHEC: Rating invalide:', rating);
      return res.status(400).json({
        success: false,
        message: 'דירוג חייב להיות בין 1 ל-5'
      });
    }
    
    // Validation longueur commentaire
    if (comment.trim().length < 3) {
      console.log('❌ ÉCHEC: Commentaire trop court:', comment.length);
      return res.status(400).json({
        success: false,
        message: 'ההערה חייבת להכיל לפחות 3 תווים'
      });
    }
    
    console.log(`⭐ Création avis ${rating}/5 pour provider ${providerId} par ${email}`);
    
    // NOUVEAU SYSTÈME : CRÉATION SIMPLIFIÉE avec publication immédiate
    const result = await Review.createReview({
      email,
      verificationCode,
      providerId,
      serviceType,
      rating,
      title,
      comment,
       displayNameOption
    });
    
    if (!result.success) {
      console.log('❌ Échec création avis:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    console.log(`✅ Avis créé et publié avec ID: ${result.reviewId}`);
    
    res.json({
      success: true,
      reviewId: result.reviewId,
      message: 'הביקורת נוצרה בהצלחה ופורסמה מיד'
    });
    
  } catch (error) {
    console.error('🔴 Erreur create review:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה ביצירת הביקורת'
    });
  }
});

// ROUTE 4: RÉCUPÉRER LES AVIS D'UN PROVIDER (AVEC RÉPONSES)
router.get('/provider/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'newest';
    
    console.log(`📖 Récupération avis provider ${providerId}, page ${page}, limit ${limit}`);
    
    const result = await Review.getProviderReviews(providerId, {
      page,
      limit,
      sortBy
    });
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    console.log(`✅ Trouvé ${result.reviews.length} avis pour provider ${providerId}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('🔴 Erreur get reviews:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת הביקורות'
    });
  }
});

// =============================================
// NOUVELLES ROUTES SYSTÈME RÉPONSES PRESTATAIRES
// =============================================

// ROUTE 5: CRÉER UNE RÉPONSE PRESTATAIRE
router.post('/:reviewId/respond', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { responseText } = req.body;
    const providerUserId = req.user.userId;
    
    console.log(`📝 Tentative réponse prestataire user ${providerUserId} pour review ${reviewId}`);
    
    // Validation
    if (!responseText || responseText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'התגובה חייבת להכיל לפחות 10 תווים'
      });
    }
    
    if (responseText.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'התגובה ארוכה מדי (מקסימום 1000 תווים)'
      });
    }
    
    const result = await Review.createProviderResponse(
      reviewId,
      providerUserId,
      responseText.trim()
    );
    
    if (result.success) {
      console.log(`✅ Réponse créée avec ID: ${result.responseId}`);
    } else {
      console.log(`❌ Échec création réponse: ${result.message}`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('🔴 Erreur create provider response:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה ביצירת התגובה'
    });
  }
});

router.get('/my-reviews', authenticateToken, async (req, res) => {
  try {
    const providerUserId = req.user.userId; // ✅ userId, pas id
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const includeResponded = req.query.includeResponded !== 'false';
    const serviceType = req.query.service_type; // AJOUTER CETTE LIGNE
    
    console.log(`📊 Dashboard avis pour prestataire user ${providerUserId}${serviceType ? ` - service: ${serviceType}` : ''}`); // MODIFIER
    
    const result = await Review.getProviderDashboardReviews(providerUserId, {
      page,
      limit,
      includeResponded,
      serviceType // AJOUTER CETTE LIGNE
    });
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    console.log(`✅ Dashboard: ${result.reviews.length} avis, ${result.responseStats.withoutResponse} sans réponse`);
    
    res.json(result);
    
  } catch (error) {
    console.error('🔴 Erreur dashboard reviews:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת הביקורות שלך'
    });
  }
});

// ROUTE 7: OBTENIR UN AVIS SPÉCIFIQUE AVEC RÉPONSE (pour édition)
router.get('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const providerUserId = req.user.id;
    
    console.log(`🔍 Récupération avis ${reviewId} pour prestataire ${providerUserId}`);
    
    // Vérifier que l'avis appartient à ce prestataire
    const review = await query(`
      SELECT 
        r.id, r.reviewer_name, r.service_type, r.rating, r.title, r.comment,
        r.helpful_count, r.created_at,
        DATE_FORMAT(r.created_at, '%d/%m/%Y') as formatted_date,
        pr.response_text as provider_response,
        pr.created_at as response_created_at,
        sp.title as provider_title
      FROM reviews r
      JOIN service_providers sp ON r.provider_id = sp.id
      LEFT JOIN provider_responses pr ON r.id = pr.review_id
      WHERE r.id = ? AND sp.user_id = ? AND r.is_verified = TRUE
    `, [reviewId, providerUserId]);
    
    if (review.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ביקורת לא נמצאה'
      });
    }
    
    console.log(`✅ Avis trouvé: ${review[0].rating}⭐ par ${review[0].reviewer_name}`);
    
    res.json({
      success: true,
      review: new Review(review[0]).toJSON()
    });
    
  } catch (error) {
    console.error('🔴 Erreur get single review:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת הביקורת'
    });
  }
});

// =============================================
// ROUTES UTILITAIRES (CONSERVÉES)
// =============================================

// ROUTE 8: MARQUER AVIS COMME UTILE
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    console.log(`👍 Marquer avis ${reviewId} comme utile`);
    
    const result = await Review.markHelpful(reviewId);
    
    if (result.success) {
      console.log(`✅ Avis ${reviewId} marqué comme utile`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('🔴 Erreur mark helpful:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון הביקורת'
    });
  }
});

// ROUTE 9: STATISTIQUES D'UN PROVIDER
router.get('/provider/:providerId/stats', async (req, res) => {
  try {
    const { providerId } = req.params;
    
    console.log(`📊 Récupération stats provider ${providerId}`);
    
    const stats = await Review.getProviderStats(providerId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'ספק לא נמצא'
      });
    }
    
    console.log(`✅ Stats récupérées pour provider ${providerId}`);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('🔴 Erreur get stats:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סטטיסטיקות'
    });
  }
});

// ROUTE 10: VÉRIFIER SI AVIS DÉJÀ EXISTANT
router.get('/check-existing/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'אימייל נדרש'
      });
    }
    
    console.log(`🔍 Vérification avis existant: ${email} pour provider ${providerId}`);
    
    const existingReview = await Review.findExistingReview(email, providerId);
    
    res.json({
      success: true,
      hasExistingReview: !!existingReview,
      message: existingReview 
        ? 'כבר השארת ביקורת לספק זה' 
        : 'ניתן להשאיר ביקורת'
    });
    
  } catch (error) {
    console.error('🔴 Erreur check existing:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בבדיקת ביקורת קיימת'
    });
  }
});

// ROUTE 11: OBTENIR AVIS RÉCENTS (POUR DEBUG)
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    console.log(`📋 Récupération ${limit} avis récents`);
    
    const reviews = await Review.getRecentReviews(limit);
    
    res.json({
      success: true,
      reviews,
      message: `נמצאו ${reviews.length} ביקורות אחרונות`
    });
    
  } catch (error) {
    console.error('🔴 Erreur get recent:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת ביקורות אחרונות'
    });
  }
});

module.exports = router;