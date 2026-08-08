-- Migration: add_pricing_is_title
-- Description: Permet d'ajouter des lignes "titre" (en-tête de section, sans tarif) dans la grille tarifaire d'un prestataire
-- Date: 2026-07-30

ALTER TABLE provider_pricing
  ADD COLUMN is_title BOOLEAN NOT NULL DEFAULT FALSE AFTER price;
