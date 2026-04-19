-- =============================================
-- MIGRATION: Fix service_type columns to VARCHAR
-- Allows all 23+ service types without ENUM limits
-- =============================================

USE homesherut_db;

-- Fix service_providers.service_type (old ENUM had only 6 services)
ALTER TABLE service_providers
  MODIFY COLUMN service_type VARCHAR(50) NOT NULL;
