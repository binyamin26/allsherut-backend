-- =============================================
-- MIGRATION RECRUTEMENT HOMESHERUT
-- Fichier: backend/migrations/add_recruitment.sql
-- =============================================

USE homesherut_db;

-- 1. Ajout seeking_type sur service_providers (safe : ignore si déjà existant)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'homesherut_db'
    AND TABLE_NAME = 'service_providers'
    AND COLUMN_NAME = 'seeking_type'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE service_providers ADD COLUMN seeking_type ENUM(''clients'', ''recruitment'', ''both'') DEFAULT ''clients'' COMMENT ''Objectif du prestataire''',
  'SELECT ''seeking_type already exists'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Nouvelle table job_listings
CREATE TABLE IF NOT EXISTS job_listings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  service_type VARCHAR(50) NOT NULL,

  -- Type de contrat
  contract_type ENUM('full_time', 'part_time', 'one_time') NOT NULL,

  -- Rémunération
  salary VARCHAR(100) NOT NULL        COMMENT 'Ex: 50₪/heure ou 8000₪/mois',
  payment_type ENUM('hourly', 'daily', 'monthly') NOT NULL,

  -- Disponibilité
  availability_days JSON              COMMENT 'Tableau de jours ["ראשון","שני",...]',
  availability_hours JSON             COMMENT 'Tableau de créneaux ["בוקר","ערב",...]',

  -- Profil recherché
  experience_required ENUM('beginner', '1_2_years', '3_plus_years') NOT NULL DEFAULT 'beginner',
  languages_required JSON             COMMENT 'Langues optionnelles',
  driving_license BOOLEAN DEFAULT FALSE,

  -- Description
  description TEXT NOT NULL,

  -- Statut
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  INDEX idx_service_type (service_type),
  INDEX idx_provider (provider_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
