const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/authMiddleware');

// =============================================
// GET /api/pricing/provider/:providerId
// Public — tarifs d'un prestataire
// =============================================
router.get('/provider/:providerId', async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId) || providerId <= 0) {
      return res.status(400).json({ success: false, message: 'ID prestataire invalide' });
    }

    const rows = await query(
      'SELECT id, service_name, price, is_title, sort_order FROM provider_pricing WHERE provider_id = ? ORDER BY sort_order ASC, id ASC',
      [providerId]
    );

    return res.json({ success: true, data: rows.map(r => ({ ...r, is_title: !!r.is_title })) });
  } catch (err) {
    console.error('GET /pricing/provider/:providerId error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת המחירון' });
  }
});

// =============================================
// GET /api/pricing/my
// Private — mes tarifs (provider authentifié)
// =============================================
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedProviderId = parseInt(req.query.providerId);

    let providerId;
    if (!isNaN(requestedProviderId) && requestedProviderId > 0) {
      // Un prestataire multi-services : ne renvoyer que le tarif du service demandé,
      // après vérification que ce service_provider appartient bien à cet utilisateur.
      const owned = await query(
        'SELECT id FROM service_providers WHERE id = ? AND user_id = ? AND is_active = TRUE LIMIT 1',
        [requestedProviderId, userId]
      );
      if (!owned || owned.length === 0) {
        return res.status(403).json({ success: false, message: 'שירות זה אינו שייך לחשבון שלך' });
      }
      providerId = owned[0].id;
    } else {
      const providers = await query(
        'SELECT id FROM service_providers WHERE user_id = ? AND is_active = TRUE LIMIT 1',
        [userId]
      );
      if (!providers || providers.length === 0) {
        return res.json({ success: true, data: [] });
      }
      providerId = providers[0].id;
    }

    const rows = await query(
      'SELECT id, service_name, price, is_title, sort_order FROM provider_pricing WHERE provider_id = ? ORDER BY sort_order ASC, id ASC',
      [providerId]
    );

    return res.json({ success: true, data: rows.map(r => ({ ...r, is_title: !!r.is_title })) });
  } catch (err) {
    console.error('GET /pricing/my error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת המחירון' });
  }
});

// =============================================
// PUT /api/pricing/my
// Private — sauvegarder tous les tarifs (bulk replace)
// =============================================
router.put('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, providerId: requestedProviderId } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Format invalide' });
    }

    // Validation
    for (const item of items) {
      const isTitle = !!item.is_title;
      if (!item.service_name || !item.service_name.trim()) {
        return res.status(400).json({ success: false, message: isTitle ? 'כותרת חובה עבור כל שורת כותרת' : 'Nom de service requis pour chaque ligne' });
      }
      if (item.service_name.trim().length > 200) {
        return res.status(400).json({ success: false, message: 'Nom de service trop long (max 200 caractères)' });
      }
      if (!isTitle) {
        if (!item.price || !item.price.trim()) {
          return res.status(400).json({ success: false, message: 'Tarif requis pour chaque ligne' });
        }
        if (item.price.trim().length > 100) {
          return res.status(400).json({ success: false, message: 'Tarif trop long (max 100 caractères)' });
        }
      }
    }

    let providerId;
    const parsedProviderId = parseInt(requestedProviderId);
    if (!isNaN(parsedProviderId) && parsedProviderId > 0) {
      const owned = await query(
        'SELECT id FROM service_providers WHERE id = ? AND user_id = ? AND is_active = TRUE LIMIT 1',
        [parsedProviderId, userId]
      );
      if (!owned || owned.length === 0) {
        return res.status(403).json({ success: false, message: 'שירות זה אינו שייך לחשבון שלך' });
      }
      providerId = owned[0].id;
    } else {
      const providers = await query(
        'SELECT id FROM service_providers WHERE user_id = ? AND is_active = TRUE LIMIT 1',
        [userId]
      );
      if (!providers || providers.length === 0) {
        return res.status(404).json({ success: false, message: 'Profil prestataire introuvable' });
      }
      providerId = providers[0].id;
    }

    // Supprimer tous les tarifs existants
    await query('DELETE FROM provider_pricing WHERE provider_id = ?', [providerId]);

    // Insérer les nouveaux tarifs
    if (items.length > 0) {
      const values = items.map((item, index) => [
        providerId,
        item.service_name.trim(),
        item.is_title ? '' : item.price.trim(),
        !!item.is_title,
        index
      ]);
      await query(
        'INSERT INTO provider_pricing (provider_id, service_name, price, is_title, sort_order) VALUES ?',
        [values]
      );
    }

    const saved = await query(
      'SELECT id, service_name, price, is_title, sort_order FROM provider_pricing WHERE provider_id = ? ORDER BY sort_order ASC, id ASC',
      [providerId]
    );

    return res.json({ success: true, message: 'המחירון נשמר בהצלחה', data: saved.map(r => ({ ...r, is_title: !!r.is_title })) });
  } catch (err) {
    console.error('PUT /pricing/my error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בשמירת המחירון' });
  }
});

module.exports = router;
