-- =============================================
-- Migration: Séparation de private_chef en 3 services
-- (catering / private_chef / pastry)
-- Date: 2026-07-13
-- =============================================

-- ÉTAPE 1 : Ajouter les 2 nouveaux services dans la table services
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
VALUES
  ('catering', 'קייטרינג לאירועים', 'Catering for Events', 'שירותי קייטרינג מקצועיים לאירועים וארוחות', 'Professional catering services for events and meals', '🍽️', 199.00),
  ('pastry', 'עוגות ופטיסרי', 'Cakes & Pastry', 'עוגות, פטיסרי וקינוחים מעוצבים לאירועים ולבית', 'Cakes, pastry and desserts for events and home', '🎂', 199.00);

-- ÉTAPE 2 : Mettre à jour les ENUMs dans toutes les tables concernées
ALTER TABLE users
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE service_providers
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  ) NOT NULL;

ALTER TABLE service_provider_details
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE reviews
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE subscriptions
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE review_verifications
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE bookings
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

ALTER TABLE trial_history
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver',
    'catering','pastry'
  );

-- Vérification :
-- SELECT service_type, COUNT(*) FROM service_providers GROUP BY service_type;
