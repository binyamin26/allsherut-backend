-- =============================================
-- MIGRATION RESET PASSWORD SYSTEM - HOMESHERUT
-- Fichier: backend/scripts/add-reset-tokens-table.sql
-- =============================================

USE homesherut_db;

-- 1. Créer la table password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  tokenHash VARCHAR(64) NOT NULL UNIQUE,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  usedAt DATETIME NULL DEFAULT NULL,
  
  -- Index pour optimiser les recherches
  INDEX idx_token_hash (tokenHash),
  INDEX idx_user_id (userId),
  INDEX idx_expires_at (expiresAt),
  
  -- Clé étrangère vers la table users
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ajouter la colonne tokenVersion à la table users (si elle n'existe pas)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokenVersion INT DEFAULT 0;

-- 3. Ajouter des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(tokenVersion);

-- 4. Nettoyer les tokens expirés (fonction utilitaire)
-- Cette requête sera utilisée périodiquement par le backend
-- DELETE FROM password_reset_tokens WHERE expiresAt < NOW();

-- Vérification que tout est créé
SELECT 'Table password_reset_tokens créée avec succès!' as status;
DESCRIBE password_reset_tokens;