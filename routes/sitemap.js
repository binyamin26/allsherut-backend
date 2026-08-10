const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

const BASE_URL = 'https://allsherut.com';

// Sitemap dédié aux fiches prestataires (pages générées dynamiquement, absentes
// du sitemap statique public/sitemap.xml qui couvre uniquement les pages
// catégories/services avec leurs variantes hreflang).
router.get('/', async (req, res) => {
  try {
    const providers = await query(
      `SELECT sp.id, sp.updated_at
       FROM service_providers sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.is_active = TRUE AND u.is_active = TRUE AND sp.verification_status = 'verified'
       ORDER BY sp.updated_at DESC
       LIMIT 5000`
    );

    const today = new Date().toISOString().split('T')[0];

    const providerUrls = providers.map(p => {
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : today;
      return `
  <url>
    <loc>${BASE_URL}/provider/${p.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${providerUrls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error.message);
    res.status(500).send('Sitemap generation failed');
  }
});

module.exports = router;
