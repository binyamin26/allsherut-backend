-- =============================================
-- SCHÉMA COMPLET HOMESHERUT - Version mise à jour
-- =============================================

-- =============================================
-- Table utilisateurs principale (VERSION COMPLÈTE)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('user', 'client', 'provider', 'admin') DEFAULT 'client',
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare'),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  premium_until DATETIME NULL,
  profile_image VARCHAR(255),
  profile_image_path VARCHAR(255),
  
  -- Nouvelles colonnes pour crédits de contact
  contact_credits_total INT DEFAULT 3,
  contact_credits_used INT DEFAULT 0,
  contact_credits_remaining INT DEFAULT 3,
  
  -- Nouvelle colonne pour gestion tokens
  tokenVersion INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_service_type (service_type),
  INDEX idx_active (is_active),
  INDEX idx_premium (premium_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table services disponibles (configuration)
-- =============================================
CREATE TABLE IF NOT EXISTS services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_key VARCHAR(50) UNIQUE NOT NULL,
  name_he VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_he TEXT,
  description_en TEXT,
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  premium_price DECIMAL(6,2),
  features JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_service_key (service_key),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table profils prestataires (VERSION ÉTENDUE)
-- =============================================
CREATE TABLE IF NOT EXISTS service_providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  title VARCHAR(200),
  description TEXT,
  experience_years INT DEFAULT 0,
  hourly_rate DECIMAL(6,2),
  currency VARCHAR(3) DEFAULT 'ILS',
  location_city VARCHAR(100),
  location_area VARCHAR(100),
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  availability JSON,
  languages JSON,
  certifications JSON,
  profile_images JSON,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  verification_date TIMESTAMP NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INT DEFAULT 0,
  contact_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Nouvelle colonne pour Step 2
  profile_completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_service (user_id, service_type),
  INDEX idx_service_type (service_type),
  INDEX idx_location_city (location_city),
  INDEX idx_verification_status (verification_status),
  INDEX idx_featured (is_featured),
  INDEX idx_active (is_active),
  INDEX idx_location (latitude, longitude),
  INDEX idx_profile_completed (profile_completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table avis/évaluations (VERSION SIMPLIFIÉE POUR PUBLICATION IMMÉDIATE)
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  reviewer_user_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  rating TINYINT CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  comment TEXT,
  service_date DATE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  helpful_count INT DEFAULT 0,
  
  -- Nouvelles colonnes pour système d'avis par email
  reviewer_name VARCHAR(100),
  reviewer_email VARCHAR(255),
  verification_token VARCHAR(64),
  email_verified_at TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_provider_review (reviewer_email, provider_id),
  INDEX idx_provider_id (provider_id),
  INDEX idx_service_type (service_type),
  INDEX idx_rating (rating),
  INDEX idx_verified (is_verified),
  INDEX idx_published (is_published),
  INDEX idx_verification_token (verification_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- NOUVELLE TABLE - Réponses prestataires aux avis
-- =============================================
CREATE TABLE IF NOT EXISTS provider_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  review_id INT NOT NULL,
  provider_id INT NOT NULL,
  response_text TEXT NOT NULL,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_review_response (review_id),
  INDEX idx_review_id (review_id),
  INDEX idx_provider_id (provider_id),
  INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- NOUVELLE TABLE - Détails spécifiques par service (STEP 2)
-- =============================================
CREATE TABLE IF NOT EXISTS service_provider_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  
  -- Champs communs à tous les services
  hourly_rate DECIMAL(6,2),
  experience_description TEXT,
  certifications TEXT,
  languages VARCHAR(255),
  
  -- Champs spécifiques babysitting
  age INT,
  age_groups JSON,
  availability_times JSON,
  can_sleep_over VARCHAR(50),
  has_vehicle VARCHAR(50),
  specific_experience TEXT,
  activities TEXT,
  religious_level VARCHAR(50),
  response_time VARCHAR(50),
  
  -- Champs spécifiques cleaning
  legal_status VARCHAR(50),
  cleaning_types JSON,
  frequency JSON,
  materials_provided VARCHAR(50),
  
  -- Champs spécifiques gardening
  gardening_services JSON,
  seasons JSON,
  equipment JSON,
  specializations JSON,
  horticulture_training TEXT,
  
  -- Champs spécifiques petcare
  animal_types JSON,
  dog_sizes JSON,
  care_location VARCHAR(50),
  vet_services VARCHAR(50),
  walk_exercise VARCHAR(50),
  medication_admin VARCHAR(50),
  max_animals INT,
  outdoor_space VARCHAR(50),
  
  -- Champs spécifiques tutoring
  subjects JSON,
  education_levels JSON,
  qualifications TEXT,
  teaching_mode VARCHAR(50),
  teaching_specializations JSON,
  teaching_languages TEXT,
  
  -- Champs spécifiques eldercare
  care_types JSON,
  certification TEXT,
  availability_schedule JSON,
  specific_conditions JSON,
  administrative_help VARCHAR(50),
  medical_accompaniment VARCHAR(50),
  vehicle_for_outings VARCHAR(50),
  
  -- Services additionnels communs
  additional_services JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_provider_service_details (provider_id, service_type),
  INDEX idx_provider_id (provider_id),
  INDEX idx_service_type (service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- NOUVELLE TABLE - Zones de travail prestataires
-- =============================================
CREATE TABLE IF NOT EXISTS provider_working_areas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  city VARCHAR(100) NOT NULL,
  neighborhood VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  INDEX idx_provider_id (provider_id),
  INDEX idx_city (city),
  INDEX idx_neighborhood (neighborhood)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- NOUVELLE TABLE - Tokens reset password
-- =============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  tokenHash VARCHAR(64) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  usedAt TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_tokenHash (tokenHash),
  INDEX idx_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table contacts/messages
-- =============================================
CREATE TABLE IF NOT EXISTS contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  client_user_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  message TEXT,
  service_date DATE,
  service_time VARCHAR(20),
  contact_method ENUM('phone', 'email', 'message') DEFAULT 'message',
  status ENUM('pending', 'responded', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_provider_id (provider_id),
  INDEX idx_client_id (client_user_id),
  INDEX idx_service_type (service_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table abonnements premium
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  plan_type ENUM('monthly', 'yearly') DEFAULT 'monthly',
  amount DECIMAL(6,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ILS',
  status ENUM('active', 'cancelled', 'expired', 'pending') DEFAULT 'pending',
  payment_method ENUM('bit_pay', 'tranzila', 'paypal') NOT NULL,
  payment_transaction_id VARCHAR(255),
  starts_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_service_type (service_type),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Table villes/localisations israéliennes
-- =============================================
CREATE TABLE IF NOT EXISTS locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  city_name_he VARCHAR(100) NOT NULL,
  city_name_en VARCHAR(100) NOT NULL,
  region_he VARCHAR(100),
  region_en VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  population INT,
  is_major_city BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_city_he (city_name_he),
  INDEX idx_city_en (city_name_en),
  INDEX idx_region (region_he),
  INDEX idx_major_city (is_major_city),
  INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- NOUVELLE TABLE - Tokens de vérification email pour avis
-- =============================================
CREATE TABLE IF NOT EXISTS review_verification_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  provider_id INT NOT NULL,
  service_type ENUM('babysitting', 'cleaning', 'gardening', 'petcare', 'tutoring', 'eldercare') NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  reviewer_name VARCHAR(100),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  INDEX idx_email (email),
  INDEX idx_provider_id (provider_id),
  INDEX idx_verification_code (verification_code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Insertion des services de base
-- =============================================
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price) VALUES
('babysitting', 'בייביסיטר', 'Babysitting', 'שירותי שמירה על ילדים מקצועיים', 'Professional childcare services', '👶', 29.90),
('cleaning', 'ניקיון', 'Cleaning', 'שירותי ניקיון לבית ומשרד', 'Home and office cleaning services', '🧹', 19.90),
('gardening', 'גינון', 'Gardening', 'עיצוב וטיפוח גינות', 'Garden design and maintenance', '🌱', 24.90),
('petcare', 'שמירת חיות', 'Pet Care', 'טיפול בחיות מחמד', 'Pet care and sitting services', '🐕', 27.90),
('tutoring', 'שיעורים פרטיים', 'Tutoring', 'חיזוק לימודי אישי', 'Private tutoring and academic support', '📚', 22.90),
('eldercare', 'עזרה לקשישים', 'Elder Care', 'ליווי וסיוע לקשישים', 'Elder care and assistance services', '👵', 34.90);

-- =============================================
-- Insertion des principales villes israéliennes
-- =============================================
INSERT IGNORE INTO locations (city_name_he, city_name_en, region_he, region_en, is_major_city, latitude, longitude) VALUES
('תל אביב', 'Tel Aviv', 'מרכז', 'Central', TRUE, 32.0853, 34.7818),
('ירושלים', 'Jerusalem', 'ירושלים', 'Jerusalem', TRUE, 31.7683, 35.2137),
('חיפה', 'Haifa', 'צפון', 'North', TRUE, 32.7940, 34.9896),
('ראשון לציון', 'Rishon LeZion', 'מרכז', 'Central', TRUE, 31.9730, 34.8086),
('פתח תקווה', 'Petah Tikva', 'מרכז', 'Central', TRUE, 32.0870, 34.8876),
('אשדוד', 'Ashdod', 'דרום', 'South', TRUE, 31.7940, 34.6555),
('נתניה', 'Netanya', 'מרכז', 'Central', TRUE, 32.3215, 34.8532),
('בני ברק', 'Bnei Brak', 'מרכז', 'Central', FALSE, 32.0819, 34.8291),
('חולון', 'Holon', 'מרכז', 'Central', FALSE, 32.0178, 34.7804),
('רמת גן', 'Ramat Gan', 'מרכז', 'Central', FALSE, 32.0719, 34.8236);

-- =============================================
-- Index composites pour optimiser les recherches
-- =============================================
CREATE INDEX IF NOT EXISTS idx_provider_service_location ON service_providers(service_type, location_city, is_active);
CREATE INDEX IF NOT EXISTS idx_provider_rating ON service_providers(service_type, verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_rating ON reviews(provider_id, rating, is_published);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id, service_type, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reviews_with_responses ON reviews(provider_id, is_published, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_responses_review ON provider_responses(review_id, is_published);

-- =============================================
-- NETTOYAGE - Supprimer les anciens utilisateurs de test si nécessaires
-- =============================================
-- DELETE FROM users WHERE email LIKE '%@example.com';

-- =============================================
-- VUES UTILES POUR DÉVELOPPEMENT
-- =============================================

-- Vue pour les avis avec réponses prestataires
CREATE OR REPLACE VIEW reviews_with_responses AS
SELECT 
  r.*,
  pr.response_text as provider_response,
  pr.created_at as response_created_at,
  sp.title as provider_title,
  u.first_name as provider_first_name,
  u.last_name as provider_last_name
FROM reviews r
LEFT JOIN provider_responses pr ON r.id = pr.review_id AND pr.is_published = TRUE
JOIN service_providers sp ON r.provider_id = sp.id
JOIN users u ON sp.user_id = u.id
WHERE r.is_published = TRUE
ORDER BY r.created_at DESC;

-- Vue pour profils prestataires complets
CREATE OR REPLACE VIEW providers_complete AS
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.service_type,
  sp.*,
  spd.hourly_rate as details_rate,
  spd.experience_description,
  GROUP_CONCAT(DISTINCT CONCAT(pwa.city, ' - ', pwa.neighborhood) SEPARATOR '; ') as working_areas_text
FROM users u
JOIN service_providers sp ON u.id = sp.user_id
LEFT JOIN service_provider_details spd ON sp.id = spd.provider_id
LEFT JOIN provider_working_areas pwa ON sp.id = pwa.provider_id
WHERE u.role = 'provider' AND u.is_active = TRUE AND sp.is_active = TRUE
GROUP BY u.id, sp.id;

-- =============================================
-- PROCÉDURES STOCKÉES UTILES
-- =============================================

DELIMITER //

-- Procédure pour nettoyer les tokens expirés
CREATE OR REPLACE PROCEDURE CleanExpiredTokens()
BEGIN
    DELETE FROM password_reset_tokens WHERE expiresAt < NOW() OR usedAt IS NOT NULL;
    DELETE FROM review_verification_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL;
END //

-- Procédure pour obtenir les statistiques d'un prestataire
CREATE OR REPLACE PROCEDURE GetProviderStats(IN provider_user_id INT)
BEGIN
    SELECT 
        COUNT(r.id) as total_reviews,
        AVG(r.rating) as average_rating,
        COUNT(pr.id) as total_responses,
        ROUND((COUNT(pr.id) / COUNT(r.id)) * 100, 2) as response_rate_percentage,
        sp.view_count,
        sp.contact_count,
        u.created_at as member_since
    FROM users u
    JOIN service_providers sp ON u.id = sp.user_id
    LEFT JOIN reviews r ON sp.id = r.provider_id AND r.is_published = TRUE
    LEFT JOIN provider_responses pr ON r.id = pr.review_id AND pr.is_published = TRUE
    WHERE u.id = provider_user_id AND u.role = 'provider';
END //

DELIMITER ;

-- =============================================
-- TRIGGERS UTILES
-- =============================================

DELIMITER //

-- Trigger pour maintenir contact_credits_remaining à jour
CREATE OR REPLACE TRIGGER update_credits_remaining 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.contact_credits_total != OLD.contact_credits_total OR 
       NEW.contact_credits_used != OLD.contact_credits_used THEN
        UPDATE users 
        SET contact_credits_remaining = GREATEST(0, NEW.contact_credits_total - NEW.contact_credits_used)
        WHERE id = NEW.id;
    END IF;
END //

-- Trigger pour incrémenter view_count des prestataires
CREATE OR REPLACE TRIGGER increment_provider_views
AFTER INSERT ON contacts
FOR EACH ROW
BEGIN
    UPDATE service_providers 
    SET view_count = view_count + 1,
        contact_count = contact_count + 1
    WHERE id = NEW.provider_id;
END //

DELIMITER ;

-- =============================================
-- COMMENTAIRES DE MAINTENANCE
-- =============================================

/*
NOTES IMPORTANTES :

1. Ce schéma inclut toutes les tables nécessaires pour :
   - Inscription utilisateurs (clients et prestataires)
   - Système d'avis avec vérification email
   - Réponses prestataires aux avis
   - Step 2 complet pour prestataires
   - Reset password sécurisé
   - Zones de travail prestataires
   - Crédits de contact pour clients

2. Pour supprimer les utilisateurs de test :
   Décommente la ligne : DELETE FROM users WHERE email LIKE '%@example.com';

3. Pour surveillance performance :
   - Utilise les vues créées pour requêtes complexes
   - Lance CleanExpiredTokens() périodiquement
   - Surveille les index sur les tables à forte croissance

4. Extensions futures possibles :
   - Notifications push (table notifications)
   - Messages intégrés (table messages)
   - Favoris utilisateurs (table favorites)
   - Analytics détaillées (table analytics_events)

VERSION : 2025-09-16 - Schema complet avec système réponses prestataires
*/