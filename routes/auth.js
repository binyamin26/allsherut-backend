const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const TrialHistory = require('../models/TrialHistory');
const { authenticateToken, generateToken } = require('../middleware/authMiddleware');
const config = require('../config/config');



// ✨ NOUVEAUX IMPORTS UNIFIÉS
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();
const { query } = require('../config/database');

// ===== FONCTION DE VALIDATION SÉCURISÉE DES MOTS DE PASSE =====
const validatePasswordComplexity = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push(MESSAGES.ERROR.VALIDATION.PASSWORD_COMPLEXITY);
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות קטנה באנגלית');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות גדולה באנגלית');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
  }
  
  // Vérification mots de passe communs
  const commonPasswords = ['password', '123456', 'password123', 'admin', 'qwerty', '12345678'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common.toLowerCase()))) {
    errors.push(MESSAGES.ERROR.VALIDATION.COMMON_PASSWORD);
  }
  
  return errors;
};

// Custom validators sécurisés
const passwordValidator = body('password').custom((value) => {
  const errors = validatePasswordComplexity(value);
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  return true;
});

const newPasswordValidator = body('newPassword').custom((value) => {
  const errors = validatePasswordComplexity(value);
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  return true;
});

// ============================================
// CLOUDINARY CONFIG
// ============================================
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = (fileBuffer, userId, serviceType) => {
  return new Promise((resolve, reject) => {
    const folder = 'homesherut/profiles';
    const publicId = `profile-${userId}-${serviceType}-${Date.now()}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    // ✅ Accepter uniquement JPG, PNG, WebP
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error('פורמטים מותרים: JPG, PNG, WebP בלבד'));
    }
  }
});

// ✨ RATE LIMITING UNIFIÉ AVEC ERRORCODES
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // ✅ 15 tentatives au lieu de 5
  handler: (req, res) => {
    res.rateLimited(15 * 60);
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ AJOUTER : Limiter par IP + email (pas juste IP)
  keyGenerator: (req) => {
    return req.body?.email 
      ? `${req.ip}-${req.body.email.toLowerCase()}` 
      : req.ip;
  }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // ✅ 5 au lieu de 3
  handler: (req, res) => {
    res.error(ErrorHandler.CODES.RATE_LIMITED, MESSAGES.ERROR.EMAIL.RATE_LIMITED);
  },
  // ✅ AJOUTER
  keyGenerator: (req) => {
    return req.body?.email 
      ? `${req.ip}-${req.body.email.toLowerCase()}` 
      : req.ip;
  }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  handler: (req, res) => {
    res.error(ErrorHandler.CODES.RATE_LIMITED, MESSAGES.ERROR.AUTH.RATE_LIMITED);
  }
});

// ✅ NOUVEAU - Vérifier si téléphone déjà utilisé pour un service
router.post('/check-phone', async (req, res) => {
  try {
    const { phone, serviceType } = req.body;
    
    if (!phone || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'מספר טלפון וסוג שירות נדרשים'
      });
    }
    
    const phoneCheck = await TrialHistory.hasUsedTrialByPhone(phone, serviceType);
    
    return res.json({
      success: true,
      phoneExists: phoneCheck.hasUsedTrial
    });
    
  } catch (error) {
    console.error('Erreur vérification téléphone:', error);
    return res.status(500).json({
      success: false,
      message: 'שגיאה בבדיקת מספר טלפון'
    });
  }
});

// =============================================
// POST /api/auth/register - Version complète avec Step 2 UNIFIÉE
// =============================================
router.post('/register', 
  upload.single('profileImage'), // Middleware upload
  authLimiter, 
  [
    body('email')
      .isEmail()
      .toLowerCase()
      .withMessage(MESSAGES.ERROR.VALIDATION.INVALID_EMAIL),
    
    // ✅ VALIDATION SÉCURISÉE DU MOT DE PASSE
    passwordValidator,
    
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage(MESSAGES.ERROR.VALIDATION.REQUIRED_FIELD),
    body('role')
      .isIn(['client', 'provider'])
      .withMessage('סוג משתמש לא תקין'),
    
    // Validation conditionnelle pour providers
    body('serviceType').custom((value, { req }) => {
      if (req.body.role === 'provider') {
     const availableServices = ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare', 'laundry', 'property_management', 'electrician', 'plumbing', 'air_conditioning', 'gas_technician', 'drywall', 'carpentry', 'home_organization', 'event_entertainment', 'private_chef', 'painting', 'waterproofing', 'contractor','aluminum','glass_works', 'locksmith']; // Ajout du service 'contractor'
        if (!value || !availableServices.includes(value)) {
          throw new Error('סוג שירות נדרש לספקים');
        }
      }
      return true;
    }),
body('phone').custom((value, { req }) => {
  // Pour tous (clients et providers): phone optionnel mais si fourni, doit être valide
  if (value && !value.match(/^05\d{8}$/)) {
    throw new Error(MESSAGES.ERROR.VALIDATION.INVALID_PHONE);
  }
  return true;
})

  ],
  async (req, res) => {
 
    
    try {
      console.log(DEV_LOGS.AUTH.LOGIN_ATTEMPT, req.body.email);

      // ✅ VALIDATION UNIFIÉE
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
       
      
        
        return res.validationError(
          validationErrors.array().map(err => ({
            field: err.path,
            message: err.msg
          }))
        );
      }

      const { 
        name,
        email, 
        password, 
        phone,
        role,
        serviceType
      } = req.body;


      // Données de base pour la création utilisateur
      const userData = {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        email: email?.trim() || '',
        phone: phone?.replace(/[\s-]/g, '') || '',
        password,
        role,
        serviceType,
         tranziliaToken: req.body.tranziliaToken || null
      };

      let user;

      // Si c'est un client OU un provider sans données Step 2 -> création simple
      if (role === 'client' || !req.body.serviceDetails) {
        user = await User.create(userData);
        
        // 🆕 CRÉER TRIAL AVEC TOKEN TRANZILIA
if (role === 'provider' && userData.tranziliaToken) {
  const Subscription = require('../models/Subscription');
  await Subscription.createTrialSubscription(user.id, userData.tranziliaToken);
}
        // Sauvegarder l'image de profil si fournie
    if (req.file) {
          const cloudinaryResult = await uploadToCloudinary(req.file.buffer, user.id, serviceType);
          await user.updateProfile({ profile_image_path: cloudinaryResult.secure_url });
          console.log('☁️ Image Cloudinary:', cloudinaryResult.secure_url);
        }

        console.log(DEV_LOGS.BUSINESS.PROVIDER_CREATED, user.id);
      } 
      // Provider avec données Step 2 -> création complète
      else {
        try {
          // Parser les données JSON du frontend
          const serviceDetails = JSON.parse(req.body.serviceDetails || '{}');
          const workingAreas = JSON.parse(req.body.workingAreas || '[]');

          // Validation Step 2
          const step2Errors = User.validateProviderStep2(serviceType, serviceDetails, workingAreas);
          if (step2Errors.length > 0) {
            
            return res.validationError(step2Errors);
          }

          let relativePath = null;
          if (req.file) {
            const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'new', serviceType);
            relativePath = cloudinaryResult.secure_url;
            console.log('☁️ Image Cloudinary:', relativePath);
          }

          user = await User.createProviderWithDetails(
            userData,
            serviceDetails,
            workingAreas,
            relativePath
          );

          console.log(DEV_LOGS.BUSINESS.PROFILE_COMPLETED, user.id);

        } catch (parseError) {
          console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Step 2 data parsing:', parseError);
          
return res.status(400).json({
  success: false,
  message: 'נתונים לא תקינים'
});
        }
      }

      // Générer le token
      const token = generateToken(user.id, user.email, user.role);
      console.log(DEV_LOGS.AUTH.TOKEN_GENERATED, user.id);

      // Obtenir les informations complètes pour la réponse
      let responseData = user.toJSON();
      
      if (user.role === 'provider') {
        responseData.providerProfile = await user.getFullProviderProfile();
    } else if (user.role === 'client') {
        responseData.contactCredits = await user.getContactCredits();
      }

      // Récupérer tous les services du provider
      if (user.role === 'provider') {
        const services = await query(`
          SELECT DISTINCT service_type 
          FROM service_providers 
          WHERE user_id = ? AND is_active = TRUE
        `, [user.id]);
        
        responseData.services = services.map(s => s.service_type);
      }

      // ✅ MESSAGE DE SUCCÈS UNIFIÉ

      // ✅ MESSAGE DE SUCCÈS UNIFIÉ
      let successMessage = MESSAGES.SUCCESS.AUTH.REGISTER;
      if (user.role === 'provider') {
        if (user.isPremium()) {
          successMessage += ' ' + MESSAGES.SUCCESS.PROVIDER.FREE_MONTH_GRANTED;
        }
        if (req.body.serviceDetails) {
          successMessage += ' ' + MESSAGES.SUCCESS.PROVIDER.PROFILE_COMPLETED;
        }
      } else if (user.role === 'client') {
        successMessage += ' ' + MESSAGES.SUCCESS.CLIENT.CREDITS_GRANTED;
      }

      // Définir le cookie JWT
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      };

      res.cookie('homesherut_token', token, cookieOptions);

      console.log(DEV_LOGS.AUTH.LOGIN_SUCCESS, user.id);

      res.created(successMessage, {
        user: responseData,
        token
      }, user.id);

   } catch (error) {
    

   console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Registration:', error);
     console.error('❌ ERREUR COMPLETE:', error.message);     // ← AJOUTE CES 2 LIGNES
  console.error('❌ STACK TRACE:', error.stack);    
      
      // ✅ Gestion erreur mot de passe incorrect pour compte existant
      if (error.message === 'INVALID_PASSWORD_FOR_EXISTING_ACCOUNT') {
        return res.status(401).json({
          error: 'INVALID_PASSWORD',
          message: 'הסיסמה שהזנת אינה תואמת לחשבון הקיים. אנא הזן את הסיסמה הנכונה.'
        });
      }

      // ✅ Gestion erreur nom ne correspond pas
      if (error.message === 'NAME_MISMATCH_FOR_EXISTING_ACCOUNT') {
        return res.status(401).json({
          error: 'NAME_MISMATCH',
          message: 'השם שהזנת אינו תואם לחשבון הקיים. אנא הזן את השם הנכון.'
        });
      }

      // ✅ Gestion erreur téléphone déjà utilisé pour CE service
      if (error.message === 'PHONE_ALREADY_USED_FOR_SERVICE') {
        return res.status(409).json({
          error: 'PHONE_ALREADY_USED_FOR_SERVICE',
          message: 'מספר טלפון זה כבר רשום לשירות זה'
        });
      }

      // ✅ Gestion erreur email déjà utilisé pour CE service  
      if (error.message === 'EMAIL_ALREADY_USED_FOR_SERVICE') {
        return res.status(409).json({
          error: 'EMAIL_ALREADY_USED_FOR_SERVICE',
          message: 'כתובת האימייל הזו כבר רשומה לשירות זה'
        });
      }

      // ✅ Gestion erreur trial déjà utilisé
      if (error.message === 'TRIAL_ALREADY_USED') {
        return res.status(403).json({
          error: 'TRIAL_ALREADY_USED',
          message: 'כתובת האימייל הזו כבר השתמשה בתקופת הניסיון החינמית'
        });
      }

  
      res.serverError(error);

        }
  });

// =============================================
// POST /api/auth/complete-provider-profile
// Route séparée pour compléter un profil provider plus tard
// =============================================
router.post('/complete-provider-profile',
  authenticateToken,
  upload.single('profileImage'),
  [
    body('serviceDetails').notEmpty().withMessage('פרטי שירות נדרשים'),
    body('workingAreas').notEmpty().withMessage('אזורי עבודה נדרשים')
  ],
  async (req, res) => {
   
    
    try {
      // Vérifier que c'est un provider
      const user = await User.findById(req.user.userId);
      if (!user || user.role !== 'provider') {
        return res.forbidden('insufficient');
      }

      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error(DEV_LOGS.API.ERROR_OCCURRED, 'File cleanup:', unlinkError);
          }
        }
        return res.validationError(validationErrors.array());
      }

      // Stocker le chemin du fichier uploadé
      if (req.file) {
        uploadedFilePath = req.file.path;
        console.log(DEV_LOGS.API.UPLOAD_STARTED, `Profile completion for user ${req.user.userId}`);
      }

      try {
        const serviceDetails = JSON.parse(req.body.serviceDetails);
        const workingAreas = JSON.parse(req.body.workingAreas);

        // Validation
        const errors = User.validateProviderStep2(user.service_type, serviceDetails, workingAreas);
        if (errors.length > 0) {
          if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath);
          }
          return res.validationError(errors);
        }

        // Mettre à jour le profil
        await user.updateProviderDetails(serviceDetails, workingAreas);

        // Sauvegarder l'image si fournie
        if (uploadedFilePath) {
          const relativePath = path.relative(path.join(__dirname, '../'), uploadedFilePath);
          await user.updateProfile({ profile_image_path: relativePath });
          console.log(DEV_LOGS.API.UPLOAD_COMPLETED, `Profile image updated: ${relativePath}`);
        }

        // Réponse avec profil mis à jour
        const fullProfile = await user.getFullProviderProfile();
        
        console.log(DEV_LOGS.BUSINESS.PROFILE_COMPLETED, user.id);
        
        res.success(MESSAGES.SUCCESS.PROVIDER.PROFILE_COMPLETED, {
          user: user.toJSON(),
          providerProfile: fullProfile
        });

      } catch (parseError) {
        console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Profile completion data parsing:', parseError);
        if (uploadedFilePath) {
          await fs.unlink(uploadedFilePath);
        }
        return res.error(ErrorHandler.CODES.VALIDATION_FAILED, MESSAGES.ERROR.VALIDATION.DATA_INVALID);
      }

    } catch (error) {
      console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Profile completion:', error);
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (unlinkError) {
          console.error(DEV_LOGS.API.ERROR_OCCURRED, 'File cleanup:', unlinkError);
        }
      }
      res.serverError(error);
    }
  });

// =============================================  
// GET /api/auth/provider-profile-complete
// Vérifier si le profil provider est complet
// =============================================
router.get('/provider-profile-complete', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'provider') {
      return res.forbidden('insufficient');
    }

    const profile = await user.getFullProviderProfile();
    const isComplete = profile && profile.profile_completed && 
                      profile.serviceDetails && 
                      profile.workingAreas && profile.workingAreas.length > 0;

    res.success('סטטוס פרופיל נטען', {
      isComplete,
      profile: profile
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Profile status check:', error);
    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/login
// Connexion utilisateur UNIFIÉE
// =============================================
router.post('/login', authLimiter, [
  body('email')
    .isEmail()
    .toLowerCase()
    .withMessage(MESSAGES.ERROR.VALIDATION.INVALID_EMAIL),
  body('password')
    .notEmpty()
    .withMessage(MESSAGES.ERROR.VALIDATION.REQUIRED_FIELD)
], async (req, res) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.validationError(validationErrors.array());
    }

    const { email, password } = req.body;

    console.log(DEV_LOGS.AUTH.LOGIN_ATTEMPT, email);

    // Authentifier l'utilisateur
    const user = await User.authenticate(email, password);

    // Générer le token
    const token = generateToken(user.id, user.email, user.role);
    console.log(DEV_LOGS.AUTH.TOKEN_GENERATED, user.id);

    // Obtenir les informations supplémentaires
    let responseData = user.toJSON();
    
    if (user.role === 'provider') {
      responseData.providerProfile = await user.getFullProviderProfile();
  } else if (user.role === 'client') {
      responseData.contactCredits = await user.getContactCredits();
    }

    // Récupérer tous les services du provider
    if (user.role === 'provider') {
      const services = await query(`
        SELECT DISTINCT service_type 
        FROM service_providers 
        WHERE user_id = ? AND is_active = TRUE
      `, [user.id]);
      
      responseData.services = services.map(s => s.service_type);
    }

    // Définir le cookie JWT
    // Définir le cookie JWT
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    };

    res.cookie('homesherut_token', token, cookieOptions);

    console.log(DEV_LOGS.AUTH.LOGIN_SUCCESS, user.id);

    res.success(MESSAGES.SUCCESS.AUTH.LOGIN, {
      user: responseData,
      token
    });

  } catch (error) {
    console.error(DEV_LOGS.AUTH.LOGIN_FAILED, error.message);

    // ✅ GESTION DES DIFFÉRENTS TYPES D'ERREURS UNIFIÉE
    if (error.message.includes('שגויים')) {
      return res.authError('invalid');
    }

    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/forgot-password
// Demande de reset password UNIFIÉE
// =============================================
router.post('/forgot-password', forgotPasswordLimiter, [
  body('email')
    .isEmail()
    .withMessage(MESSAGES.ERROR.VALIDATION.INVALID_EMAIL)
    .toLowerCase()
    .trim()
], async (req, res) => {
  try {
    // Valider les données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.validationError(errors.array());
    }

    const { email } = req.body;

    console.log(DEV_LOGS.AUTH.PASSWORD_RESET_REQUESTED, email);

    // Générer le token de reset et envoyer l'email
    const result = await User.generateResetToken(email);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.message });
    }

    return res.success(MESSAGES.SUCCESS.AUTH.EMAIL_SENT);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Forgot password:', error);
    res.serverError(error);
  }
});

// =============================================
// GET /api/auth/verify-reset-token/:token
// Vérification de token reset UNIFIÉE
// =============================================
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      return res.error(ErrorHandler.CODES.TOKEN_INVALID);
    }

    const result = await User.verifyResetToken(token);

    if (result.success) {
      return res.success('טוקן תקף');
    }

    return res.error(ErrorHandler.CODES.TOKEN_INVALID, result.message);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Token verification:', error);
    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/reset-password
// Réinitialisation effective du mot de passe UNIFIÉE
// =============================================
router.post('/reset-password', resetPasswordLimiter, [
  body('token')
    .isLength({ min: 64, max: 64 })
    .withMessage(MESSAGES.ERROR.AUTH.TOKEN_INVALID),
  
  // ✅ VALIDATION SÉCURISÉE DU NOUVEAU MOT DE PASSE
  body('newPassword').custom((value) => {
    if (value.length > 100) {
      throw new Error('הסיסמה ארוכה מדי (מקסימום 100 תווים)');
    }
    const errors = validatePasswordComplexity(value);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return true;
  })
], async (req, res) => {
  try {
    // Valider les données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.validationError(errors.array());
    }

    const { token, newPassword } = req.body;

    // Effectuer le reset password
    const result = await User.resetPassword(token, newPassword);

    if (result.success) {
      // Générer nouveau JWT pour auto-login
      const jwtToken = generateToken(result.user.id, result.user.email, 'client');

      // Définir le cookie JWT pour l'auto-login
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      };

      res.cookie('homesherut_token', jwtToken, cookieOptions);

      console.log(DEV_LOGS.AUTH.PASSWORD_RESET_COMPLETED, result.user.email);

      return res.success(MESSAGES.SUCCESS.AUTH.PASSWORD_RESET, {
        user: result.user,
        token: jwtToken
      });
    }

    return res.error(ErrorHandler.CODES.TOKEN_INVALID, result.message);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Password reset:', error);
    res.serverError(error);
  }
});

// =============================================
// GET /api/auth/me
// Profil utilisateur connecté UNIFIÉ
// =============================================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.notFound('user');
    }

    let responseData = user.toJSON();
    
    if (user.role === 'provider') {
      // 🆕 Récupérer le service demandé (ou service principal par défaut)
      const requestedService = req.query.service_type || user.service_type;
      
      // Récupérer TOUS les services du provider
      const services = await query(`
        SELECT DISTINCT service_type 
        FROM service_providers 
        WHERE user_id = ? AND is_active = TRUE
      `, [user.id]);
      
      responseData.services = services.map(s => s.service_type);
      
  // 🆕 Récupérer le profil pour le service demandé
const providerProfile = await user.getProviderProfileForService(requestedService);
responseData.providerProfile = providerProfile;
responseData.service_type = requestedService; // Mettre à jour le service actif
responseData.serviceCreatedAt = providerProfile?.created_at || null; // ← AJOUTER CETTE LIGNE
      
if (providerProfile && providerProfile.profileImage) {
  // On renvoie juste le chemin (ex: /uploads/photo.jpg)
  responseData.profileImage = providerProfile.profileImage;
}
    } else if (user.role === 'client') {
      responseData.contactCredits = await user.getContactCredits();
    }

    res.success(MESSAGES.SUCCESS.SYSTEM.DATA_LOADED, {
      user: responseData
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Profile fetch:', error);
    res.serverError(error);
  }
});

// =============================================
// PUT /api/auth/me
// Mise à jour du profil utilisateur UNIFIÉE
// =============================================
router.put('/me', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('שם פרטי נדרש'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('שם משפחה נדרש'),
  body('phone').optional().matches(/^05\d{8}$/).withMessage(MESSAGES.ERROR.VALIDATION.INVALID_PHONE)
], async (req, res) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.validationError(validationErrors.array());
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.notFound('user');
    }

    // Préparer les données à mettre à jour
    const updateData = {};
    if (req.body.firstName) updateData.first_name = req.body.firstName;
    if (req.body.lastName) updateData.last_name = req.body.lastName;
    if (req.body.phone) updateData.phone = req.body.phone;
    if (req.body.profileImage !== undefined) updateData.profile_image = req.body.profileImage;

    // Mise à jour du profil
    await user.updateProfile(updateData);

    // Retourner les données mises à jour
    let responseData = user.toJSON();
    
    if (user.role === 'provider') {
      responseData.providerProfile = await user.getFullProviderProfile();
    } else if (user.role === 'client') {
      responseData.contactCredits = await user.getContactCredits();
    }

    res.success(MESSAGES.SUCCESS.AUTH.PROFILE_UPDATED, {
      user: responseData
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Profile update:', error);
    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/change-password
// Changement de mot de passe UNIFIÉ
// =============================================
router.post('/change-password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('סיסמה נוכחית נדרשת'),
  
  // ✅ VALIDATION SÉCURISÉE DU NOUVEAU MOT DE PASSE
  newPasswordValidator
], async (req, res) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.validationError(validationErrors.array());
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.notFound('user');
    }

    await user.changePassword(currentPassword, newPassword);

    res.success(MESSAGES.SUCCESS.AUTH.PASSWORD_CHANGED);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Password change:', error);

    if (error.message.includes('שגויה')) {
      return res.authError('invalid');
    }

    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/refresh-token
// Refresh JWT token UNIFIÉ
// =============================================
router.post('/refresh-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.homesherut_token;

    if (!token) {
      return res.authError('missing');
    }

    // Vérifier le token existant
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Récupérer l'utilisateur pour s'assurer qu'il existe encore
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.notFound('user');
    }

    // Générer un nouveau token
    const newToken = generateToken(user.id, user.email, user.role);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };

    res.cookie('homesherut_token', newToken, cookieOptions);

    console.log(DEV_LOGS.AUTH.TOKEN_GENERATED, user.id);

    return res.success('טוקן חודש בהצלחה', {
      user: user.toJSON(),
      token: newToken
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.authError('token');
    }

    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Token refresh:', error);
    res.serverError(error);
  }
});

// =============================================
// POST /api/auth/logout
// Déconnexion UNIFIÉE
// =============================================
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Supprimer le cookie
    res.clearCookie('homesherut_token');
    
    res.success(MESSAGES.SUCCESS.AUTH.LOGOUT);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Logout:', error);
    res.serverError(error);
  }
});

// =============================================
// GET /api/auth/check
// Vérification de token UNIFIÉE
// =============================================
router.get('/check', authenticateToken, async (req, res) => {
  res.success('Token תקין', {
    userId: req.user.userId,
    email: req.user.email,
    role: req.user.role
  });
});

// =============================================
// GET /api/auth/stats (Admin only)
// Statistiques utilisateurs UNIFIÉES
// =============================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Vérifier si c'est un admin
    if (req.user.role !== 'admin') {
      return res.forbidden('insufficient');
    }

    const stats = await User.getStats();

    res.success(MESSAGES.SUCCESS.SYSTEM.STATS_LOADED, stats);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'User stats:', error);
    res.serverError(error);
  }
});

// =============================================
// DELETE /api/auth/cleanup-tokens
// Nettoyage des tokens expirés (admin/cron)
// =============================================
router.delete('/cleanup-tokens', async (req, res) => {
  try {
    const result = await User.cleanExpiredTokens();

    return res.success('ניקוי טוקנים הושלם', { deletedCount: result });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Token cleanup:', error);
    res.serverError(error);
  }
});

router.post('/check-email', async (req, res) => {
  try {
    const { email, serviceType } = req.body;
    
    console.log('🔍 CHECK EMAIL:', email, 'Service:', serviceType); // ← AJOUTER
    
    if (!email) {
      return res.status(400).json({ 
        available: false, 
        message: 'כתובת אימייל נדרשת' 
      });
    }
    
    // Vérifier si l'utilisateur existe
    const existingUser = await User.findByEmail(email);
    console.log('Existing user?', !!existingUser); // ← AJOUTER
    
    // Si serviceType est fourni, vérifier si l'email existe pour CE service
    if (serviceType) {
      const hasService = await User.hasService(email, serviceType);
      console.log('Has service?', hasService); // ← AJOUTER
      
      if (hasService) {
        // ✅ AJOUTER VÉRIFICATION DU TRIAL HISTORY
        const TrialHistory = require('../models/TrialHistory');
        const trialCheck = await TrialHistory.hasUsedTrial(email, serviceType);
        console.log('Trial check:', trialCheck); // ← AJOUTER
        
        if (trialCheck.hasUsedTrial) {
          // Email existe déjà pour ce service spécifique
          return res.json({ 
            available: false,
            exists: true,
            forThisService: true,
            message: 'אתה כבר רשום לשירות זה' 
          });
        }
      }
      
      // ✅ CORRIGÉ : Vérifier si le compte existe pour un AUTRE service
      return res.json({ 
        available: true,
        exists: !!existingUser,
        forThisService: false,
        message: existingUser ? 'חשבון קיים - הזן את הסיסמה שלך' : 'כתובת זמינה'
      });
    
    }
    
    // Si pas de serviceType (cas login client), vérification normale
    const available = !existingUser;
    
    res.json({ 
      available: available,
      exists: !available,
      message: available ? 'כתובת זמינה' : 'כתובת האימייל כבר קיימת במערכת'
    });
    
  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({ 
      available: false, 
      message: 'שגיאה בשרת' 
    });
  }
});

// =============================================
// POST /api/auth/verify-password
// Vérifier si le mot de passe correspond au compte existant
// =============================================
router.post('/verify-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        valid: false,
        message: 'אימייל וסיסמה נדרשים'
      });
    }
    
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Pas de compte existant = pas besoin de vérifier
      return res.json({ 
        valid: true,
        accountExists: false
      });
    }
    
    // Compte existe → vérifier le mot de passe
    const isValid = await user.verifyPassword(password);
    
    return res.json({
      valid: isValid,
      accountExists: true,
      message: isValid ? '' : 'הסיסמה אינה תואמת לחשבון הקיים'
    });
    
  } catch (error) {
    console.error('Erreur vérification mot de passe:', error);
    return res.status(500).json({
      valid: false,
      message: 'שגיאה בבדיקת סיסמה'
    });
  }
});

// =============================================
// POST /api/auth/check-identity
// Vérifier si téléphone/email est associé à un nom différent
// =============================================
router.post('/check-identity', async (req, res) => {
  try {
    const { phone, email, fullName } = req.body;
    
    if (!fullName) {
      return res.json({ valid: true });
    }
    
    // Normaliser le nom (trim + lowercase pour comparaison)
    const normalizedName = fullName.trim().toLowerCase();
    
    // Vérifier si le téléphone existe avec un nom différent
    if (phone) {
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const [phoneResults] = await query(
        `SELECT CONCAT(first_name, ' ', last_name) as full_name FROM users 
WHERE phone = ? 
AND LOWER(TRIM(CONCAT(first_name, ' ', last_name))) != ?
         AND deleted_at IS NULL
         LIMIT 1`,
        [cleanPhone, normalizedName]
      );
      
      if (phoneResults && phoneResults.length > 0) {
        return res.json({
          valid: false,
          field: 'phone',
          message: 'מספר הטלפון הזה משויך לשם אחר. אם זה החשבון שלך, התחבר עם הפרטים הקיימים.'
        });
      }
    }
    
    // Vérifier si l'email existe avec un nom différent
    if (email) {
     const [emailResults] = await query(
  `SELECT CONCAT(first_name, ' ', last_name) as full_name FROM users 
   WHERE email = ? 
   AND LOWER(TRIM(CONCAT(first_name, ' ', last_name))) != ?
         AND deleted_at IS NULL
         LIMIT 1`,
        [email.toLowerCase().trim(), normalizedName]
      );
      
      if (emailResults && emailResults.length > 0) {
        return res.json({
          valid: false,
          field: 'email',
          message: 'כתובת האימייל הזו משויכת לשם אחר. אם זה החשבון שלך, התחבר עם הפרטים הקיימים.'
        });
      }
    }
    
    return res.json({ valid: true });
    
  } catch (error) {
    console.error('Erreur vérification identité:', error);
    return res.status(500).json({
      valid: false,
      message: 'שגיאה בבדיקת זהות'
    });
  }
});

// =============================================
// ✅ NOUVEAU - PUT /api/auth/update-full-profile
// Mise à jour complète du profil (données perso + pro + zones)
// =============================================
router.put('/update-full-profile', 
  authenticateToken,
  [
    body('firstName').optional().trim().isLength({ min: 2 }).withMessage('שם פרטי נדרש'),
    body('lastName').optional().trim().isLength({ min: 2 }).withMessage('שם משפחה נדרש'),
    body('phone').optional().custom((value) => {
      if (value && !value.match(/^05\d{8}$/)) {
        throw new Error(MESSAGES.ERROR.VALIDATION.INVALID_PHONE);
      }
      return true;
    }),
body('experienceYears').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage('ניסיון חייב להיות מספר חיובי'),
body('hourlyRate').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('תעריף חייב להיות מספר חיובי')
  ],
  async (req, res) => {
    try {
      console.log('📥 Requête update-full-profile reçue');
      console.log('User ID:', req.user.userId);
      console.log('Body:', req.body);

      // Validation des erreurs
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.validationError(validationErrors.array());
      }

      // Récupérer l'utilisateur
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.notFound('user');
      }

      // Vérifier que seuls les providers peuvent mettre à jour certaines données
      if (user.role !== 'provider' && (req.body.workingAreas || req.body.serviceDetails)) {
        return res.forbidden('insufficient');
      }

      // Préparer les données de mise à jour
      const updateData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        description: req.body.description,
        experienceYears: req.body.experienceYears,
        hourlyRate: req.body.hourlyRate,
        availability: req.body.availability,
        languages: req.body.languages,
        workingAreas: req.body.workingAreas,
        serviceDetails: req.body.serviceDetails,
     activeServiceType: req.body.activeServiceType
      };

      // Appeler la méthode de mise à jour
      await user.updateFullProfile(updateData);

   // Récupérer les données mises à jour
      let responseData = user.toJSON();
      
      if (user.role === 'provider') {
        const activeService = req.body.activeServiceType || user.service_type;
        responseData.providerProfile = await user.getProviderProfileForService(activeService);
      }

      console.log('✅ Profil mis à jour avec succès');

      res.success(MESSAGES.SUCCESS.AUTH.PROFILE_UPDATED, {
        user: responseData
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour profil complet:', error);
      res.serverError(error);
    }
  }
);

// =============================================
// ✅ SIMPLIFIÉ - DELETE /api/auth/delete-account
// Suppression complète du compte utilisateur
// =============================================
// =============================================
// ✅ CORRIGÉ - DELETE /api/auth/delete-account
// Suppression complète du compte utilisateur
// =============================================
router.delete('/delete-account', 
  authenticateToken,
  async (req, res) => {
    try {
      console.log('🗑️ Demande de suppression de compte, User ID:', req.user.userId);

      // Récupérer l'utilisateur
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.notFound('user');
      }

      // ✅ AJOUTER : Marquer le trial comme supprimé AVANT la suppression du compte
      await TrialHistory.markAccountDeleted(user.email);
      console.log('✅ Trial history marqué comme supprimé pour:', user.email);

      // Supprimer le compte (soft delete)
      await user.deleteAccount();

      // Supprimer le cookie
      res.clearCookie('homesherut_token');

      console.log('✅ Compte supprimé avec succès:', user.email);

      res.success('החשבון נמחק בהצלחה', {
        deleted: true
      });

    } catch (error) {
      console.error('❌ Erreur suppression compte:', error);
      res.serverError(error);
    }
  }
);

module.exports = router;