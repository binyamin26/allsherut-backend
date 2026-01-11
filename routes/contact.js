const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// ✨ NOUVEAUX IMPORTS UNIFIÉS
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');

// ✅ VALIDATION UNIFIÉE AVEC MESSAGES STANDARDISÉS
const validateContactForm = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'שם חייב להכיל לפחות 2 תווים' });
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: 'email', message: MESSAGES.ERROR.VALIDATION.INVALID_EMAIL });
  }
  
  if (!data.subject || data.subject.trim().length < 5) {
    errors.push({ field: 'subject', message: 'נושא חייב להכיל לפחות 5 תווים' });
  }
  
  if (!data.message || data.message.trim().length < 10) {
    errors.push({ field: 'message', message: 'הודעה חייבת להכיל לפחות 10 תווים' });
  }
  
  if (data.phone && !/^05\d{8}$/.test(data.phone.replace(/[\s-]/g, ''))) {
    errors.push({ field: 'phone', message: MESSAGES.ERROR.VALIDATION.INVALID_PHONE });
  }
  
  return errors;
};

// =============================================
// POST /api/contact - Formulaire contact UNIFIÉ
// =============================================
router.post('/', async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'Contact form submission');
    
    const { name, email, phone, subject, message } = req.body;
    
    // ✅ VALIDATION UNIFIÉE CORRIGÉE
    const validationErrors = validateContactForm(req.body);
    if (validationErrors.length > 0) {
      const { errorResponse, statusCode } = ErrorHandler.validationError(validationErrors);
      return res.status(statusCode).json(errorResponse);
    }

    // Préparation des données
    const formData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.replace(/[\s-]/g, '') : null,
      subject: subject.trim(),
      message: message.trim()
    };

    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Contact from ${formData.email}`);

    // ✅ ENVOI EMAILS AVEC GESTION D'ERREURS UNIFIÉE
    const [adminResult, thankYouResult] = await Promise.all([
      emailService.sendContactEmail(formData),
      emailService.sendThankYouEmail(formData)
    ]);

    // Vérification que les deux emails ont été envoyés
    if (!adminResult.success) {
      console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Admin email failed:', adminResult.error);
      
      // ✅ IDENTIFICATION TYPE D'ERREUR SERVICE EXTERNE
      if (adminResult.error?.includes('EAUTH')) {
        const { errorResponse, statusCode } = ErrorHandler.createError(
          ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
          MESSAGES.ERROR.EMAIL.SERVICE_UNAVAILABLE, 
          null, 
          503
        );
        return res.status(statusCode).json(errorResponse);
      }
      
      if (adminResult.error?.includes('ECONNECTION')) {
        const { errorResponse, statusCode } = ErrorHandler.createError(
          ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
          MESSAGES.ERROR.SYSTEM.NETWORK_ERROR, 
          null, 
          503
        );
        return res.status(statusCode).json(errorResponse);
      }
      
      const { errorResponse, statusCode } = ErrorHandler.createError(
        ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
        MESSAGES.ERROR.EMAIL.SEND_FAILED, 
        null, 
        500
      );
      return res.status(statusCode).json(errorResponse);
    }

    if (!thankYouResult.success) {
      console.warn(DEV_LOGS.API.ERROR_OCCURRED, 'Thank you email failed:', thankYouResult.error);
      // Ne pas faire échouer la requête si seul l'email de remerciement échoue
    }

    // Log pour suivi
    console.log(DEV_LOGS.API.RESPONSE_SENT, `Contact processed: ${formData.name} (${formData.email}) - ${formData.subject}`);

    // ✅ RÉPONSE UNIFIÉE
    res.success(MESSAGES.SUCCESS.CLIENT.CONTACT_SENT, {
      emailsSent: {
        admin: adminResult.success,
        thankYou: thankYouResult.success
      }
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Contact form error:', error);
    
    // ✅ GESTION D'ERREURS SPÉCIFIQUES SERVICES EXTERNES
    if (error.message?.includes('EAUTH')) {
      const { errorResponse, statusCode } = ErrorHandler.createError(
        ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
        MESSAGES.ERROR.EMAIL.SERVICE_UNAVAILABLE, 
        null, 
        503
      );
      return res.status(statusCode).json(errorResponse);
    } 
    
    if (error.message?.includes('ECONNECTION')) {
      const { errorResponse, statusCode } = ErrorHandler.createError(
        ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
        MESSAGES.ERROR.SYSTEM.NETWORK_ERROR, 
        null, 
        503
      );
      return res.status(statusCode).json(errorResponse);
    } 
    
    if (error.message?.includes('EMESSAGE')) {
      const { errorResponse, statusCode } = ErrorHandler.createError(
        ErrorHandler.CODES.VALIDATION_FAILED, 
        'שגיאה בפורמט ההודעה. נא לבדוק את הפרטים ולנסות שוב',
        null,
        400
      );
      return res.status(statusCode).json(errorResponse);
    }

    const { errorResponse, statusCode } = ErrorHandler.serverError(error);
    res.status(statusCode).json(errorResponse);
  }
});

// =============================================
// GET /api/contact/status - Vérification service email UNIFIÉE
// =============================================
router.get('/status', async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'Email service status check');
    
    // ✅ VÉRIFICATION SERVICE AVEC GESTION D'ERREURS
    const emailReady = await emailService.verifyConnection();
    
    console.log(DEV_LOGS.API.RESPONSE_SENT, `Email service status: ${emailReady ? 'ready' : 'not ready'}`);
    
    // ✅ RÉPONSE STRUCTURÉE UNIFIÉE
    const statusData = {
      emailService: emailReady ? 'connected' : 'disconnected',
      smtp: {
        host: process.env.SMTP_HOST || 'not set',
        port: process.env.SMTP_PORT || 'not set',
        user: process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-10) : 'not set',
        from: process.env.SMTP_FROM ? '***' + process.env.SMTP_FROM.slice(-10) : 'not set'
      },
      methods_available: [
        'sendContactEmail',
        'sendThankYouEmail', 
        'sendResetPasswordEmail',
        'sendWelcomeEmail',
        'verifyConnection'
      ]
    };

    if (emailReady) {
      res.success('שירות האימייל זמין', statusData);
    } else {
      res.error(ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, MESSAGES.ERROR.EMAIL.SERVICE_UNAVAILABLE, null, 503, statusData);
    }

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Email service check failed:', error);
    
    // ✅ DIAGNOSTIC DÉTAILLÉ DES ERREURS SMTP
    const diagnosticData = {
      code: error.code,
      smtp_host_set: !!process.env.SMTP_HOST,
      smtp_user_set: !!process.env.SMTP_USER,
      smtp_pass_set: !!process.env.SMTP_PASS,
      smtp_from_set: !!process.env.SMTP_FROM
    };

    res.error(
      ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 
      MESSAGES.ERROR.EMAIL.SERVICE_UNAVAILABLE,
      null,
      500,
      diagnosticData
    );
  }
});

// =============================================
// POST /api/contact/test - Route de test UNIFIÉE (développement uniquement)
// =============================================
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req, res) => {
    try {
      const testData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '0501234567',
        subject: 'Test Contact Form',
        message: 'This is a test message from the contact form.'
      };

      console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'Email service test');
      
      const result = await emailService.sendContactEmail(testData);
      
      if (result.success) {
        res.success('Test email sent successfully', { result });
      } else {
        res.error(ErrorHandler.CODES.EXTERNAL_SERVICE_ERROR, 'Test email failed', { result });
      }

    } catch (error) {
      console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Email test failed:', error);
      res.serverError(error, 'Test failed');
    }
  });
}

module.exports = router;