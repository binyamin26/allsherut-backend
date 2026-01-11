// routes/health.js - Version simplifiée compatible
const express = require('express');
const router = express.Router();
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');

// =============================================
// CONSTANTES DE CONFIGURATION
// =============================================

const HEALTH_CHECK_CONFIG = {
  DATABASE_TIMEOUT: 5000, // 5 secondes timeout pour DB
  MEMORY_WARNING_THRESHOLD: 80, // Pourcentage seuil d'alerte mémoire
  UPTIME_WARNING_THRESHOLD: 86400 // 24h - redémarrage recommandé après
};

const SERVICE_STATUS = {
  HEALTHY: 'healthy',
  WARNING: 'warning', 
  CRITICAL: 'critical',
  DOWN: 'down'
};

// =============================================
// ROUTES PUBLIQUES DE SANTÉ
// =============================================

/**
 * GET /api/health
 * Vérification complète de l'état du serveur HomeSherut
 */
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'health/check');

    // Initialisation du rapport de santé
    const healthReport = {
      service: 'HomeSherut API',
      status: SERVICE_STATUS.HEALTHY,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {},
      warnings: [],
      responseTime: null
    };

    // ==========================================
    // 1. VÉRIFICATION BASE DE DONNÉES
    // ==========================================
    try {
      const dbStartTime = Date.now();
      const User = require('../models/User');
      
      // Test de connexion simple avec timeout
      const dbTestPromise = User.executeQuery('SELECT 1 as test, NOW() as server_time');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), HEALTH_CHECK_CONFIG.DATABASE_TIMEOUT)
      );
      
      const dbResult = await Promise.race([dbTestPromise, timeoutPromise]);
      const dbResponseTime = Date.now() - dbStartTime;
      
      healthReport.checks.database = {
        status: SERVICE_STATUS.HEALTHY,
        responseTime: `${dbResponseTime}ms`,
        serverTime: dbResult[0].server_time,
        connection: 'active'
      };

      // Alerte si DB lente
      if (dbResponseTime > 1000) {
        healthReport.warnings.push({
          component: 'database',
          message: 'Base de données lente',
          details: `Response time: ${dbResponseTime}ms`
        });
        healthReport.checks.database.status = SERVICE_STATUS.WARNING;
      }

      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `DB response: ${dbResponseTime}ms`);

    } catch (dbError) {
      console.error(DEV_LOGS.DATABASE.QUERY_ERROR, dbError.message);
      
      healthReport.checks.database = {
        status: SERVICE_STATUS.CRITICAL,
        error: dbError.message,
        connection: 'failed',
        impact: 'Toutes les fonctionnalités de la plateforme sont indisponibles'
      };
      
      healthReport.status = SERVICE_STATUS.CRITICAL;
      healthReport.warnings.push({
        component: 'database',
        message: 'שגיאה בבסיס הנתונים',
        details: dbError.message
      });
    }

    // ==========================================
    // 2. VÉRIFICATION MÉMOIRE ET PERFORMANCE
    // ==========================================
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    healthReport.checks.memory = {
      status: SERVICE_STATUS.HEALTHY,
      used: `${memoryUsedMB}MB`,
      total: `${memoryTotalMB}MB`,
      percentage: `${memoryUsagePercent}%`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
    };

    // Alerte mémoire
    if (memoryUsagePercent > HEALTH_CHECK_CONFIG.MEMORY_WARNING_THRESHOLD) {
      healthReport.checks.memory.status = SERVICE_STATUS.WARNING;
      healthReport.warnings.push({
        component: 'memory',
        message: 'Utilisation mémoire élevée',
        details: `Usage: ${memoryUsagePercent}%`
      });
      
      if (healthReport.status !== SERVICE_STATUS.CRITICAL) {
        healthReport.status = SERVICE_STATUS.WARNING;
      }
    }

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Memory usage: ${memoryUsagePercent}% (${memoryUsedMB}MB)`);

    // ==========================================
    // 3. VÉRIFICATION SYSTÈME ET RUNTIME
    // ==========================================
    healthReport.checks.system = {
      status: SERVICE_STATUS.HEALTHY,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      uptime: {
        seconds: Math.floor(process.uptime()),
        human: formatUptime(process.uptime())
      }
    };

    // Alerte uptime long (recommandation redémarrage)
    if (process.uptime() > HEALTH_CHECK_CONFIG.UPTIME_WARNING_THRESHOLD) {
      healthReport.warnings.push({
        component: 'uptime',
        message: 'Uptime long - redémarrage recommandé',
        details: `Uptime: ${formatUptime(process.uptime())}`
      });
    }

    // ==========================================
    // 4. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT CRITIQUES
    // ==========================================
    const requiredEnvVars = [
      'DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    healthReport.checks.environment = {
      status: missingEnvVars.length === 0 ? SERVICE_STATUS.HEALTHY : SERVICE_STATUS.WARNING,
      requiredVariables: requiredEnvVars.length,
      missing: missingEnvVars.length,
      missingVars: process.env.NODE_ENV === 'development' ? missingEnvVars : []
    };

    if (missingEnvVars.length > 0) {
      healthReport.warnings.push({
        component: 'environment',
        message: 'Variables d\'environnement manquantes',
        details: `Missing: ${missingEnvVars.length} variables`
      });
      
      if (healthReport.status !== SERVICE_STATUS.CRITICAL) {
        healthReport.status = SERVICE_STATUS.WARNING;
      }
    }

    // ==========================================
    // 5. MÉTRIQUES FINALES
    // ==========================================
    const totalResponseTime = Date.now() - startTime;
    healthReport.responseTime = `${totalResponseTime}ms`;

    // Déterminer le statut HTTP selon l'état de santé
    let httpStatus;
    switch (healthReport.status) {
      case SERVICE_STATUS.HEALTHY:
        httpStatus = 200;
        break;
      case SERVICE_STATUS.WARNING:
        httpStatus = 200; // Warnings ne sont pas bloquantes
        break;
      case SERVICE_STATUS.CRITICAL:
        httpStatus = 503; // Service Unavailable
        break;
      default:
        httpStatus = 500;
    }

    // Message utilisateur en hébreu selon le statut
    let userMessage;
    switch (healthReport.status) {
      case SERVICE_STATUS.HEALTHY:
        userMessage = 'שרת HomeSherut פועל תקין';
        break;
      case SERVICE_STATUS.WARNING:
        userMessage = 'שרת HomeSherut פועל עם אזהרות';
        break;
      case SERVICE_STATUS.CRITICAL:
        userMessage = 'שרת HomeSherut לא זמין';
        break;
    }

    healthReport.message = userMessage;

    console.log(DEV_LOGS.API.RESPONSE_SENT, `Health check completed: ${healthReport.status} (${totalResponseTime}ms)`);

    // En production, masquer les détails sensibles
    if (process.env.NODE_ENV === 'production') {
      delete healthReport.checks.system.pid;
      delete healthReport.checks.environment.missingVars;
      
      // Simplifier les erreurs DB en production
      if (healthReport.checks.database?.error) {
        healthReport.checks.database.error = 'Database connection failed';
      }
    }

    res.status(httpStatus).json({
      success: httpStatus < 400,
      ...healthReport
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'health/check', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * GET /api/health/simple
 * Vérification simple et rapide (pour load balancers)
 */
router.get('/simple', async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'health/simple');

    // Test basique de la base de données
    const User = require('../models/User');
    await Promise.race([
      User.executeQuery('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);

    console.log(DEV_LOGS.API.RESPONSE_SENT, 'Simple health check: OK');

    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Simple health check failed:', error.message);
    
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'שירות לא זמין',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/metrics
 * Métriques détaillées pour monitoring
 */
router.get('/metrics', async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'health/metrics');

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      // Métriques Node.js
      nodejs: {
        version: process.version,
        uptime_seconds: process.uptime(),
        memory_heap_used_bytes: memoryUsage.heapUsed,
        memory_heap_total_bytes: memoryUsage.heapTotal,
        memory_rss_bytes: memoryUsage.rss,
        memory_external_bytes: memoryUsage.external,
        cpu_user_microseconds: cpuUsage.user,
        cpu_system_microseconds: cpuUsage.system
      },
      
      // Métriques application
      application: {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        platform: process.platform
      }
    };

    // Test rapide DB pour métriques
    try {
      const dbStart = Date.now();
      const User = require('../models/User');
      await User.executeQuery('SELECT 1');
      metrics.database = {
        status: 1, // 1 = UP, 0 = DOWN
        response_time_ms: Date.now() - dbStart
      };
    } catch (dbError) {
      metrics.database = {
        status: 0,
        error: dbError.message
      };
    }

    console.log(DEV_LOGS.API.RESPONSE_SENT, 'Metrics delivered');

    res.json(metrics);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'health/metrics', error.message);
    
    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// ROUTES DE COMPATIBILITÉ
// =============================================

/**
 * GET /health (sans /api prefix)
 * Redirection vers le health check principal
 */
// router.get('/', (req, res) => {
//   console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'health/redirect');
//   res.redirect('/api/health');
// });

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Formatage human-readable de l'uptime
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

module.exports = router;