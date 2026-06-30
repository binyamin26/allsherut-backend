-- =============================================
-- MIGRATION: Fix experience_required column
-- Converts ENUM to VARCHAR(20) to support
-- '1_year' and '2_years' values added to UI
-- =============================================



ALTER TABLE job_listings
  MODIFY COLUMN experience_required VARCHAR(20) NOT NULL DEFAULT 'beginner';
