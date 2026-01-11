const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const TrialHistory = require('./TrialHistory');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.email = userData.email;
    this.first_name = userData.first_name;
    this.last_name = userData.last_name;
    this.phone = userData.phone;
    this.role = userData.role;
    this.service_type = userData.service_type;
    this.is_active = userData.is_active;
    this.email_verified = userData.email_verified;
    this.premium_until = userData.premium_until;
    this.profile_image = userData.profile_image;
    this.created_at = userData.created_at;
    this.updated_at = userData.updated_at;
    this.last_login = userData.last_login;
    this.scheduled_deletion_date = userData.scheduled_deletion_date; // ✅ NOUVEAU
  }

  // =============================================
  // CRÉATION D'UTILISATEUR
  // =============================================
  static async create(userData) {
    return transaction(async (connection) => {
      try {
        // Validation préalable
        const validationErrors = User.validateRegistrationData(userData);
        if (validationErrors.length > 0) {
          throw new Error(validationErrors[0].message);
        }

        // Vérifier si l'email existe
        const emailExists = await User.emailExists(userData.email);
     // Vérifier si l'email existe
if (userData.role === 'provider') {
  // Pour providers : vérifier si email + service existe déjà
  const hasService = await User.hasService(userData.email, userData.serviceType);
  if (hasService) {
    throw new Error('אתה כבר רשום לשירות זה');
  }
  

    
// Si email existe mais pas ce service : vérifier le mot de passe d'abord
const existingUser = await User.findByEmail(userData.email);
if (existingUser) {
  // ✅ VÉRIFIER LE MOT DE PASSE AVANT D'AJOUTER UN SERVICE
  const [userWithPassword] = await connection.execute(
    'SELECT password FROM users WHERE id = ?',
    [existingUser.id]
  );
  
const isValidPassword = await bcrypt.compare(userData.password, userWithPassword[0].password);
  if (!isValidPassword) {
    throw new Error('INVALID_PASSWORD_FOR_EXISTING_ACCOUNT');
  }

  // Vérifier que le nom correspond aussi
  const newFirstName = (userData.firstName || userData.first_name || '').trim().toLowerCase();
  const newLastName = (userData.lastName || userData.last_name || '').trim().toLowerCase();
  const existingFirstName = (existingUser.first_name || '').trim().toLowerCase();
  const existingLastName = (existingUser.last_name || '').trim().toLowerCase();

  if (newFirstName !== existingFirstName || newLastName !== existingLastName) {
    throw new Error('NAME_MISMATCH_FOR_EXISTING_ACCOUNT');
  }
// Mettre à jour le service_type ET le téléphone dans users
  await connection.execute(
    'UPDATE users SET service_type = ?, phone = COALESCE(?, phone), updated_at = NOW() WHERE id = ?',
    [userData.serviceType, userData.phone, existingUser.id]
  );

  // Ajouter juste le nouveau service
  await connection.execute(`
    INSERT INTO service_providers (
      user_id, service_type, title, experience_years, 
      location_city, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
  `, [
    existingUser.id,
    userData.serviceType,
    `ספק ${userData.serviceType} מקצועי`,
    0,
    null,
    true
  ]);
  
  // Retourner l'utilisateur existant
  const [users] = await connection.execute(
    'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
    [existingUser.id]
  );
  return new User(users[0]);
}
} else {
  // Pour clients : vérification normale
  const emailExists = await User.emailExists(userData.email);
  if (emailExists) {
    throw new Error('כתובת האימייל כבר קיימת במערכת');
  }
}

// ✅ Vérifier si le trial a déjà été utilisé pour CE service
if (userData.role === 'provider') {
  const serviceType = userData.serviceType || userData.service_type;
  
  // Vérifier email
  const emailCheck = await TrialHistory.hasUsedTrial(userData.email, serviceType);
  if (emailCheck.hasUsedTrial) {
    throw new Error('EMAIL_ALREADY_USED_FOR_SERVICE');
  }
  
  // Vérifier téléphone
  if (userData.phone) {
    const phoneCheck = await TrialHistory.hasUsedTrialByPhone(userData.phone, serviceType);
    if (phoneCheck.hasUsedTrial) {
      throw new Error('PHONE_ALREADY_USED_FOR_SERVICE');
    }
  }
}

        // Hasher le mot de passe
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        // Déterminer qui a droit au mois gratuit premium
        const hasFreePremium = userData.role === 'provider' && 
          ['cleaning', 'gardening', 'petcare', 'tutoring'].includes(userData.serviceType);

        // Calculer la date d'expiration premium (1 mois gratuit si éligible)
        let premiumUntil = null;
        if (hasFreePremium) {
          const now = new Date();
          premiumUntil = new Date(now.setMonth(now.getMonth() + 1));
        }

        // Insérer l'utilisateur
        const [userResult] = await connection.execute(`
          INSERT INTO users (
            email, password, first_name, last_name, phone, 
            role, service_type, premium_until, is_active, 
            tokenVersion, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, 0, NOW())
        `, [
          userData.email.toLowerCase().trim(),
          hashedPassword,
          userData.firstName || userData.first_name,
          userData.lastName || userData.last_name,
          userData.phone || null,
          userData.role,
          userData.serviceType || userData.service_type || null,
          premiumUntil
        ]);

        const userId = userResult.insertId;

        // Créer le profil provider si nécessaire
        if (userData.role === 'provider') {
          await connection.execute(`
            INSERT INTO service_providers (
              user_id, service_type, title, experience_years, 
              location_city, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
          `, [
            userId,
            userData.serviceType || userData.service_type,
            `ספק ${userData.serviceType || userData.service_type} מקצועי`,
            0,
            null,
            true
          ]);
        }

     // ✅ Enregistrer dans l'historique des trials
try {
  await TrialHistory.recordTrialUsage(
    userId, 
    userData.email,
    userData.phone,
    userData.serviceType || userData.service_type
  );
} catch (error) {
  console.error('⚠️ Erreur enregistrement trial:', error);
}

        // Retourner l'utilisateur créé (même connexion)
        const [users] = await connection.execute(
          'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
          [userId]
        );
        
        if (users.length === 0) {
          console.log('DEBUG: Utilisateur créé mais non trouvé, ID:', userId);
          return null;
        }
        
        return new User(users[0]);

      } catch (error) {
        console.error('שגיאה ביצירת משתמש:', error);
        throw error;
      }
    });
  }

  // =============================================
  // AUTHENTIFICATION
  // =============================================
  static async authenticate(email, password) {
    try {
      const users = await query(
        'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
        [email.toLowerCase().trim()]
      );

      if (users.length === 0) {
        throw new Error('האימייל או הסיסמה שגויים');
      }

      const userData = users[0];
      const isValidPassword = await bcrypt.compare(password, userData.password);

      if (!isValidPassword) {
        throw new Error('האימייל או הסיסמה שגויים');
      }

      const user = new User(userData);
      
      // Mettre à jour la dernière connexion
      await user.updateLastLogin();

      return user;

    } catch (error) {
      console.error('שגיאה באימות:', error);
      throw error;
    }
  }

  // =============================================
  // RECHERCHE D'UTILISATEURS
  // =============================================
  static async findById(id) {
    try {
      const users = await query(
        'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
        [id]
      );

      if (users.length === 0) {
        return null;
      }

      return new User(users[0]);
    } catch (error) {
      console.error('שגיאה בחיפוש משתמש לפי ID:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const users = await query(
        'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
        [email.toLowerCase().trim()]
      );

      if (users.length === 0) {
        return null;
      }

      return new User(users[0]);
    } catch (error) {
      console.error('שגיאה בחיפוש משתמש לפי אימייל:', error);
      throw error;
    }
  }

  // =============================================
  // GESTION PROFIL
  // =============================================
  async updateProfile(updateData) {
    try {
      const updateFields = [];
      const updateValues = [];

      const allowedFields = [
        'first_name', 'last_name', 'phone', 'profile_image'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
      });

      if (updateFields.length === 0) {
        return this;
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(this.id);

      await query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Mettre à jour l'instance actuelle
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          this[key] = updateData[key];
        }
      });

      return this;
    } catch (error) {
      console.error('שגיאה בעדכון פרופיל:', error);
      throw error;
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      // Vérifier l'ancien mot de passe
      const isValidPassword = await this.verifyPassword(currentPassword);
      if (!isValidPassword) {
        throw new Error('הסיסמה הנוכחית שגויה');
      }

      // Hasher le nouveau mot de passe
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await query(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, this.id]
      );

      return true;
    } catch (error) {
      console.error('שגיאה בשינוי סיסמה:', error);
      throw error;
    }
  }

  async verifyPassword(password) {
    try {
      const users = await query(
        'SELECT password FROM users WHERE id = ?',
        [this.id]
      );

      if (users.length === 0) {
        return false;
      }

      return await bcrypt.compare(password, users[0].password);
    } catch (error) {
      console.error('שגיאה בבדיקת סיסמה:', error);
      return false;
    }
  }

  async updateLastLogin() {
    try {
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [this.id]
      );
      
      this.last_login = new Date();
      return this;
    } catch (error) {
      console.error('שגיאה בעדכון התחברות אחרונה:', error);
      throw error;
    }
  }

  // =============================================
  // SYSTÈME PREMIUM
  // =============================================
  isPremium() {
    if (!this.premium_until) {
      return false;
    }
    return new Date() < new Date(this.premium_until);
  }

  async extendPremium(durationMonths) {
    try {
      const currentExpiry = this.premium_until ? new Date(this.premium_until) : new Date();
      const newExpiry = new Date(currentExpiry);
      
      if (newExpiry < new Date()) {
        newExpiry.setTime(Date.now());
      }
      
      newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

      await query(
        'UPDATE users SET premium_until = ?, updated_at = NOW() WHERE id = ?',
        [newExpiry, this.id]
      );

      this.premium_until = newExpiry;
      return this;
    } catch (error) {
      console.error('שגיאה בהארכת פרימיום:', error);
      throw error;
    }
  }

  async getProviderProfile() {
    if (this.role !== 'provider') {
      return null;
    }

    try {
      const profiles = await query(
        'SELECT * FROM service_providers WHERE user_id = ? AND is_active = TRUE',
        [this.id]
      );

      return profiles.length > 0 ? profiles[0] : null;
    } catch (error) {
      console.error('שגיאה בקבלת פרופיל ספק:', error);
      throw error;
    }
  }

  // =============================================
  // SYSTÈME RESET PASSWORD (intégration emailService)
  // =============================================
  
 static async generateResetToken(email) {
  try {
    console.log('🔍 [RESET] Début generateResetToken pour:', email);
    
    const users = await query(
      'SELECT id, first_name, last_name FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );

    console.log('🔍 [RESET] Utilisateurs trouvés:', users.length);

    if (users.length === 0) {
      console.log('❌ [RESET] Email non trouvé dans la base');
      return { success: false, message: 'כתובת האימייל לא נמצאה במערכת' };
    }

    const user = users[0];
    console.log('🔍 [RESET] User trouvé - ID:', user.id, 'Name:', user.first_name);
    
    const emailService = require('../services/emailService');
    const resetToken = emailService.generateResetToken();
    console.log('🔍 [RESET] Token généré:', resetToken.substring(0, 10) + '...');
    
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('🔍 [RESET] Suppression anciens tokens...');
    await query('DELETE FROM password_reset_tokens WHERE userId = ?', [user.id]);

    console.log('🔍 [RESET] Insertion nouveau token...');
    await query(
      'INSERT INTO password_reset_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );
    console.log('✅ [RESET] Token sauvegardé en base');

    console.log('📧 [RESET] Envoi email en cours...');
    const result = await emailService.sendResetPasswordEmail(
      email, 
      resetToken, 
      user.first_name
    );
    console.log('📧 [RESET] Résultat envoi email:', JSON.stringify(result));

    if (result.success) {
      console.log('✅ [RESET] Email envoyé avec succès!');
      return { success: true, message: 'אם כתובת האימייל קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה' };
    } else {
      console.log('❌ [RESET] Échec envoi email:', result.error);
      return { success: false, message: 'שגיאה בשליחת האימייל' };
    }

  } catch (error) {
    console.error('❌ [RESET] Error generating reset token:', error);
    return { success: false, message: 'שגיאה ביצירת טוקן איפוס' };
  }
}

  static async verifyResetToken(token) {
    try {
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
    const tokens = await query(`
  SELECT prt.userId, u.email, u.first_name 
  FROM password_reset_tokens prt
  JOIN users u ON prt.userId = u.id
  WHERE prt.tokenHash = ? AND prt.expiresAt > NOW() AND prt.usedAt IS NULL
`, [tokenHash]);

      return tokens.length > 0 
        ? { success: true, message: 'טוקן תקף' }
        : { success: false, message: 'טוקן איפוס לא תקף או פג תוקף' };

    } catch (error) {
      console.error('Error verifying reset token:', error);
      return { success: false, message: 'שגיאה בבדיקת הטוקן' };
    }
  }

  static async resetPassword(token, newPassword) {
    try {
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const tokens = await query(`
        SELECT prt.userId, u.email, u.first_name 
        FROM password_reset_tokens prt
        JOIN users u ON prt.userId = u.id
        WHERE prt.tokenHash = ? AND prt.expiresAt > NOW() AND prt.usedAt IS NULL
      `, [tokenHash]);

      if (tokens.length === 0) {
        return { success: false, message: 'טוקן איפוס לא תקף או פג תוקף' };
      }

      const tokenData = tokens[0];
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await query(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, tokenData.userId]
      );

      await query(
        'UPDATE password_reset_tokens SET usedAt = NOW() WHERE tokenHash = ?',
        [tokenHash]
      );

      return { 
        success: true, 
        message: 'הסיסמה שונתה בהצלחה',
        user: {
          id: tokenData.userId,
          email: tokenData.email,
          firstName: tokenData.first_name
        }
      };

    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, message: 'שגיאה בשינוי הסיסמה' };
    }
  }

  static async cleanExpiredTokens() {
    try {
      const result = await query(
        'DELETE FROM password_reset_tokens WHERE expiresAt < NOW() OR usedAt IS NOT NULL'
      );
      return result.affectedRows || 0;
    } catch (error) {
      console.error('Error cleaning expired tokens:', error);
      return 0;
    }
  }

  // =============================================
  // VALIDATION
  // =============================================
  static validateRegistrationData(userData) {
    const errors = [];

    // Email
    if (!userData.email || !userData.email.trim()) {
      errors.push({ field: 'email', message: 'כתובת אימייל נדרשת' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push({ field: 'email', message: 'כתובת אימייל לא תקינה' });
    }

    // Mot de passe
    if (!userData.password || userData.password.length < 8) {
      errors.push({ field: 'password', message: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
    }

    // Noms
    const firstName = userData.firstName || userData.first_name;
    const lastName = userData.lastName || userData.last_name;

    if (!firstName || !firstName.trim()) {
      errors.push({ field: 'firstName', message: 'שם פרטי נדרש' });
    }

    if (!lastName || !lastName.trim()) {
      errors.push({ field: 'lastName', message: 'שם משפחה נדרש' });
    }

    // Téléphone (optionnel mais si fourni, doit être valide)
    if (userData.phone && !/^05\d{8}$/.test(userData.phone)) {
      errors.push({ field: 'phone', message: 'מספר טלפון לא תקין (05xxxxxxxx)' });
    }

    // Rôle
    if (!userData.role || !['client', 'provider'].includes(userData.role)) {
      errors.push({ field: 'role', message: 'סוג משתמש נדרש' });
    }

    // Type de service pour les providers
    if (userData.role === 'provider') {
      const serviceType = userData.serviceType || userData.service_type;
     const validServices = [
  'babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare',
  'laundry', 'property_management', 'electrician', 'plumbing', 'air_conditioning',
  'gas_technician', 'drywall', 'carpentry', 'home_organization', 'event_entertainment',
  'private_chef', 'painting', 'waterproofing', 'contractor', 'aluminum', 
  'glass_works', 'locksmith'
];
      
      if (!serviceType || !validServices.includes(serviceType)) {
        errors.push({ field: 'serviceType', message: 'סוג שירות נדרש לספקים' });
      }
    }

    return errors;
  }

  static async emailExists(email) {
    try {
      const users = await query(
        'SELECT id FROM users WHERE email = ? AND is_active = TRUE',
        [email.toLowerCase().trim()]
      );
      return users.length > 0;
    } catch (error) {
      console.error('שגיאה בבדיקת אימייל קיים:', error);
      throw error;
    }
  }

static async hasService(email, serviceType) {
  try {
    const result = await query(`
      SELECT sp.id 
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.email = ? 
        AND sp.service_type = ? 
        AND u.is_active = TRUE
        AND sp.is_active = TRUE  -- ✅ AJOUTER CETTE LIGNE
    `, [email.toLowerCase().trim(), serviceType]);
    return result.length > 0;
  } catch (error) {
    console.error('שגיאה בבדיקת שירות קיים:', error);
    throw error;
  }
}

  // =============================================
  // MÉTHODES UTILITAIRES
  // =============================================
  
  // Obtenir l'objet JSON sans le mot de passe
  toJSON() {
    const userObject = { ...this };
    delete userObject.password;
    
    // Convertir les noms pour compatibilité frontend
    return {
      id: this.id,
      email: this.email,
      firstName: this.first_name,
      lastName: this.last_name,
      phone: this.phone,
      role: this.role,
      serviceType: this.service_type,
      isActive: this.is_active,
      emailVerified: this.email_verified,
      isPremium: this.isPremium(),
      premiumUntil: this.premium_until,
      profileImage: this.profile_image,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      lastLogin: this.last_login,
        scheduled_deletion_date: this.scheduled_deletion_date
    };
  }

  // Désactiver le compte
  async deactivate() {
    try {
      await query(
        'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [this.id]
      );

      this.is_active = false;
      return this;
    } catch (error) {
      console.error('שגיאה בביטול חשבון:', error);
      throw error;
    }
  }

  // =============================================
  // MÉTHODES STATIQUES POUR STATISTICS
  // =============================================
  static async getStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'client' THEN 1 END) as total_clients,
          COUNT(CASE WHEN role = 'provider' THEN 1 END) as total_providers,
          COUNT(CASE WHEN premium_until > NOW() THEN 1 END) as premium_users,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as new_today
        FROM users 
        WHERE is_active = TRUE
      `);

      const serviceStats = await query(`
        SELECT 
          service_type,
          COUNT(*) as count
        FROM users 
        WHERE role = 'provider' AND is_active = TRUE
        GROUP BY service_type
      `);

      return {
        users: stats[0],
        services: serviceStats.reduce((acc, stat) => {
          acc[stat.service_type] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('שגיאה בקבלת סטטיסטיקות:', error);
      throw error;
    }
  }

  // Méthode statique pour compatibilité avec les nouvelles routes
  static async executeQuery(sql, params = []) {
    return await query(sql, params);
  }

// =============================================
  // AJOUTS À User.js - Nouvelles méthodes pour Step 2
  // =============================================

  // =============================================
  // CRÉATION COMPLÈTE PROVIDER (Step 2) - VERSION CORRIGÉE
  // =============================================
  static async createProviderWithDetails(userData, serviceDetails, workingAreas, profileImagePath = null) {
    return transaction(async (connection) => {
      try {
        console.log('🔵 Début création provider complet');
        console.log('📝 userData:', userData);
        console.log('📝 serviceDetails:', serviceDetails);
        console.log('📝 workingAreas:', workingAreas);

        // 1. Créer l'utilisateur de base
        const user = await User.create(userData);
        if (!user) {
          throw new Error('Échec création utilisateur de base');
        }
        console.log('✅ Utilisateur créé, ID:', user.id);

        // 2. Récupérer le service provider créé automatiquement
        const [providers] = await connection.execute(
          'SELECT id FROM service_providers WHERE user_id = ? AND service_type = ?',
          [user.id, userData.serviceType]
        );

        if (providers.length === 0) {
          throw new Error('Profil provider non trouvé après création user');
        }

        const providerId = providers[0].id;
        console.log('✅ Provider ID récupéré:', providerId);

        // 3. Mettre à jour service_providers avec TOUTES les données
        await User.updateServiceProviderWithDetails(
          connection, 
          providerId, 
          userData.serviceType, 
          serviceDetails,
          profileImagePath
        );
        console.log('✅ Détails service enregistrés');

        // 4. Insérer les zones de travail
        if (workingAreas && workingAreas.length > 0) {
          await User.insertWorkingAreas(connection, providerId, workingAreas);
          console.log('✅ Zones de travail enregistrées:', workingAreas.length);
        }

        // 5. Mettre à jour le flag profile_completed
        await connection.execute(
          'UPDATE service_providers SET profile_completed = 1 WHERE id = ?',
          [providerId]
        );
        console.log('✅ Profile marqué comme complet');

        console.log('🎉 Provider complet créé avec succès');
        return user;

      } catch (error) {
        console.error('❌ Erreur création provider complet:', error);
        throw error;
      }
    });
  }

  // =============================================
// ✅ CORRIGÉ - MISE À JOUR SERVICE_PROVIDERS AVEC TOUS LES DÉTAILS
// =============================================
static async updateServiceProviderWithDetails(connection, providerId, serviceType, details, profileImagePath = null) {
  try {
    console.log('📝 DÉBUT updateServiceProviderWithDetails');
    console.log('providerId:', providerId);
    console.log('serviceType:', serviceType);
    console.log('details REÇUS:', JSON.stringify(details, null, 2));
    
    // ✅ Liste des colonnes JSON dans MySQL
    const jsonColumns = [
      'availability_days',
      'availability_hours', 
      'babysitting_types',
      'languages',
      'certifications'
    ];
    
    // Champs de base communs
    const baseFields = {
      description: details.description || `ספק ${serviceType} מקצועי`,
      experience_years: details.experience || details.experienceYears || 0,
      hourly_rate: details.hourlyRate || details.rate || 0,
      service_details: JSON.stringify(details),
      profile_image: profileImagePath ? profileImagePath.replace(/\\/g, '/') : null
    };

    // ✅ AUTOMATIQUE : Pour chaque colonne JSON, convertir en JSON
    jsonColumns.forEach(col => {
      if (details[col] !== undefined && details[col] !== null) {
        if (Array.isArray(details[col])) {
          // Si c'est déjà un array → JSONifier
          baseFields[col] = JSON.stringify(details[col]);
        } else if (typeof details[col] === 'string') {
          // Si c'est une string → mettre dans un array puis JSONifier
          baseFields[col] = JSON.stringify([details[col]]);
        } else {
          // Autre type → JSONifier tel quel
          baseFields[col] = JSON.stringify(details[col]);
        }
      }
    });

    // ✅ Gérer can_travel_alone séparément (tinyint, pas JSON)
    if (details.can_travel_alone !== undefined) {
      baseFields.can_travel_alone = details.can_travel_alone === true ? 1 : 0;
    }

    console.log('🔍 baseFields à sauvegarder:', JSON.stringify(baseFields, null, 2));

    const fieldNames = Object.keys(baseFields);
    const fieldValues = Object.values(baseFields);
    
    const sql = `
      UPDATE service_providers 
      SET ${fieldNames.map(f => `${f} = ?`).join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    console.log('📤 SQL:', sql);
    console.log('📤 Values:', [...fieldValues, providerId]);

    await connection.execute(sql, [...fieldValues, providerId]);

    console.log('✅ UPDATE exécuté avec succès');

  } catch (error) {
    console.error('❌ Erreur updateServiceProviderWithDetails:', error);
    throw error;
  }
}

  // =============================================
  // INSERTION ZONES DE TRAVAIL - VERSION CORRIGÉE
  // =============================================
  static async insertWorkingAreas(connection, providerId, workingAreas) {
    if (!workingAreas || workingAreas.length === 0) {
      console.log('⚠️ Pas de zones de travail à insérer');
      return;
    }

    try {
      const sql = `
        INSERT INTO provider_working_areas (provider_id, city, neighborhood, created_at)
        VALUES (?, ?, ?, NOW())
      `;

      for (const area of workingAreas) {
        await connection.execute(sql, [
          providerId, 
          area.city, 
          area.neighborhood
        ]);
        console.log(`✅ Zone ajoutée: ${area.neighborhood}, ${area.city}`);
      }

    } catch (error) {
      console.error('❌ Erreur insertion zones de travail:', error);
      throw error;
    }
  }

  // =============================================
  // MISE À JOUR DÉTAILS PROVIDER - VERSION CORRIGÉE
  // =============================================
  async updateProviderDetails(serviceDetails, workingAreas = null) {
    return transaction(async (connection) => {
      try {
        console.log('🔄 Mise à jour détails provider pour user', this.id);

        // 1. Récupérer provider ID
        const [providers] = await connection.execute(
          'SELECT id FROM service_providers WHERE user_id = ? AND service_type = ?',
          [this.id, this.service_type]
        );

        if (providers.length === 0) {
          throw new Error('Profil provider non trouvé');
        }

        const providerId = providers[0].id;
        console.log('✅ Provider ID:', providerId);

        // 2. Mettre à jour les détails du service
        if (serviceDetails) {
          await User.updateServiceProviderWithDetails(
            connection, 
            providerId, 
            this.service_type, 
            serviceDetails
          );
          console.log('✅ Détails service mis à jour');
        }

        // 3. Mettre à jour les zones de travail
        if (workingAreas) {
          // Supprimer anciennes zones
          await connection.execute(
            'DELETE FROM provider_working_areas WHERE provider_id = ?',
            [providerId]
          );
          console.log('✅ Anciennes zones supprimées');

          // Insérer nouvelles zones
          await User.insertWorkingAreas(connection, providerId, workingAreas);
          console.log('✅ Nouvelles zones insérées');
        }

        // 4. Marquer profil comme complet
        await connection.execute(
          'UPDATE service_providers SET profile_completed = 1 WHERE id = ?',
          [providerId]
        );

        console.log('🎉 Mise à jour complète réussie');
        return true;

      } catch (error) {
        console.error('❌ Erreur mise à jour détails provider:', error);
        throw error;
      }
    });
  }

  // =============================================
  // VALIDATION DONNÉES STEP 2
  // =============================================
 static validateProviderStep2(serviceType, serviceDetails, workingAreas) {
  const errors = [];

  // Validation zones de travail
  if (!workingAreas || workingAreas.length === 0) {
    errors.push({ field: 'workingAreas', message: 'יש לבחור לפחות אזור עבודה אחד' });
  }

  // Validation basique pour tous les services
  if (!serviceDetails || Object.keys(serviceDetails).length === 0) {
    errors.push({ field: 'serviceDetails', message: 'פרטי שירות נדרשים' });
    return errors;
  }

  // Validation par service
  switch (serviceType) {
    case 'babysitting':
      if (!serviceDetails.age) errors.push({ field: 'age', message: 'גיל נדרש' });
      else if (parseInt(serviceDetails.age) < 15) errors.push({ field: 'age', message: 'גיל מינימלי: 15 שנים' });
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.ageGroups || serviceDetails.ageGroups.length === 0) {
        errors.push({ field: 'ageGroups', message: 'יש לבחור קבוצות גיל' });
      }
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.babysitting_types || serviceDetails.babysitting_types.length === 0) {
        errors.push({ field: 'babysitting_types', message: 'יש לבחור סוגי שמרטפות' });
      }
      if (serviceDetails.can_travel_alone === undefined) {
        errors.push({ field: 'can_travel_alone', message: 'יש לציין אם יכול להגיע ולחזור לבד' });
      }
      if (!serviceDetails.languages || serviceDetails.languages.length === 0) {
        errors.push({ field: 'languages', message: 'יש לבחור לפחות שפה אחת' });
      }
      if (!serviceDetails.hourlyRate) errors.push({ field: 'hourlyRate', message: 'תעריף שעתי נדרש' });
      break;

    case 'cleaning':
      if (!serviceDetails.legalStatus) errors.push({ field: 'legalStatus', message: 'סטטוס משפטי נדרש' });
      if (!serviceDetails.cleaningTypes || serviceDetails.cleaningTypes.length === 0) {
        errors.push({ field: 'cleaningTypes', message: 'יש לבחור סוגי ניקיון' });
      }
      if (!serviceDetails.frequency || serviceDetails.frequency.length === 0) {
        errors.push({ field: 'frequency', message: 'יש לבחור תדירות' });
      }
 if (!serviceDetails.hourlyRate) errors.push({ field: 'hourlyRate', message: 'תעריף נדרש' });;
      break;

    case 'gardening':
      if (!serviceDetails.services || serviceDetails.services.length === 0) {
        errors.push({ field: 'services', message: 'יש לבחור סוגי שירותי גינון' });
      }
      if (!serviceDetails.seasons || serviceDetails.seasons.length === 0) {
        errors.push({ field: 'seasons', message: 'יש לבחור עונות זמינות' });
      }
      if (!serviceDetails.equipment || serviceDetails.equipment.length === 0) {
        errors.push({ field: 'equipment', message: 'יש לציין ציוד' });
      }
      if (!serviceDetails.rate) errors.push({ field: 'rate', message: 'תעריף נדרש' });
      break;

    case 'petcare':
      if (!serviceDetails.animalTypes || serviceDetails.animalTypes.length === 0) {
        errors.push({ field: 'animalTypes', message: 'יש לבחור סוגי חיות' });
      }
      if (!serviceDetails.dogSizes || serviceDetails.dogSizes.length === 0) {
        errors.push({ field: 'dogSizes', message: 'יש לבחור גודל חיה' });
      }
      if (!serviceDetails.location) errors.push({ field: 'location', message: 'מקום השמירה נדרש' });
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'ניסיון נדרש' });
      break;

    case 'tutoring':
      if (!serviceDetails.subjects || serviceDetails.subjects.length === 0) {
        errors.push({ field: 'subjects', message: 'יש לבחור מקצועות' });
      }
      if (!serviceDetails.levels || serviceDetails.levels.length === 0) {
        errors.push({ field: 'levels', message: 'יש לבחור רמות לימוד' });
      }
      if (!serviceDetails.qualifications) {
        errors.push({ field: 'qualifications', message: 'השכלה/הסמכות נדרשות' });
      }
      if (!serviceDetails.teachingMode) {
        errors.push({ field: 'teachingMode', message: 'אופן הוראה נדרש' });
      }
      break;

  case 'eldercare':
      if (!serviceDetails.careTypes || serviceDetails.careTypes.length === 0) {
        errors.push({ field: 'careTypes', message: 'יש לבחור סוגי טיפול' });
      }
      if (!serviceDetails.certification) {
        errors.push({ field: 'certification', message: 'הכשרה/הסמכה נדרשת' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור זמינות' });
      }
      if (!serviceDetails.experience) {
        errors.push({ field: 'experience', message: 'ניסיון עם קשישים נדרש' });
      }
      break;

  case 'laundry':
      if (!serviceDetails.laundryTypes || serviceDetails.laundryTypes.length === 0) {
        errors.push({ field: 'laundryTypes', message: 'יש לבחור סוגי שירותים' });
      }
      break;

    case 'property_management':
      if (!serviceDetails.management_type || serviceDetails.management_type.length === 0) {
        errors.push({ field: 'management_type', message: 'יש לבחור לפחות סוג ניהול אחד' });
      }
      break;

    case 'electrician':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקונים') && (!serviceDetails.repair_types || serviceDetails.repair_types.length === 0)) {
        errors.push({ field: 'repair_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
      }
      if (serviceDetails.work_types?.includes('התקנות') && (!serviceDetails.installation_types || serviceDetails.installation_types.length === 0)) {
        errors.push({ field: 'installation_types', message: 'יש לבחור לפחות סוג התקנה אחד' });
      }
      if (serviceDetails.work_types?.includes('עבודות חשמל גדולות') && (!serviceDetails.large_work_types || serviceDetails.large_work_types.length === 0)) {
        errors.push({ field: 'large_work_types', message: 'יש לבחור לפחות סוג עבודה גדולה אחד' });
      }
      break;

    case 'plumbing':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('סתימות') && (!serviceDetails.blockage_types || serviceDetails.blockage_types.length === 0)) {
        errors.push({ field: 'blockage_types', message: 'יש לבחור לפחות סוג סתימה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקון צנרת') && (!serviceDetails.pipe_repair_types || serviceDetails.pipe_repair_types.length === 0)) {
        errors.push({ field: 'pipe_repair_types', message: 'יש לבחור לפחות סוג תיקון צנרת אחד' });
      }
      if (serviceDetails.work_types?.includes('עבודות גדולות') && (!serviceDetails.large_work_types || serviceDetails.large_work_types.length === 0)) {
        errors.push({ field: 'large_work_types', message: 'יש לבחור לפחות סוג עבודה גדולה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקון והתקנת אביזרי אינסטלציה') && (!serviceDetails.fixture_types || serviceDetails.fixture_types.length === 0)) {
        errors.push({ field: 'fixture_types', message: 'יש לבחור לפחות סוג אביזר אחד' });
      }
      break;

    case 'air_conditioning':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('התקנת מזגנים') && (!serviceDetails.installation_types || serviceDetails.installation_types.length === 0)) {
        errors.push({ field: 'installation_types', message: 'יש לבחור לפחות סוג התקנה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקון מזגנים') && (!serviceDetails.repair_types || serviceDetails.repair_types.length === 0)) {
        errors.push({ field: 'repair_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
      }
      if (serviceDetails.work_types?.includes('פירוק והרכבת מזגנים') && (!serviceDetails.disassembly_types || serviceDetails.disassembly_types.length === 0)) {
        errors.push({ field: 'disassembly_types', message: 'יש לבחור לפחות סוג פירוק/הרכבה אחד' });
      }
      break;

    case 'gas_technician':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('התקנת צנרת גז בבית') && (!serviceDetails.installation_types || serviceDetails.installation_types.length === 0)) {
        errors.push({ field: 'installation_types', message: 'יש לבחור לפחות סוג התקנה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקוני גז בבית') && (!serviceDetails.repair_types || serviceDetails.repair_types.length === 0)) {
        errors.push({ field: 'repair_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
      }
      break;

    case 'drywall':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('עיצובים בגבס') && (!serviceDetails.design_types || serviceDetails.design_types.length === 0)) {
        errors.push({ field: 'design_types', message: 'יש לבחור לפחות סוג עיצוב אחד' });
      }
      if (serviceDetails.work_types?.includes('עבודות גבס') && (!serviceDetails.construction_types || serviceDetails.construction_types.length === 0)) {
        errors.push({ field: 'construction_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      break;

    case 'carpentry':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('בניית רהיטים') && (!serviceDetails.furniture_building_types || serviceDetails.furniture_building_types.length === 0)) {
        errors.push({ field: 'furniture_building_types', message: 'יש לבחור לפחות סוג בנייה אחד' });
      }
      if (serviceDetails.work_types?.includes('תיקון רהיטים') && (!serviceDetails.furniture_repair_types || serviceDetails.furniture_repair_types.length === 0)) {
        errors.push({ field: 'furniture_repair_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
      }
      if (serviceDetails.work_types?.includes('עבודות נגרות אחרות') && (!serviceDetails.other_carpentry_types || serviceDetails.other_carpentry_types.length === 0)) {
        errors.push({ field: 'other_carpentry_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      break;

    case 'home_organization':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('סידור כללי') && (!serviceDetails.general_organization_types || serviceDetails.general_organization_types.length === 0)) {
        errors.push({ field: 'general_organization_types', message: 'יש לבחור לפחות סוג סידור אחד' });
      }
      if (serviceDetails.work_types?.includes('סידור + מיון') && (!serviceDetails.sorting_types || serviceDetails.sorting_types.length === 0)) {
        errors.push({ field: 'sorting_types', message: 'יש לבחור לפחות סוג מיון אחד' });
      }
      if (serviceDetails.work_types?.includes('ארגון מקצועי') && (!serviceDetails.professional_organization_types || serviceDetails.professional_organization_types.length === 0)) {
        errors.push({ field: 'professional_organization_types', message: 'יש לבחור לפחות סוג ארגון אחד' });
      }
      break;

    case 'event_entertainment':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) {
        errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      }
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      
      // Validations conditionnelles pour השכרת ציוד לאירועים
      if (serviceDetails.work_types?.includes('השכרת ציוד לאירועים')) {
        if (!serviceDetails.equipment_rental_types || serviceDetails.equipment_rental_types.length === 0) {
          errors.push({ field: 'equipment_rental_types', message: 'יש לבחור לפחות סוג ציוד אחד' });
        }
        
        if (serviceDetails.equipment_rental_types?.includes('🍿 מכונות מזון')) {
          if (!serviceDetails.food_machine_types || serviceDetails.food_machine_types.length === 0) {
            errors.push({ field: 'food_machine_types', message: 'יש לבחור לפחות סוג מכונה אחד' });
          }
        }
        
        if (serviceDetails.equipment_rental_types?.includes('🎪 השכרת מתנפחים ומשחקים')) {
          if (!serviceDetails.inflatable_game_types || serviceDetails.inflatable_game_types.length === 0) {
            errors.push({ field: 'inflatable_game_types', message: 'יש לבחור לפחות סוג משחק אחד' });
          }
        }
        
        if (serviceDetails.equipment_rental_types?.includes('💨 מכונות אפקטים להשכרה')) {
          if (!serviceDetails.effect_machine_types || serviceDetails.effect_machine_types.length === 0) {
            errors.push({ field: 'effect_machine_types', message: 'יש לבחור לפחות סוג מכונה אחד' });
          }
        }
      }
      
      // Validation pour סוגי ההפעלה
      if (serviceDetails.work_types?.includes('סוגי ההפעלה')) {
        if (!serviceDetails.entertainment_types || serviceDetails.entertainment_types.length === 0) {
          errors.push({ field: 'entertainment_types', message: 'יש לבחור לפחות סוג הפעלה אחד' });
        }
      }
      
      // Validation pour אחר
      if (serviceDetails.work_types?.includes('אחר')) {
        if (!serviceDetails.other_types || serviceDetails.other_types.length === 0) {
          errors.push({ field: 'other_types', message: 'יש לבחור לפחות סוג שירות אחד' });
        }
      }
      break;
      case 'private_chef':
      if (!serviceDetails.age) {
        errors.push({ field: 'age', message: 'גיל נדרש' });
      } else if (parseInt(serviceDetails.age) < 18) {
        errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
      }
      if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
      if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
        errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
      }
      if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
        errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
      }
      if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
        errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
      }
      if (serviceDetails.work_types?.includes('סוג המטבח') && (!serviceDetails.cuisine_types || serviceDetails.cuisine_types.length === 0)) {
        errors.push({ field: 'cuisine_types', message: 'יש לבחור לפחות סוג מטבח אחד' });
      }
      if (serviceDetails.work_types?.includes('כשרות') && (!serviceDetails.kosher_types || serviceDetails.kosher_types.length === 0)) {
        errors.push({ field: 'kosher_types', message: 'יש לבחור לפחות סוג כשרות אחד' });
      }
      break;

      case 'painting':
  if (!serviceDetails.age) {
    errors.push({ field: 'age', message: 'גיל נדרש' });
  } else if (parseInt(serviceDetails.age) < 18) {
    errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
  }
  if (!serviceDetails.experience) {
    errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
  }
  if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
    errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
  }
  if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
    errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
  }
  if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
    errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  break;

  case 'waterproofing':
  if (!serviceDetails.age) {
    errors.push({ field: 'age', message: 'גיל נדרש' });
  } else if (parseInt(serviceDetails.age) < 18) {
    errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
  }
  if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
  if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
    errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
  }
  if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
    errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
  }
  if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
    errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  if (serviceDetails.work_types?.includes('איטום גגות') && (!serviceDetails.roof_waterproofing_types || serviceDetails.roof_waterproofing_types.length === 0)) {
    errors.push({ field: 'roof_waterproofing_types', message: 'יש לבחור לפחות סוג איטום גג אחד' });
  }
  if (serviceDetails.work_types?.includes('איטום קירות חיצוניים') && (!serviceDetails.wall_waterproofing_types || serviceDetails.wall_waterproofing_types.length === 0)) {
    errors.push({ field: 'wall_waterproofing_types', message: 'יש לבחור לפחות סוג איטום קיר אחד' });
  }
  if (serviceDetails.work_types?.includes('איטום מרפסות') && (!serviceDetails.balcony_waterproofing_types || serviceDetails.balcony_waterproofing_types.length === 0)) {
    errors.push({ field: 'balcony_waterproofing_types', message: 'יש לבחור לפחות סוג איטום מרפסת אחד' });
  }
  if (serviceDetails.work_types?.includes('איטום חדרים רטובים') && (!serviceDetails.wet_room_waterproofing_types || serviceDetails.wet_room_waterproofing_types.length === 0)) {
    errors.push({ field: 'wet_room_waterproofing_types', message: 'יש לבחור לפחות סוג איטום חדר רטוב אחד' });
  }
  if (serviceDetails.work_types?.includes('איטום תת-קרקעי') && (!serviceDetails.underground_waterproofing_types || serviceDetails.underground_waterproofing_types.length === 0)) {
    errors.push({ field: 'underground_waterproofing_types', message: 'יש לבחור לפחות סוג איטום תת-קרקעי אחד' });
  }
  if (serviceDetails.work_types?.includes('בדיקות, אבחון וציוד') && (!serviceDetails.inspection_equipment_types || serviceDetails.inspection_equipment_types.length === 0)) {
    errors.push({ field: 'inspection_equipment_types', message: 'יש לבחור לפחות סוג בדיקה אחד' });
  }
  break;
case 'contractor':
  if (!serviceDetails.age) {
    errors.push({ field: 'age', message: 'גיל נדרש' });
  } else if (parseInt(serviceDetails.age) < 18) {
    errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
  }
  if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
  if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
    errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
  }
  if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
    errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
  }
  if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
    errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  if (serviceDetails.work_types?.includes('עבודות שלד') && (!serviceDetails.structure_work_types || serviceDetails.structure_work_types.length === 0)) {
    errors.push({ field: 'structure_work_types', message: 'יש לבחור לפחות סוג עבודת שלד אחד' });
  }
  if (serviceDetails.work_types?.includes('שיפוצים כלליים') && (!serviceDetails.general_renovation_types || serviceDetails.general_renovation_types.length === 0)) {
    errors.push({ field: 'general_renovation_types', message: 'יש לבחור לפחות סוג שיפוץ אחד' });
  }
  if (serviceDetails.work_types?.includes('חשמל ואינסטלציה') && (!serviceDetails.electric_plumbing_types || serviceDetails.electric_plumbing_types.length === 0)) {
    errors.push({ field: 'electric_plumbing_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  if (serviceDetails.work_types?.includes('עבודות חוץ') && (!serviceDetails.exterior_work_types || serviceDetails.exterior_work_types.length === 0)) {
    errors.push({ field: 'exterior_work_types', message: 'יש לבחור לפחות סוג עבודת חוץ אחד' });
  }
  if (serviceDetails.work_types?.includes('שיקום ותיקון חוץ') && (!serviceDetails.facade_repair_types || serviceDetails.facade_repair_types.length === 0)) {
    errors.push({ field: 'facade_repair_types', message: 'יש לבחור לפחות סוג שיקום אחד' });
  }
  break;
  case 'aluminum':
  if (!serviceDetails.age) {
    errors.push({ field: 'age', message: 'גיל נדרש' });
  } else if (parseInt(serviceDetails.age) < 18) {
    errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
  }
  if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
  if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
    errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
  }
  if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
    errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
  }
  if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
    errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  if (serviceDetails.work_types?.includes('חלונות ודלתות') && (!serviceDetails.windows_doors_types || serviceDetails.windows_doors_types.length === 0)) {
    errors.push({ field: 'windows_doors_types', message: 'יש לבחור לפחות סוג אחד' });
  }
  if (serviceDetails.work_types?.includes('פרגולות ואלומיניום חוץ') && (!serviceDetails.pergolas_outdoor_types || serviceDetails.pergolas_outdoor_types.length === 0)) {
    errors.push({ field: 'pergolas_outdoor_types', message: 'יש לבחור לפחות סוג אחד' });
  }
  if (serviceDetails.work_types?.includes('תיקונים ושירות') && (!serviceDetails.repairs_service_types || serviceDetails.repairs_service_types.length === 0)) {
    errors.push({ field: 'repairs_service_types', message: 'יש לבחור לפחות סוג אחד' });
  }
  if (serviceDetails.work_types?.includes('חיפויי אלומיניום') && (!serviceDetails.cladding_types || serviceDetails.cladding_types.length === 0)) {
    errors.push({ field: 'cladding_types', message: 'יש לבחור לפחות סוג אחד' });
  }
  break;

  case 'glass_works':
    if (!serviceDetails.age) {
      errors.push({ field: 'age', message: 'גיל נדרש' });
    } else if (parseInt(serviceDetails.age) < 18) {
      errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
    }
    if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
    if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
      errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
    }
    if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
      errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
    }
    if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
      errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
    }
    if (serviceDetails.work_types?.includes('זכוכיות לבית') && (!serviceDetails.home_glass_types || serviceDetails.home_glass_types.length === 0)) {
      errors.push({ field: 'home_glass_types', message: 'יש לבחור לפחות סוג זכוכית אחד' });
    }
    if (serviceDetails.work_types?.includes('מקלחונים') && (!serviceDetails.shower_types || serviceDetails.shower_types.length === 0)) {
      errors.push({ field: 'shower_types', message: 'יש לבחור לפחות סוג מקלחון אחד' });
    }
    if (serviceDetails.work_types?.includes('מחיצות וקירות זכוכית') && (!serviceDetails.partition_types || serviceDetails.partition_types.length === 0)) {
      errors.push({ field: 'partition_types', message: 'יש לבחור לפחות סוג מחיצה אחד' });
    }
    if (serviceDetails.work_types?.includes('מעקות זכוכית') && (!serviceDetails.railing_types || serviceDetails.railing_types.length === 0)) {
      errors.push({ field: 'railing_types', message: 'יש לבחור לפחות סוג מעקה אחד' });
    }
    if (serviceDetails.work_types?.includes('ריהוט וזכוכית מעוצבת') && (!serviceDetails.furniture_glass_types || serviceDetails.furniture_glass_types.length === 0)) {
      errors.push({ field: 'furniture_glass_types', message: 'יש לבחור לפחות סוג ריהוט אחד' });
    }
    if (serviceDetails.work_types?.includes('תיקונים ושירות') && (!serviceDetails.repair_service_types || serviceDetails.repair_service_types.length === 0)) {
      errors.push({ field: 'repair_service_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
    }
    break;
  
    case 'locksmith':
  if (!serviceDetails.age) {
    errors.push({ field: 'age', message: 'גיל נדרש' });
  } else if (parseInt(serviceDetails.age) < 18) {
    errors.push({ field: 'age', message: 'גיל מינימלי: 18 שנים' });
  }
  if (!serviceDetails.experience) errors.push({ field: 'experience', message: 'שנות ניסיון נדרשות' });
  if (!serviceDetails.availability_days || serviceDetails.availability_days.length === 0) {
    errors.push({ field: 'availability_days', message: 'יש לבחור ימי זמינות' });
  }
  if (!serviceDetails.availability_hours || serviceDetails.availability_hours.length === 0) {
    errors.push({ field: 'availability_hours', message: 'יש לבחור שעות זמינות' });
  }
  if (!serviceDetails.work_types || serviceDetails.work_types.length === 0) {
    errors.push({ field: 'work_types', message: 'יש לבחור לפחות סוג עבודה אחד' });
  }
  if (serviceDetails.work_types?.includes('🔐 פריצות חירום') && (!serviceDetails.emergency_opening_types || serviceDetails.emergency_opening_types.length === 0)) {
    errors.push({ field: 'emergency_opening_types', message: 'יש לבחור לפחות סוג פריצה אחד' });
  }
  if (serviceDetails.work_types?.includes('🔑 החלפת מנעולים') && (!serviceDetails.lock_replacement_types || serviceDetails.lock_replacement_types.length === 0)) {
    errors.push({ field: 'lock_replacement_types', message: 'יש לבחור לפחות סוג החלפה אחד' });
  }
  if (serviceDetails.work_types?.includes('🚪 תיקון דלתות ובטיחות') && (!serviceDetails.door_repair_types || serviceDetails.door_repair_types.length === 0)) {
    errors.push({ field: 'door_repair_types', message: 'יש לבחור לפחות סוג תיקון אחד' });
  }
  if (serviceDetails.work_types?.includes('📡 מערכות מתקדמות') && (!serviceDetails.advanced_systems_types || serviceDetails.advanced_systems_types.length === 0)) {
    errors.push({ field: 'advanced_systems_types', message: 'יש לבחור לפחות סוג מערכת אחד' });
  }
  break;
  }
  
  return errors;
}

  // =============================================
  // MÉTHODE HELPER POUR CRÉDITS CLIENTS
  // =============================================
  async getContactCredits() {
    if (this.role !== 'client') {
      return null;
    }

    // TODO: Implémenter système de crédits si nécessaire
    return {
      remaining: 10,
      total: 10,
      used: 0
    };
  }
// =============================================
// ✅ NOUVEAU - MISE À JOUR PROFIL COMPLET
// =============================================
async updateFullProfile(profileData) {
  return transaction(async (connection) => {
    try {
      console.log('🔄 Début mise à jour profil complet pour user', this.id);

      // 1. Mettre à jour les données utilisateur de base
      const userUpdateFields = [];
      const userUpdateValues = [];

      if (profileData.firstName) {
        userUpdateFields.push('first_name = ?');
        userUpdateValues.push(profileData.firstName);
      }
      if (profileData.lastName) {
        userUpdateFields.push('last_name = ?');
        userUpdateValues.push(profileData.lastName);
      }
      if (profileData.phone !== undefined) {
        userUpdateFields.push('phone = ?');
        userUpdateValues.push(profileData.phone || null);
      }

      if (userUpdateFields.length > 0) {
        userUpdateFields.push('updated_at = NOW()');
        userUpdateValues.push(this.id);

        await connection.execute(
          `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = ?`,
          userUpdateValues
        );
        console.log('✅ Données utilisateur mises à jour');
      }

     // 2. Si c'est un provider, mettre à jour service_providers
if (this.role === 'provider') {
  // ✅ CORRECTION: Utiliser le service actif passé par le frontend
  const activeServiceType = profileData.activeServiceType || this.service_type;
  console.log('🔧 Service actif pour mise à jour:', activeServiceType);
  
  // Récupérer le provider ID pour le BON service
  const [providers] = await connection.execute(
    'SELECT id FROM service_providers WHERE user_id = ? AND service_type = ?',
    [this.id, activeServiceType]
  );

        if (providers.length === 0) {
          throw new Error('Profil provider non trouvé');
        }

        const providerId = providers[0].id;

        // Préparer les mises à jour pour service_providers
        const providerUpdateFields = [];
        const providerUpdateValues = [];

        if (profileData.description !== undefined) {
          providerUpdateFields.push('description = ?');
          providerUpdateValues.push(profileData.description || null);
        }

        if (profileData.experienceYears !== undefined) {
          providerUpdateFields.push('experience_years = ?');
          providerUpdateValues.push(parseInt(profileData.experienceYears) || 0);
        }

        if (profileData.hourlyRate !== undefined) {
          providerUpdateFields.push('hourly_rate = ?');
          providerUpdateValues.push(parseFloat(profileData.hourlyRate) || 0);
        }

        if (profileData.availability !== undefined) {
          providerUpdateFields.push('availability = ?');
          providerUpdateValues.push(JSON.stringify(profileData.availability || []));
        }

        if (profileData.languages !== undefined) {
          providerUpdateFields.push('languages = ?');
          providerUpdateValues.push(JSON.stringify(profileData.languages || []));
        }

      // ✅ MISE À JOUR AUTOMATIQUE du JSON service_details
// Récupérer le JSON actuel
const [currentProvider] = await connection.execute(
  'SELECT service_details FROM service_providers WHERE id = ?',
  [providerId]
);

let currentDetails = {};
if (currentProvider[0]?.service_details) {
  try {
    currentDetails = typeof currentProvider[0].service_details === 'string' 
      ? JSON.parse(currentProvider[0].service_details)
      : currentProvider[0].service_details;
  } catch (e) {
    console.log('⚠️ Erreur parsing service_details existant');
  }
}

// Fusionner avec les nouvelles valeurs
const updatedDetails = {
  ...currentDetails,
  ...(profileData.serviceDetails || {}),
  // ✅ Synchroniser les colonnes avec le JSON
  experience_years: profileData.experienceYears !== undefined ? parseInt(profileData.experienceYears) || 0 : currentDetails.experience_years,
  hourly_rate: profileData.hourlyRate !== undefined ? parseFloat(profileData.hourlyRate).toFixed(2) : currentDetails.hourly_rate,
  hourlyRate: profileData.hourlyRate !== undefined ? profileData.hourlyRate.toString() : currentDetails.hourlyRate,
  description: profileData.description !== undefined ? profileData.description : currentDetails.description
};

providerUpdateFields.push('service_details = ?');
providerUpdateValues.push(JSON.stringify(updatedDetails));

        if (providerUpdateFields.length > 0) {
          providerUpdateFields.push('updated_at = NOW()');
          providerUpdateValues.push(providerId);

          await connection.execute(
            `UPDATE service_providers SET ${providerUpdateFields.join(', ')} WHERE id = ?`,
            providerUpdateValues
          );
          console.log('✅ Service provider mis à jour');
        }

        // 3. Mettre à jour les zones de travail si fournies
        if (profileData.workingAreas !== undefined && Array.isArray(profileData.workingAreas)) {
          // Supprimer les anciennes zones
          await connection.execute(
            'DELETE FROM provider_working_areas WHERE provider_id = ?',
            [providerId]
          );
          console.log('✅ Anciennes zones supprimées');

          // Insérer les nouvelles zones
          if (profileData.workingAreas.length > 0) {
            for (const area of profileData.workingAreas) {
              await connection.execute(
                'INSERT INTO provider_working_areas (provider_id, city, neighborhood, created_at) VALUES (?, ?, ?, NOW())',
                [providerId, area.city, area.neighborhood]
              );
            }
            console.log('✅ Nouvelles zones insérées:', profileData.workingAreas.length);
          }
        }
      }

      // 4. Mettre à jour l'instance actuelle
      if (profileData.firstName) this.first_name = profileData.firstName;
      if (profileData.lastName) this.last_name = profileData.lastName;
      if (profileData.phone !== undefined) this.phone = profileData.phone;

      console.log('🎉 Mise à jour profil complet réussie');
      return true;

    } catch (error) {
      console.error('❌ Erreur mise à jour profil complet:', error);
      throw error;
    }
  });
}

// =============================================
// ✅ AMÉLIORATION - Récupération profil avec service_details ET image
// =============================================
async getFullProviderProfile() {
  console.log('🔍 getFullProviderProfile appelé pour user', this.id);
  
  if (this.role !== 'provider') {
    console.log('⚠️ User n\'est pas un provider');
    return null;
  }

  try {
    // ✅ SELECT explicite avec TOUTES les colonnes babysitting
    const profiles = await query(`
      SELECT 
        *,
        availability_days,
        availability_hours,
        babysitting_types,
        can_travel_alone
      FROM service_providers 
      WHERE user_id = ? AND is_active = TRUE
    `, [this.id]);

    if (profiles.length === 0) {
      console.log('⚠️ Aucun profil provider trouvé');
      return null;
    }

    const profile = profiles[0];
    console.log('✅ Profil de base récupéré');
    console.log('🔍 DEBUG availability_days:', profile.availability_days);
    console.log('🔍 DEBUG babysitting_types:', profile.babysitting_types);

    // 2. Récupérer les zones de travail
    const workingAreas = await query(
      'SELECT city, neighborhood FROM provider_working_areas WHERE provider_id = ?',
      [profile.id]
    );
    console.log('✅ Zones de travail récupérées:', workingAreas.length);

    // 3. Parser les données JSON - AVEC VÉRIFICATION DES CHAÎNES VIDES
    const parseJsonSafe = (value) => {
      if (!value || value === '' || value === 'null') return [];
      if (typeof value === 'object') return Array.isArray(value) ? value : [];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }
      return [];
    };

const parseJsonObject = (value) => {
  console.log('🔍 parseJsonObject - type:', typeof value);
  console.log('🔍 parseJsonObject - value:', value);
  
  if (!value || value === '' || value === 'null') {
    console.log('→ Retour: {} (vide ou null)');
    return {};
  }
  
  // Si c'est déjà un objet JavaScript (MySQL a auto-parsé)
  if (typeof value === 'object' && !Array.isArray(value)) {
    console.log('→ Retour: objet direct');
    return value;
  }
  
  // Si c'est une string JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      console.log('→ Retour: parsé avec succès');
      return parsed;
    } catch (e) {
      console.log('❌ Erreur parsing:', e.message);
      return {};
    }
  }
  
  console.log('→ Retour: {} (type non géré)');
  return {};
};

    // ✅ Parser profile_images
    let profileImage = null;
    if (profile.profile_images) {
      try {
        const imagesArray = typeof profile.profile_images === 'string' 
          ? JSON.parse(profile.profile_images) 
          : profile.profile_images;
        
        if (Array.isArray(imagesArray) && imagesArray.length > 0) {
          profileImage = imagesArray[0];
        }
      } catch (parseError) {
        console.error('⚠️ Erreur parsing profile_images:', parseError);
      }
    }

// Parser le JSON d'abord
    const parsedServiceDetails = parseJsonObject(profile.service_details);
    
    // ✅ CONSTRUCTION COMPLÈTE avec TOUS les alias
    const serviceDetails = {
      // Colonnes DB
      experience_years: profile.experience_years || 0,
      hourly_rate: profile.hourly_rate || 0,
      description: profile.description,
      availability: parseJsonSafe(profile.availability),
      availability_days: parseJsonSafe(profile.availability_days),
      availability_hours: parseJsonSafe(profile.availability_hours),
      languages: parseJsonSafe(profile.languages),
      certifications: parseJsonSafe(profile.certifications),
      babysitting_types: parseJsonSafe(profile.babysitting_types),
      can_travel_alone: profile.can_travel_alone === 1,
      
      // Données JSON
      ...parsedServiceDetails,
      
      // ✅ ALIAS pour compatibilité Dashboard
      experienceYears: profile.experience_years || parsedServiceDetails.experience || 0,
      experience: profile.experience_years || parsedServiceDetails.experience || 0,
      hourlyRate: profile.hourly_rate || parsedServiceDetails.hourlyRate || parsedServiceDetails.rate || 0,
      rate: profile.hourly_rate || parsedServiceDetails.rate || 0
    };

    console.log('✅ serviceDetails construit:', Object.keys(serviceDetails));

    return {
      ...profile,
      profileImage: profileImage,
      serviceDetails: serviceDetails,
      workingAreas: workingAreas || [],
      scheduled_deletion_date: this.scheduled_deletion_date 
    };

  } catch (error) {
    console.error('❌ Erreur récupération profil complet:', error);
    throw error;
  }
}

// =============================================
// 🆕 NOUVEAU - Récupération profil pour un service spécifique
// =============================================
async getProviderProfileForService(serviceType) {
  console.log('🔍 getProviderProfileForService appelé pour user', this.id, 'service:', serviceType);
  
  if (this.role !== 'provider') {
    console.log('⚠️ User n\'est pas un provider');
    return null;
  }

  try {
    // 1. Récupérer le profil pour CE service spécifique
    const profiles = await query(
      'SELECT * FROM service_providers WHERE user_id = ? AND service_type = ? AND is_active = TRUE',
      [this.id, serviceType]
    );

    if (profiles.length === 0) {
      console.log('⚠️ Aucun profil provider trouvé pour', serviceType);
      return null;
    }

    const profile = profiles[0];
    console.log('✅ Profil de base récupéré pour', serviceType);

    // 2. Récupérer les zones de travail
    const workingAreas = await query(
      'SELECT city, neighborhood FROM provider_working_areas WHERE provider_id = ?',
      [profile.id]
    );
    console.log('✅ Zones de travail récupérées:', workingAreas.length);

    // 3. Parser les données JSON
    const parseJsonSafe = (value) => {
      if (!value || value === '' || value === 'null') return [];
      try {
        return JSON.parse(value);
      } catch (e) {
        console.log('⚠️ Erreur parsing JSON:', value);
        return [];
      }
    };

 const parseJsonObject = (value) => {
  console.log('🔍 parseJsonObject - type:', typeof value);
  console.log('🔍 parseJsonObject - value:', value);
  
  if (!value || value === '' || value === 'null') {
    console.log('→ Retour: {} (vide ou null)');
    return {};
  }
  
  // Si c'est déjà un objet JavaScript (MySQL a auto-parsé)
  if (typeof value === 'object' && !Array.isArray(value)) {
    console.log('→ Retour: objet direct');
    return value;
  }
  
  // Si c'est une string JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      console.log('→ Retour: parsé avec succès');
      return parsed;
    } catch (e) {
      console.log('❌ Erreur parsing:', e.message);
      return {};
    }
  }
  
  console.log('→ Retour: {} (type non géré)');
  return {};
};

    // 4. Parser profile_images
    let profileImage = null;
    if (profile.profile_images) {
      try {
        const imagesArray = typeof profile.profile_images === 'string' 
          ? JSON.parse(profile.profile_images) 
          : profile.profile_images;
        
        if (Array.isArray(imagesArray) && imagesArray.length > 0) {
          profileImage = imagesArray[0];
          console.log('✅ Image de profil récupérée:', profileImage);
        }
      } catch (parseError) {
        console.error('⚠️ Erreur parsing profile_images:', parseError);
      }
    }

// Parser le JSON d'abord
    const parsedServiceDetails = parseJsonObject(profile.service_details);
    
    const serviceDetails = {
      // Colonnes DB
      experience_years: profile.experience_years || 0,
      hourly_rate: profile.hourly_rate || 0,
      description: profile.description,
      availability: parseJsonSafe(profile.availability),
      availability_days: parseJsonSafe(profile.availability_days),
      availability_hours: parseJsonSafe(profile.availability_hours),
      languages: parseJsonSafe(profile.languages),
      certifications: parseJsonSafe(profile.certifications),
      babysitting_types: parseJsonSafe(profile.babysitting_types),
      can_travel_alone: profile.can_travel_alone === 1,
      
      // Données JSON
      ...parsedServiceDetails,
      
      // ✅ ALIAS pour compatibilité (le Dashboard cherche ces noms)
      experienceYears: profile.experience_years || parsedServiceDetails.experience || 0,
      experience: profile.experience_years || parsedServiceDetails.experience || 0,
      hourlyRate: profile.hourly_rate || parsedServiceDetails.hourlyRate || parsedServiceDetails.rate || 0,
      rate: profile.hourly_rate || parsedServiceDetails.rate || 0
    };

    console.log('✅ Profil complet construit pour', serviceType);

    return {
      ...profile,
      profileImage: profileImage,
      serviceDetails: serviceDetails,
      workingAreas: workingAreas || [],
      scheduled_deletion_date: this.scheduled_deletion_date 
    };

  } catch (error) {
    console.error('❌ Erreur récupération profil pour service:', error);
    throw error;
  }
}

// =============================================
// ✅ NOUVEAU - SUPPRESSION DE COMPTE
// =============================================
async deleteAccount() {
  return transaction(async (connection) => {
    try {
      console.log('🗑️ Début suppression compte user', this.id);

      // ✅ Marquer dans trial_history AVANT anonymisation
      if (this.role === 'provider') {
        try {
          await TrialHistory.markAccountDeleted(this.email);
        } catch (error) {
          console.error('⚠️ Erreur marquage trial_history:', error);
        }
      }

      // 1. Désactiver l'utilisateur (soft delete)
      await connection.execute(
        'UPDATE users SET is_active = 0, email = CONCAT(email, "_deleted_", id), updated_at = NOW() WHERE id = ?',
        [this.id]
      );
      console.log('✅ Utilisateur désactivé');

    // 2. Si provider, SUPPRIMER les services (permet réinscription)
if (this.role === 'provider') {
  await connection.execute(
    'DELETE FROM service_providers WHERE user_id = ?',
    [this.id]
  );
  console.log('✅ Services providers supprimés');
  
  // Supprimer aussi les zones de travail
  await connection.execute(
    'DELETE FROM provider_working_areas WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = ?)',
    [this.id]
  );
  console.log('✅ Zones de travail supprimées');
}

      // 3. Anonymiser les données sensibles (optionnel)
      await connection.execute(
        'UPDATE users SET phone = NULL, profile_image = NULL WHERE id = ?',
        [this.id]
      );
      console.log('✅ Données anonymisées');

      console.log('🎉 Suppression compte réussie');
      return true;

    } catch (error) {
      console.error('❌ Erreur suppression compte:', error);
      throw error;
    }
  });
}

// =============================================
// ✅ RÉACTIVATION DE COMPTE
// =============================================
async reactivateAccount(originalEmail) {
  try {
    // Vérifier que l'email n'est pas déjà utilisé par un autre compte actif
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ? AND is_active = 1 AND id != ?',
      [originalEmail, this.id]
    );
    
    if (existingUser.length > 0) {
      throw new Error('Cette adresse email est déjà utilisée par un autre compte');
    }

    // Réactiver l'utilisateur ET restaurer l'email
    await query(
      'UPDATE users SET is_active = 1, email = ?, scheduled_deletion_date = NULL, updated_at = NOW() WHERE id = ?',
      [originalEmail, this.id]
    );
    
    // Si provider, réactiver aussi le profil
    if (this.role === 'provider') {
      await query(
        'UPDATE service_providers SET is_active = 1 WHERE user_id = ?',
        [this.id]
      );
    }
    
    this.is_active = true;
    this.email = originalEmail;
    this.scheduled_deletion_date = null;
    
    console.log(`✅ Compte ${this.id} réactivé avec email: ${originalEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur réactivation compte:', error);
    throw error;
  }
}
// ============================================
  // SUPPRESSION D'UN SERVICE SPÉCIFIQUE
  // ============================================
  
  /**
   * Supprimer un service spécifique du compte provider
   * Si c'est le dernier service, supprime le compte entier
   */
 async deleteService(serviceType) {
  try {
    // 1. Vérifier que l'utilisateur a bien ce service
    const userServices = await query(
      'SELECT service_type FROM service_providers WHERE user_id = ? AND is_active = TRUE',
      [this.id]
    );
    
    const services = userServices.map(s => s.service_type);
    
    if (!services.includes(serviceType)) {
      throw new Error('Ce service n\'existe pas pour cet utilisateur');
    }
    
    // 2. Si c'est le dernier service → supprimer le compte entier
    if (services.length === 1) {
      console.log(`[User ${this.id}] Dernier service, suppression complète du compte`);
      await this.deleteAccount();
      return { success: true, accountDeleted: true };
    }
    
// 3. SUPPRIMER le service_provider (pas juste désactiver)
await query(
  'DELETE FROM service_providers WHERE user_id = ? AND service_type = ?',
  [this.id, serviceType]
);

// Supprimer aussi les working_areas associées
await query(
  'DELETE FROM provider_working_areas WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = ? AND service_type = ?)',
  [this.id, serviceType]
);
    
    // 4. Si le service supprimé était le service actif, basculer vers un autre
    const remainingServices = services.filter(s => s !== serviceType);
    let newActiveService = this.service_type;
    
    if (this.service_type === serviceType) {
      newActiveService = remainingServices[0];
      await query(
        'UPDATE users SET service_type = ? WHERE id = ?',
        [newActiveService, this.id]
      );
      console.log(`[User ${this.id}] Service actif changé: ${serviceType} → ${newActiveService}`);
    }
    
    console.log(`[User ${this.id}] Service ${serviceType} supprimé. Services restants:`, remainingServices);
    
    return {
      success: true,
      accountDeleted: false,
      remainingServices,
      newActiveService
    };
    
  } catch (error) {
    console.error(`[User ${this.id}] Erreur suppression service:`, error);
    throw error;
  }
}
  
// =============================================
// ✅✅✅ NOUVELLES MÉTHODES - SUPPRESSION PLANIFIÉE ✅✅✅
// =============================================

/**
 * Planifier la suppression du compte à la fin de l'abonnement
 * @returns {Promise<Object>}
 */
async scheduleAccountDeletion() {
  try {
    // Calculer la date de fin d'abonnement
    let deletionDate;
    
    if (this.premium_until) {
      // Si premium_until existe, on supprime à cette date
      deletionDate = new Date(this.premium_until);
    } else {
      // Sinon, on supprime dans 30 jours
      deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);
    }

    // Mettre à jour la base de données
    const sql = `
      UPDATE users 
      SET scheduled_deletion_date = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    await query(sql, [deletionDate, this.id]);

    // Mettre à jour l'instance
    this.scheduled_deletion_date = deletionDate;

    console.log(`✅ Suppression planifiée pour l'utilisateur ${this.email} le ${deletionDate.toISOString()}`);

    return {
      success: true,
      scheduledDate: deletionDate,
      message: 'החשבון מתוזמן למחיקה בסוף התקופה'
    };

  } catch (error) {
    console.error('❌ Erreur lors de la planification de suppression:', error);
    throw new Error('שגיאה בתזמון מחיקת החשבון');
  }
}

/**
 * Annuler la suppression planifiée du compte
 * @returns {Promise<Object>}
 */
async cancelScheduledDeletion() {
  try {
    const sql = `
      UPDATE users 
      SET scheduled_deletion_date = NULL,
          updated_at = NOW()
      WHERE id = ?
    `;

    await query(sql, [this.id]);

    // Mettre à jour l'instance
    this.scheduled_deletion_date = null;

    console.log(`✅ Suppression annulée pour l'utilisateur ${this.email}`);

    return {
      success: true,
      message: 'ביטול המחיקה בוטל בהצלחה'
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation de la suppression:', error);
    throw new Error('שגיאה בביטול המחיקה');
  }
}

/**
 * Vérifier si le compte a une suppression planifiée
 * @returns {boolean}
 */
hasScheduledDeletion() {
  return this.scheduled_deletion_date !== null && this.scheduled_deletion_date !== undefined;
}

/**
 * Obtenir la date de suppression planifiée
 * @returns {Date|null}
 */
getScheduledDeletionDate() {
  return this.scheduled_deletion_date ? new Date(this.scheduled_deletion_date) : null;
}

/**
 * Méthode statique : Récupérer tous les comptes à supprimer aujourd'hui
 * @returns {Promise<Array>}
 */
static async getAccountsToDelete() {
  try {
    const sql = `
      SELECT * FROM users
      WHERE scheduled_deletion_date IS NOT NULL
        AND scheduled_deletion_date <= NOW()
        AND is_active = 1
    `;

    const users = await query(sql);

    return users.map(userData => {
      const user = new User(userData);
      // Copier toutes les propriétés
      Object.keys(userData).forEach(key => {
        user[key] = userData[key];
      });
      return user;
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des comptes à supprimer:', error);
    throw error;
  }
}

/**
 * Méthode statique : Supprimer tous les comptes planifiés pour aujourd'hui
 * @returns {Promise<number>} Nombre de comptes supprimés
 */
static async deleteScheduledAccounts() {
  try {
    const accountsToDelete = await User.getAccountsToDelete();
    
    let deletedCount = 0;

    for (const user of accountsToDelete) {
      try {
        await user.deleteAccount();
        deletedCount++;
        console.log(`✅ Compte supprimé automatiquement: ${user.email}`);
      } catch (error) {
        console.error(`❌ Erreur suppression du compte ${user.email}:`, error);
      }
    }

    return deletedCount;

  } catch (error) {
    console.error('❌ Erreur lors de la suppression des comptes planifiés:', error);
    throw error;
  }
}

}

module.exports = User;
