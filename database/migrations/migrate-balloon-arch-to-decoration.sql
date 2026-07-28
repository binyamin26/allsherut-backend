-- =============================================
-- Migration: retrait de "בלוני קשת" (Arche de ballons) de
-- la catégorie event_entertainment ("Autre"), au profit de
-- "קשתות ועיצוב בלונים" (Arches et décoration de ballons)
-- dans event_decoration.
-- Date: 2026-07-27
--
-- NOTE: base de production = TiDB. "dec" est un mot réservé
-- (synonyme de DECIMAL) : ne pas l'utiliser comme alias.
--
-- Étape 1 : pour les prestataires event_entertainment ayant
--   déjà une fiche event_decoration, ajouter la valeur dans
--   leur decoration_types (sans doublon).
-- Étape 2 : pour ceux qui n'ont PAS encore de fiche
--   event_decoration, en créer une nouvelle à partir de leur
--   profil event_entertainment (copie des infos générales),
--   déjà active/vérifiée pour ne rien casser côté visibilité.
-- Étape 3 : retirer "בלוני קשת" de leur other_types
--   event_entertainment.
--
-- Idempotent : peut être ré-exécutée sans effet de bord.
-- =============================================

-- Vérification avant migration :
-- SELECT sp.id, sp.user_id, sp.title
-- FROM service_providers sp
-- WHERE sp.service_type = 'event_entertainment'
--   AND JSON_SEARCH(sp.service_details, 'one', 'בלוני קשת', NULL, '$.other_types') IS NOT NULL;

START TRANSACTION;

-- ÉTAPE 1 : fusion dans une fiche event_decoration existante
UPDATE service_providers edec
JOIN service_providers ent
  ON ent.user_id = edec.user_id
  AND ent.service_type = 'event_entertainment'
SET edec.service_details = JSON_ARRAY_APPEND(
  JSON_SET(
    COALESCE(edec.service_details, JSON_OBJECT()),
    '$.decoration_types',
    COALESCE(JSON_EXTRACT(edec.service_details, '$.decoration_types'), JSON_ARRAY())
  ),
  '$.decoration_types',
  'קשתות ועיצוב בלונים'
)
WHERE edec.service_type = 'event_decoration'
  AND JSON_SEARCH(ent.service_details, 'one', 'בלוני קשת', NULL, '$.other_types') IS NOT NULL
  AND JSON_SEARCH(COALESCE(edec.service_details, JSON_OBJECT()), 'one', 'קשתות ועיצוב בלונים', NULL, '$.decoration_types') IS NULL;

-- ÉTAPE 2 : création d'une nouvelle fiche event_decoration pour ceux qui n'en ont pas
INSERT INTO service_providers (
  user_id, service_type, title, description, experience_years, hourly_rate, currency,
  location_city, location_area, location_address, latitude, longitude,
  availability, languages, certifications, profile_images, profile_image,
  verification_status, verification_date, is_featured, is_active, seeking_type,
  service_details, created_at
)
SELECT
  ent.user_id, 'event_decoration', ent.title, ent.description, ent.experience_years, ent.hourly_rate, ent.currency,
  ent.location_city, ent.location_area, ent.location_address, ent.latitude, ent.longitude,
  ent.availability, ent.languages, ent.certifications, ent.profile_images, ent.profile_image,
  ent.verification_status, ent.verification_date, ent.is_featured, ent.is_active, ent.seeking_type,
  JSON_OBJECT('decoration_types', JSON_ARRAY('קשתות ועיצוב בלונים')), NOW()
FROM service_providers ent
WHERE ent.service_type = 'event_entertainment'
  AND JSON_SEARCH(ent.service_details, 'one', 'בלוני קשת', NULL, '$.other_types') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM service_providers edec2
    WHERE edec2.user_id = ent.user_id AND edec2.service_type = 'event_decoration'
  );

-- ÉTAPE 3 : retrait de "בלוני קשת" du profil event_entertainment
UPDATE service_providers
SET service_details = JSON_REMOVE(
  service_details,
  JSON_UNQUOTE(JSON_SEARCH(service_details, 'one', 'בלוני קשת', NULL, '$.other_types'))
)
WHERE service_type = 'event_entertainment'
  AND JSON_SEARCH(service_details, 'one', 'בלוני קשת', NULL, '$.other_types') IS NOT NULL;

COMMIT;

-- Vérification après migration :
-- SELECT service_type, JSON_EXTRACT(service_details, '$.other_types') AS other_types
-- FROM service_providers WHERE service_type = 'event_entertainment';
-- SELECT service_type, JSON_EXTRACT(service_details, '$.decoration_types') AS decoration_types
-- FROM service_providers WHERE service_type = 'event_decoration';
