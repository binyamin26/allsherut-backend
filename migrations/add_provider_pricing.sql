-- Migration: add_provider_pricing
-- Description: Table pour les grilles tarifaires des prestataires
-- Date: 2026-06-07

CREATE TABLE IF NOT EXISTS provider_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  service_name VARCHAR(200) NOT NULL,
  price VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  INDEX idx_provider_id (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
