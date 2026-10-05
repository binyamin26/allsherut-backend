// Normalise un numéro WhatsApp saisi par l'utilisateur.
// Retourne null si vide (= même numéro que le téléphone), sinon le numéro sans séparateurs.
const normalizeWhatsappPhone = (value) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/[\s\-(). /]/g, '').slice(0, 20);
  return cleaned || null;
};

module.exports = { normalizeWhatsappPhone };
