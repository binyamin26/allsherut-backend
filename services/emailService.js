const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
 constructor() {
  this.transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });

  // Logo Cloudinary
  this.logoUrl = 'https://res.cloudinary.com/ddzskq7hd/image/upload/v1770758706/Logo_moderne_d_AllSherut_avec_sph%C3%A8re_3D_ycuw9s.png';
}

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // ============================================
  // HEADER & FOOTER COMMUNS
  // ============================================

  getEmailHeader(subtitle = '') {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
          <!-- Header avec logo -->
          <div style="background: linear-gradient(135deg, #6366f1 0%, #14b8a6 100%); padding: 35px 40px; text-align: center;">
            <img src="${this.logoUrl}" alt="AllSherut" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 12px; border: 3px solid rgba(255,255,255,0.3);" />
            <div style="font-size: 26px; font-weight: 800; color: white; margin-bottom: 4px; letter-spacing: 0.5px;">AllSherut</div>
            <div style="font-size: 14px; color: rgba(255,255,255,0.85);">שירותי בית מקצועיים</div>
            ${subtitle ? `<div style="margin-top: 10px; display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 18px; border-radius: 20px; font-size: 14px; color: white; font-weight: 600;">${subtitle}</div>` : ''}
          </div>
    `;
  }

  getEmailFooter() {
    return `
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 25px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
            <img src="${this.logoUrl}" alt="AllSherut" style="width: 36px; height: 36px; border-radius: 50%; margin-bottom: 8px; opacity: 0.7;" />
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b; font-weight: 600;">AllSherut - שירותי בית מקצועיים</p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">support@homesherut.co.il | 058-329-0896</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ============================================
  // TEMPLATE: Reset Password
  // ============================================
  getResetPasswordTemplate(resetUrl, userName) {
    return `
      ${this.getEmailHeader('🔐 איפוס סיסמה')}
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">שלום ${userName},</h2>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px;">
              קיבלנו בקשה לאיפוס הסיסמה של החשבון שלך ב-AllSherut.
              <br>לאיפוס הסיסמה, לחץ על הכפתור למטה:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">
                איפוס סיסמה
              </a>
            </div>
            
            <div style="background: #fef3c7; border-right: 3px solid #f59e0b; color: #92400e; padding: 14px 18px; border-radius: 10px; margin: 25px 0; font-size: 14px;">
              <strong>⚠️ חשוב:</strong> הקישור תקף למשך 24 שעות בלבד. אם לא ביקשת איפוס סיסמה, התעלם מהמייל הזה.
            </div>
            
            <div style="height: 1px; background: #e5e7eb; margin: 25px 0;"></div>
            
            <p style="font-size: 13px; color: #9ca3af;">
              אם הכפתור לא עובד, העתק והדבק את הקישור:
              <br><a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATE: Review Verification
  // ============================================
  getReviewVerificationTemplate(verificationCode, userName, serviceType) {
    const serviceNames = {
      'cleaning': 'ניקיון', 'gardening': 'גינון', 'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות', 'tutoring': 'שיעורים פרטיים', 'eldercare': 'עזרה לקשישים',
      'laundry': 'כביסה', 'property-management': 'ניהול דירות', 'electrician': 'חשמלאי',
      'plumbing': 'אינסטלציה', 'air-conditioning': 'מיזוג אוויר', 'gas-technician': 'טכנאי גז',
      'drywall': 'גבס', 'carpentry': 'נגרות', 'home-organization': 'סידור בית',
      'event-entertainment': 'אירועים', 'private-chef': 'שף פרטי', 'painting': 'צביעה',
      'waterproofing': 'איטום', 'contractor': 'קבלן', 'aluminum': 'אלומיניום',
      'glass-works': 'זגגות', 'locksmith': 'מנעולן'
    };
    const serviceName = serviceNames[serviceType] || 'שירות';

    return `
      ${this.getEmailHeader('⭐ השארת ביקורת ודירוג')}
          <div style="padding: 40px; direction: rtl;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 700;">שירותי ${serviceName}</span>
            </div>
            
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${userName},</h2>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px; text-align: right;">
              תודה על הרצון להשאיר ביקורת ודירוג!
              <br>כדי להבטיח את איכות הביקורות, אנא השתמש בקוד האימות הבא:
            </p>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 28px; text-align: center; margin: 25px 0;">
              <div style="font-size: 38px; font-weight: 800; color: #0d9488; letter-spacing: 10px; font-family: 'Courier New', monospace;">${verificationCode}</div>
              <div style="font-size: 13px; color: #0d9488; margin-top: 10px;">קוד אימות תקף ל-15 דקות</div>
            </div>
            
            <div style="background: #fef3c7; border-right: 3px solid #f59e0b; color: #92400e; padding: 14px 18px; border-radius: 10px; margin: 20px 0; font-size: 14px;">
              <strong>⚠️ חשוב:</strong> הקוד תקף למשך 15 דקות בלבד. אל תשתף את הקוד עם אחרים.
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                💬 הביקורת שלך תעזור ללקוחות אחרים לקבל החלטה מושכלת
                <br>⭐ דירוגים אמינים משפרים את איכות השירות לכולם
              </p>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATE: Review Confirmation
  // ============================================
  getReviewConfirmationTemplate(userName, serviceType) {
    const serviceNames = {
      'cleaning': 'ניקיון', 'gardening': 'גינון', 'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות', 'tutoring': 'שיעורים פרטיים', 'eldercare': 'עזרה לקשישים',
      'laundry': 'כביסה', 'property-management': 'ניהול דירות', 'electrician': 'חשמלאי',
      'plumbing': 'אינסטלציה', 'air-conditioning': 'מיזוג אוויר', 'gas-technician': 'טכנאי גז',
      'drywall': 'גבס', 'carpentry': 'נגרות', 'home-organization': 'סידור בית',
      'event-entertainment': 'אירועים', 'private-chef': 'שף פרטי', 'painting': 'צביעה',
      'waterproofing': 'איטום', 'contractor': 'קבלן', 'aluminum': 'אלומיניום',
      'glass-works': 'זגגות', 'locksmith': 'מנעולן'
    };
    const serviceName = serviceNames[serviceType] || 'שירות';

    return `
      ${this.getEmailHeader('🎉 תודה על הביקורת!')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${userName},</h2>
            
            <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #14b8a6; border-radius: 16px; padding: 30px; text-align: center; margin: 25px 0;">
              <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
              <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 20px;">הביקורת נשלחה בהצלחה!</h3>
              <p style="color: #065f46; margin: 0; font-size: 15px;">הביקורת שלך על שירותי ${serviceName} פורסמה באתר</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 20px; text-align: right;">
              תודה רבה על הזמן שהשקעת בכתיבת הביקורת. חוות הדעת שלך חשובה מאוד ותעזור ללקוחות אחרים לקבל החלטות מושכלות.
            </p>
            
            <div style="background: #fffbeb; border-right: 3px solid #f59e0b; padding: 14px 18px; border-radius: 10px; text-align: right;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                💡 הביקורות האמינות שלך עוזרות לשפר את איכות השירותים לכל הקהילה
              </p>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATE: Provider New Review Notification
  // ============================================
  getProviderNewReviewNotificationTemplate(providerData) {
    const { providerName, providerTitle, rating, reviewerName, comment, title, serviceType } = providerData;
    
    const serviceNames = {
      'cleaning': 'ניקיון', 'gardening': 'גינון', 'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות', 'tutoring': 'שיעורים פרטיים', 'eldercare': 'עזרה לקשישים',
      'laundry': 'כביסה', 'property-management': 'ניהול דירות', 'electrician': 'חשמלאי',
      'plumbing': 'אינסטלציה', 'air-conditioning': 'מיזוג אוויר', 'gas-technician': 'טכנאי גז',
      'drywall': 'גבס', 'carpentry': 'נגרות', 'home-organization': 'סידור בית',
      'event-entertainment': 'אירועים', 'private-chef': 'שף פרטי', 'painting': 'צביעה',
      'waterproofing': 'איטום', 'contractor': 'קבלן', 'aluminum': 'אלומיניום',
      'glass-works': 'זגגות', 'locksmith': 'מנעולן'
    };
    const serviceName = serviceNames[serviceType] || 'שירות';
    const starsDisplay = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    return `
      ${this.getEmailHeader('💬 ביקורת חדשה!')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${providerName},</h2>
            
            <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 16px; padding: 22px; margin: 20px 0; text-align: right;">
              <h3 style="margin: 0 0 10px 0; color: #1d4ed8; font-size: 17px;">📋 ביקורת חדשה על השירות שלך</h3>
              <p style="margin: 0; font-size: 15px; color: #374151;">
                לקוח השאיר ביקורת על <strong>"${providerTitle}"</strong> - שירותי ${serviceName}.
              </p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 14px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <div style="text-align: right; margin-bottom: 12px;">
                <strong style="color: #374151;">לקוח:</strong> ${reviewerName}
              </div>
              <div style="margin-bottom: 12px;">
                <span style="font-size: 22px; color: #f59e0b;">${starsDisplay}</span>
                <span style="color: #6b7280; font-size: 14px; margin-right: 8px;">(${rating}/5)</span>
              </div>
              ${title ? `<div style="margin-bottom: 10px; text-align: right;"><strong>כותרת:</strong> ${title}</div>` : ''}
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; font-style: italic; color: #374151; text-align: right; line-height: 1.6;">
                "${comment}"
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #374151; font-size: 15px; margin-bottom: 16px;">תוכל להגיב על הביקורת מהדשבורד שלך</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">
                עבור לדשבורד שלך
              </a>
            </div>
            
            <div style="background: #fffbeb; border-right: 3px solid #f59e0b; padding: 14px 18px; border-radius: 10px;">
              <p style="margin: 0; color: #92400e; font-size: 13px; text-align: right;">
                <strong>💡 טיפ:</strong> תגובה מקצועית ואמפתית יכולה להראות ללקוחות עתידיים שאתה אכפת ומשתפר.
              </p>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATE: Welcome
  // ============================================
  getWelcomeTemplate(userName, userRole) {
    const roleText = userRole === 'provider' ? 'ספק שירות' : 'לקוח';
    
    return `
      ${this.getEmailHeader('🎉 ברוכים הבאים!')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${userName},</h2>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px; text-align: right;">
              ברוכים הבאים למשפחת AllSherut! אנחנו שמחים שהצטרפת אלינו כ${roleText}.
            </p>
            
            ${userRole === 'provider' ? `
              <div style="background: #f0fdf4; border-radius: 14px; padding: 22px; margin-bottom: 25px; border: 1px solid #bbf7d0;">
                <h3 style="color: #16a34a; margin: 0 0 12px 0; font-size: 17px; text-align: right;">כספק שירות, אתה יכול עכשיו:</h3>
                <ul style="text-align: right; color: #374151; line-height: 2; padding-right: 20px; margin: 0;">
                  <li>ליצור פרופיל מקצועי משלך</li>
                  <li>לקבל פניות מלקוחות באזור שלך</li>
                  <li>לבנות מוניטין ולקבל ביקורות</li>
                  <li>להרוויח בגמישות מלאה</li>
                </ul>
              </div>
            ` : `
              <div style="background: #eff6ff; border-radius: 14px; padding: 22px; margin-bottom: 25px; border: 1px solid #bfdbfe;">
                <h3 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 17px; text-align: right;">כלקוח, אתה יכול עכשיו:</h3>
                <ul style="text-align: right; color: #374151; line-height: 2; padding-right: 20px; margin: 0;">
                  <li>לחפש ספקי שירות מקצועיים באזור שלך</li>
                  <li>לקרוא ביקורות והמלצות</li>
                  <li>ליצור קשר ישיר עם ספקים</li>
                  <li>לקבל שירות איכותי ומהימן</li>
                </ul>
              </div>
            `}
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">
                התחל עכשיו
              </a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATE: Contact Email
  // ============================================
  getContactEmailTemplate(formData) {
    const { name, email, phone, subject, message } = formData;
    const timestamp = new Date().toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      ${this.getEmailHeader('📩 הודעה חדשה')}
          <div style="padding: 40px; direction: rtl;">
            <div style="background: #fffbeb; border-right: 3px solid #f59e0b; color: #92400e; padding: 12px 18px; border-radius: 10px; margin-bottom: 25px; font-size: 14px; font-weight: 600;">
              📅 התקבל ב: ${timestamp}
            </div>
            
            ${this._contactField('שם השולח', name)}
            ${this._contactField('כתובת אימייל', `<a href="mailto:${email}" style="color: #3b82f6; text-decoration: none;">${email}</a>`)}
            ${phone ? this._contactField('מספר טלפון', `<a href="tel:${phone}" style="color: #22c55e; text-decoration: none;">${phone}</a>`) : ''}
            ${this._contactField('נושא הפניה', subject)}
            
            <div style="margin-bottom: 20px; padding: 18px; background: #eff6ff; border-radius: 12px; border-right: 3px solid #3b82f6;">
              <div style="font-weight: 700; color: #1f2937; font-size: 13px; margin-bottom: 8px; text-align: right;">תוכן ההודעה</div>
              <div style="font-size: 15px; color: #374151; white-space: pre-wrap; line-height: 1.7; text-align: right;">${message}</div>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  _contactField(label, value) {
    return `
      <div style="margin-bottom: 16px; padding: 16px; background: #f8fafc; border-radius: 12px; border-right: 3px solid #3b82f6;">
        <div style="font-weight: 700; color: #1f2937; font-size: 13px; margin-bottom: 6px; text-align: right;">${label}</div>
        <div style="font-size: 15px; color: #374151; text-align: right;">${value}</div>
      </div>
    `;
  }

  // ============================================
  // TEMPLATE: Thank You
  // ============================================
  getThankYouTemplate(name, subject) {
    return `
      ${this.getEmailHeader('🎉 תודה על פנייתך!')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${name},</h2>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px; text-align: right;">
              תודה שפנית אלינו בנושא "<strong>${subject}</strong>".
              <br>קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.
            </p>
            
            <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 14px; padding: 20px; text-align: center;">
              <strong style="color: #1d4ed8; font-size: 16px;">⚡ זמן מענה צפוי: 2-4 שעות</strong>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // TEMPLATES: Trial / Subscription (gardés mais désactivés dans le cron)
  // ============================================
  async sendTrialExpiringSoonEmail(user) {
    const subject = '7 ימים נותרו לתקופת הניסיון שלך - AllSherut';
    const html = `
      ${this.getEmailHeader('⏱️ תקופת הניסיון מסתיימת בקרוב')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${user.first_name},</h2>
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 20px; text-align: right;">
              תקופת הניסיון החינמית שלך מסתיימת בעוד <strong>7 ימים</strong>.
            </p>
            <p style="text-align: right; color: #374151;"><strong>תאריך סיום:</strong> ${new Date(user.premium_until).toLocaleDateString('he-IL')}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/billing" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">שדרג למנוי בתשלום</a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
    return this._sendMail(user.email, subject, html);
  }

  async sendTrialExpiringUrgentEmail(user) {
    const subject = '⚠️ רק 3 ימים נותרו לתקופת הניסיון - AllSherut';
    const html = `
      ${this.getEmailHeader('⚠️ דחוף: 3 ימים נותרו!')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${user.first_name},</h2>
            <div style="background: #fef3c7; border-right: 3px solid #f59e0b; padding: 16px 18px; border-radius: 10px; margin-bottom: 20px;">
              <strong style="color: #92400e;">תקופת הניסיון שלך מסתיימת בעוד 3 ימים בלבד!</strong>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/billing" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">שדרג עכשיו</a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
    return this._sendMail(user.email, subject, html);
  }

  async sendSubscriptionExpiredEmail(user) {
    const subject = 'תקופת הניסיון שלך הסתיימה - AllSherut';
    const html = `
      ${this.getEmailHeader('📢 תקופת הניסיון הסתיימה')}
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; text-align: right;">שלום ${user.first_name},</h2>
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px; text-align: right;">
              תקופת הניסיון החינמית שלך הסתיימה.
              <br>כדי להמשיך ליהנות מכל היתרונות - חדש את המנוי שלך עכשיו.
            </p>
            <div style="background: #fef3c7; border-right: 3px solid #f59e0b; padding: 14px 18px; border-radius: 10px; margin-bottom: 25px; font-size: 14px; color: #92400e;">
              <strong>⚠️ חשוב:</strong> הפרופיל שלך כבר לא מופיע בתוצאות החיפוש. חידוש המנוי יחזיר אותך לפעילות מלאה תוך דקות.
            </div>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">חדש מנוי</a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
    return this._sendMail(user.email, subject, html);
  }

  // ============================================
  // TEMPLATES: Subscription Cancellation / Deletion
  // ============================================
  getSubscriptionCancellationTemplate(firstName, deletionDate) {
    const formattedDate = new Date(deletionDate).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
      ${this.getEmailHeader('⏱️ בקשת ביטול מנוי התקבלה')}
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">שלום ${firstName},</h2>
            
            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 25px;">
              קיבלנו את בקשתך לביטול המנוי. אנחנו מצטערים לראות אותך עוזב! 😢
            </p>

            <div style="background: #fffbeb; border-right: 3px solid #f59e0b; padding: 20px 18px; border-radius: 10px; margin-bottom: 25px;">
              <h3 style="color: #f59e0b; margin: 0 0 12px 0; font-size: 18px;">מה קורה עכשיו?</h3>
              <ul style="color: #374151; line-height: 1.9; padding-right: 20px; margin: 0;">
                <li>החשבון שלך ימשיך לפעול עד <strong>${formattedDate}</strong></li>
                <li>הפרופיל שלך יישאר גלוי ופעיל עד סוף התקופה</li>
                <li>ב-<strong>${formattedDate}</strong> החשבון יימחק אוטומטית ולצמיתות</li>
              </ul>
            </div>

            <div style="background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); padding: 28px; border-radius: 14px; text-align: center; margin-bottom: 25px;">
              <div style="color: white; font-size: 20px; font-weight: 700; margin-bottom: 12px;">💡 שינית את דעתך?</div>
              <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 20px;">
                תוכל לבטל את בקשת המחיקה בכל עת לפני ${formattedDate}
              </div>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: white; color: #22c55e; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
                ביטול בקשת המחיקה
              </a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  getDeletionCancelledTemplate(firstName) {
    return `
      ${this.getEmailHeader('✅ המנוי שלך ממשיך!')}
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">שלום ${firstName},</h2>
            
            <div style="background: #f0fdf4; border-right: 3px solid #22c55e; padding: 20px 18px; border-radius: 10px; margin-bottom: 25px;">
              <h3 style="color: #16a34a; margin: 0 0 10px 0; font-size: 20px;">🎉 שמחים שנשארת איתנו!</h3>
              <p style="color: #374151; line-height: 1.7; margin: 0; font-size: 15px;">
                בקשת המחיקה שלך בוטלה בהצלחה. החשבון שלך ממשיך לפעול באופן רגיל.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #22c55e 100%); color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">
                מעבר לדאשבורד
              </a>
            </div>
          </div>
      ${this.getEmailFooter()}
    `;
  }

  // ============================================
  // MÉTHODES D'ENVOI
  // ============================================
  
  async _sendMail(to, subject, html) {
    try {
      const mailOptions = {
        from: { name: 'AllSherut', address: process.env.SMTP_FROM || process.env.SMTP_USER },
        to,
        subject,
        html
      };
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendResetPasswordEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    return this._sendMail(email, 'איפוס סיסמה - AllSherut', this.getResetPasswordTemplate(resetUrl, userName));
  }

  async sendReviewVerificationEmail(email, verificationCode, userName, serviceType) {
    return this._sendMail(email, 'אימות אימייל לביקורת - AllSherut', this.getReviewVerificationTemplate(verificationCode, userName, serviceType));
  }

  async sendReviewConfirmationEmail(email, userName, serviceType) {
    return this._sendMail(email, 'תודה על הביקורת - AllSherut 🌟', this.getReviewConfirmationTemplate(userName, serviceType));
  }

  async sendProviderNewReviewNotification(providerEmail, providerData) {
    return this._sendMail(providerEmail, `💬 ביקורת חדשה התקבלה (${providerData.rating}⭐) - AllSherut`, this.getProviderNewReviewNotificationTemplate(providerData));
  }

  async sendWelcomeEmail(email, userName, userRole) {
    return this._sendMail(email, 'ברוכים הבאים ל-AllSherut! 🎉', this.getWelcomeTemplate(userName, userRole));
  }

  async sendContactEmail(formData) {
    const adminEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    try {
      const mailOptions = {
        from: { name: 'AllSherut Contact', address: adminEmail },
        to: adminEmail,
        subject: `🏠 AllSherut - פניה חדשה: ${formData.subject}`,
        html: this.getContactEmailTemplate(formData),
        replyTo: formData.email
      };
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Contact email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send contact email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendThankYouEmail(formData) {
    return this._sendMail(formData.email, 'תודה על פנייתך - AllSherut 🏠', this.getThankYouTemplate(formData.name, formData.subject));
  }

  async sendSubscriptionCancellationEmail(email, firstName, deletionDate) {
    return this._sendMail(email, '⏱️ בקשת ביטול מנוי התקבלה - AllSherut', this.getSubscriptionCancellationTemplate(firstName, deletionDate));
  }

  async sendDeletionCancelledEmail(email, firstName) {
    return this._sendMail(email, '✅ המנוי שלך ממשיך - AllSherut', this.getDeletionCancelledTemplate(firstName));
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service ready');
      return true;
    } catch (error) {
      console.error('❌ Email service not ready:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();