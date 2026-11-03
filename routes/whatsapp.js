const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { query } = require('../config/database');
const { getServiceLabel } = require('../constants/messages');

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// In-memory OTP store: normalizedPhone → { code, expiresAt }
const otpStore = new Map();

const rateLimit = require('express-rate-limit');
const mkLimiter = (windowMs, max) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'too_many_requests' }
});
const otpSendLimiter = mkLimiter(60 * 60 * 1000, 5);     // 5 codes / h / IP
const otpVerifyLimiter = mkLimiter(15 * 60 * 1000, 10);  // 10 essais / 15 min / IP
const msgLimiter = mkLimiter(60 * 60 * 1000, 20);        // notify + followup : 20 / h / IP

// Un même numéro ne reçoit pas plus d'un message de ce type toutes les 5 min (anti-harcèlement)
const lastSent = new Map();
function tooSoon(key) {
  const now = Date.now();
  for (const [k, t] of lastSent) if (now - t > 5 * 60 * 1000) lastSent.delete(k);
  if (lastSent.has(key)) return true;
  lastSent.set(key, now);
  return false;
}

// Normalize Israeli phone → international format (972XXXXXXXXX)
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

// POST /api/whatsapp/notify
router.post('/notify', msgLimiter, async (req, res) => {
  try {
    const { providerPhone, providerName, serviceName } = req.body;

    if (!providerPhone) {
      return res.status(400).json({ success: false, message: 'providerPhone required' });
    }

    const to = normalizePhone(providerPhone);
    if (tooSoon('notify:' + to)) return res.json({ success: true, throttled: true });

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: `שלום ${providerName || ''}! 👋\nלקוח חדש מעוניין בשירותי ${serviceName || 'השירות שלך'} דרך AllSherut.\nהוא ניסה ליצור איתך קשר — אנא חזור אליו בהקדם! 🏠`,
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return res.status(500).json({ success: false, message: 'WhatsApp send failed', error: data });
    }

    return res.json({ success: true, messageId: data.messages?.[0]?.id });
  } catch (err) {
    console.error('WhatsApp route error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/whatsapp/followup
// Sends a delayed WA to the CLIENT asking if they concluded a deal with the provider
router.post('/followup', msgLimiter, async (req, res) => {
  try {
    const { clientPhone, clientName, providerName, serviceName, action, providerPhone, delayMinutes = 1 } = req.body;

    if (!clientPhone) {
      return res.status(400).json({ success: false, message: 'clientPhone required' });
    }

    const to = normalizePhone(clientPhone);
    if (tooSoon('followup:' + to)) return res.json({ success: true, throttled: true });
    const delayMs = Math.min(delayMinutes, 120) * 60 * 1000; // cap at 2h

    res.json({ success: true, scheduledIn: `${delayMinutes}min` });

    (async () => {
      let resolvedServiceName = serviceName;
      if (!resolvedServiceName && providerPhone) {
        try {
          const rows = await query(
            `SELECT sp.service_type FROM service_providers sp
             JOIN users u ON sp.user_id = u.id
             WHERE u.phone = ? ORDER BY sp.is_active DESC LIMIT 1`,
            [providerPhone]
          );
          if (rows[0]?.service_type) {
            resolvedServiceName = getServiceLabel(rows[0].service_type);
          }
        } catch (err) {
          console.error('Lead email service lookup error:', err.message);
        }
      }

      return emailService.sendLeadNotificationEmail({ clientPhone, providerName, serviceName: resolvedServiceName, action });
    })().catch(err => console.error('Lead email error:', err.message));

    setTimeout(async () => {
      try {
        const TEMPLATE_NAME = process.env.WHATSAPP_FOLLOWUP_TEMPLATE;

        // Use approved template if configured, otherwise fall back to free-form text
        const payload = TEMPLATE_NAME
          ? {
              messaging_product: 'whatsapp',
              to,
              type: 'template',
              template: {
                name: TEMPLATE_NAME,
                language: { code: 'he' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: providerName || 'הנותן שירות' },
                    ],
                  },
                ],
              },
            }
          : {
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: {
                body: `שלום! 👋\nשאלה קצרה — האם הצלחת לסגור עסקה עם ${providerName || 'הנותן שירות'} דרך AllSherut?\nנשמח אם תשאיר ביקורת קצרה — זה עוזר ללקוחות אחרים מאוד! ⭐`,
              },
            };

        const response = await fetch(
          `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          console.error('WhatsApp followup error:', JSON.stringify(data));
        } else {
          console.log(`✅ WhatsApp followup sent to ${to}:`, data.messages?.[0]?.id);
        }
      } catch (err) {
        console.error('WhatsApp followup send error:', err.message);
      }
    }, delayMs);
  } catch (err) {
    console.error('WhatsApp followup route error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/whatsapp/send-otp
router.post('/send-otp', otpSendLimiter, async (req, res) => {
  try {
    if (!TOKEN || !PHONE_NUMBER_ID) {
      console.error('WhatsApp env vars missing: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set');
      return res.status(500).json({ success: false, message: 'whatsapp_not_configured' });
    }

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });

    const to = normalizePhone(phone);
    if (!to) return res.status(400).json({ success: false, message: 'invalid phone' });

    if (tooSoon('otp:' + to)) return res.status(429).json({ success: false, message: 'too_many_requests' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(to, { code, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: `קוד האימות שלך עבור AllSherut הוא: *${code}*\nהקוד בתוקף ל-10 דקות. 🔐`,
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp OTP send error:', JSON.stringify(data));
      return res.status(500).json({
        success: false,
        message: 'whatsapp_send_failed',
        waError: data?.error?.message || 'unknown',
        waCode: data?.error?.code,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('send-otp error:', err.message);
    return res.status(500).json({ success: false, message: 'server_error' });
  }
});

// POST /api/whatsapp/verify-otp
router.post('/verify-otp', otpVerifyLimiter, (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ success: false, message: 'phone and code required' });

  const to = normalizePhone(phone);
  const entry = otpStore.get(to);

  if (!entry) return res.json({ success: false, message: 'no_otp' });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(to);
    return res.json({ success: false, message: 'expired' });
  }
  if (entry.code !== String(code).trim()) {
    entry.attempts = (entry.attempts || 0) + 1;
    if (entry.attempts >= 5) otpStore.delete(to);
    return res.json({ success: false, message: 'invalid' });
  }

  otpStore.delete(to);
  return res.json({ success: true });
});

module.exports = router;
