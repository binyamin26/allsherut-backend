const { query, transaction } = require('../config/database');

class Subscription {
  constructor(subscriptionData) {
    this.id = subscriptionData.id;
    this.user_id = subscriptionData.user_id;
    this.plan_type = subscriptionData.plan_type;
    this.status = subscriptionData.status;
    this.started_at = subscriptionData.started_at;
    this.expires_at = subscriptionData.expires_at;
    this.next_billing_date = subscriptionData.next_billing_date;
    this.amount_monthly = subscriptionData.amount_monthly;
    this.payment_method_id = subscriptionData.payment_method_id;
    this.stripe_subscription_id = subscriptionData.stripe_subscription_id;
    this.trial_ends_at = subscriptionData.trial_ends_at;
    this.cancelled_at = subscriptionData.cancelled_at;
    this.created_at = subscriptionData.created_at;
    this.updated_at = subscriptionData.updated_at;
  }

  // =============================================
  // CRÉATION ABONNEMENTS
  // =============================================
  
static async createTrialSubscription(userId, tranziliaToken = null) {
  try {
    // Vérifier si l'utilisateur a déjà un abonnement
    const existing = await Subscription.getActiveSubscription(userId);
    if (existing) {
      throw new Error('המשתמש כבר מנוי פעיל');
    }

    const trialEndDate = new Date();
    trialEndDate.setMonth(trialEndDate.getMonth() + 1); // 1 mois gratuit

   const [result] = await query(`
  INSERT INTO provider_subscriptions 
  (user_id, plan_type, status, expires_at, trial_ends_at, payment_method_id, auto_renewal) 
  VALUES (?, 'trial', 'active', ?, ?, ?, TRUE)
`, [userId, trialEndDate, trialEndDate, tranziliaToken]);

    return await Subscription.findById(result.insertId);
  } catch (error) {
    console.error('שגיאה ביצירת מנוי ניסיון:', error);
    throw error;
  }
}




  // Créer abonnement payant (mensuel ou annuel)
  static async createPaidSubscription(userId, planType, paymentMethodId, stripeSubscriptionId) {
    return transaction(async (connection) => {
      try {
        // Prix selon le plan
        const pricing = {
          monthly: { amount: 79, duration: 1 },
          yearly: { amount: 790, duration: 12 } // 2 mois gratuits
        };

        if (!pricing[planType]) {
          throw new Error('סוג מנוי לא תקין');
        }

        const plan = pricing[planType];
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + plan.duration);

        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + plan.duration);

        // Annuler abonnement existant s'il y en a un
        await connection.execute(`
          UPDATE provider_subscriptions 
          SET status = 'cancelled', cancelled_at = NOW() 
          WHERE user_id = ? AND status = 'active'
        `, [userId]);

        // Créer nouveau abonnement
        const [result] = await connection.execute(`
          INSERT INTO provider_subscriptions 
          (user_id, plan_type, status, expires_at, next_billing_date, amount_monthly, 
           payment_method_id, stripe_subscription_id) 
          VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
        `, [
          userId, planType, expiresAt, nextBillingDate, 
          plan.amount, paymentMethodId, stripeSubscriptionId
        ]);

        return await Subscription.findById(result.insertId);
      } catch (error) {
        console.error('שגיאה ביצירת מנוי בתשלום:', error);
        throw error;
      }
    });
  }

  // =============================================
  // RÉCUPÉRATION ABONNEMENTS
  // =============================================
  
  // Trouver abonnement par ID
  static async findById(id) {
    try {
      const subscriptions = await query(
        'SELECT * FROM provider_subscriptions WHERE id = ?',
        [id]
      );
      
      return subscriptions.length > 0 ? new Subscription(subscriptions[0]) : null;
    } catch (error) {
      console.error('שגיאה בחיפוש מנוי לפי ID:', error);
      throw error;
    }
  }

  // Obtenir abonnement actif d'un utilisateur
static async getActiveSubscription(userId, serviceType = null) {
  try {
    let sql = `
      SELECT * FROM provider_subscriptions 
      WHERE user_id = ? AND status IN ('active', 'past_due')
    `;
    const params = [userId];
    
    if (serviceType) {
      sql += ` AND service_type = ?`;
      params.push(serviceType);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT 1`;
    
    const subscriptions = await query(sql, params);
    
    return subscriptions.length > 0 ? new Subscription(subscriptions[0]) : null;
  } catch (error) {
    console.error('שגיאה בקבלת מנוי פעיל:', error);
    throw error;
  }
}

  // Obtenir tous les abonnements d'un utilisateur
  static async getUserSubscriptions(userId) {
    try {
      const subscriptions = await query(`
        SELECT * FROM provider_subscriptions 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `, [userId]);
      
      return subscriptions.map(sub => new Subscription(sub));
    } catch (error) {
      console.error('שגיאה בקבלת מנויי משתמש:', error);
      throw error;
    }
  }

  // =============================================
  // GESTION STATUT ABONNEMENT
  // =============================================
  
  // Vérifier si abonnement actif et valide
  isActive() {
    return this.status === 'active' && new Date() < new Date(this.expires_at);
  }

  // Vérifier si c'est un trial
  isTrial() {
    return this.plan_type === 'trial';
  }

  // Jours restants avant expiration
  daysRemaining() {
    const now = new Date();
    const expires = new Date(this.expires_at);
    const diffTime = expires - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Mettre à jour statut
  async updateStatus(newStatus, reason = null) {
    try {
      const updates = { status: newStatus };
      
      if (newStatus === 'cancelled') {
        updates.cancelled_at = 'NOW()';
      }

      const setClause = Object.keys(updates).map(key => 
        key === 'cancelled_at' ? `${key} = ${updates[key]}` : `${key} = ?`
      ).join(', ');
      
      const values = Object.values(updates).filter(v => v !== 'NOW()');
      values.push(this.id);

      await query(`
        UPDATE provider_subscriptions 
        SET ${setClause}, updated_at = NOW() 
        WHERE id = ?
      `, values);

      this.status = newStatus;
      if (newStatus === 'cancelled') {
        this.cancelled_at = new Date();
      }

      return this;
    } catch (error) {
      console.error('שגיאה בעדכון סטטוס מנוי:', error);
      throw error;
    }
  }

  // Renouveler abonnement
  async renew(durationMonths = null) {
    try {
      // Durée selon le type de plan ou paramètre fourni
      const duration = durationMonths || (this.plan_type === 'yearly' ? 12 : 1);
      
      const newExpiresAt = new Date();
      newExpiresAt.setMonth(newExpiresAt.getMonth() + duration);
      
      const newNextBilling = new Date();
      newNextBilling.setMonth(newNextBilling.getMonth() + duration);

      await query(`
        UPDATE provider_subscriptions 
        SET expires_at = ?, next_billing_date = ?, status = 'active', updated_at = NOW() 
        WHERE id = ?
      `, [newExpiresAt, newNextBilling, this.id]);

      this.expires_at = newExpiresAt;
      this.next_billing_date = newNextBilling;
      this.status = 'active';

      return this;
    } catch (error) {
      console.error('שגיאה בחידוש מנוי:', error);
      throw error;
    }
  }

  // =============================================
  // TRANSACTIONS DE PAIEMENT
  // =============================================
  
  // Créer transaction de paiement
  async createPaymentTransaction(amount, paymentMethod, transactionId = null) {
    try {
      const [result] = await query(`
        INSERT INTO payment_transactions 
        (subscription_id, amount, payment_method, transaction_id, status) 
        VALUES (?, ?, ?, ?, 'pending')
      `, [this.id, amount, paymentMethod, transactionId]);

      return result.insertId;
    } catch (error) {
      console.error('שגיאה ביצירת טרנזקציה:', error);
      throw error;
    }
  }

  // Obtenir historique des transactions
  async getPaymentTransactions() {
    try {
      return await query(`
        SELECT * FROM payment_transactions 
        WHERE subscription_id = ? 
        ORDER BY created_at DESC
      `, [this.id]);
    } catch (error) {
      console.error('שגיאה בקבלת היסטוריית תשלומים:', error);
      throw error;
    }
  }

  // Marquer transaction comme complétée
  static async markTransactionCompleted(transactionId, stripePaymentIntentId = null) {
    try {
      await query(`
        UPDATE payment_transactions 
        SET status = 'completed', processed_at = NOW(), stripe_payment_intent_id = ?
        WHERE id = ?
      `, [stripePaymentIntentId, transactionId]);

      return true;
    } catch (error) {
      console.error('שגיאה בעדכון טרנזקציה:', error);
      throw error;
    }
  }

  // =============================================
  // MÉTHODES UTILITAIRES ET STATISTIQUES
  // =============================================
  
  // Obtenir abonnements expirant bientôt (dans X jours)
  static async getExpiringSoon(days = 7) {
    try {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + days);

      return await query(`
        SELECT ps.*, u.first_name, u.last_name, u.email, u.service_type
        FROM provider_subscriptions ps
        JOIN users u ON ps.user_id = u.id
        WHERE ps.status = 'active' 
        AND ps.expires_at <= ? 
        AND ps.expires_at > NOW()
        ORDER BY ps.expires_at ASC
      `, [expireDate]);
    } catch (error) {
      console.error('שגיאה בקבלת מנויים שמסתיימים בקרוב:', error);
      throw error;
    }
  }

  // Statistiques globales des abonnements
  static async getSubscriptionStats() {
    try {
      const [stats] = await query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN plan_type = 'trial' THEN 1 END) as trial_subscriptions,
          COUNT(CASE WHEN plan_type = 'monthly' THEN 1 END) as monthly_subscriptions,
          COUNT(CASE WHEN plan_type = 'yearly' THEN 1 END) as yearly_subscriptions,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_subscriptions,
          SUM(CASE WHEN plan_type = 'monthly' AND status = 'active' THEN amount_monthly ELSE 0 END) as monthly_revenue,
          SUM(CASE WHEN plan_type = 'yearly' AND status = 'active' THEN amount_monthly ELSE 0 END) as yearly_revenue
        FROM provider_subscriptions
      `);

      return stats;
    } catch (error) {
      console.error('שגיאה בקבלת סטטיסטיקות מנויים:', error);
      throw error;
    }
  }

  // Nettoyer les abonnements expirés (passer en status expired)
  static async cleanExpiredSubscriptions() {
    try {
      const [result] = await query(`
        UPDATE provider_subscriptions 
        SET status = 'expired', updated_at = NOW() 
        WHERE status = 'active' AND expires_at <= NOW()
      `);

      return result.affectedRows || 0;
    } catch (error) {
      console.error('שגיאה בניקוי מנויים שפגו:', error);
      throw error;
    }
  }

  // Convertir en JSON pour API
  toJSON() {
    return {
      id: this.id,
      userId: this.user_id,
      planType: this.plan_type,
      status: this.status,
      isActive: this.isActive(),
      isTrial: this.isTrial(),
      daysRemaining: this.daysRemaining(),
      startedAt: this.started_at,
      expiresAt: this.expires_at,
      nextBillingDate: this.next_billing_date,
      amountMonthly: this.amount_monthly,
      trialEndsAt: this.trial_ends_at,
      cancelledAt: this.cancelled_at,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }
}

module.exports = Subscription;