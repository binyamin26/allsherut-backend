-- =============================================
-- BACKFILL VERIFICATION STATUS
-- Fichier: backend/migrations/backfill-verification-status.sql
--
-- Marque tous les prestataires déjà inscrits comme "verified" avant
-- d'activer le filtre de visibilité publique sur verification_status,
-- pour qu'ils ne disparaissent pas du site du jour au lendemain.
-- À exécuter UNE SEULE FOIS, avant/au déploiement de cette fonctionnalité.
-- =============================================

UPDATE service_providers
SET verification_status = 'verified'
WHERE verification_status = 'pending';
