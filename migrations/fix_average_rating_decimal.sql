-- Fix: average_rating column was DECIMAL(3,2) max 9.99, but ratings go up to 10
ALTER TABLE service_providers
MODIFY COLUMN average_rating DECIMAL(4,2) DEFAULT 0.00 COMMENT 'Rating moyen (0-10)';
