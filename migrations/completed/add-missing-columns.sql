-- =============================================
-- MIGRATION SIMPLIFIÉE HOMESHERUT - Seulement les manques
-- Fichier: backend/migrations/add-missing-columns.sql
-- =============================================

USE homesherut_db;

-- =============================================
-- 1. AJOUT COLONNES MANQUANTES DANS USERS (si elles n'existent pas)
-- =============================================

-- Crédits de contact pour clients
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS contact_credits_total INT DEFAULT 3 COMMENT 'Crédits de contact par mois';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS contact_credits_used INT DEFAULT 0 COMMENT 'Crédits utilisés ce mois';

-- Token versioning pour sécurité
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tokenVersion INT DEFAULT 0 COMMENT 'Version token pour invalidation';

-- Path image profil
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image_path VARCHAR(255) NULL COMMENT 'Chemin image profil';

-- =============================================
-- 2. AJOUT COLONNES MANQUANTES DANS SERVICE_PROVIDERS
-- =============================================

ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE COMMENT 'Profil complété';

ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00 COMMENT 'Rating moyen';

ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS total_reviews INT DEFAULT 0 COMMENT 'Nombre total avis';

-- =============================================  
-- 3. INSERTION DONNÉES DE TEST DANS SERVICE_PROVIDER_DETAILS
-- =============================================

-- Fatima (ID 7, cleaning)
INSERT IGNORE INTO service_provider_details (
  provider_id, service_type, hourly_rate, experience_description, 
  legal_status, cleaning_types, frequency, materials_provided
) VALUES (
  7, 'cleaning', 20.00, 'ניקיון מקצועי של בתים ומשרדים עם ניסיון של 3 שנים',
  'עצמאי', '["regular", "deep"]', '["weekly", "biweekly"]', 'no'
);

-- Rachel (ID 8, babysitting)
INSERT IGNORE INTO service_provider_details (
  provider_id, service_type, hourly_rate, experience_description,
  age, experience_years, age_groups, can_sleep_over, has_vehicle, religious_level
) VALUES (
  8, 'babysitting', 25.00, 'שמירה על ילדים באהבה ומקצועיות עם ניסיון של 3 שנים',
  28, 3, '["3-5", "6-10"]', 'no', 'yes', 'מסורתי'
);

-- Ahmed (ID 9, gardening)  
INSERT IGNORE INTO service_provider_details (
  provider_id, service_type, hourly_rate, experience_description,
  gardening_services, seasons, equipment
) VALUES (
  9, 'gardening', 18.00, 'עיצוב וטיפוח גינות פרטיות ומסחריות',
  '["lawn_care", "planting", "pruning"]', '["spring", "summer", "fall"]', '["mower", "trimmer"]'
);

-- =============================================
-- 4. INSERTION ZONES DE TRAVAIL DANS PROVIDER_WORKING_AREAS  
-- =============================================

-- Zones pour Fatima (cleaning)
INSERT IGNORE INTO provider_working_areas (provider_id, city, neighborhood) VALUES
(7, 'תל אביב', 'פלורנטין'),
(7, 'תל אביב', 'נווה צדק'),
(7, 'תל אביב', 'שפירא');

-- Zones pour Rachel (babysitting)
INSERT IGNORE INTO provider_working_areas (provider_id, city, neighborhood) VALUES  
(8, 'תל אביב', 'רמת אביב'),
(8, 'תל אביב', 'צהלה'),
(8, 'רמת גן', NULL);

-- Zones pour Ahmed (gardening)
INSERT IGNORE INTO provider_working_areas (provider_id, city, neighborhood) VALUES
(9, 'תל אביב', 'יפו'),
(9, 'תל אביב', 'עג\'מי'),
(9, 'בת ים', NULL);

-- =============================================
-- 5. MISE À JOUR DES PROVIDERS EXISTANTS
-- =============================================

-- Marquer profils comme complétés
UPDATE service_providers 
SET profile_completed = TRUE 
WHERE id IN (7, 8, 9);

-- Calculer ratings (même si 0 pour l'instant)
UPDATE service_providers sp
SET average_rating = COALESCE((
  SELECT AVG(r.rating) 
  FROM reviews r 
  WHERE r.provider_id = sp.id AND r.is_published = TRUE
), 0),
total_reviews = COALESCE((
  SELECT COUNT(*) 
  FROM reviews r 
  WHERE r.provider_id = sp.id AND r.is_published = TRUE
), 0)
WHERE id IN (7, 8, 9);

-- =============================================
-- 6. CRÉATION D'INDEX POUR PERFORMANCES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_credits ON users(contact_credits_used, contact_credits_total);
CREATE INDEX IF NOT EXISTS idx_provider_completed ON service_providers(profile_completed);
CREATE INDEX IF NOT EXISTS idx_provider_rating ON service_providers(average_rating);
CREATE INDEX IF NOT EXISTS idx_provider_details_provider ON service_provider_details(provider_id);
CREATE INDEX IF NOT EXISTS idx_working_areas_provider ON provider_working_areas(provider_id);

-- =============================================
-- 7. VÉRIFICATIONS FINALES
-- =============================================

SELECT 'Migration terminée avec succès!' as status;

-- Vérifier les données insérées
SELECT 'Vérification des données:' as info;

SELECT 
  sp.id,
  sp.service_type,
  sp.profile_completed,
  spd.hourly_rate,
  COUNT(pwa.id) as zones_travail
FROM service_providers sp
LEFT JOIN service_provider_details spd ON sp.id = spd.provider_id
LEFT JOIN provider_working_areas pwa ON sp.id = pwa.provider_id  
WHERE sp.id IN (7, 8, 9)
GROUP BY sp.id;

-- Vérifier colonnes users
SELECT 
  id, 
  email,
  contact_credits_total,
  contact_credits_used,
  tokenVersion
FROM users 
WHERE role = 'provider' 
LIMIT 3;