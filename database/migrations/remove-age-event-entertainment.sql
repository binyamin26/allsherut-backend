-- Migration: remove age from existing event_entertainment provider profiles
-- Run once against the production database

UPDATE service_providers
SET service_details = JSON_REMOVE(service_details, '$.age')
WHERE service_type = 'event_entertainment'
  AND JSON_EXTRACT(service_details, '$.age') IS NOT NULL;
