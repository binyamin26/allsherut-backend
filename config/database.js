const mysql = require('mysql2/promise');
const config = require('./config');

// Pool de connexions pour optimiser les performances
const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
timezone: '+03:00', // Israël
  
  // Configuration simplifiée pour MySQL2
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  connectTimeout: 30000
});

// Test de connexion avec retry automatique
const testConnection = async () => {
  try {
    console.log('🔄 בדיקת חיבור למסד נתונים...');
    
    // Debug des paramètres de connexion
    console.log('🔧 Paramètres de connexion:', {
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password ? '***masqué***' : '(vide)',
      database: config.database.name
    });
    
    const connection = await pool.getConnection();
    console.log('✅ Connexion MySQL réussie');
    console.log('📊 Informations serveur MySQL:', connection.serverVersion);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur connexion MySQL:', error.message);
    console.error('❌ שגיאה: לא ניתן להתחבר למסד הנתונים');
    
    // Plus de détails sur l'erreur
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Vérifiez les identifiants MySQL dans le fichier .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Vérifiez que MySQL est démarré');
    }
    
    return false;
  }
};

// Fonction helper pour les requêtes - VERSION CORRIGÉE
const query = async (sql, params = []) => {
  try {
    // ✅ Utiliser pool.query au lieu de pool.execute pour éviter les problèmes de prepared statements
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ Erreur requête SQL:', error.message);
    throw error;
  }
};

// Fonction helper pour les transactions
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Fonction pour fermer proprement le pool
const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Pool MySQL fermé proprement');
  } catch (error) {
    console.error('❌ Erreur fermeture pool:', error.message);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool
};