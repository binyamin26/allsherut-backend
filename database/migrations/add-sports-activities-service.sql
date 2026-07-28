-- =============================================
-- Migration: Séparation tutoring → sports_activities
-- Date: 2026-05-13
--
-- Ce script :
-- 1. Ajoute sports_activities dans la table services
-- 2. Crée les sous-catégories pour sports_activities
-- 3. Met à jour les ENUMs pour inclure sports_activities
-- 4. Migre les providers tutoring dont les sujets sont
--    uniquement sports/activités → sports_activities
-- =============================================

-- =============================================
-- ÉTAPE 1 : Ajouter le service sports_activities
-- =============================================
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
VALUES ('sports_activities', 'חוגים וספורט', 'Sports & Activities', 'שיעורי ספורט, חוגים ופעילויות לכל הגילאים', 'Sports lessons, classes and activities for all ages', '⚽', 22.90);

-- =============================================
-- ÉTAPE 2 : Copier les sous-catégories pertinentes
--           de tutoring vers sports_activities
-- Ranges sports_activities : 1-7, 10-16, 20-24, 30-33,
--                            50-54, 70-74, 80-89, 90-119
-- (exclut : 40-47 langues, 60-64 tech, 200-223 académique)
-- =============================================
INSERT IGNORE INTO service_subcategories (service_id, name_he, name_en, name_fr, name_ru, icon, display_order, is_active)
SELECT
  (SELECT id FROM services WHERE service_key = 'sports_activities'),
  sc.name_he,
  sc.name_en,
  sc.name_fr,
  sc.name_ru,
  sc.icon,
  sc.display_order,
  sc.is_active
FROM service_subcategories sc
WHERE sc.service_id = (SELECT id FROM services WHERE service_key = 'tutoring')
  AND (
    (sc.display_order BETWEEN 1   AND 7)    -- מוזיקה
    OR (sc.display_order BETWEEN 10  AND 16)   -- אמנות
    OR (sc.display_order BETWEEN 20  AND 24)   -- מחול
    OR (sc.display_order BETWEEN 30  AND 33)   -- תיאטרון
    OR (sc.display_order BETWEEN 50  AND 54)   -- יצירה
    OR (sc.display_order BETWEEN 70  AND 74)   -- בישול
    OR (sc.display_order BETWEEN 80  AND 89)   -- פיתוח אישי
    OR (sc.display_order BETWEEN 90  AND 119)  -- ספורט
  );

-- =============================================
-- ÉTAPE 3 : Mettre à jour les ENUMs
--           (uniquement si pas déjà présent)
-- =============================================

-- users.service_type
ALTER TABLE users
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- service_providers.service_type
ALTER TABLE service_providers
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  ) NOT NULL;

-- service_provider_details.service_type
ALTER TABLE service_provider_details
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- reviews.service_type
ALTER TABLE reviews
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- subscriptions.service_type
ALTER TABLE subscriptions
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- review_verifications.service_type (si la table existe)
ALTER TABLE review_verifications
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- bookings.service_type (si la table existe)
ALTER TABLE bookings
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare',
    'tutoring','sports_activities','eldercare'
  );

-- =============================================
-- ÉTAPE 4 : Migration des providers
--
-- Logique : un provider tutoring doit passer à
-- sports_activities si AUCUN de ses sujets
-- n'appartient aux catégories purement académiques
-- (langues 40-47, tech 60-64, académique 200-223)
--
-- ⚠️  VÉRIFICATION D'ABORD (SELECT) avant UPDATE
-- =============================================

-- ── 4a. Voir quels providers seraient migrés ──────────
-- (à exécuter manuellement pour vérifier avant le UPDATE)
/*
SELECT
  sp.id              AS provider_id,
  u.first_name,
  u.last_name,
  u.email,
  spd.subjects
FROM service_providers sp
JOIN users u ON u.id = sp.user_id
LEFT JOIN service_provider_details spd
  ON spd.provider_id = sp.id AND spd.service_type = 'tutoring'
WHERE sp.service_type = 'tutoring'
  AND (
    spd.subjects IS NULL
    OR spd.subjects = '[]'
    OR NOT EXISTS (
      SELECT 1
      FROM service_subcategories sc
      WHERE sc.service_id = (SELECT id FROM services WHERE service_key = 'tutoring')
        AND (
          (sc.display_order BETWEEN 40  AND 47)   -- langues
          OR (sc.display_order BETWEEN 60  AND 64)   -- tech
          OR (sc.display_order BETWEEN 200 AND 223)  -- académique
        )
        AND JSON_CONTAINS(spd.subjects, JSON_QUOTE(sc.name_he))
    )
  );
*/

-- ── 4b. Migrer service_providers ──────────────────────
UPDATE service_providers sp
LEFT JOIN service_provider_details spd
  ON spd.provider_id = sp.id AND spd.service_type = 'tutoring'
SET sp.service_type = 'sports_activities'
WHERE sp.service_type = 'tutoring'
  AND (
    spd.subjects IS NULL
    OR spd.subjects = '[]'
    OR NOT EXISTS (
      SELECT 1
      FROM service_subcategories sc
      WHERE sc.service_id = (SELECT id FROM services WHERE service_key = 'tutoring')
        AND (
          (sc.display_order BETWEEN 40  AND 47)
          OR (sc.display_order BETWEEN 60  AND 64)
          OR (sc.display_order BETWEEN 200 AND 223)
        )
        AND JSON_CONTAINS(spd.subjects, JSON_QUOTE(sc.name_he))
    )
  );

-- ── 4c. Migrer service_provider_details ───────────────
UPDATE service_provider_details spd
JOIN service_providers sp ON sp.id = spd.provider_id
SET spd.service_type = 'sports_activities'
WHERE spd.service_type = 'tutoring'
  AND sp.service_type = 'sports_activities';

-- ── 4d. Migrer users.service_type ─────────────────────
-- (uniquement si c'est leur seul service)
UPDATE users u
JOIN service_providers sp ON sp.user_id = u.id
SET u.service_type = 'sports_activities'
WHERE u.service_type = 'tutoring'
  AND sp.service_type = 'sports_activities'
  AND NOT EXISTS (
    SELECT 1 FROM service_providers sp2
    WHERE sp2.user_id = u.id AND sp2.service_type = 'tutoring'
  );

-- ── 4e. Migrer subscriptions ──────────────────────────
UPDATE subscriptions sub
JOIN users u ON u.id = sub.user_id
SET sub.service_type = 'sports_activities'
WHERE sub.service_type = 'tutoring'
  AND u.service_type = 'sports_activities';

-- =============================================
-- FIN DE MIGRATION
-- =============================================
-- Vérifier les résultats :
-- SELECT service_type, COUNT(*) FROM service_providers GROUP BY service_type;
-- SELECT service_type, COUNT(*) FROM users WHERE role='provider' GROUP BY service_type;
