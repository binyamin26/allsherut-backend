const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/authMiddleware');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');

const router = express.Router();

// Configuration multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/profiles/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(MESSAGES.ERROR.UPLOAD.INVALID_FILE_TYPE), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/upload/profile-image
router.post('/profile-image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.error(ErrorHandler.CODES.REQUIRED_FIELD, MESSAGES.ERROR.UPLOAD.NO_FILE_SELECTED);
    }

    console.log(DEV_LOGS.API.UPLOAD_STARTED, `User ${req.user.id} uploading profile image`);

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      if (req.file?.path) {
        fs.unlink(req.file.path, (unlinkError) => {
          if (unlinkError) console.error(DEV_LOGS.API.ERROR_OCCURRED, 'File cleanup:', unlinkError);
        });
      }
      return res.notFound('user');
    }
const baseUrl = process.env.BACKEND_URL || 'https://homesherut-backend.onrender.com';
const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;

// ✅ Récupérer le service_type depuis le body
const serviceType = req.body.serviceType || req.user.service_type;

try {
  const { query } = require('../config/database');
  
  if (user.role === 'provider') {
    // ✅ CORRECTION - Cibler uniquement le service actif
    await query(
      'UPDATE service_providers SET profile_image = ? WHERE user_id = ? AND service_type = ?',
      [imageUrl, req.user.id, serviceType]
    );
  } else {
    await query(
      'UPDATE users SET profile_image = ? WHERE id = ?',
      [imageUrl, req.user.id]
    );
  }

  console.log(DEV_LOGS.API.UPLOAD_COMPLETED, `Image saved for user ${req.user.id}, service ${serviceType}: ${imageUrl}`);

  return res.created(MESSAGES.SUCCESS.UPLOAD.IMAGE_UPLOADED, {
    imageUrl,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    }
  });

} catch (dbError) {
  console.error(DEV_LOGS.DATABASE.QUERY_ERROR, 'Profile image update failed:', dbError);
  
  if (req.file?.path) {
    fs.unlink(req.file.path, (unlinkError) => {
      if (unlinkError) console.error(DEV_LOGS.API.ERROR_OCCURRED, 'File cleanup:', unlinkError);
    });
  }
  
  return res.serverError(dbError, 'Database update failed');
}

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Upload error:', error);
    
    if (req.file?.path) {
      fs.unlink(req.file.path, (unlinkError) => {
        if (unlinkError) console.error(DEV_LOGS.API.ERROR_OCCURRED, 'File cleanup:', unlinkError);
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.uploadError('size');
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.uploadError('type');
    }

    if (error.message?.includes(MESSAGES.ERROR.UPLOAD.INVALID_FILE_TYPE)) {
      return res.uploadError('type');
    }

    return res.serverError(error);
  }
});

// DELETE /api/upload/profile-image
router.delete('/profile-image', authenticateToken, async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Delete profile image for user ${req.user.id}`);

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.notFound('user');
    }

    // ✅ AJOUTER CETTE LIGNE - Récupérer serviceType depuis le body
    const serviceType = req.body.serviceType || req.user.service_type;
    
    console.log('🔍 serviceType reçu:', serviceType); // ← AJOUTER CE LOG

    const { query } = require('../config/database');
    let currentImage = null;

    if (user.role === 'provider') {
      const providerResult = await query(
        'SELECT profile_image FROM service_providers WHERE user_id = ? AND service_type = ?',
        [req.user.id, serviceType]
      );
      
      console.log('🔍 Image trouvée en DB:', providerResult[0]?.profile_image); // ← AJOUTER CE LOG
      
      currentImage = providerResult[0]?.profile_image;
    } else {
      const userResult = await query(
        'SELECT profile_image FROM users WHERE id = ?',
        [req.user.id]
      );
      currentImage = userResult[0]?.profile_image;
    }

    if (currentImage) {
      const imagePath = path.join(__dirname, '../', currentImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(DEV_LOGS.API.RESPONSE_SENT, `Physical file deleted: ${imagePath}`);
      }

      if (user.role === 'provider') {
        // ✅ MODIFIER CETTE LIGNE
        const updateResult = await query(
          'UPDATE service_providers SET profile_image = NULL WHERE user_id = ? AND service_type = ?',
          [req.user.id, serviceType]
        );
        
        console.log('🔍 Lignes affectées par UPDATE:', updateResult.affectedRows); // ← AJOUTER CE LOG
      } else {
        await query(
          'UPDATE users SET profile_image = NULL WHERE id = ?',
          [req.user.id]
        );
      }

      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `Profile image removed from DB for user ${req.user.id}, service ${serviceType}`);
    }

    return res.success(MESSAGES.SUCCESS.UPLOAD.IMAGE_DELETED);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Delete profile image error:', error);
    return res.serverError(error);
  }
});

// GET /api/upload/test
router.get('/test', (req, res) => {
  console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'Upload service test');
  
  res.success('Service d\'upload fonctionnel', {
    maxFileSize: '5MB',
    supportedFormats: ['JPG', 'PNG', 'WebP'],
    endpoints: [
      'POST /api/upload/profile-image',
      'DELETE /api/upload/profile-image'
    ]
  });
});

// Middleware erreurs Multer
router.use((error, req, res, next) => {
  console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Multer middleware error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.uploadError('size');
      case 'LIMIT_UNEXPECTED_FILE':
        return res.uploadError('type', 'שדה קובץ לא צפוי');
      case 'LIMIT_FILE_COUNT':
        return res.uploadError('general', 'יותר מדי קבצים');
      default:
        return res.uploadError('general', `שגיאת multer: ${error.code}`);
    }
  }
  
  if (error.message?.includes(MESSAGES.ERROR.UPLOAD.INVALID_FILE_TYPE)) {
    return res.uploadError('type');
  }

  if (error.message?.includes('file')) {
    return res.uploadError('general', error.message);
  }

  res.serverError(error, 'Upload middleware error');
});

module.exports = router;