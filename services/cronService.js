const cron = require('node-cron');
const User = require('../models/User');
const emailService = require('./emailService');
const { query } = require('../config/database');

class SubscriptionCronService {
  
  start() {
    cron.schedule('0 2 * * *', async () => {
      console.log('[CRON] Vérification des abonnements - ' + new Date().toISOString());
      
      try {
        // DÉSACTIVÉ - Service gratuit pour l'instant
        // await this.checkExpiringSubscriptions();
        // await this.checkExpiredSubscriptions();
        await this.deleteScheduledAccounts();
        // await this.processAutoRenewals();
        
      } catch (error) {
        console.error('[CRON] Erreur:', error);
      }
    });
    
    console.log('[CRON] Service démarré - vérification quotidienne à 2h');
  }
  
  async checkExpiringSubscriptions() {
    // (code existant inchangé)
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    
    const expiringSoon = await query(`
      SELECT id, email, first_name, premium_until 
      FROM users 
      WHERE role = 'provider'
      AND subscription_status = 'trial'
      AND DATE(premium_until) = DATE(?)
      AND is_active = 1
    `, [in7Days]);
    
    for (const user of expiringSoon) {
      await emailService.sendTrialExpiringSoonEmail(user);
      console.log(`[CRON] Email J-7 envoyé à ${user.email}`);
    }
    
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    
    const expiringUrgent = await query(`
      SELECT id, email, first_name, premium_until 
      FROM users 
      WHERE role = 'provider'
      AND subscription_status = 'trial'
      AND DATE(premium_until) = DATE(?)
      AND is_active = 1
    `, [in3Days]);
    
    for (const user of expiringUrgent) {
      await emailService.sendTrialExpiringUrgentEmail(user);
      console.log(`[CRON] Email J-3 envoyé à ${user.email}`);
    }
  }
  
  async checkExpiredSubscriptions() {
    // (code existant inchangé)
    const now = new Date();

    console.log('[DEBUG] Recherche utilisateurs expirés avec NOW() =', now);
    const expired = await query(`
      SELECT id, email, first_name 
      FROM users 
      WHERE role = 'provider'
      AND premium_until < ?
      AND subscription_status != 'expired'
      AND is_active = 1
    `, [now]);
    
    console.log(`[DEBUG] ${expired.length} utilisateurs trouvés`);
    if (expired.length === 0) {
      console.log('[DEBUG] Aucun utilisateur expiré trouvé');
    }
    
    for (const user of expired) {
      await query(`
        UPDATE users 
        SET subscription_status = 'expired'
        WHERE id = ?
      `, [user.id]);
      
      await emailService.sendSubscriptionExpiredEmail(user);
      
      console.log(`[CRON] Abonnement expiré pour ${user.email}`);
    }
    
    if (expired.length > 0) {
      console.log(`[CRON] ${expired.length} abonnements expirés aujourd'hui`);
    }
  }

  // ✅✅✅ NOUVELLE MÉTHODE ✅✅✅
  async deleteScheduledAccounts() {
    try {
      console.log('[CRON] 🗑️ Début suppression des comptes planifiés...');

      const accountsToDelete = await query(`
        SELECT id, email, first_name, scheduled_deletion_date
        FROM users
        WHERE scheduled_deletion_date IS NOT NULL
          AND scheduled_deletion_date <= NOW()
          AND is_active = 1
      `);

      if (accountsToDelete.length === 0) {
        console.log('[CRON] ℹ️ Aucun compte à supprimer aujourd\'hui');
        return;
      }

      console.log(`[CRON] 📋 ${accountsToDelete.length} compte(s) à supprimer`);

      let deletedCount = 0;

      for (const userData of accountsToDelete) {
        try {
          const user = await User.findById(userData.id);
          
          if (user) {
            await user.deleteAccount();
            deletedCount++;
            console.log(`[CRON] ✅ Compte supprimé: ${userData.email} (planifié le ${userData.scheduled_deletion_date})`);
          }
        } catch (error) {
          console.error(`[CRON] ❌ Erreur suppression du compte ${userData.email}:`, error.message);
        }
      }

      if (deletedCount > 0) {
        console.log(`[CRON] ✅ ${deletedCount} compte(s) supprimé(s) automatiquement`);
      }

    } catch (error) {
      console.error('[CRON] ❌ Erreur lors de la suppression des comptes planifiés:', error);
    }
  }
  async processAutoRenewals() {
  try {
    console.log('[CRON] 💳 Début traitement auto-renouvellement...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const expiringSubscriptions = await query(`
      SELECT ps.*, u.email, u.first_name 
      FROM provider_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.expires_at <= ? 
      AND ps.auto_renewal = TRUE 
      AND ps.payment_method_id IS NOT NULL
      AND ps.status = 'active'
    `, [tomorrow]);

    if (expiringSubscriptions.length === 0) {
      console.log('[CRON] ℹ️ Aucun abonnement à renouveler');
      return;
    }

    console.log(`[CRON] 📋 ${expiringSubscriptions.length} abonnement(s) à renouveler`);

    for (const sub of expiringSubscriptions) {
      try {
        // TODO: Appeler API Tranzilia ici quand tu auras les credentials
        // const result = await tranzilaAPI.charge(sub.payment_method_id, 79);
        
        console.log(`[CRON] ⏳ Renouvellement à implémenter pour: ${sub.email}`);
        
      } catch (error) {
        console.error(`[CRON] ❌ Erreur renouvellement ${sub.email}:`, error.message);
      }
    }

  } catch (error) {
    console.error('[CRON] ❌ Erreur processAutoRenewals:', error);
  }
}
}

module.exports = new SubscriptionCronService();