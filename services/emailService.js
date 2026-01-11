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
}

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Template email reset password
  getResetPasswordTemplate(resetUrl, userName) {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>איפוס סיסמה - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">HomeSherut</div>
            <div style="opacity: 0.9; font-size: 16px;">שירותי בית מקצועיים</div>
          </div>
          
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${userName},</h2>
            
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              קיבלנו בקשה לאיפוס הסיסמה של החשבון שלך ב-HomeSherut.
              <br><br>
              לאיפוס הסיסמה, לחץ על הכפתור למטה:
            </div>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 20px 0;">איפוס סיסמה</a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; text-align: right;">
              <strong>חשוב:</strong> הקישור תקף למשך 24 שעות בלבד. אם לא ביקשת איפוס סיסמה, התעלם מהמייל הזה.
            </div>
            
            <div style="height: 1px; background: #e5e7eb; margin: 30px 0;"></div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: right;">
              אם הכפתור לא עובד, העתק והדבק את הקישור הזה בדפדפן:
              <br>
              <a href="${resetUrl}" style="color: #0ea5e9; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>אם יש לך שאלות, צור קשר: support@homesherut.co.il | 058-329-0896</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template email vérification pour avis
  getReviewVerificationTemplate(verificationCode, userName, serviceType) {
    const serviceNames = {
      'cleaning': 'ניקיון',
      'gardening': 'גינון',
      'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות',
      'tutoring': 'שיעורים פרטיים',
      'eldercare': 'עזרה לקשישים'
    };

    const serviceName = serviceNames[serviceType] || 'שירות';

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>אימות אימייל לביקורת - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">HomeSherut</div>
            <div style="opacity: 0.9; font-size: 16px;">⭐ השארת ביקורת ודירוג</div>
          </div>
          
          <div style="padding: 40px; direction: rtl;">
            <div style="text-align: center;">
              <div style="display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 20px;">שירותי ${serviceName}</div>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${userName},</h2>
            
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              תודה על הרצון להשאיר ביקורת ודירוג!
              <br><br>
              כדי להבטיח את איכות הביקורות ולמנוע ביקורות מזויפות, אנא השתמש בקוד האימות הבא:
            </div>
            
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <div style="font-size: 36px; font-weight: bold; color: #059669; letter-spacing: 8px; font-family: monospace;">${verificationCode}</div>
              <div style="font-size: 14px; color: #065f46; margin-top: 10px;">קוד אימות תקף ל-15 דקות</div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; text-align: right;">
              <strong>חשוב:</strong> הקוד תקף למשך 15 דקות בלבד. אל תשתף את הקוד עם אחרים.
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 16px; text-align: center;">
                💬 הביקורת שלך תעזור ללקוחות אחרים לקבל החלטה מושכלת
                <br>
                ⭐ דירוגים אמינים משפרים את איכות השירות לכולם
              </p>
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>אימייל זה נשלח אוטומטית ממערכת הביקורות שלנו</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Templates emails expiration trial
  async sendTrialExpiringSoonEmail(user) {
    const subject = '7 ימים נותרו לתקופת הניסיון שלך - HomeSherut';
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; text-align: center;">תקופת הניסיון שלך מסתיימת בקרוב</h1>
          </div>
          <div style="background: white; padding: 30px; direction: rtl;">
            <p style="text-align: right;">שלום ${user.first_name},</p>
            
            <p style="text-align: right;">רצינו להזכיר לך שתקופת הניסיון החינמית שלך ב-HomeSherut מסתיימת בעוד <strong>7 ימים</strong>.</p>
            
            <p style="text-align: right;"><strong>תאריך סיום:</strong> ${new Date(user.premium_until).toLocaleDateString('he-IL')}</p>
            
            <p style="text-align: right;">כדי להמשיך ליהנות מכל היתרונות:</p>
            <ul style="text-align: right;">
              <li>קבלת פניות מלקוחות חדשים</li>
              <li>מענה לביקורות</li>
              <li>עדכון הפרופיל שלך</li>
              <li>הופעה בתוצאות החיפוש</li>
            </ul>
            
            <p style="text-align: right;">שדרג עכשיו למנוי חודשי או שנתי:</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/billing" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">שדרג למנוי בתשלום</a>
            </div>
            
            <p style="margin-top: 30px; text-align: right;">יש לך שאלות? אנחנו כאן לעזור!</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #666; font-size: 14px; background: #f9fafb;">
            <p>HomeSherut - פלטפורמת שירותי הבית המובילה בישראל</p>
            <p>${process.env.FRONTEND_URL}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      שלום ${user.first_name},
      
      תקופת הניסיון שלך ב-HomeSherut מסתיימת בעוד 7 ימים.
      תאריך סיום: ${new Date(user.premium_until).toLocaleDateString('he-IL')}
      
      שדרג עכשיו כדי להמשיך ליהנות מכל היתרונות:
      ${process.env.FRONTEND_URL}/billing
    `;
    
    const mailOptions = {
      from: {
        name: 'HomeSherut',
        address: process.env.SMTP_FROM || process.env.SMTP_USER
      },
      to: user.email,
      subject: subject,
      text: text,
      html: html
    };

    const result = await this.transporter.sendMail(mailOptions);
    console.log('✅ Trial expiring soon email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  }

  async sendTrialExpiringUrgentEmail(user) {
    const subject = '⚠️ רק 3 ימים נותרו לתקופת הניסיון - HomeSherut';
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; text-align: center;">⚠️ דחוף: 3 ימים נותרו!</h1>
          </div>
          <div style="background: white; padding: 30px; direction: rtl;">
            <p style="text-align: right;">שלום ${user.first_name},</p>
            
            <div style="background: #fff3cd; border-right: 4px solid #ff9800; padding: 15px; margin: 20px 0; text-align: right;">
              <strong>תקופת הניסיון שלך מסתיימת בעוד 3 ימים בלבד!</strong>
            </div>
            
            <p style="text-align: right;">ללא שדרוג, החל מ-${new Date(user.premium_until).toLocaleDateString('he-IL')}:</p>
            <ul style="color: #d32f2f; text-align: right;">
              <li>הפרופיל שלך לא יופיע בחיפושים</li>
              <li>לא תוכל להגיב לביקורות</li>
              <li>לא תוכל לערוך את הפרופיל שלך</li>
              <li>לקוחות חדשים לא יוכלו לפנות אליך</li>
            </ul>
            
            <p style="text-align: right;"><strong>אל תפספס הזדמנויות!</strong> שדרג עכשיו והמשך לקבל פניות מלקוחות.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/billing" style="display: inline-block; background: #f5576c; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-size: 18px; font-weight: bold;">שדרג עכשיו</a>
            </div>
          </div>
          <div style="text-align: center; padding: 20px; color: #666; font-size: 14px; background: #f9fafb;">
            <p>HomeSherut</p>
            <p>${process.env.FRONTEND_URL}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      שלום ${user.first_name},
      
      דחוף! תקופת הניסיון שלך מסתיימת בעוד 3 ימים.
      
      ללא שדרוג, לא תוכל יותר לקבל פניות מלקוחות או להגיב לביקורות.
      שדרג עכשיו: ${process.env.FRONTEND_URL}/billing
    `;
    
    const mailOptions = {
      from: {
        name: 'HomeSherut',
        address: process.env.SMTP_FROM || process.env.SMTP_USER
      },
      to: user.email,
      subject: subject,
      text: text,
      html: html
    };

    const result = await this.transporter.sendMail(mailOptions);
    console.log('✅ Trial expiring urgent email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  }

  async sendSubscriptionExpiredEmail(user) {
    const subject = 'תקופת הניסיון שלך הסתיימה - HomeSherut';
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>תקופת הניסיון הסתיימה - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">HomeSherut</div>
            <div style="opacity: 0.9; font-size: 16px;">שירותי בית מקצועיים</div>
          </div>
          
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${user.first_name},</h2>
            
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              תקופת הניסיון החינמית שלך ב-HomeSherut הסתיימה.
              <br><br>
              כדי להמשיך ליהנות מכל היתרונות - קבלת פניות מלקוחות, מענה לביקורות, ועדכון הפרופיל שלך - חדש את המנוי שלך עכשיו.
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; text-align: right;">
              <strong>חשוב:</strong> הפרופיל שלך כבר לא מופיע בתוצאות החיפוש. חידוש המנוי יחזיר אותך לפעילות מלאה תוך דקות.
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 20px 0;">
                חדש מנוי
              </a>
            </div>
            
            <div style="height: 1px; background: #e5e7eb; margin: 30px 0;"></div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: right;">
              כל הנתונים שלך נשמרו - פשוט חדש את המנוי ותחזור לפעילות.
            </p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>שאלות? כתוב לנו: ${process.env.SMTP_FROM || 'support@homesherut.com'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      שלום ${user.first_name},
      
      תקופת הניסיון שלך הסתיימה.
      
      חדש את המנוי שלך כדי להמשיך לקבל לקוחות:
      ${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing
    `;
    
    const mailOptions = {
      from: {
        name: 'HomeSherut',
        address: process.env.SMTP_FROM || process.env.SMTP_USER
      },
      to: user.email,
      subject: subject,
      text: text,
      html: html
    };

    const result = await this.transporter.sendMail(mailOptions);
    console.log('✅ Subscription expired email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  }

  // Template email confirmation après création d'avis
  getReviewConfirmationTemplate(userName, serviceType) {
    const serviceNames = {
      'cleaning': 'ניקיון',
      'gardening': 'גינון', 
      'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות',
      'tutoring': 'שיעורים פרטיים',
      'eldercare': 'עזרה לקשישים'
    };

    const serviceName = serviceNames[serviceType] || 'שירות';

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>תודה על הביקורת - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">HomeSherut</div>
            <div style="opacity: 0.9; font-size: 16px;">🎉 תודה על הביקורת!</div>
          </div>
          
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${userName},</h2>
            
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
              <h3 style="color: #059669; margin: 0 0 10px 0;">הביקורת נשלחה בהצלחה!</h3>
              <p style="color: #065f46; margin: 0;">הביקורת שלך על שירותי ${serviceName} פורסמה באתר</p>
            </div>
            
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              תודה רבה על הזמן שהשקעת בכתיבת הביקורת. חוות הדעת שלך חשובה מאוד ותעזור ללקוחות אחרים לקבל החלטות מושכלות.
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0; font-weight: 500; text-align: center;">
                💡 הביקורות האמינות שלך עוזרות לשפר את איכות השירותים לכל הקהילה
              </p>
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>אם יש לך שאלות על הביקורת, צור קשר: support@homesherut.co.il</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template notification prestataire pour nouvel avis
  getProviderNewReviewNotificationTemplate(providerData) {
    const { providerName, providerTitle, rating, reviewerName, comment, title, serviceType } = providerData;
    
    const serviceNames = {
      'cleaning': 'ניקיון',
      'gardening': 'גינון',
      'babysitting': 'בייביסיטר',
      'petcare': 'שמירת חיות',
      'tutoring': 'שיעורים פרטיים',
      'eldercare': 'עזרה לקשישים'
    };

    const serviceName = serviceNames[serviceType] || 'שירות';
    const starsDisplay = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>💬 ביקורת חדשה התקבלה - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center;">
            <h1 style="margin: 0;">💬 ביקורת חדשה!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">לקוח השאיר ביקורת על השירות שלך</p>
          </div>
          
          <div style="padding: 40px; direction: rtl;">
            <h2 style="color: #1f2937; text-align: right;">שלום ${providerName},</h2>
            
            <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: right;">
              <h3 style="margin: 0 0 15px 0; color: #0369a1;">📋 ביקורת חדשה על השירות שלך</h3>
              <p style="margin: 0; font-size: 16px;">
                לקוח השאיר ביקורת על <strong>"${providerTitle}"</strong> - שירותי ${serviceName}.
                <br><br>
                הביקורת פורסמה באתר וגלויה לכל המשתמשים.
              </p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h4 style="margin: 0 0 15px 0; color: #374151; text-align: right;">תצוגה מקדימה של הביקורת:</h4>
              
              <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; text-align: right;">
                <strong>לקוח:</strong> ${reviewerName}
                <span style="font-size: 20px; color: #f59e0b; margin: 10px 0;">${starsDisplay} (${rating}/5)</span>
              </div>
              
              ${title ? `
              <div style="margin-bottom: 10px; text-align: right;">
                <strong>כותרת:</strong> ${title}
              </div>
              ` : ''}
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; font-style: italic; text-align: right;">
                "${comment}"
              </div>
            </div>
            
            <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <h4 style="margin: 0 0 15px 0; color: #1e40af;">💡 תוכל להגיב על הביקורת</h4>
              <p style="margin: 0 0 20px 0; color: #1e3a8a; line-height: 1.6; text-align: center;">
                כספק שירות, יש לך אפשרות להגיב על הביקורת ולחלוק את נקודת המבט שלך עם לקוחות עתידיים.
              </p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; margin: 20px 0;">
                עבור לדשבורד שלך
              </a>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
                <strong>זכור:</strong> תגובה מקצועית ואמפתית יכולה להראות ללקוחות עתידיים שאתה אכפת ומשתפר.
              </p>
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>אימייל זה נשלח אוטומטית כחלק ממערכת הביקורות</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template email bienvenue
  getWelcomeTemplate(userName, userRole) {
    const roleText = userRole === 'provider' ? 'ספק שירות' : 'לקוח';
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>ברוכים הבאים ל-HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 40px; text-align: center;">
            <h1 style="text-align: center;">🎉 ברוכים הבאים ל-HomeSherut!</h1>
          </div>
          <div style="padding: 40px; direction: rtl;">
            <h2 style="text-align: right;">שלום ${userName},</h2>
            <p style="text-align: right;">ברוכים הבאים למשפחת HomeSherut! אנחנו שמחים שהצטרפת אלינו כ${roleText}.</p>
            
            ${userRole === 'provider' ? `
              <p style="text-align: right;">כספק שירות, אתה יכול עכשיו:</p>
              <ul style="text-align: right;">
                <li>ליצור פרופיל מקצועי משלך</li>
                <li>לקבל פניות מלקוחות באזור שלך</li>
                <li>לבנות מוניטין ולקבל ביקורות</li>
                <li>להרוויח בגמישות מלאה</li>
              </ul>
            ` : `
              <p style="text-align: right;">כלקוח, אתה יכול עכשיו:</p>
              <ul style="text-align: right;">
                <li>לחפש ספקי שירות מקצועיים באזור שלך</li>
                <li>לקרוא ביקורות והמלצות</li>
                <li>ליצור קשר ישיר עם ספקים</li>
                <li>לקבל שירות איכותי ומהימן</li>
              </ul>
            `}
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; margin: 20px 0;">
                התחל עכשיו
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template email contact (CORRIGÉ RTL)
  getContactEmailTemplate(formData) {
    const { name, email, phone, subject, message } = formData;
    const timestamp = new Date().toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>הודעה חדשה מ-HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">HomeSherut</div>
            <div style="opacity: 0.9; font-size: 16px;">שירותי בית מקצועיים</div>
          </div>
          
          <div style="padding: 40px; direction: rtl;">
            <div style="background: #fef3c7; color: #92400e; padding: 15px; text-align: center; font-weight: bold; border-right: 4px solid #f59e0b; margin-bottom: 20px;">
              📅 התקבל ב: ${timestamp}
            </div>
            
            <div style="margin-bottom: 25px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0ea5e9;">
              <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; text-align: right;">שם השולח</div>
              <div style="font-size: 16px; color: #374151; word-wrap: break-word; text-align: right;">${name}</div>
            </div>
            
            <div style="margin-bottom: 25px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0ea5e9;">
              <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; text-align: right;">כתובת אימייל</div>
              <div style="font-size: 16px; color: #374151; word-wrap: break-word; text-align: right;">
                <a href="mailto:${email}" style="color: #0ea5e9; text-decoration: none;">${email}</a>
              </div>
            </div>
            
            ${phone ? `
            <div style="margin-bottom: 25px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0ea5e9;">
              <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; text-align: right;">מספר טלפון</div>
              <div style="font-size: 16px; color: #374151; word-wrap: break-word; text-align: right;">
                <a href="tel:${phone}" style="color: #10b981; text-decoration: none;">${phone}</a>
              </div>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 25px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0ea5e9;">
              <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; text-align: right;">נושא הפניה</div>
              <div style="font-size: 16px; color: #374151; word-wrap: break-word; text-align: right;">${subject}</div>
            </div>
            
            <div style="margin-bottom: 25px; padding: 20px; background: #f0f9ff; border-radius: 12px; border-left: 4px solid #10b981;">
              <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; text-align: right;">תוכן ההודעה</div>
              <div style="font-size: 16px; color: #374151; word-wrap: break-word; line-height: 1.8; white-space: pre-wrap; text-align: right;">${message}</div>
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
            <p>אימייל זה נשלח אוטומטית מטופס יצירת קשר באתר</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template email remerciement
  getThankYouTemplate(name, subject) {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>תודה על פנייתך - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); color: white; padding: 40px; text-align: center;">
            <h1 style="text-align: center;">🎉 תודה על פנייתך!</h1>
          </div>
          <div style="padding: 40px; direction: rtl;">
            <h2 style="text-align: right;">שלום ${name},</h2>
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              תודה שפנית אלינו בנושא "<strong>${subject}</strong>".
              <br><br>
              קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.
            </div>
            <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
              <strong>⚡ זמן מענה צפוי: 2-4 שעות</strong>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280;">
            <p>HomeSherut - הפלטפורמה המובילה לשירותי בית בישראל</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Méthodes d'envoi email
  async sendResetPasswordEmail(email, resetToken, userName) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
      
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: 'איפוס סיסמה - HomeSherut',
        html: this.getResetPasswordTemplate(resetUrl, userName)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Reset password email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send reset password email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendReviewVerificationEmail(email, verificationCode, userName, serviceType) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut Reviews',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: `אימות אימייל לביקורת - HomeSherut`,
        html: this.getReviewVerificationTemplate(verificationCode, userName, serviceType)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Review verification email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send review verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendReviewConfirmationEmail(email, userName, serviceType) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: 'תודה על הביקורת - HomeSherut 🌟',
        html: this.getReviewConfirmationTemplate(userName, serviceType)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Review confirmation email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send review confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendProviderNewReviewNotification(providerEmail, providerData) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: providerEmail,
        subject: `💬 ביקורת חדשה התקבלה (${providerData.rating}⭐) - HomeSherut`,
        html: this.getProviderNewReviewNotificationTemplate(providerData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Provider notification email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send provider notification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(email, userName, userRole) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: 'ברוכים הבאים ל-HomeSherut! 🎉',
        html: this.getWelcomeTemplate(userName, userRole)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendContactEmail(formData) {
    try {
      const adminEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      
      const mailOptions = {
        from: {
          name: 'HomeSherut Contact',
          address: adminEmail
        },
        to: adminEmail,
        subject: `🏠 HomeSherut - פניה חדשה: ${formData.subject}`,
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
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: formData.email,
        subject: 'תודה על פנייתך - HomeSherut 🏠',
        html: this.getThankYouTemplate(formData.name, formData.subject)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Thank you email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send thank you email:', error);
      return { success: false, error: error.message };
    }
  }

  // ⚠️ AJOUTE CE CODE JUSTE AVANT LA MÉTHODE verifyConnection() dans ton emailService.js
// (ligne 826 environ, juste avant "async verifyConnection()")

  // ✅✅✅ NOUVEAUX TEMPLATES - SUPPRESSION DIFFÉRÉE ✅✅✅
  
  /**
   * Template email confirmation annulation d'abonnement
   */
  getSubscriptionCancellationTemplate(firstName, deletionDate) {
    const formattedDate = new Date(deletionDate).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ביטול מנוי - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header Orange/Amber -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">⏱️</div>
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">בקשת ביטול מנוי התקבלה</div>
            <div style="opacity: 0.9; font-size: 16px;">HomeSherut</div>
          </div>
          
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${firstName},</h2>
            
            <div style="font-size: 18px; line-height: 1.6; color: #374151; margin-bottom: 30px; text-align: right;">
              קיבלנו את בקשתך לביטול המנוי. אנחנו מצטערים לראות אותך עוזב! 😢
            </div>

            <!-- Section explicative -->
            <div style="background: #fffbeb; border-right: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #f59e0b; margin-top: 0; font-size: 20px;">מה קורה עכשיו?</h3>
              <ul style="color: #374151; line-height: 1.8; padding-right: 20px;">
                <li>החשבון שלך ימשיך לפעול באופן רגיל עד <strong>${formattedDate}</strong></li>
                <li>הפרופיל שלך יישאר גלוי ופעיל עד סוף התקופה</li>
                <li>תמשיך לקבל פניות מלקוחות עד סוף החודש</li>
                <li>ב-<strong>${formattedDate}</strong> החשבון יימחק אוטומטית ולצמיתות</li>
              </ul>
            </div>

            <!-- Section CTA -->
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
              <div style="color: white; font-size: 22px; font-weight: bold; margin-bottom: 16px;">💡 שינית את דעתך?</div>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 24px;">
                תוכל לבטל את בקשת המחיקה בכל עת לפני ${formattedDate}
              </div>
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="display: inline-block; background: white; color: #10b981; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px;">
                ביטול בקשת המחיקה והמשך המנוי
              </a>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p>יש שאלות? <a href="mailto:support@homesherut.com" style="color: #0ea5e9; text-decoration: none;">צור איתנו קשר</a></p>
              <p style="margin-top: 10px;">© 2025 HomeSherut. כל הזכויות שמורות.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template email confirmation annulation de la suppression
   */
  getDeletionCancelledTemplate(firstName) {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>המנוי שלך ממשיך - HomeSherut</title>
      </head>
      <body style="font-family: 'Heebo', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header Vert -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">המנוי שלך ממשיך!</div>
            <div style="opacity: 0.9; font-size: 16px;">HomeSherut</div>
          </div>
          
          <div style="padding: 40px; text-align: right; direction: rtl;">
            <h2 style="color: #1f2937; margin-bottom: 20px; text-align: right;">שלום ${firstName},</h2>
            
            <!-- Section célébration -->
            <div style="background: #d1fae5; border-right: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #059669; margin-top: 0; font-size: 22px;">🎉 שמחים שנשארת איתנו!</h3>
              <div style="color: #374151; line-height: 1.8; font-size: 16px;">
                בקשת המחיקה שלך בוטלה בהצלחה. החשבון שלך ממשיך לפעול באופן רגיל ואתה יכול להמשיך להציע את השירותים שלך בפלטפורמה.
              </div>
            </div>

            <!-- Liste fonctionnalités -->
            <div style="margin-bottom: 30px;">
              <h3 style="color: #1f2937; font-size: 18px;">מה זה אומר?</h3>
              <ul style="color: #374151; line-height: 1.8; padding-right: 20px;">
                <li>הפרופיל שלך גלוי ללקוחות ✅</li>
                <li>תוכל לקבל פניות חדשות ✅</li>
                <li>כל הפונקציות זמינות ✅</li>
                <li>המנוי שלך פעיל עד סוף התקופה ששילמת ✅</li>
              </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px;">
                מעבר לדאשבורד
              </a>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p>תודה שבחרת ב-HomeSherut! 🏠</p>
              <p style="margin-top: 10px;">© 2025 HomeSherut. כל הזכויות שמורות.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envoyer email de confirmation d'annulation d'abonnement
   */
  async sendSubscriptionCancellationEmail(email, firstName, deletionDate) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: '⏱️ בקשת ביטול מנוי התקבלה - HomeSherut',
        html: this.getSubscriptionCancellationTemplate(firstName, deletionDate)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Subscription cancellation email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send subscription cancellation email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer email de confirmation d'annulation de suppression
   */
  async sendDeletionCancelledEmail(email, firstName) {
    try {
      const mailOptions = {
        from: {
          name: 'HomeSherut',
          address: process.env.SMTP_FROM || process.env.SMTP_USER
        },
        to: email,
        subject: '✅ המנוי שלך ממשיך - HomeSherut',
        html: this.getDeletionCancelledTemplate(firstName)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Deletion cancelled email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send deletion cancelled email:', error);
      return { success: false, error: error.message };
    }
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