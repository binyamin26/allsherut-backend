const express = require('express');
const rateLimit = require('express-rate-limit');
const emailService = require('../services/emailService');

const router = express.Router();

// Reçoit les erreurs d'affichage du site (page blanche évitée par l'ErrorBoundary du frontend)
// et prévient l'admin par email. Route publique : tout est borné pour éviter le spam
// (taille des champs, limite par IP, dédoublonnage, plafond global d'emails par heure).

const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // une même erreur = 1 email max / 6 h
const MAX_EMAILS_PER_HOUR = 10;              // plafond global, quoi qu'il arrive
const HOUR_MS = 60 * 60 * 1000;
const BOT_UA = /bot|crawler|spider|crawling|lighthouse|headless/i;

const seen = new Map();   // signature -> { firstAt, lastEmailAt, count }
let sentTimestamps = [];  // horodatages des emails envoyés sur la dernière heure

const perIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reports' }
});

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

const cleanup = (now) => {
  sentTimestamps = sentTimestamps.filter((t) => now - t < HOUR_MS);
  for (const [sig, entry] of seen) {
    if (now - entry.lastEmailAt > DEDUPE_WINDOW_MS) seen.delete(sig);
  }
};

router.post('/', perIpLimiter, async (req, res) => {
  // Toujours répondre vite et sans détail : le visiteur n'a pas à attendre l'email.
  res.json({ success: true });

  try {
    const message = clip(req.body?.message, 500);
    if (!message) return;

    const report = {
      message,
      stack: clip(req.body?.stack, 1500),
      componentStack: clip(req.body?.componentStack, 1500),
      url: clip(req.body?.url, 300),
      language: clip(req.body?.language, 10),
      userAgent: clip(req.get('User-Agent'), 300),
      time: new Date().toISOString()
    };

    // Robots (Googlebot, etc.) : pas d'alerte, ce n'est pas un visiteur. Filtre aussi côté serveur
    // pour les anciens bundles frontend encore en cache qui ne filtrent pas.
    if (BOT_UA.test(report.userAgent)) return;

    const now = Date.now();
    cleanup(now);

    const firstStackLine = report.stack.split('\n')[1] || '';
    const signature = `${message}|${firstStackLine}`.slice(0, 400);
    const entry = seen.get(signature);
    if (entry) {
      entry.count += 1;
      return; // déjà signalée récemment
    }

    if (sentTimestamps.length >= MAX_EMAILS_PER_HOUR) {
      console.warn(`[client-errors] plafond d'emails atteint, erreur non envoyée: ${message}`);
      return;
    }

    seen.set(signature, { firstAt: now, lastEmailAt: now, count: 1 });
    sentTimestamps.push(now);
    console.error('[client-errors]', report.message, '|', report.url);
    await emailService.sendClientErrorEmail(report);
  } catch (err) {
    console.error('[client-errors] échec du traitement:', err.message);
  }
});

module.exports = router;
