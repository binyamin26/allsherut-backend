-- Migration: add 4 category ratings (1-10) to reviews table
-- Run once against the production database

ALTER TABLE reviews
  MODIFY COLUMN rating DECIMAL(4,2) NULL,
  ADD COLUMN quality_rating       TINYINT NULL CHECK (quality_rating       >= 1 AND quality_rating       <= 10),
  ADD COLUMN price_rating         TINYINT NULL CHECK (price_rating         >= 1 AND price_rating         <= 10),
  ADD COLUMN availability_rating  TINYINT NULL CHECK (availability_rating  >= 1 AND availability_rating  <= 10),
  ADD COLUMN professionalism_rating TINYINT NULL CHECK (professionalism_rating >= 1 AND professionalism_rating <= 10);
