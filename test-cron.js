const cronService = require('./services/cronService');

(async () => {
  console.log('🧪 Test manuel du système d\'expiration...\n');
  
  console.log('📧 Vérification emails J-7 et J-3...');
  await cronService.checkExpiringSubscriptions();
  
  console.log('\n⏰ Vérification abonnements expirés...');
  await cronService.checkExpiredSubscriptions();
  
  console.log('\n🗑️ Vérification comptes à supprimer...'); // ✅ NOUVEAU
  await cronService.deleteScheduledAccounts(); // ✅ NOUVEAU
  
  console.log('\n✅ Test terminé avec succès!');
  process.exit(0);
})();