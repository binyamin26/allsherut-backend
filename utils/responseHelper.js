/**
 * Helper pour standardiser toutes les réponses API HomeSherut
 * Usage: ResponseHelper.success(), ResponseHelper.error(), etc.
 */
class ResponseHelper {
  
  static success(message, data = null, meta = null) {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) response.data = data;
    if (meta !== null) response.meta = meta;
    return response;
  }

  static error(message, errors = null, statusCode = 400) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors !== null) response.errors = errors;
    if (process.env.NODE_ENV === 'development') response.statusCode = statusCode;
    return response;
  }

  static paginated(data, paginationInfo, message = null) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      data,
      pagination: {
        currentPage: paginationInfo.currentPage || paginationInfo.page || 1,
        totalPages: paginationInfo.totalPages,
        totalItems: paginationInfo.totalItems || paginationInfo.total,
        itemsPerPage: paginationInfo.itemsPerPage || paginationInfo.limit || 10,
        hasNext: paginationInfo.hasNext,
        hasPrev: paginationInfo.hasPrev || (paginationInfo.currentPage > 1)
      }
    };

    if (message) response.message = message;
    return response;
  }

  static created(message, data, resourceId = null) {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      data
    };

    if (resourceId) response.resourceId = resourceId;
    return response;
  }

  static updated(message, data = null) {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data) response.data = data;
    return response;
  }

  static deleted(message) {
    return {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static notFound(resource = 'משאב') {
    return {
      success: false,
      message: `${resource} לא נמצא`,
      timestamp: new Date().toISOString()
    };
  }

  static unauthorized() {
    return {
      success: false,
      message: 'נדרשת הזדהות',
      timestamp: new Date().toISOString()
    };
  }

  static forbidden() {
    return {
      success: false,
      message: 'אין הרשאה לפעולה זו',
      timestamp: new Date().toISOString()
    };
  }

  static validationError(validationErrors) {
    return {
      success: false,
      message: 'נתונים לא תקינים',
      errors: validationErrors,
      timestamp: new Date().toISOString()
    };
  }

  static serverError(message = 'שגיאת שרת פנימית') {
    return {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
  }
  // Ajouter à la fin de ResponseHelper.js, avant module.exports

/**
 * Middleware pour ajouter les méthodes de réponse à Express
 */
static middleware(req, res, next) {
  // Ajouter les méthodes à l'objet response
  res.success = (message, data = null, meta = null) => {
    return res.json(ResponseHelper.success(message, data, meta));
  };

  res.error = (message, errors = null, statusCode = 400) => {
    return res.status(statusCode).json(ResponseHelper.error(message, errors, statusCode));
  };

  res.paginated = (data, paginationInfo, message = null) => {
    return res.json(ResponseHelper.paginated(data, paginationInfo, message));
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

  res.notFound = (resource = 'משאב') => {
    return res.status(404).json(ResponseHelper.notFound(resource));
  };

  res.unauthorized = () => {
    return res.status(401).json(ResponseHelper.unauthorized());
  };

  res.forbidden = () => {
    return res.status(403).json(ResponseHelper.forbidden());
  };

  res.validationError = (validationErrors) => {
    return res.status(400).json(ResponseHelper.validationError(validationErrors));
  };

  res.serverError = (message = 'שגיאת שרת פנימית') => {
    return res.status(500).json(ResponseHelper.serverError(message));
  };

  next();
}
}

module.exports = ResponseHelper;