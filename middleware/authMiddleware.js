// Middleware d'authentification JWT
// =============================================

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { query } = require('../config/database');

// Génération de token JWT
const generateToken = (userId, email, role = 'user') => {
  return jwt.sign(
    { 
      userId, 
      email, 
      role,
      iat: Math.floor(Date.now() / 1000)
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Génération de refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Middleware de vérification du token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'אסימון גישה נדרש' // Token d'accès requis
      });
    }

    // Vérification du token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Vérification que l'utilisateur existe toujours
    const user = await query(
      'SELECT id, email, role, is_active, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (user.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'משתמש לא נמצא' // Utilisateur non trouvé
      });
    }

    if (!user[0].is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'חשבון לא פעיל' // Compte non actif
      });
    }

    // Ajout des infos utilisateur à la requête
    req.user = {
      id: decoded.userId,
        userId: decoded.userId,
      email: decoded.email,
      role: user[0].role,
      isActive: user[0].is_active
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'אסימון פג תוקף',  // Token expiré
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'אסימון לא תקין' // Token invalide
      });
    }

    console.error('❌ Erreur auth middleware:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאת שרת פנימית' // Erreur serveur interne
    });
  }
};

// Middleware optionnel (ne bloque pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await query(
        'SELECT id, email, role, is_active FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (user.length > 0 && user[0].is_active) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: user[0].role,
          isActive: user[0].is_active
        };
      }
    }

    next();
  } catch (error) {
    // En cas d'erreur, on continue sans authentification
    next();
  }
};

// Middleware de vérification du rôle
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'אימות נדרש' // Authentification requise
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ 
        success: false, 
        message: 'אין הרשאה לפעולה זו' // Pas d'autorisation pour cette action
      });
    }

    next();
  };
};

// Middleware pour vérifier que l'utilisateur modifie ses propres données
const requireOwnership = (req, res, next) => {
  const resourceUserId = req.params.userId || req.body.userId;
  
  if (req.user.role === 'admin') {
    return next(); // Admin peut tout modifier
  }

  if (req.user.id.toString() !== resourceUserId.toString()) {
    return res.status(403).json({ 
      success: false, 
      message: 'ניתן לערוך רק את הפרופיל שלך' // Vous ne pouvez modifier que votre propre profil
    });
  }

  next();
};

module.exports = {
  generateToken,
  generateRefreshToken,
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership
};