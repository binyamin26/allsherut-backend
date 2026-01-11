const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('🔄 Test connexion étape par étape...');
    
    // Test 1: Connexion sans base de données
    console.log('\n1️⃣ Test connexion serveur MySQL...');
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'rootpassword'
      // PAS de database
    });
    console.log('✅ Connexion serveur OK');
    
    // Test 2: Lister toutes les bases
    console.log('\n2️⃣ Liste des bases de données:');
    const [databases] = await connection.execute('SHOW DATABASES');
    databases.forEach(db => {
      console.log('   📁', Object.values(db)[0]);
    });
    
    // Test 3: Vérifier si homesherut_db existe
    const dbExists = databases.some(db => Object.values(db)[0] === 'homesherut_db');
    console.log('\n3️⃣ homesherut_db existe?', dbExists ? '✅ OUI' : '❌ NON');
    
    if (!dbExists) {
      console.log('\n🔧 Création de la base...');
      await connection.execute('CREATE DATABASE homesherut_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      console.log('✅ Base créée');
    }
    
    // Test 4: Connexion à la base
    await connection.execute('USE homesherut_db');
    console.log('✅ Connexion à homesherut_db OK');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error('Code:', error.code);
  }
}

testConnection();