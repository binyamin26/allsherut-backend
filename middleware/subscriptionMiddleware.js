const Subscription = require('../models/Subscription');

// =============================================
// MIDDLEWARE VÉRIFICATION ABONNEMENT
// =============================================

/**
 * Middleware pour vérifier que le prestataire a un abonnement actif
 * Bloque l'accès aux fonctionnalités premium si l'abonnement est expiré
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'נדרש להתחבר למערכת',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Vérifier que c'est un prestataire
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'הגישה מוגבלת לספקים בלבד',
        code: 'PROVIDER_ONLY'
      });
    }

    // Récupérer l'abonnement actif
    const subscription = await Subscription.getActiveSubscription(req.user.id);
    
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'נדרש מנוי פעיל לביצוע פעולה זו',
        code: 'NO_SUBSCRIPTION',
        action: 'upgrade',
        redirectUrl: '/billing/upgrade'
      });
    }

    // Vérifier si l'abonnement est vraiment actif (pas expiré)
    if (!subscription.isActive()) {
      const daysExpired = Math.abs(subscription.daysRemaining());
      
      return res.status(403).json({
        success: false,
        message: `המנוי פג לפני ${daysExpired} ימים`,
        code: 'SUBSCRIPTION_EXPIRED',
        action: 'renew',
        redirectUrl: '/billing/upgrade',
        data: {
          expiredDays: daysExpired,
          expiredAt: subscription.expires_at
        }
      });
    }

    // Ajouter l'abonnement au request pour usage ultérieur
    req.subscription = subscription;
    
    next();

  } catch (error) {
    console.error('שגיאה בבדיקת מנוי:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בבדיקת סטטוס המנוי',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

/**
 * Middleware plus souple - permet l'accès mais ajoute les infos d'abonnement
 * Utilisé pour les endpoints où on veut juste savoir le statut sans bloquer
 */
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    // Initialiser les infos d'abonnement par défaut
    req.subscriptionInfo = {
      hasSubscription: false,
      isActive: false,
      isTrial: false,
      daysRemaining: 0,
      needsUpgrade: true
    };

    // Si pas connecté ou pas prestataire, passer au suivant
    if (!req.user || req.user.role !== 'provider') {
      return next();
    }

    // Récupérer l'abonnement
    const subscription = await Subscription.getActiveSubscription(req.user.id);
    
    if (subscription) {
      req.subscription = subscription;
      req.subscriptionInfo = {
        hasSubscription: true,
        isActive: subscription.isActive(),
        isTrial: subscription.isTrial(),
        daysRemaining: subscription.daysRemaining(),
        needsUpgrade: !subscription.isActive() || (subscription.isTrial() && subscription.daysRemaining() <= 0),
        planType: subscription.plan_type,
        expiresAt: subscription.expires_at
      };
    }

    next();

  } catch (error) {
    console.error('שגיאה בבדיקת סטטוס מנוי:', error);
    // Ne pas bloquer en cas d'erreur, juste log et continuer
    next();
  }
};

/**
 * Middleware pour fonctionnalités spécifiques selon le type d'abonnement
 * Permet d'avoir des restrictions granulaires
 */
const requireSubscriptionLevel = (requiredLevel = 'active') => {
  return async (req, res, next) => {
    try {
      // D'abord vérifier l'abonnement de base
      await new Promise((resolve, reject) => {
        requireActiveSubscription(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const subscription = req.subscription;

      // Vérifications selon le niveau requis
      switch (requiredLevel) {
        case 'active':
          // Déjà vérifié par requireActiveSubscription
          break;

        case 'paid':
          // Exiger un abonnement payant (pas de trial)
          if (subscription.isTrial()) {
            return res.status(403).json({
              success: false,
              message: 'פיצ\'ר זה זמין רק במנוי בתשלום',
              code: 'PAID_SUBSCRIPTION_REQUIRED',
              action: 'upgrade',
              redirectUrl: '/billing/upgrade'
            });
          }
          break;

        case 'premium':
          // Fonctionnalités premium (pour le futur)
          if (subscription.plan_type !== 'yearly') {
            return res.status(403).json({
              success: false,
              message: 'פיצ\'ר זה זמין רק במנוי השנתי',
              code: 'PREMIUM_SUBSCRIPTION_REQUIRED',
              action: 'upgrade_premium',
              redirectUrl: '/billing/upgrade?plan=yearly'
            });
          }
          break;

        default:
          throw new Error(`Unknown subscription level: ${requiredLevel}`);
      }

      next();

    } catch (error) {
      console.error('שגיאה בבדיקת רמת מנוי:', error);
      res.status(500).json({
        success: false,
        message: 'שגיאה בבדיקת הרשאות המנוי'
      });
    }
  };
};

/**
 * Middleware d'avertissement pour abonnements qui expirent bientôt
 * Ajoute des headers d'avertissement sans bloquer
 */
const addExpirationWarnings = async (req, res, next) => {
  try {
    if (req.subscription && req.subscription.isActive()) {
      const daysRemaining = req.subscription.daysRemaining();
      
      if (daysRemaining <= 7) {
        res.setHeader('X-Subscription-Warning', 'expiring-soon');
        res.setHeader('X-Days-Remaining', daysRemaining.toString());
        
        if (daysRemaining <= 3) {
          res.setHeader('X-Subscription-Urgency', 'high');
        }
      }

      if (req.subscription.isTrial() && daysRemaining <= 3) {
        res.setHeader('X-Trial-Warning', 'ending-soon');
      }
    }

    next();
    
  } catch (error) {
    console.error('שגיאה בהוספת אזהרות מנוי:', error);
    // Ne pas bloquer, juste continuer
    next();
  }
};

/**
 * Fonction utilitaire pour vérifier l'abonnement programmatiquement
 * (utilisable dans les contrôleurs sans middleware)
 */
const checkUserSubscription = async (userId) => {
  try {
    const subscription = await Subscription.getActiveSubscription(userId);
    
    if (!subscription) {
      return {
        hasSubscription: false,
        isActive: false,
        message: 'אין מנוי פעיל'
      };
    }

    return {
      hasSubscription: true,
      isActive: subscription.isActive(),
      isTrial: subscription.isTrial(),
      daysRemaining: subscription.daysRemaining(),
      subscription: subscription.toJSON()
    };
    
  } catch (error) {
    console.error('שגיאה בבדיקת מנוי משתמש:', error);
    return {
      hasSubscription: false,
      isActive: false,
      error: true,
      message: 'שגיאה בבדיקת המנוי'
    };
  }
};

/**
 * Middleware pour API responses - ajoute automatiquement les infos d'abonnement
 */
const enrichWithSubscriptionData = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Si c'est un prestataire avec abonnement, ajouter les infos
    if (req.subscriptionInfo) {
      if (data.success && data.data) {
        data.data.subscriptionInfo = req.subscriptionInfo;
      }
    }
    
    return originalJson(data);
  };
  
  next();
};

module.exports = {
  requireActiveSubscription,
  checkSubscriptionStatus,
  requireSubscriptionLevel,
  addExpirationWarnings,
  enrichWithSubscriptionData,
  checkUserSubscription
};