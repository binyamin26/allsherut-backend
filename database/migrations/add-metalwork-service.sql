-- =============================================
-- Migration: Ajout du service metalwork (מסגרות)
-- Date: 2026-06-15
-- =============================================

-- ÉTAPE 1 : Ajouter le service dans la table services
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
VALUES ('metalwork', 'מסגרות', 'Metalwork', 'סורגים, מעקות וגדרות מקצועיים', 'Professional bars, railings and fences', '🔩', 22.90);

-- ÉTAPE 2 : Mettre à jour les ENUMs dans toutes les tables concernées

ALTER TABLE users
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

ALTER TABLE service_providers
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  ) NOT NULL;

ALTER TABLE service_provider_details
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

ALTER TABLE reviews
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

ALTER TABLE subscriptions
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

ALTER TABLE review_verifications
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

ALTER TABLE bookings
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork'
  );

-- Vérification :
-- SELECT service_type, COUNT(*) FROM service_providers GROUP BY service_type;
