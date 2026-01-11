// utils/ErrorHandler.js
const ResponseHelper = require('./responseHelper');

/**
 * Classe centralisée pour la gestion d'erreurs HomeSherut
 * Unifie tous les types d'erreurs avec messages en hébreu et codes de debug
 */
class ErrorHandler {
  
  // =============================================
  // CODES D'ERREUR POUR DEBUGGING (développeurs)
  // =============================================
  static CODES = {
    // Authentification
    AUTH_INVALID: 'AUTH_INVALID',
    AUTH_EXPIRED: 'AUTH_EXPIRED', 
    AUTH_MISSING: 'AUTH_MISSING',
    CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
    EMAIL_EXISTS: 'EMAIL_EXISTS',
    PASSWORD_WEAK: 'PASSWORD_WEAK',
    TOKEN_INVALID: 'TOKEN_INVALID',
    
    // Validation
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    INVALID_PHONE: 'INVALID_PHONE',
    INVALID_EMAIL: 'INVALID_EMAIL',
    
    // Ressources
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
    PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    
    // Permissions
    ACCESS_DENIED: 'ACCESS_DENIED',
    INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
    FORBIDDEN_ACTION: 'FORBIDDEN_ACTION',
    
    // Business Logic
    CREDITS_INSUFFICIENT: 'CREDITS_INSUFFICIENT',
    PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    RATE_LIMITED: 'RATE_LIMITED',
    
    // Upload
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    UPLOAD_FAILED: 'UPLOAD_FAILED',
    
    // Database
    DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
    DB_QUERY_ERROR: 'DB_QUERY_ERROR',
    DB_CONSTRAINT_ERROR: 'DB_CONSTRAINT_ERROR',
    
    // Système
    SERVER_ERROR: 'SERVER_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
  };

  // =============================================
  // MESSAGES EN HÉBREU (utilisateurs finaux)
  // =============================================
  static MESSAGES = {
    // Authentification
    [ErrorHandler.CODES.AUTH_INVALID]: 'פרטי ההתחברות לא תקינים',
    [ErrorHandler.CODES.AUTH_EXPIRED]: 'פג תוקף ההתחברות. אנא התחבר מחדש',
    [ErrorHandler.CODES.AUTH_MISSING]: 'נדרשת התחברות למערכת',
    [ErrorHandler.CODES.CREDENTIALS_INVALID]: 'האימייל או הסיסמה שגויים',
    [ErrorHandler.CODES.EMAIL_EXISTS]: 'כתובת האימייל כבר קיימת במערכת',
    [ErrorHandler.CODES.PASSWORD_WEAK]: 'הסיסמה חלשה מדי. נדרשות לפחות 6 תווים',
    [ErrorHandler.CODES.TOKEN_INVALID]: 'טוקן לא תקף',
    
    // Validation
    [ErrorHandler.CODES.VALIDATION_FAILED]: 'נתונים לא תקינים',
    [ErrorHandler.CODES.REQUIRED_FIELD]: 'שדה חובה חסר',
    [ErrorHandler.CODES.INVALID_FORMAT]: 'פורמט לא תקין',
    [ErrorHandler.CODES.INVALID_PHONE]: 'מספר טלפון לא תקין (05xxxxxxxx)',
    [ErrorHandler.CODES.INVALID_EMAIL]: 'כתובת אימייל לא תקינה',
    
    // Ressources  
    [ErrorHandler.CODES.USER_NOT_FOUND]: 'משתמש לא נמצא',
    [ErrorHandler.CODES.PROVIDER_NOT_FOUND]: 'ספק השירות לא נמצא',
    [ErrorHandler.CODES.PROFILE_INCOMPLETE]: 'פרופיל לא הושלם',
    [ErrorHandler.CODES.RESOURCE_NOT_FOUND]: 'המשאב המבוקש לא נמצא',
    
    // Permissions
    [ErrorHandler.CODES.ACCESS_DENIED]: 'אין הרשאה לפעולה זו',
    [ErrorHandler.CODES.INSUFFICIENT_PRIVILEGES]: 'אין הרשאות מספיקות',
    [ErrorHandler.CODES.FORBIDDEN_ACTION]: 'פעולה לא מורשית',
    
    // Business Logic
    [ErrorHandler.CODES.CREDITS_INSUFFICIENT]: 'אין מספיק קרדיטים. שדרג לפרימיום',
    [ErrorHandler.CODES.PREMIUM_REQUIRED]: 'נדרש חשבון פרימיום',
    [ErrorHandler.CODES.SERVICE_UNAVAILABLE]: 'השירות אינו זמין כרגע',
    [ErrorHandler.CODES.RATE_LIMITED]: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
    
    // Upload
    [ErrorHandler.CODES.FILE_TOO_LARGE]: 'הקובץ גדול מדי. מקסימום 5MB',
    [ErrorHandler.CODES.INVALID_FILE_TYPE]: 'סוג קובץ לא נתמך. השתמש ב-JPG, PNG או WebP',
    [ErrorHandler.CODES.UPLOAD_FAILED]: 'שגיאה בהעלאת הקובץ',
    
    // Database
    [ErrorHandler.CODES.DB_CONNECTION_ERROR]: 'שגיאה בחיבור למאגר המידע',
    [ErrorHandler.CODES.DB_QUERY_ERROR]: 'שגיאה בשאילתת המידע',
    [ErrorHandler.CODES.DB_CONSTRAINT_ERROR]: 'הנתונים מפרים אילוצי המערכת',
    
    // Système
    [ErrorHandler.CODES.SERVER_ERROR]: 'שגיאת שרת פנימית',
    [ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR]: 'שגיאה בשירות חיצוני',
    [ErrorHandler.CODES.CONFIGURATION_ERROR]: 'שגיאה בהגדרות המערכת'
  };

  // =============================================
  // MÉTHODES PRINCIPALES
  // =============================================
  
  /**
   * Créer une erreur standardisée
   * @param {string} code - Code d'erreur (pour debugging)
   * @param {string} customMessage - Message personnalisé (optionnel)
   * @param {Array} errors - Erreurs de validation détaillées
   * @param {number} statusCode - Code HTTP
   * @param {Object} meta - Métadonnées additionnelles
   */
  static createError(code, customMessage = null, errors = null, statusCode = 400, meta = null) {
    const message = customMessage || ErrorHandler.MESSAGES[code] || 'שגיאה לא מזוהה';
    
    const errorResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      code // Code pour debugging côté développeur
    };

    if (errors) errorResponse.errors = errors;
    if (meta) errorResponse.meta = meta;
    
    // Informations debug uniquement en développement
    if (process.env.NODE_ENV === 'development') {
      errorResponse.debug = {
        statusCode,
        errorCode: code,
        stack: new Error().stack
      };
    }

    return { errorResponse, statusCode };
  }

  /**
   * Wrapper pour les erreurs de validation express-validator
   */
  static validationError(validationErrors, customMessage = null) {
    const formattedErrors = Array.isArray(validationErrors) 
      ? validationErrors.map(err => ({
          field: err.path || err.param || err.field,
          message: err.msg || err.message
        }))
      : validationErrors;

    return ErrorHandler.createError(
      ErrorHandler.CODES.VALIDATION_FAILED,
      customMessage,
      formattedErrors,
      400
    );
  }

  /**
   * Erreurs d'authentification
   */
  static authError(type = 'invalid') {
    const codeMap = {
      'invalid': ErrorHandler.CODES.CREDENTIALS_INVALID,
      'expired': ErrorHandler.CODES.AUTH_EXPIRED,
      'missing': ErrorHandler.CODES.AUTH_MISSING,
      'token': ErrorHandler.CODES.TOKEN_INVALID
    };
    
    const statusMap = {
      'invalid': 401,
      'expired': 401,
      'missing': 401,
      'token': 401
    };

    return ErrorHandler.createError(
      codeMap[type] || ErrorHandler.CODES.AUTH_INVALID,
      null,
      null,
      statusMap[type] || 401
    );
  }

  /**
   * Erreurs de ressources non trouvées
   */
  static notFoundError(resourceType = 'resource', customMessage = null) {
    const codeMap = {
      'user': ErrorHandler.CODES.USER_NOT_FOUND,
      'provider': ErrorHandler.CODES.PROVIDER_NOT_FOUND,
      'resource': ErrorHandler.CODES.RESOURCE_NOT_FOUND
    };

    return ErrorHandler.createError(
      codeMap[resourceType] || ErrorHandler.CODES.RESOURCE_NOT_FOUND,
      customMessage,
      null,
      404
    );
  }

  /**
   * Erreurs de permissions
   */
  static permissionError(type = 'denied') {
    const codeMap = {
      'denied': ErrorHandler.CODES.ACCESS_DENIED,
      'insufficient': ErrorHandler.CODES.INSUFFICIENT_PRIVILEGES,
      'forbidden': ErrorHandler.CODES.FORBIDDEN_ACTION
    };

    return ErrorHandler.createError(
      codeMap[type] || ErrorHandler.CODES.ACCESS_DENIED,
      null,
      null,
      403
    );
  }

  /**
   * Erreurs serveur
   */
  static serverError(originalError = null, customMessage = null) {
    console.error('Server Error:', originalError);
    
    let code = ErrorHandler.CODES.SERVER_ERROR;
    
    // Identifier le type d'erreur spécifique
    if (originalError) {
      if (originalError.code === 'ECONNREFUSED') {
        code = ErrorHandler.CODES.DB_CONNECTION_ERROR;
      } else if (originalError.code && originalError.code.startsWith('ER_')) {
        code = ErrorHandler.CODES.DB_QUERY_ERROR;
      }
    }

    return ErrorHandler.createError(
      code,
      customMessage,
      null,
      500,
      process.env.NODE_ENV === 'development' ? { originalError: originalError?.message } : null
    );
  }

  /**
   * Erreurs de rate limiting
   */
  static rateLimitError(retryAfter = null) {
    return ErrorHandler.createError(
      ErrorHandler.CODES.RATE_LIMITED,
      null,
      null,
      429,
      retryAfter ? { retryAfter } : null
    );
  }

  /**
   * Erreurs d'upload
   */
  static uploadError(type = 'general', customMessage = null) {
    const codeMap = {
      'size': ErrorHandler.CODES.FILE_TOO_LARGE,
      'type': ErrorHandler.CODES.INVALID_FILE_TYPE,
      'general': ErrorHandler.CODES.UPLOAD_FAILED
    };

    return ErrorHandler.createError(
      codeMap[type] || ErrorHandler.CODES.UPLOAD_FAILED,
      customMessage,
      null,
      400
    );
  }

  // =============================================
  // INTÉGRATION AVEC EXPRESS
  // =============================================
  
  /**
   * Middleware Express pour la gestion d'erreurs
   */
  static expressErrorHandler(err, req, res, next) {
    console.error('Express Error Handler:', err);

    let errorResponse, statusCode;

    // Identifier le type d'erreur et créer la réponse appropriée
    if (err.name === 'ValidationError') {
      ({ errorResponse, statusCode } = ErrorHandler.validationError(err.errors));
    } else if (err.name === 'UnauthorizedError') {
      ({ errorResponse, statusCode } = ErrorHandler.authError('token'));
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      ({ errorResponse, statusCode } = ErrorHandler.uploadError('size'));
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      ({ errorResponse, statusCode } = ErrorHandler.uploadError('type'));
    } else {
      ({ errorResponse, statusCode } = ErrorHandler.serverError(err));
    }

    res.status(statusCode).json(errorResponse);
  }
}

module.exports = ErrorHandler;