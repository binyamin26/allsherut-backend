const { query } = require('./config/database');

async function debugDB() {
  try {
    console.log('🔍 Test de connexion...');
    
    // Test 1: Quelle base ?
    const [db] = await query('SELECT DATABASE() as current_db');
    console.log('📋 Base de données actuelle:', db.current_db);
    
    // Test 2: Quelles tables ?
    const tables = await query('SHOW TABLES');
    console.log('📋 Tables disponibles:', tables.map(t => Object.values(t)[0]));
    
    // Test 3: Table users existe ?
    try {
      const [count] = await query('SELECT COUNT(*) as total FROM users');
      console.log('👥 Nombre d\'utilisateurs:', count.total);
    } catch (error) {
      console.log('❌ Erreur table users:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

debugDB();