const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

// Fonction utilitaire pour les requêtes
async function makeRequest(endpoint, method = 'GET', data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const result = await response.json();
    return { status: response.status, success: response.ok, data: result };
  } catch (error) {
    return { status: 0, success: false, error: error.message };
  }
}

// Tests rapides
async function runQuickTests() {
  console.log('🧪 === TESTS RAPIDES HOMESHERUT ===\n');
  
  let passed = 0, failed = 0;

  // Test 1: Health check
  console.log('🔍 Test 1: Health check...');
  const healthResult = await makeRequest('/health'.replace('/api', ''), 'GET');
  if (healthResult.success && healthResult.data?.database === 'connected') {
    console.log('✅ Health check OK');
    passed++;
  } else {
    console.log('❌ Health check FAILED');
    failed++;
  }

  // Test 2: Services disponibles
  console.log('\n📋 Test 2: Services disponibles...');
  const servicesResult = await makeRequest('/services/available');
  if (servicesResult.success && servicesResult.data?.services?.length === 6) {
    console.log('✅ Services OK -', servicesResult.data.services.length, 'services');
    passed++;
  } else {
    console.log('❌ Services FAILED');
    console.log('   Statut:', servicesResult.status);
    console.log('   Message:', servicesResult.data?.message || servicesResult.error);
    failed++;
  }

  // Test 3: Recherche providers (peut être vide)
  console.log('\n🔍 Test 3: Recherche providers...');
  const searchResult = await makeRequest('/search/providers');
  if (searchResult.success) {
    console.log('✅ Recherche OK -', searchResult.data?.providers?.length || 0, 'providers');
    passed++;
  } else {
    console.log('❌ Recherche FAILED');
    console.log('   Statut:', searchResult.status);
    console.log('   Message:', searchResult.data?.message || searchResult.error);
    failed++;
  }

  // Test 4: Inscription client test
  console.log('\n👤 Test 4: Inscription client...');
  const registerResult = await makeRequest('/auth/register', 'POST', {
    email: 'test.client.' + Date.now() + '@homesherut.co.il',
    password: 'test123456',
    first_name: 'Test',
    last_name: 'Client',
    phone: '0501234567',
    role: 'user'
  });
  
  if (registerResult.success) {
    console.log('✅ Inscription OK');
    console.log('   Token:', registerResult.data?.token ? 'Présent' : 'Manquant');
    passed++;
  } else {
    console.log('❌ Inscription FAILED');
    console.log('   Statut:', registerResult.status);
    console.log('   Message:', registerResult.data?.message || registerResult.error);
    failed++;
  }

  // Test 5: Protection route privée
  console.log('\n🔒 Test 5: Protection routes privées...');
  const protectedResult = await makeRequest('/auth/me');
  if (!protectedResult.success && protectedResult.status === 401) {
    console.log('✅ Protection OK - Accès refusé sans token');
    passed++;
  } else {
    console.log('❌ Protection FAILED - Route non protégée');
    failed++;
  }

  // Résultats
  console.log('\n🏁 === RÉSULTATS ===');
  console.log('✅ Tests réussis:', passed);
  console.log('❌ Tests échoués:', failed);
  console.log('📊 Taux de réussite:', Math.round((passed / (passed + failed)) * 100) + '%');

  if (failed === 0) {
    console.log('\n🎉 Parfait ! Votre API HomeSherut fonctionne correctement !');
    console.log('🚀 Vous pouvez maintenant connecter votre frontend.');
  } else {
    console.log('\n🔧 Quelques ajustements nécessaires pour une compatibilité parfaite.');
  }

  return { passed, failed };
}

// Exécuter les tests
runQuickTests().catch(console.error);