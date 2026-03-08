require('dotenv').config();

// ✅ SÉCURITÉ : Vérification des variables critiques
const requiredEnvVars = ['JWT_SECRET', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('🔴 ERREUR SÉCURITÉ : Variables d\'environnement manquantes :');
  missingVars.forEach(envVar => {
    console.error(`   - ${envVar}`);
  });
  console.error('\n💡 Créez un fichier .env avec ces variables obligatoires');
  process.exit(1); // Arrêt immédiat de l'application
}

// ✅ Validation JWT Secret (minimum 32 caractères)
if (process.env.JWT_SECRET.length < 32) {
  console.error('🔴 ERREUR SÉCURITÉ : JWT_SECRET doit faire au moins 32 caractères');
  console.error('💡 Générez un secret fort avec : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// ⚠️ Warning ENCRYPTION_KEY manquante
if (!process.env.ENCRYPTION_KEY) {
  console.warn('⚠️ ATTENTION : ENCRYPTION_KEY non définie - les emails dans trial_history ne seront pas chiffrés');
}

const config = {
  // Configuration base de données
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306, // ✅ CORRIGÉ : parseInt pour convertir en nombre
    user: process.env.DB_USER || 'homesherut_user',
    password: process.env.DB_PASSWORD, // ✅ PAS de fallback - obligatoire
    name: process.env.DB_NAME || 'homesherut_db'
  },

  // Configuration serveur
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
  },

  // ✅ Configuration JWT SÉCURISÉE
  jwt: {
    secret: process.env.JWT_SECRET, // ✅ OBLIGATOIRE - pas de fallback
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: '30d'
  },

  // Configuration upload
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  },

  // Configuration paiements
  payments: {
    bitPay: {
      apiKey: process.env.BIT_PAY_API_KEY,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    },
   tranzila: {
  terminal: process.env.TRANZILA_TERMINAL,
  apiKey: process.env.TRANZILA_API_KEY,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
}
  },

services: {
  available: ['babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare', 'laundry', 'property_management', 'electrician', 'plumbing', 'air_conditioning', 'gas_technician', 'drywall', 'carpentry', 'home_organization', 'event_entertainment', 'private_chef', 'painting', 'waterproofing', 'contractor','aluminum', 'glass_works', 'locksmith'] // Ajout du service 'contractor'
},

  // ✅ CORRIGÉ : Configuration email avec les bonnes variables de .env
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true pour 465, false pour autres ports
    user: process.env.SMTP_USER, // ✅ CORRIGÉ : SMTP_USER au lieu d'EMAIL_USER
    password: process.env.SMTP_PASS, // ✅ CORRIGÉ : SMTP_PASS au lieu d'EMAIL_PASSWORD
    from: process.env.SMTP_FROM || 'noreply@homesherut.co.il' // ✅ CORRIGÉ : SMTP_FROM
  },

  // Limites de rate limiting
  rateLimits: {
    auth: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 tentatives par 15min
    api: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requêtes par 15min
    upload: { windowMs: 60 * 60 * 1000, max: 10 } // 10 uploads par heure
  }
};

module.exports = config;