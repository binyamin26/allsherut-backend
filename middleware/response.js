// middleware/response.js - VERSION AMÉLIORÉE
const ResponseHelper = require('../utils/responseHelper');
const ErrorHandler = require('../utils/ErrorHandler');

/**
 * Middleware de réponses standardisées pour HomeSherut
 * Intègre ErrorHandler pour une gestion d'erreurs unifiée
 */
const responseMiddleware = (req, res, next) => {
  
  // =============================================
  // MÉTHODES DE SUCCÈS (existantes améliorées)
  // =============================================
  
  res.success = (message, data = null, meta = null) => {
    return res.json(ResponseHelper.success(message, data, meta));
  };

  res.created = (message, data, resourceId = null) => {
    return res.status(201).json(ResponseHelper.created(message, data, resourceId));
  };

  res.updated = (message, data = null) => {
    return res.json(ResponseHelper.updated(message, data));
  };

  res.deleted = (message) => {
    return res.json(ResponseHelper.deleted(message));
  };

  res.paginated = (data, paginationInfo, message = null) => {
    return res.json(ResponseHelper.paginated(data, paginationInfo, message));
  };

  // =============================================
  // MÉTHODES D'ERREUR UNIFIÉES (nouvelles)
  // =============================================
  
  /**
   * Erreur générale avec code standardisé
   */
  res.error = (code, customMessage = null, errors = null, statusCode = null) => {
    const { errorResponse, statusCode: finalStatus } = ErrorHandler.createError(
      code, 
      customMessage, 
      errors, 
      statusCode
    );
    return res.status(finalStatus).json(errorResponse);
  };

  /**
   * Erreurs de validation (express-validator)
   */
  res.validationError = (validationErrors, customMessage = null) => {
    const { errorResponse, statusCode } = ErrorHandler.validationError(
      validationErrors, 
      customMessage
    );
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Erreurs d'authentification
   */
  res.authError = (type = 'invalid') => {
    const { errorResponse, statusCode } = ErrorHandler.authError(type);
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Ressource non trouvée
   */
  res.notFound = (resourceType = 'resource', customMessage = null) => {
    const { errorResponse, statusCode } = ErrorHandler.notFoundError(
      resourceType, 
      customMessage
    );
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Erreurs de permissions
   */
  res.forbidden = (type = 'denied') => {
    const { errorResponse, statusCode } = ErrorHandler.permissionError(type);
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Non autorisé (401)
   */
  res.unauthorized = () => {
    const { errorResponse, statusCode } = ErrorHandler.authError('missing');
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Erreurs serveur
   */
  res.serverError = (originalError = null, customMessage = null) => {
    const { errorResponse, statusCode } = ErrorHandler.serverError(
      originalError, 
      customMessage
    );
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Rate limiting
   */
  res.rateLimited = (retryAfter = null) => {
    const { errorResponse, statusCode } = ErrorHandler.rateLimitError(retryAfter);
    return res.status(statusCode).json(errorResponse);
  };

  /**
   * Erreurs d'upload
   */
  res.uploadError = (type = 'general', customMessage = null) => {
    const { errorResponse, statusCode } = ErrorHandler.uploadError(type, customMessage);
    return res.status(statusCode).json(errorResponse);
  };

  // =============================================
  // MÉTHODES DE COMPATIBILITÉ AVEC L'ANCIEN CODE
  // =============================================
  
  /**
   * @deprecated Utiliser res.error() avec des codes à la place
   */
  res.badRequest = (message, errors = null) => {
    console.warn('DEPRECATED: res.badRequest() - Utiliser res.error() avec ErrorHandler.CODES');
    return res.error(ErrorHandler.CODES.VALIDATION_FAILED, message, errors, 400);
  };

  /**
   * @deprecated Utiliser res.error() avec des codes à la place  
   */
  res.conflict = (message) => {
    console.warn('DEPRECATED: res.conflict() - Utiliser res.error() avec ErrorHandler.CODES');
    return res.error(ErrorHandler.CODES.DB_CONSTRAINT_ERROR, message, null, 409);
  };

  // =============================================
  // UTILITAIRES DE LOGGING
  // =============================================
  
  /**
   * Log automatique des erreurs serveur
   */
  const originalServerError = res.serverError;
  res.serverError = (originalError = null, customMessage = null) => {
    // Logger les détails pour debugging
    if (originalError) {
      console.error('🔥 Erreur serveur détectée:', {
        message: originalError.message,
        stack: originalError.stack,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalServerError.call(res, originalError, customMessage);
  };

  /**
   * Helper pour les réponses avec logs automatiques
   */
  res.logAndRespond = (level, message, data = null, meta = null) => {
    const logData = {
      level,
      message,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      data: data ? Object.keys(data) : null
    };

    switch (level) {
      case 'info':
        console.log('ℹ️', logData);
        break;
      case 'warn':
        console.warn('⚠️', logData);
        break;
      case 'error':
        console.error('❌', logData);
        break;
      default:
        console.log('📝', logData);
    }

    return res.success(message, data, meta);
  };

  next();
};

module.exports = responseMiddleware;