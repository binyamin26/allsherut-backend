const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/authMiddleware');
const ErrorHandler = require('../utils/ErrorHandler');
const { MESSAGES, DEV_LOGS } = require('../constants/messages');

const router = express.Router();

// ============================================
// CLOUDINARY CONFIG
// ============================================
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer en mémoire (pas sur disque)
const storage = multer.memoryStorage();

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

// ============================================
// Helper : Upload buffer vers Cloudinary
// ============================================
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

// ============================================
// Helper : Supprimer image de Cloudinary
// ============================================
const deleteFromCloudinary = async (imageUrl) => {
  try {
    // Extraire le public_id depuis l'URL Cloudinary
    // URL format: https://res.cloudinary.com/xxx/image/upload/v123/homesherut/profiles/profile-16-xxx.jpg
    const parts = imageUrl.split('/upload/');
    if (parts.length < 2) return;

    // Enlever la version (v123456/) et l'extension
    let publicId = parts[1].replace(/^v\d+\//, '');
    publicId = publicId.replace(/\.[^.]+$/, ''); // Enlever .jpg/.png/.webp

    console.log('🗑️ Suppression Cloudinary public_id:', publicId);
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('⚠️ Erreur suppression Cloudinary:', err.message);
  }
};

// ============================================
// POST /api/upload/profile-image
// ============================================
router.post('/profile-image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.error(ErrorHandler.CODES.REQUIRED_FIELD, MESSAGES.ERROR.UPLOAD.NO_FILE_SELECTED);
    }

    console.log(DEV_LOGS.API.UPLOAD_STARTED, `User ${req.user.id} uploading profile image`);

    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.notFound('user');
    }

    const serviceType = req.body.serviceType || req.user.service_type;

    // ✅ Upload vers Cloudinary (pas sur disque)
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.user.id, serviceType);
    const imageUrl = cloudinaryResult.secure_url;

    console.log('☁️ Image uploadée sur Cloudinary:', imageUrl);

    const { query } = require('../config/database');

    // Supprimer l'ancienne image de Cloudinary si elle existe
    if (user.role === 'provider') {
      const oldResult = await query(
        'SELECT profile_image FROM service_providers WHERE user_id = ? AND service_type = ?',
        [req.user.id, serviceType]
      );
      if (oldResult[0]?.profile_image && oldResult[0].profile_image.includes('cloudinary')) {
        await deleteFromCloudinary(oldResult[0].profile_image);
      }

      await query(
        'UPDATE service_providers SET profile_image = ? WHERE user_id = ? AND service_type = ?',
        [imageUrl, req.user.id, serviceType]
      );
    } else {
      const oldResult = await query(
        'SELECT profile_image FROM users WHERE id = ?',
        [req.user.id]
      );
      if (oldResult[0]?.profile_image && oldResult[0].profile_image.includes('cloudinary')) {
        await deleteFromCloudinary(oldResult[0].profile_image);
      }

      await query(
        'UPDATE users SET profile_image = ? WHERE id = ?',
        [imageUrl, req.user.id]
      );
    }

    console.log(DEV_LOGS.API.UPLOAD_COMPLETED, `Image saved for user ${req.user.id}, service ${serviceType}: ${imageUrl}`);

    return res.created(MESSAGES.SUCCESS.UPLOAD.IMAGE_UPLOADED, {
      imageUrl,
      file: {
        filename: cloudinaryResult.public_id,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Upload error:', error);

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

// ============================================
// DELETE /api/upload/profile-image
// ============================================
router.delete('/profile-image', authenticateToken, async (req, res) => {
  try {
    console.log(DEV_LOGS.API.REQUEST_RECEIVED, `Delete profile image for user ${req.user.id}`);

    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.notFound('user');
    }

    const serviceType = req.body.serviceType || req.user.service_type;
    const { query } = require('../config/database');
    let currentImage = null;

    if (user.role === 'provider') {
      const providerResult = await query(
        'SELECT profile_image FROM service_providers WHERE user_id = ? AND service_type = ?',
        [req.user.id, serviceType]
      );
      currentImage = providerResult[0]?.profile_image;
    } else {
      const userResult = await query(
        'SELECT profile_image FROM users WHERE id = ?',
        [req.user.id]
      );
      currentImage = userResult[0]?.profile_image;
    }

    if (currentImage) {
      // ✅ Supprimer de Cloudinary
      if (currentImage.includes('cloudinary')) {
        await deleteFromCloudinary(currentImage);
      }

      if (user.role === 'provider') {
        await query(
          'UPDATE service_providers SET profile_image = NULL WHERE user_id = ? AND service_type = ?',
          [req.user.id, serviceType]
        );
      } else {
        await query(
          'UPDATE users SET profile_image = NULL WHERE id = ?',
          [req.user.id]
        );
      }

      console.log(DEV_LOGS.DATABASE.QUERY_EXECUTED, `Profile image removed for user ${req.user.id}, service ${serviceType}`);
    }

    return res.success(MESSAGES.SUCCESS.UPLOAD.IMAGE_DELETED);

  } catch (error) {
    console.error(DEV_LOGS.API.ERROR_OCCURRED, 'Delete profile image error:', error);
    return res.serverError(error);
  }
});

// ============================================
// POST /api/upload/gallery-image
// ============================================
router.post('/gallery-image', authenticateToken, upload.single('galleryImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.error(ErrorHandler.CODES.REQUIRED_FIELD, 'לא נבחר קובץ');
    }

    const { query } = require('../config/database');
    const serviceType = req.body.serviceType || req.user.service_type;

    // Récupérer la galerie actuelle
    const result = await query(
      'SELECT profile_images FROM service_providers WHERE user_id = ? AND service_type = ?',
      [req.user.id, serviceType]
    );

    if (!result[0]) {
      return res.notFound('provider');
    }

    let gallery = [];
    try {
      gallery = result[0].profile_images ? JSON.parse(result[0].profile_images) : [];
    } catch (e) {
      gallery = [];
    }

    if (gallery.length >= 6) {
      return res.error(400, 'מקסימום 6 תמונות בגלריה');
    }

    // Upload vers Cloudinary dans un dossier gallery
    const uploadGallery = (buffer, userId, serviceType) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'homesherut/gallery',
          public_id: `gallery-${userId}-${serviceType}-${Date.now()}`,
          resource_type: 'image',
          transformation: [
            { width: 800, height: 600, crop: 'fill' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(buffer);
    });

    const cloudinaryResult = await uploadGallery(req.file.buffer, req.user.id, serviceType);
    gallery.push(cloudinaryResult.secure_url);

    await query(
      'UPDATE service_providers SET profile_images = ? WHERE user_id = ? AND service_type = ?',
      [JSON.stringify(gallery), req.user.id, serviceType]
    );

    return res.created('תמונה הועלתה לגלריה', { gallery });

  } catch (error) {
    console.error('Gallery upload error:', error);
    return res.serverError(error);
  }
});

// ============================================
// DELETE /api/upload/gallery-image
// ============================================
router.delete('/gallery-image', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { serviceType, imageUrl } = req.body;
    const svcType = serviceType || req.user.service_type;

    if (!imageUrl) {
      return res.error(400, 'כתובת תמונה נדרשת');
    }

    const result = await query(
      'SELECT profile_images FROM service_providers WHERE user_id = ? AND service_type = ?',
      [req.user.id, svcType]
    );

    if (!result[0]) return res.notFound('provider');

    let gallery = [];
    try {
      gallery = result[0].profile_images ? JSON.parse(result[0].profile_images) : [];
    } catch (e) { gallery = []; }

    // Supprimer de Cloudinary
    if (imageUrl.includes('cloudinary')) {
      await deleteFromCloudinary(imageUrl);
    }

    gallery = gallery.filter(url => url !== imageUrl);

    await query(
      'UPDATE service_providers SET profile_images = ? WHERE user_id = ? AND service_type = ?',
      [JSON.stringify(gallery), req.user.id, svcType]
    );

    return res.success('תמונה נמחקה מהגלריה', { gallery });

  } catch (error) {
    console.error('Gallery delete error:', error);
    return res.serverError(error);
  }
});

// ============================================
// GET /api/upload/test
// ============================================
router.get('/test', (req, res) => {
  console.log(DEV_LOGS.API.REQUEST_RECEIVED, 'Upload service test');

  res.success('Service d\'upload fonctionnel', {
    maxFileSize: '5MB',
    supportedFormats: ['JPG', 'PNG', 'WebP'],
    storage: 'Cloudinary',
    endpoints: [
      'POST /api/upload/profile-image',
      'DELETE /api/upload/profile-image'
    ]
  });
});

// ============================================
// Middleware erreurs Multer
// ============================================
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