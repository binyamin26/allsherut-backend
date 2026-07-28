-- =============================================
-- Migration: séparation de event_entertainment en 3 services
-- (event_entertainment reste "Animations & spectacles" ;
--  ajout de event_equipment_rental et event_food_stands)
-- Date: 2026-07-27
-- =============================================

-- ÉTAPE 1 : Ajouter les 2 nouveaux services dans la table services
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
VALUES
  ('event_equipment_rental', 'השכרת ציוד לאירועים', 'Event Equipment Rental', 'השכרת מכונות מזון, מתנפחים ומכונות אפקטים לאירועים', 'Rental of food machines, inflatables and effect machines for events', '🎪', 199.00),
  ('event_food_stands', 'דוכני מזון לאירועים', 'Event Food Stands', 'דוכני מזון מאוישים לאירועים', 'Staffed food stands for events', '🍿', 199.00);

-- ÉTAPE 2 : Mettre à jour les ENUMs dans toutes les tables concernées
ALTER TABLE users
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE service_providers
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  ) NOT NULL;

ALTER TABLE service_provider_details
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE reviews
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE subscriptions
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

-- NOTE: `review_verifications` and `bookings` do NOT exist in production
-- (confirmed via SHOW TABLES on 2026-07-27 — dead statements carried over
-- from split-private-chef-service.sql that always silently no-op/fail).
-- Real review-verification table is `review_email_tokens`, whose
-- service_type column is a plain VARCHAR(50), not an ENUM — no ALTER needed.

ALTER TABLE trial_history
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','event_equipment_rental','event_food_stands','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

-- Vérification :
-- SELECT service_type, COUNT(*) FROM service_providers GROUP BY service_type;
