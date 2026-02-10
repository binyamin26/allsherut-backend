const db = require('./config/database');

async function fixImageUrls() {
  try {
    console.log('Ì¥ß Correction des URLs d\'images...');
    
    const result = await db.query(
      `UPDATE service_providers 
       SET profile_image = CONCAT('https://homesherut-backend.onrender.com', profile_image)
       WHERE profile_image LIKE '/uploads/%'`
    );
    
    console.log(`‚úÖ ${result.affectedRows} lignes corrig√©es !`);
    
    // V√©rification
    const check = await db.query(
      `SELECT id, user_id, service_type, profile_image 
       FROM service_providers 
       WHERE profile_image IS NOT NULL 
       LIMIT 10`
    );
    
    console.log('\nÌ≥∏ Aper√ßu des URLs corrig√©es :');
    console.table(check);
    
    process.exit(0);
  } catch (error) {
    console.error('‚ùå Erreur:', error);
    process.exit(1);
  }
}

fixImageUrls();
