const db = require('./config/database');

async function fixRemainingUrls() {
  try {
    console.log('Ì¥ß Correction des URLs restantes...');
    
    const result = await db.query(
      `UPDATE service_providers 
       SET profile_image = CONCAT('https://homesherut-backend.onrender.com/', profile_image)
       WHERE profile_image LIKE 'uploads/%' 
       AND profile_image NOT LIKE 'https://%'`
    );
    
    console.log(`‚úÖ ${result.affectedRows} lignes suppl√©mentaires corrig√©es !`);
    
    // V√©rification finale
    const check = await db.query(
      `SELECT id, user_id, service_type, profile_image 
       FROM service_providers 
       WHERE profile_image IS NOT NULL`
    );
    
    console.log('\nÌ≥∏ TOUTES les URLs (v√©rification finale) :');
    console.table(check);
    
    process.exit(0);
  } catch (error) {
    console.error('‚ùå Erreur:', error);
    process.exit(1);
  }
}

fixRemainingUrls();
