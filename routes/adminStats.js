const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Accès réservé : users.role = 'admin' OU email listé dans la variable ADMIN_EMAILS (séparés par des virgules)
const adminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const requireAdmin = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    try {
      const userId = decoded.userId || decoded.id;
      const rows = await query('SELECT id, email, role FROM users WHERE id = ?', [userId]);
      const u = rows[0];
      if (!u || !(u.role === 'admin' || adminEmails().includes(String(u.email).toLowerCase()))) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      req.user = u;
      next();
    } catch (e) {
      console.error('❌ admin-stats auth:', e.message);
      res.status(500).json({ success: false });
    }
  });
};

// Liste continue de jours YYYY-MM-DD (les jours sans donnée valent 0)
function fillDays(rows, days, fields) {
  const map = new Map(rows.map(r => [r.d, r]));
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 86400000);
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(dt);
    const r = map.get(d);
    const item = { date: d };
    fields.forEach(f => { item[f] = r ? Number(r[f]) : 0; });
    out.push(item);
  }
  return out;
}

// GET /api/admin-stats?days=30
router.get('/', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);

    const [
      totalsRows, dailyRows, byService, topProviders, recent,
      signupRows, providerStatus, userTotals
    ] = await Promise.all([
      query(`SELECT
          SUM(clicked_at >= CURDATE()) AS today,
          SUM(clicked_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)) AS last7,
          SUM(clicked_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)) AS last30,
          COUNT(*) AS allTime,
          SUM(click_type = 'call') AS calls,
          SUM(click_type = 'whatsapp') AS whatsapp,
          SUM(client_phone IS NOT NULL) AS withPhone
        FROM contact_clicks`),
      query(`SELECT DATE_FORMAT(clicked_at, '%Y-%m-%d') AS d,
          COUNT(*) AS total,
          SUM(click_type = 'call') AS calls,
          SUM(click_type = 'whatsapp') AS whatsapp
        FROM contact_clicks
        WHERE clicked_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY d`, [days - 1]),
      query(`SELECT sp.service_type AS service, COUNT(*) AS clicks
        FROM contact_clicks cc JOIN service_providers sp ON sp.id = cc.provider_id
        WHERE cc.clicked_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY sp.service_type ORDER BY clicks DESC LIMIT 15`, [days - 1]),
      query(`SELECT sp.id, sp.service_type AS service,
          CONCAT(u.first_name, ' ', u.last_name) AS name, COUNT(*) AS clicks
        FROM contact_clicks cc
        JOIN service_providers sp ON sp.id = cc.provider_id
        JOIN users u ON u.id = sp.user_id
        WHERE cc.clicked_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY sp.id, sp.service_type, u.first_name, u.last_name
        ORDER BY clicks DESC LIMIT 10`, [days - 1]),
      query(`SELECT cc.id, cc.click_type AS type, cc.source, cc.client_phone AS clientPhone,
          cc.clicked_at AS at, sp.service_type AS service,
          CONCAT(u.first_name, ' ', u.last_name) AS provider
        FROM contact_clicks cc
        LEFT JOIN service_providers sp ON sp.id = cc.provider_id
        LEFT JOIN users u ON u.id = sp.user_id
        ORDER BY cc.id DESC LIMIT 25`),
      query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d,
          SUM(role = 'provider') AS providers,
          SUM(role <> 'provider') AS clients
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY d`, [days - 1]),
      query(`SELECT verification_status AS status, COUNT(*) AS n
        FROM service_providers GROUP BY verification_status`),
      query(`SELECT COUNT(*) AS users, SUM(role = 'provider') AS providers FROM users`)
    ]);

    const t = totalsRows[0] || {};
    res.json({
      success: true,
      days,
      totals: {
        today: Number(t.today || 0),
        last7: Number(t.last7 || 0),
        last30: Number(t.last30 || 0),
        allTime: Number(t.allTime || 0),
        calls: Number(t.calls || 0),
        whatsapp: Number(t.whatsapp || 0),
        withPhone: Number(t.withPhone || 0)
      },
      daily: fillDays(dailyRows, days, ['total', 'calls', 'whatsapp']),
      signups: fillDays(signupRows, days, ['providers', 'clients']),
      byService: byService.map(r => ({ service: r.service, clicks: Number(r.clicks) })),
      topProviders: topProviders.map(r => ({ id: r.id, name: r.name, service: r.service, clicks: Number(r.clicks) })),
      recent,
      providerStatus: providerStatus.map(r => ({ status: r.status, n: Number(r.n) })),
      users: {
        total: Number(userTotals[0]?.users || 0),
        providers: Number(userTotals[0]?.providers || 0)
      }
    });
  } catch (error) {
    console.error('❌ admin-stats:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
