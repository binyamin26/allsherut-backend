const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');
const { query } = require('../config/database');
const emailService = require('../services/emailService'); // ✅ NOUVEAU

// =============================================
// MIDDLEWARE SPÉCIFIQUE AUX ABONNEMENTS
// =============================================

// Middleware pour vérifier que l'utilisateur est un prestataire
const requireProvider = (req, res, next) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'הגישה מוגבלת לספקים בלבד'
    });
  }
  next();
};

// =============================================
// ROUTES CONSULTATION ABONNEMENT
// =============================================

// @route   GET /api/subscriptions/status
// @desc    Obtenir le statut d'abonnement avec info de suppression planifiée
// @access  Private (Provider only)
router.get('/status', authenticateToken, requireProvider, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // ✅ Récupérer l'utilisateur pour vérifier la suppression planifiée
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }
    
    // Récupérer l'abonnement actif
    const subscription = await Subscription.getActiveSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'לא נמצא מנוי פעיל',
        data: {
          hasSubscription: false,
          needsUpgrade: true,
          // ✅ NOUVEAU
          hasScheduledDeletion: user.hasScheduledDeletion(),
          scheduledDeletionDate: user.getScheduledDeletionDate()
        }
      });
    }

    // Vérifier si l'abonnement est vraiment actif
    const isActive = subscription.isActive();
    const daysRemaining = subscription.daysRemaining();

    res.json({
      success: true,
      message: 'סטטוס מנוי נטען בהצלחה',
      data: {
        subscription: subscription.toJSON(),
        hasSubscription: true,
        isActive,
        needsUpgrade: !isActive || (subscription.isTrial() && daysRemaining <= 0),
        daysRemaining,
        warnings: {
          expiringSoon: daysRemaining <= 7 && daysRemaining > 0,
          trialEndingSoon: subscription.isTrial() && daysRemaining <= 3
        },
        // ✅ NOUVEAU - Infos suppression planifiée
        deletion: {
          hasScheduledDeletion: user.hasScheduledDeletion(),
          scheduledDeletionDate: user.getScheduledDeletionDate(),
          canCancelDeletion: user.hasScheduledDeletion() && new Date() < user.getScheduledDeletionDate()
        }
      }
    });

  } catch (error) {
    console.error('שגיאה בקבלת סטטוס מנוי:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סטטוס המנוי'
    });
  }
});

// @route   GET /api/subscriptions/billing-history
// @desc    Obtenir l'historique de facturation
// @access  Private (Provider only)
router.get('/billing-history', authenticateToken, requireProvider, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer tous les abonnements de l'utilisateur
    const subscriptions = await Subscription.getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: 'אין היסטוריית תשלומים',
        data: {
          subscriptions: [],
          transactions: []
        }
      });
    }

    // Récupérer les transactions pour tous les abonnements
    const allTransactions = [];
    for (const subscription of subscriptions) {
      const transactions = await subscription.getPaymentTransactions();
      allTransactions.push(...transactions);
    }

    // Trier les transactions par date (plus récentes en premier)
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      message: 'היסטוריית תשלומים נטענה בהצלחה',
      data: {
        subscriptions: subscriptions.map(sub => sub.toJSON()),
        transactions: allTransactions,
        summary: {
          totalSubscriptions: subscriptions.length,
          totalTransactions: allTransactions.length,
          totalPaid: allTransactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        }
      }
    });

  } catch (error) {
    console.error('שגיאה בקבלת היסטוריית תשלומים:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת היסטוריית התשלומים'
    });
  }
});

// =============================================
// ROUTES GESTION ABONNEMENT
// =============================================

// @route   POST /api/subscriptions/upgrade
// @desc    Passer du trial au plan payant
// @access  Private (Provider only)
router.post('/upgrade', authenticateToken, requireProvider, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planType, paymentMethodId, stripeSubscriptionId } = req.body;

    // Validation des données
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'סוג מנוי לא תקין. חובה לבחור monthly או yearly'
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'נדרש מזהה אמצעי תשלום'
      });
    }

    // Vérifier l'abonnement actuel
    const currentSubscription = await Subscription.getActiveSubscription(userId);
    
    if (currentSubscription && !currentSubscription.isTrial()) {
      return res.status(400).json({
        success: false,
        message: 'המשתמש כבר במנוי בתשלום'
      });
    }

    // Créer le nouvel abonnement payant
    const newSubscription = await Subscription.createPaidSubscription(
      userId, 
      planType, 
      paymentMethodId, 
      stripeSubscriptionId
    );

    // Prix pour confirmation
    const pricing = {
      monthly: { amount: 79, name: 'חודשי' },
      yearly: { amount: 790, name: 'שנתי' }
    };

    res.status(201).json({
      success: true,
      message: `המנוי ${pricing[planType].name} הופעל בהצלחה!`,
      data: {
        subscription: newSubscription.toJSON(),
        pricing: pricing[planType]
      }
    });

  } catch (error) {
    console.error('שגיאה בשדרוג מנוי:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בשדרוג המנוי. אנא נסה שוב'
    });
  }
});

// @route   POST /api/subscriptions/cancel
// @desc    Annuler l'abonnement d'un service spécifique
// @access  Private (Provider only)
router.post('/cancel', authenticateToken, requireProvider, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, serviceType } = req.body;

    if (!serviceType) {
      return res.status(400).json({
        success: false,
        message: 'נדרש לציין את סוג השירות לביטול'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Récupérer l'abonnement actif pour CE service
    const subscription = await Subscription.getActiveSubscription(userId, serviceType);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'לא נמצא מנוי פעיל לביטול עבור שירות זה'
      });
    }

    // Annuler l'abonnement
    await subscription.updateStatus('cancelled', reason);

    // Mettre à jour la date de suppression planifiée dans users
const deletionDate = new Date(subscription.expires_at);
await query(
  'UPDATE users SET scheduled_deletion_date = ? WHERE id = ?',
  [deletionDate, userId]
);

    // Envoyer email de confirmation
    try {
      await emailService.sendSubscriptionCancellationEmail(
        user.email,
        user.first_name,
        new Date(subscription.expires_at)
      );
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email annulation:', emailError);
    }

    res.json({
      success: true,
      message: `המנוי עבור ${serviceType} בוטל בהצלחה`,
      data: {
        serviceType,
        subscription: subscription.toJSON(),
        expiresAt: subscription.expires_at
      }
    });

  } catch (error) {
    console.error('שגיאה בביטול מנוי:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בביטול המנוי'
    });
  }
});

// @route   POST /api/subscriptions/reactivate
// @desc    Réactiver un abonnement annulé
// @access  Private (Provider only)
router.post('/reactivate', authenticateToken, requireProvider, async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;

    // ✅ Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Récupérer le dernier abonnement (même annulé)
    const subscription = await Subscription.getActiveSubscription(userId);
    
    if (!subscription || subscription.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'לא נמצא מנוי מבוטל לשחזור'
      });
    }

    // Vérifier si pas encore expiré
    if (new Date() >= new Date(subscription.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'המנוי פג. נדרש ליצור מנוי חדש'
      });
    }

    // Réactiver l'abonnement
    await subscription.updateStatus('active');

    // ✅ NOUVEAU - Annuler la suppression planifiée si elle existe
    let deletionCancelled = false;
    if (user.hasScheduledDeletion()) {
      await user.cancelScheduledDeletion();
      deletionCancelled = true;
      console.log(`✅ Suppression annulée pour ${user.email}`);
      
      // ✅✅✅ NOUVEAU - Envoyer email de confirmation ✅✅✅
      try {
        await emailService.sendDeletionCancelledEmail(
          user.email,
          user.first_name
        );
        console.log(`📧 Email de réactivation envoyé à ${user.email}`);
      } catch (emailError) {
        console.error('⚠️ Erreur envoi email réactivation:', emailError);
        // Ne pas bloquer si l'email échoue
      }
    }

    res.json({
      success: true,
      message: 'המנוי הופעל מחדש בהצלחה. מחיקת החשבון בוטלה.',
      data: {
        subscription: subscription.toJSON(),
        deletionCancelled
      }
    });

  } catch (error) {
    console.error('שגיאה בהפעלה מחדש של מנוי:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בהפעלה מחדש של המנוי'
    });
  }
});


// =============================================
// ROUTES INFORMATIONS ET PRIX
// =============================================

// @route   GET /api/subscriptions/pricing
// @desc    Obtenir les tarifs des abonnements
// @access  Public
router.get('/pricing', async (req, res) => {
  try {
    const pricing = {
      trial: {
        name: 'ניסיון חינם',
        price: 0,
        duration: '30 יום',
        features: [
          'גישה מלאה לכל הפיצ\'רים',
          'הופעה בתוצאות חיפוש',
          'קבלת פניות מלקוחות',
          'ללא מגבלות'
        ]
      },
      monthly: {
        name: 'מנוי חודשי',
        price: 79,
        currency: 'ILS',
        duration: 'חודש',
        features: [
          'כל היתרונות של החינמי',
          'עדיפות בתוצאות החיפוש',
          'תמיכה מועדפת',
          'כלי ניתוח מתקדמים'
        ]
      },
      yearly: {
        name: 'מנוי שנתי',
        price: 790,
        currency: 'ILS',
        duration: 'שנה',
        originalPrice: 948, // 79 * 12
        savings: 158,
        savingsPercent: 17,
        features: [
          'כל היתרונות של החודשי',
          'חיסכון של 2 חודשים',
          'תמיכה VIP',
          'גיבוי נתונים מתקדם'
        ]
      }
    };

    res.json({
      success: true,
      message: 'מחירי המנויים נטענו בהצלחה',
      data: {
        pricing,
        currency: 'ILS',
        vatIncluded: true,
        trialDuration: 30
      }
    });

  } catch (error) {
    console.error('שגיאה בקבלת מחירים:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת המחירים'
    });
  }
});

// =============================================
// ROUTES ADMIN (pour le futur)
// =============================================

// @route   GET /api/subscriptions/stats
// @desc    Statistiques globales des abonnements (Admin seulement)
// @access  Private (Admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // TODO: Ajouter middleware requireAdmin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'הגישה מוגבלת למנהלים בלבד'
      });
    }

    const stats = await Subscription.getSubscriptionStats();

    res.json({
      success: true,
      message: 'סטטיסטיקות מנויים נטענו בהצלחה',
      data: stats
    });

  } catch (error) {
    console.error('שגיאה בקבלת סטטיסטיקות:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת הסטטיסטיקות'
    });
  }
});

// =============================================
// WEBHOOKS ET UTILITAIRES
// =============================================

// @route   POST /api/subscriptions/webhook/stripe
// @desc    Webhook Stripe pour les événements de paiement
// @access  Public (avec validation Stripe)
router.post('/webhook/stripe', async (req, res) => {
  try {
    // TODO: Implémenter la validation du webhook Stripe
    // const sig = req.headers['stripe-signature'];
    // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    const event = req.body;
    
    switch (event.type) {
      case 'invoice.payment_succeeded':
        // Paiement réussi - renouveler l'abonnement
        // TODO: Implémenter la logique
        break;
        
      case 'invoice.payment_failed':
        // Paiement échoué - marquer comme past_due
        // TODO: Implémenter la logique
        break;
        
      case 'customer.subscription.deleted':
        // Abonnement supprimé - marquer comme cancelled
        // TODO: Implémenter la logique
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('שגיאה ב-webhook:', error);
    res.status(400).json({
      success: false,
      message: 'שגיאה בעיבוד webhook'
    });
  }
});

module.exports = router;