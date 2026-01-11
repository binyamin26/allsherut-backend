const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');
const { authenticateToken } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');

// @route   GET /api/users/profile/:id
// @desc    Obtenir le profil public d'un utilisateur
// @access  Public
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.notFound('משתמש');
    }

    // Profil public (sans données sensibles)
    const publicProfile = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      serviceType: user.service_type,
      role: user.role,
      createdAt: user.created_at
    };

    // Si c'est un provider, ajouter les infos provider
    if (user.role === 'provider') {
      const providerProfile = await user.getProviderProfile();
      if (providerProfile) {
        publicProfile.provider = {
          description: providerProfile.description,
          hourlyRate: providerProfile.hourly_rate,
          city: providerProfile.city,
          averageRating: providerProfile.average_rating,
          totalReviews: providerProfile.total_reviews,
          profileImage: providerProfile.profile_image,
          isVerified: providerProfile.is_verified,
          experienceYears: providerProfile.experience_years
        };
      }
    }

    res.success('פרופיל נטען בהצלחה', {
      user: publicProfile
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Route error:', error.message);
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// @route   PUT /api/users/profile
// @desc    Mettre à jour le profil utilisateur
// @access  Private
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.notFound('משתמש');
    }

    // Mettre à jour les champs de base autorisés
    const allowedUpdates = ['first_name', 'last_name', 'phone'];
    const userUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        userUpdates[field] = updates[field];
      }
    });

    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }

    // Si c'est un provider, mettre à jour le profil provider
    if (user.role === 'provider' && updates.provider) {
      const providerUpdates = updates.provider;
      const allowedProviderUpdates = [
        'description', 'hourly_rate', 'city', 'availability', 
        'experience_years', 'skills', 'languages'
      ];
      
      const filteredUpdates = {};
      allowedProviderUpdates.forEach(field => {
        if (providerUpdates[field] !== undefined) {
          filteredUpdates[field] = providerUpdates[field];
        }
      });

      if (Object.keys(filteredUpdates).length > 0) {
        await user.updateProviderProfile(filteredUpdates);
      }
    }

    // Récupérer le profil mis à jour
    const updatedUser = await User.findById(userId);
    const responseData = {
      user: updatedUser.toJSON()
    };

    if (user.role === 'provider') {
      responseData.user.providerProfile = await updatedUser.getProviderProfile();
    }

    res.updated('הפרופיל עודכן בהצלחה', responseData);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Route error:', error.message);
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// @route   GET /api/users/stats
// @desc    Statistiques générales des utilisateurs
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as totalUsers,
        COUNT(CASE WHEN role = 'client' THEN 1 END) as totalClients,
        COUNT(CASE WHEN role = 'provider' THEN 1 END) as totalProviders,
        COUNT(CASE WHEN role = 'provider' AND service_type = 'babysitting' THEN 1 END) as babysitters,
        COUNT(CASE WHEN role = 'provider' AND service_type = 'cleaning' THEN 1 END) as cleaners,
        COUNT(CASE WHEN role = 'provider' AND service_type = 'gardening' THEN 1 END) as gardeners,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as newUsersThisMonth
      FROM users
      WHERE is_active = true
    `;

    const [stats] = await User.executeQuery(statsQuery);

    res.success('סטטיסטיקות נטענו בהצלחה', {
      stats: {
        totalUsers: stats.totalUsers || 0,
        totalClients: stats.totalClients || 0,
        totalProviders: stats.totalProviders || 0,
        serviceBreakdown: {
          babysitters: stats.babysitters || 0,
          cleaners: stats.cleaners || 0,
          gardeners: stats.gardeners || 0
        },
        newUsersThisMonth: stats.newUsersThisMonth || 0
      }
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Route error:', error.message);
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// ✅✅✅ NOUVELLES ROUTES - SUPPRESSION DIFFÉRÉE ✅✅✅

// @route   POST /api/users/schedule-deletion
// @desc    Planifier la suppression du compte
// @access  Private
router.post('/schedule-deletion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Vérifier qu'aucune suppression n'est déjà planifiée
    if (user.hasScheduledDeletion()) {
      return res.status(400).json({
        success: false,
        message: 'כבר קיימת בקשת מחיקה מתוזמנת'
      });
    }

    // Planifier la suppression
    const result = await user.scheduleAccountDeletion();

    // Envoyer email de confirmation
    try {
      await emailService.sendSubscriptionCancellationEmail(
        user.email,
        user.first_name,
        result.scheduledDate
      );
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email:', emailError);
      // Ne pas bloquer si l'email échoue
    }

    res.status(200).json({
      success: true,
      message: 'החשבון מתוזמן למחיקה בהצלחה',
      data: {
        scheduledDate: result.scheduledDate
      }
    });

  } catch (error) {
    console.error('❌ Erreur schedule-deletion:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בתזמון מחיקת החשבון'
    });
  }
});

// @route   POST /api/users/cancel-deletion
// @desc    Annuler la suppression planifiée du compte
// @access  Private
router.post('/cancel-deletion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = require('../config/database');
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Vérifier qu'une suppression est bien planifiée
    if (!user.hasScheduledDeletion()) {
      return res.status(400).json({
        success: false,
        message: 'אין בקשת מחיקה מתוזמנת'
      });
    }

    // Annuler la suppression dans users
    await user.cancelScheduledDeletion();

    // Réactiver les abonnements annulés
    await query(`
      UPDATE provider_subscriptions 
      SET status = 'active', cancelled_at = NULL 
      WHERE user_id = ? AND status = 'cancelled' AND expires_at > NOW()
    `, [userId]);

    // Envoyer email de confirmation
    try {
      await emailService.sendDeletionCancelledEmail(
        user.email,
        user.first_name
      );
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'בקשת המחיקה בוטלה בהצלחה. המנוי שלך פעיל מחדש!'
    });

  } catch (error) {
    console.error('❌ Erreur cancel-deletion:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בביטול המחיקה'
    });
  }
});

// @route   GET /api/users/deletion-status
// @desc    Vérifier le statut de suppression du compte
// @access  Private
router.get('/deletion-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    const hasScheduledDeletion = user.hasScheduledDeletion();
    const deletionDate = user.getScheduledDeletionDate();

    res.status(200).json({
      success: true,
      data: {
        hasScheduledDeletion,
        scheduledDeletionDate: deletionDate,
        canCancel: hasScheduledDeletion && deletionDate > new Date()
      }
    });

  } catch (error) {
    console.error('❌ Erreur deletion-status:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בבדיקת סטטוס המחיקה'
    });
  }
});

module.exports = router;