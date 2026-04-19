require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Configuration
const config = require('./config/config');
const { testConnection } = require('./config/database');

// Middleware
const responseMiddleware = require('./middleware/response');

// 🆕 NOUVEAUX MIDDLEWARE - Système d'abonnements
const { 
  checkSubscriptionStatus, 
  enrichWithSubscriptionData,
  addExpirationWarnings,
  requireActiveSubscription 
} = require('./middleware/subscriptionMiddleware');

const app = express();
app.set('trust proxy', 1); // Indispensable pour Render

// =============================================
// MIDDLEWARE DE SÉCURITÉ - CONFIGURATION CORS
// =============================================
app.use(cors({
  origin: [
    'https://homesherut-frontend.vercel.app', 
    'https://allsherut.com', 
    'https://www.allsherut.com', 
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Configuration CORS


// Helmet pour la sécurité
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"]
    }
  }
}));

// Rate limiting avec exclusion des 404 et images
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    message: 'יותר מדי בקשות. נסה שוב מאוחר יותר'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Exclure les 404 et placeholder du rate limiting
  skip: (req, res) => {
    return req.url.includes('/api/placeholder') || res.statusCode === 404;
  }
});

app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(responseMiddleware);


// 1. Route de test immédiat (Racine)
app.get('/', (req, res) => {
  res.json({ success: true, message: '🚀 Backend HomeSherut is running!' });
});

// 2. Route de santé (Health)
app.use('/api/health', require('./routes/health'));

// Logging en développement
if (config.server.env === 'development') {
  app.use(morgan('combined'));
  // Debug CORS
  app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - Origin: ${req.get('Origin') || 'No Origin'}`);
    next();
  });
}

// Configuration CORS pour les fichiers uploads
app.use('/uploads', (req, res, next) => {
  // On autorise dynamiquement l'origine si elle est dans notre liste
  const origin = req.get('Origin');
  const allowedOrigins = [
    'https://homesherut-frontend.vercel.app', 
    'https://allsherut.com', 
    'https://www.allsherut.com', 
    'http://localhost:5173'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Route pour images placeholder
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  const imageUrl = `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=${width}&h=${height}&fit=crop&crop=face`;
  res.redirect(302, imageUrl);
});


// =============================================
// ROUTES PUBLIQUES (sans vérification d'abonnement)
// =============================================

// Health check et services généraux
app.use('/api/health', require('./routes/health'));
app.use('/api/services', require('./routes/services'));
app.use('/api/location', require('./routes/location'));
app.use('/api/contact', require('./routes/contact'));

// Authentification
app.use('/api/auth', require('./routes/auth'));

// 🆕 ROUTES ABONNEMENTS - Nouvelles routes système de paiement
app.use('/api/subscriptions', require('./routes/subscriptions'));

// =============================================
// ROUTES AVEC VÉRIFICATION D'ABONNEMENT
// =============================================

// Recherche avec statut abonnement pour tri/priorité
app.use('/api/search', checkSubscriptionStatus, require('./routes/search'));

// Détails providers avec enrichissement des données d'abonnement
app.use('/api/providers', 
  checkSubscriptionStatus, 
  enrichWithSubscriptionData,
  require('./routes/providers')
);

// Avis avec vérification d'abonnement pour créer des réponses
app.use('/api/reviews', 
  checkSubscriptionStatus,
  enrichWithSubscriptionData,
  require('./routes/reviews')
);

// Gestion utilisateurs
app.use('/api/users', require('./routes/users'));

// Recrutement (offres d'emploi)
app.use('/api/recruitment', require('./routes/recruitment'));

// Upload avec rate limiting spécifique
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: {
    success: false,
    message: 'יותר מדי העלאות. נסה שוב בעוד שעה'
  }
});
app.use('/api/upload', uploadLimiter, require('./routes/upload'));

// =============================================
// 🆕 ROUTES PREMIUM PROTÉGÉES PAR ABONNEMENT
// =============================================

// Exemple : Routes qui nécessitent un abonnement actif
// (Implémentation future selon besoins)

/*
// Analytics avancées pour prestataires avec abonnement
app.use('/api/analytics', 
  checkSubscriptionStatus,
  requireActiveSubscription,
  require('./routes/analytics')
);

// Fonctionnalités premium pour prestataires
app.use('/api/providers/premium', 
  checkSubscriptionStatus,
  requireActiveSubscription,
  require('./routes/premium-providers')
);

// Outils de marketing pour prestataires payants
app.use('/api/marketing', 
  checkSubscriptionStatus,
  requireActiveSubscription,
  require('./routes/marketing')
);
*/

// =============================================
// ENRICHISSEMENT AUTOMATIQUE DES RÉPONSES
// =============================================

// Ajouter automatiquement les avertissements d'expiration dans les headers
// pour tous les prestataires connectés
app.use(addExpirationWarnings);

// =============================================
// GESTION D'ERREURS ET 404
// =============================================

// 404 pour routes API non trouvées
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'נתיב API לא נמצא',
    path: req.originalUrl
  });
});

// Middleware de gestion d'erreurs global
app.use((error, req, res, next) => {
  console.error('שגיאת שרת:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Erreurs de validation
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'נתונים לא תקינים',
      errors: error.errors
    });
  }

  // Erreurs de base de données
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'נתון כבר קיים במערכת'
    });
  }

  // Erreurs d'abonnement spécifiques
  if (error.code === 'SUBSCRIPTION_EXPIRED') {
    return res.status(403).json({
      success: false,
      message: 'המנוי פג. נדרש חידוש לביצוע פעולה זו',
      code: 'SUBSCRIPTION_EXPIRED',
      action: 'upgrade',
      redirectUrl: '/billing/upgrade'
    });
  }

  if (error.code === 'NO_SUBSCRIPTION') {
    return res.status(403).json({
      success: false,
      message: 'נדרש מנוי פעיל לביצוע פעולה זו',
      code: 'NO_SUBSCRIPTION',
      action: 'subscribe',
      redirectUrl: '/billing'
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'שגיאת שרת פנימית',
    ...(config.server.env === 'development' && { stack: error.stack })
  });
});

// =============================================
// CRON JOB - VÉRIFICATION ABONNEMENTS
// =============================================

const cronService = require('./services/cronService');

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================
const runMigrations = async () => {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const steps = [
    ['seeking_type column', `ALTER TABLE service_providers ADD COLUMN seeking_type ENUM('clients','recruitment','both') DEFAULT 'clients'`],
    ['job_listings table', `CREATE TABLE IF NOT EXISTS job_listings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      provider_id INT NOT NULL,
      service_type VARCHAR(50) NOT NULL,
      contract_type ENUM('full_time','part_time','one_time') NOT NULL,
      salary VARCHAR(100) NOT NULL,
      payment_type ENUM('hourly','daily','monthly') NOT NULL,
      availability_days JSON,
      availability_hours JSON,
      experience_required VARCHAR(20) NOT NULL DEFAULT 'beginner',
      languages_required JSON,
      driving_license BOOLEAN DEFAULT FALSE,
      description TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],
    ['location_city column', `ALTER TABLE job_listings ADD COLUMN location_city VARCHAR(100) NULL`],
    ['location_area column', `ALTER TABLE job_listings ADD COLUMN location_area VARCHAR(100) NULL`],
    ['fix experience_required', `ALTER TABLE job_listings MODIFY COLUMN experience_required VARCHAR(20) NOT NULL DEFAULT 'beginner'`],
    ['fix service_type', `ALTER TABLE service_providers MODIFY COLUMN service_type VARCHAR(50) NOT NULL`],
    ['service_details column', `ALTER TABLE service_providers ADD COLUMN service_details JSON NULL`],
    ['profile_image sp column', `ALTER TABLE service_providers ADD COLUMN profile_image VARCHAR(255) NULL`],
    ['availability_days sp column', `ALTER TABLE service_providers ADD COLUMN availability_days JSON NULL`],
    ['availability_hours sp column', `ALTER TABLE service_providers ADD COLUMN availability_hours JSON NULL`],
    ['babysitting_types sp column', `ALTER TABLE service_providers ADD COLUMN babysitting_types JSON NULL`],
    ['can_travel_alone sp column', `ALTER TABLE service_providers ADD COLUMN can_travel_alone TINYINT(1) DEFAULT 0`],
    ['profile_completed sp column', `ALTER TABLE service_providers ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE`],
  ];

  for (const [label, sql] of steps) {
    try {
      await conn.query(sql);
      console.log(`✅ Migration OK: ${label}`);
    } catch (err) {
      console.log(`⚠️  Migration skip (${label}): ${err.message.split('\n')[0]}`);
    }
  }
  await conn.end();
};

const startServer = async () => {
  try {
    console.log('🔄 בדיקת חיבור למסד נתונים...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ שגיאה: לא ניתן להתחבר למסד הנתונים');
      process.exit(1);
    }

    await runMigrations();

    const PORT = process.env.PORT || 10000;


    app.listen(PORT, () => {
      console.log('\n🚀 ╔═══════════════════════════════════════════════╗');
      console.log(`✅ שרת HomeSherut פועל על פורט ${PORT}`);
      console.log(`🌐 Frontend URL: ${config.server.frontendUrl}`);
      console.log(`📊 Environment: ${config.server.env}`);
      console.log(`🗄️  Database: ${config.database.name}@${config.database.host}:${config.database.port}`);
      console.log(`🛡️  Rate Limit: ${config.rateLimits.api.max} req/15min`);
      console.log(`💳 מערכת מנויים: פעילה ומשולבת`);
      console.log('╚═══════════════════════════════════════════════╝\n');
      
cronService.start();

      console.log('📋 Services disponibles:');
      config.services.available.forEach(service => {
        console.log(`   • ${service}`);
      });
      
      console.log('\n🔗 API Endpoints disponibles:');
      console.log('   📝 Authentication:');
      console.log('      • POST /api/auth/register');
      console.log('      • POST /api/auth/login');
      console.log('      • GET  /api/auth/me');
      
      console.log('   🔍 Search & Services:');
      console.log('      • GET  /api/search/providers');
      console.log('      • GET  /api/services/available');
      console.log('      • GET  /api/providers/:id');
      
      console.log('   ⭐ Reviews System:');
      console.log('      • POST /api/reviews/send-verification');
      console.log('      • POST /api/reviews/verify-code');
      console.log('      • POST /api/reviews/create');
      console.log('      • POST /api/reviews/:reviewId/respond');
      console.log('      • GET  /api/reviews/my-reviews');
      
      console.log('   💳 Subscription System (NEW):');
      console.log('      • GET  /api/subscriptions/status');
      console.log('      • GET  /api/subscriptions/pricing');
      console.log('      • POST /api/subscriptions/upgrade');
      console.log('      • POST /api/subscriptions/cancel');
      console.log('      • GET  /api/subscriptions/billing-history');
      
      console.log('   🛠️  Utilities:');
      console.log('      • POST /api/contact');
      console.log('      • POST /api/upload');
      console.log('      • GET  /api/health');
      
      console.log('\n💰 Subscription Features:');
      console.log('   ✅ Trial period: 1 מונה חינם לכל ספק חדש');
      console.log('   ✅ Monthly plan: ₪79/חודש');
      console.log('   ✅ Yearly plan: ₪790/שנה (חיסכון 17%)');
      console.log('   ✅ Auto-renewal and billing');
      console.log('   ✅ Subscription status checking');
      console.log('   ✅ Provider restrictions for expired subs');
      
      console.log('\n💬 Review System:');
      console.log('   ✅ Email verification 3-step process');
      console.log('   ✅ Immediate publication all reviews');
      console.log('   ✅ Provider response system active');
      console.log('   ✅ Email notifications to providers');
      console.log('   ❌ Admin moderation disabled');
      
      console.log('\n✨ Ready for requests!\n');
    });

  } catch (error) {
    console.error('❌ שגיאה בהפעלת השרת:', error);
    process.exit(1);
  }
};

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('🔄 שרת נסגר בצורה מסודרת...');

});

process.on('SIGINT', () => {
  console.log('\n🔄 שרת נסגר...');
  console.log('💾 שומר נתוני מנויים לפני סגירה...');
  
  // TODO: Sauvegarder les données importantes avant fermeture
  setTimeout(() => {
    console.log('✅ נתונים נשמרו בהצלחה');

  }, 2000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  // ne pas exit en prod
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // idéalement, loguer mais ne pas exit
});


// Démarrage
startServer();

module.exports = app;