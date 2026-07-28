const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

const BASE_URL = 'https://www.allsherut.com';

const STATIC_ROUTES = [
  { path: '/',                           priority: '1.0', changefreq: 'daily'   },
  { path: '/services/babysitting',       priority: '0.9', changefreq: 'weekly'  },
  { path: '/services/cleaning',          priority: '0.9', changefreq: 'weekly'  },
  { path: '/services/electrician',       priority: '0.9', changefreq: 'weekly'  },
  { path: '/services/plumbing',          priority: '0.9', changefreq: 'weekly'  },
  { path: '/services/gardening',         priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/petcare',           priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/tutoring',          priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/eldercare',         priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/air-conditioning',  priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/carpentry',         priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/painting',          priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/locksmith',         priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/moving',            priority: '0.8', changefreq: 'weekly'  },
  { path: '/services/gas-technician',    priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/drywall',           priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/contractor',        priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/aluminum',          priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/glass-works',       priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/waterproofing',     priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/home-organization', priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/laundry',           priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/pest-control',      priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/handyman',          priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/mechanic',          priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/metalwork',         priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/driver',            priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/photographer',      priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/private-chef',      priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/catering',          priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/pastry',            priority: '0.7', changefreq: 'weekly'  },
  { path: '/services/dj',                priority: '0.6', changefreq: 'weekly'  },
  { path: '/services/event-entertainment', priority: '0.6', changefreq: 'weekly' },
  { path: '/services/event-decoration',  priority: '0.6', changefreq: 'weekly'  },
  { path: '/services/sports-activities', priority: '0.6', changefreq: 'weekly'  },
  { path: '/services/property-management', priority: '0.6', changefreq: 'weekly' },
  { path: '/how-it-works',              priority: '0.5', changefreq: 'monthly' },
  { path: '/become-provider',           priority: '0.5', changefreq: 'monthly' },
];

router.get('/', async (req, res) => {
  try {
    const providers = await query(
      `SELECT sp.id, sp.updated_at
       FROM service_providers sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.is_active = TRUE AND u.is_active = TRUE
       ORDER BY sp.updated_at DESC
       LIMIT 5000`
    );

    const today = new Date().toISOString().split('T')[0];

    const staticUrls = STATIC_ROUTES.map(r => `
  <url>
    <loc>${BASE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('');

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticUrls}
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
