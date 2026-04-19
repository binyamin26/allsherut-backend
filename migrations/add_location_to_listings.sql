-- =============================================
-- MIGRATION : Ajout localisation dans job_listings
-- =============================================

USE homesherut_db;

ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(100) NULL COMMENT 'Ville de la mission',
  ADD COLUMN IF NOT EXISTS location_area VARCHAR(100) NULL COMMENT 'Quartier de la mission';
