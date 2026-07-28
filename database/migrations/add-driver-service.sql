-- =============================================
-- Migration: Ajout du service driver (דרייבר פרטי)
-- Date: 2026-06-16
-- =============================================

-- ÉTAPE 1 : Ajouter le service dans la table services
INSERT IGNORE INTO services (service_key, name_he, name_en, description_he, description_en, icon, premium_price)
VALUES ('driver', 'דרייבר פרטי', 'Private Driver', 'שירות נסיעות פרטי – דרייבר אישי עד הדלת', 'Personal driver service – private taxi to your door', '🚗', 22.90);

-- ÉTAPE 2 : Mettre à jour les ENUMs dans toutes les tables concernées

ALTER TABLE users
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE service_providers
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  ) NOT NULL;

ALTER TABLE service_provider_details
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE reviews
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE subscriptions
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE review_verifications
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE bookings
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

ALTER TABLE trial_history
  MODIFY COLUMN service_type ENUM(
    'babysitting','cleaning','gardening','petcare','tutoring','sports_activities',
    'eldercare','laundry','property_management','electrician','plumbing',
    'air_conditioning','gas_technician','drywall','carpentry','home_organization',
    'event_entertainment','dj','private_chef','painting','waterproofing',
    'contractor','aluminum','glass_works','locksmith','moving','photographer',
    'event_decoration','pest_control','handyman','mechanic','metalwork','driver'
  );

-- Vérification :
-- SELECT service_type, COUNT(*) FROM service_providers GROUP BY service_type;
