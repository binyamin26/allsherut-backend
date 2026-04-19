const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/authMiddleware');

// =============================================
// GET /api/recruitment/listing/:id
// Détail d'une annonce par ID
// =============================================
router.get('/listing/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await query(
      `SELECT
        jl.id,
        jl.provider_id,
        jl.service_type,
        jl.contract_type,
        jl.salary,
        jl.payment_type,
        jl.availability_days,
        jl.availability_hours,
        jl.experience_required,
        jl.languages_required,
        jl.driving_license,
        jl.description,
        jl.created_at,
        u.first_name,
        u.last_name,
        u.phone,
        sp.profile_image,
        COALESCE(jl.location_city, sp.location_city) AS location_city,
        COALESCE(jl.location_area, sp.location_area) AS location_area
      FROM job_listings jl
      INNER JOIN service_providers sp ON sp.id = jl.provider_id
      INNER JOIN users u ON u.id = sp.user_id
      WHERE jl.id = ? AND jl.is_active = TRUE`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'מודעה לא נמצאה' });
    }

    const r = rows[0];
    const listing = {
      ...r,
      availability_days:  safeJsonParse(r.availability_days)  || [],
      availability_hours: safeJsonParse(r.availability_hours) || [],
      languages_required: safeJsonParse(r.languages_required) || [],
      full_name: `${r.first_name} ${r.last_name}`,
    };

    return res.status(200).json({ success: true, data: listing });
  } catch (err) {
    console.error('GET /recruitment/listing/:id error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת המודעה' });
  }
});

// =============================================
// GET /api/recruitment/my/listings
// Mes offres (provider authentifié) — DOIT être avant /:service
// =============================================
router.get('/my/listings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await query(
      `SELECT jl.*
       FROM job_listings jl
       INNER JOIN service_providers sp ON sp.id = jl.provider_id
       WHERE sp.user_id = ? AND jl.is_active = TRUE
       ORDER BY jl.created_at DESC`,
      [userId]
    );

    const listings = rows.map(r => ({
      ...r,
      availability_days:  safeJsonParse(r.availability_days)  || [],
      availability_hours: safeJsonParse(r.availability_hours) || [],
      languages_required: safeJsonParse(r.languages_required) || [],
    }));

    return res.status(200).json({ success: true, data: { listings } });
  } catch (err) {
    console.error('GET /recruitment/my/listings error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת המודעות שלך' });
  }
});

// =============================================
// GET /api/recruitment/:service
// Offres d'emploi publiques pour un service donné — DOIT être en dernier
// =============================================
router.get('/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const rows = await query(
      `SELECT
        jl.id,
        jl.provider_id,
        jl.service_type,
        jl.contract_type,
        jl.salary,
        jl.payment_type,
        jl.availability_days,
        jl.availability_hours,
        jl.experience_required,
        jl.languages_required,
        jl.driving_license,
        jl.description,
        jl.created_at,
        u.first_name,
        u.last_name,
        u.phone,
        sp.profile_image,
        COALESCE(jl.location_city, sp.location_city) AS location_city,
        COALESCE(jl.location_area, sp.location_area) AS location_area
      FROM job_listings jl
      INNER JOIN service_providers sp ON sp.id = jl.provider_id
      INNER JOIN users u ON u.id = sp.user_id
      WHERE jl.service_type = ? AND jl.is_active = TRUE
      ORDER BY jl.created_at DESC
      LIMIT ? OFFSET ?`,
      [service, limit, offset]
    );

    const countRows = await query(
      'SELECT COUNT(*) as total FROM job_listings WHERE service_type = ? AND is_active = TRUE',
      [service]
    );

    const total = countRows[0]?.total || 0;

    const listings = rows.map(r => ({
      ...r,
      availability_days: safeJsonParse(r.availability_days) || [],
      availability_hours: safeJsonParse(r.availability_hours) || [],
      languages_required: safeJsonParse(r.languages_required) || [],
      full_name: `${r.first_name} ${r.last_name}`,
    }));

    return res.success('OK', { listings, total, page, limit });
  } catch (err) {
    console.error('GET /recruitment/:service error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת מודעות הגיוס' });
  }
});

// =============================================
// POST /api/recruitment
// Créer une offre d'emploi (provider authentifié)
// =============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer le provider_id
    const providers = await query(
      'SELECT id FROM service_providers WHERE user_id = ? AND service_type = ? LIMIT 1',
      [userId, req.body.service_type]
    );

    let providerId;
    if (!providers || providers.length === 0) {
      // Auto-créer un record minimal pour les prestataires inscrits en mode recrutement uniquement
      const created = await query(
        `INSERT INTO service_providers (user_id, service_type, seeking_type) VALUES (?, ?, 'recruitment')`,
        [userId, req.body.service_type]
      );
      providerId = created.insertId;
    } else {
      providerId = providers[0].id;
    }

    const {
      service_type,
      contract_type,
      salary,
      payment_type,
      availability_days,
      availability_hours,
      experience_required,
      languages_required,
      driving_license,
      description,
      location_city,
      location_area,
    } = req.body;

    // Validation basique
    const days  = availability_days  || [];
    const hours = availability_hours || [];
    if (!contract_type || !salary || !payment_type || !description || !experience_required
        || days.length === 0 || hours.length === 0) {
      return res.status(400).json({ success: false, message: 'שדות חובה חסרים' });
    }

    // Vérifier si une offre active existe déjà pour ce provider + service
    const existing = await query(
      'SELECT id FROM job_listings WHERE provider_id = ? AND service_type = ? AND is_active = TRUE LIMIT 1',
      [providerId, service_type]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'כבר קיימת מודעת גיוס פעילה עבור שירות זה' });
    }

    // Mettre à jour seeking_type sur service_providers → toujours 'recruitment'
    await query(
      `UPDATE service_providers SET seeking_type = 'recruitment' WHERE id = ?`,
      [providerId]
    );

    // Si pas de ville fournie, récupérer depuis provider_working_areas (par user_id pour couvrir tous les services)
    let finalCity = location_city || null;
    let finalArea = location_area || null;
    if (!finalCity) {
      // D'abord chercher une ville spécifique (pas "כל ישראל")
      const areas = await query(
        `SELECT pwa.city, pwa.neighborhood
         FROM provider_working_areas pwa
         JOIN service_providers sp ON sp.id = pwa.provider_id
         WHERE sp.user_id = ? AND pwa.city != 'ישראל'
         LIMIT 1`,
        [userId]
      );
      if (areas && areas.length > 0) {
        finalCity = areas[0].city;
        if (!finalArea) finalArea = areas[0].neighborhood || null;
      } else {
        // Fallback : "כל ישראל"
        const allIsrael = await query(
          `SELECT pwa.city, pwa.neighborhood
           FROM provider_working_areas pwa
           JOIN service_providers sp ON sp.id = pwa.provider_id
           WHERE sp.user_id = ?
           LIMIT 1`,
          [userId]
        );
        if (allIsrael && allIsrael.length > 0) {
          // Si city = 'ישראל', utiliser le neighborhood ('כל ישראל') comme city
          finalCity = allIsrael[0].city === 'ישראל' ? allIsrael[0].neighborhood : allIsrael[0].city;
        }
      }
    }

    const result = await query(
      `INSERT INTO job_listings
        (provider_id, service_type, contract_type, salary, payment_type,
         availability_days, availability_hours, experience_required,
         languages_required, driving_license, description, location_city, location_area)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId,
        service_type,
        contract_type,
        salary,
        payment_type,
        JSON.stringify(availability_days || []),
        JSON.stringify(availability_hours || []),
        experience_required,
        JSON.stringify(languages_required || []),
        driving_license ? 1 : 0,
        description,
        finalCity,
        finalArea,
      ]
    );

    return res.status(201).json({ success: true, message: 'מודעת הגיוס נוצרה בהצלחה', data: { id: result.insertId } });
  } catch (err) {
    console.error('POST /recruitment error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה ביצירת מודעת הגיוס' });
  }
});

// =============================================
// PUT /api/recruitment/:id
// Modifier une offre (owner uniquement)
// =============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.id);

    // Vérifier ownership
    const rows = await query(
      `SELECT jl.id FROM job_listings jl
       INNER JOIN service_providers sp ON sp.id = jl.provider_id
       WHERE jl.id = ? AND sp.user_id = ?`,
      [listingId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'מודעה לא נמצאה או אין הרשאה' });
    }

    const {
      contract_type,
      salary,
      payment_type,
      availability_days,
      availability_hours,
      experience_required,
      languages_required,
      driving_license,
      description,
      location_city,
      location_area,
    } = req.body;

    // Si pas de ville fournie, récupérer depuis provider_working_areas (par user_id)
    let finalCityPut = location_city || null;
    let finalAreaPut = location_area || null;
    if (!finalCityPut) {
      const areas = await query(
        `SELECT pwa.city, pwa.neighborhood
         FROM provider_working_areas pwa
         JOIN service_providers sp ON sp.id = pwa.provider_id
         WHERE sp.user_id = ? AND pwa.city != 'ישראל'
         LIMIT 1`,
        [userId]
      );
      if (areas && areas.length > 0) {
        finalCityPut = areas[0].city;
        if (!finalAreaPut) finalAreaPut = areas[0].neighborhood || null;
      } else {
        const allIsrael = await query(
          `SELECT pwa.city, pwa.neighborhood
           FROM provider_working_areas pwa
           JOIN service_providers sp ON sp.id = pwa.provider_id
           WHERE sp.user_id = ?
           LIMIT 1`,
          [userId]
        );
        if (allIsrael && allIsrael.length > 0) {
          finalCityPut = allIsrael[0].city === 'ישראל' ? allIsrael[0].neighborhood : allIsrael[0].city;
        }
      }
    }

    await query(
      `UPDATE job_listings SET
        contract_type = ?,
        salary = ?,
        payment_type = ?,
        availability_days = ?,
        availability_hours = ?,
        experience_required = ?,
        languages_required = ?,
        driving_license = ?,
        description = ?,
        location_city = ?,
        location_area = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        contract_type,
        salary,
        payment_type,
        JSON.stringify(availability_days || []),
        JSON.stringify(availability_hours || []),
        experience_required,
        JSON.stringify(languages_required || []),
        driving_license ? 1 : 0,
        description,
        finalCityPut,
        finalAreaPut,
        listingId,
      ]
    );

    return res.status(200).json({ success: true, message: 'מודעת הגיוס עודכנה בהצלחה' });
  } catch (err) {
    console.error('PUT /recruitment/:id error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה בעדכון מודעת הגיוס' });
  }
});

// =============================================
// DELETE /api/recruitment/:id
// Supprimer (désactiver) une offre
// =============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.id);

    const rows = await query(
      `SELECT jl.id, sp.id as sp_id FROM job_listings jl
       INNER JOIN service_providers sp ON sp.id = jl.provider_id
       WHERE jl.id = ? AND sp.user_id = ?`,
      [listingId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'מודעה לא נמצאה או אין הרשאה' });
    }

    await query('UPDATE job_listings SET is_active = FALSE WHERE id = ?', [listingId]);

    // Si plus aucune offre active, repasser seeking_type à 'clients'
    const spId = rows[0].sp_id;
    const activeListings = await query(
      'SELECT COUNT(*) as cnt FROM job_listings WHERE provider_id = ? AND is_active = TRUE',
      [spId]
    );

    if (activeListings[0].cnt === 0) {
      await query(
        `UPDATE service_providers SET seeking_type = 'clients' WHERE id = ? AND seeking_type = 'recruitment'`,
        [spId]
      );
    }

    return res.status(200).json({ success: true, message: 'מודעת הגיוס נמחקה' });
  } catch (err) {
    console.error('DELETE /recruitment/:id error:', err);
    return res.status(500).json({ success: false, message: 'שגיאה במחיקת מודעת הגיוס' });
  }
});

// =============================================
// Utilitaire JSON parse sécurisé
// =============================================
function safeJsonParse(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

module.exports = router;
