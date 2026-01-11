// constants/messages.js - Messages unifiés en hébreu
/**
 * Messages système unifiés pour HomeSherut
 * Tous les messages utilisateur en hébreu, logs développeur en français
 */

const MESSAGES = {
  
  // =============================================
  // SUCCÈS - Actions réussies
  // =============================================
  SUCCESS: {
    AUTH: {
      LOGIN: 'התחברות הצליחה!',
      LOGOUT: 'התנתקות הצליחה',
      REGISTER: 'הרשמה הצליחה!',
      PASSWORD_CHANGED: 'הסיסמה שונתה בהצלחה',
      PASSWORD_RESET: 'הסיסמה שונתה בהצלחה',
      PROFILE_UPDATED: 'הפרופיל עודכן בהצלחה',
      EMAIL_SENT: 'אם כתובת האימייל קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה'
    },
    
    PROVIDER: {
      PROFILE_COMPLETED: 'פרופיל השירות הושלם בהצלחה!',
      PROFILE_UPDATED: 'פרופיל השירות עודכן בהצלחה',
      FREE_MONTH_GRANTED: 'קיבלת חודש פרימיום חינם!',
      DETAILS_SAVED: 'פרטי השירות נשמרו בהצלחה'
    },
    
    CLIENT: {
      CONTACT_SENT: 'הודעה נשלחה לספק השירות',
      CREDITS_GRANTED: 'קיבלת 3 צפיות חינמיות!',
      FAVORITE_ADDED: 'נוסף למועדפים',
      FAVORITE_REMOVED: 'הוסר מהמועדפים'
    },
    
    UPLOAD: {
      IMAGE_UPLOADED: 'תמונת הפרופיל הועלתה בהצלחה',
      IMAGE_DELETED: 'תמונת הפרופיל הוסרה בהצלחה',
      FILE_PROCESSED: 'הקובץ עובד בהצלחה'
    },
    
    SYSTEM: {
      DATA_LOADED: 'נתונים נטענו בהצלחה',
      SEARCH_COMPLETED: 'חיפוש הושלם בהצלחה',
      FILTERS_APPLIED: 'מסננים הוחלו בהצלחה',
      STATS_LOADED: 'סטטיסטיקות נטענו בהצלחה'
    }
  },

  // =============================================
  // ERREURS - Messages d'erreur utilisateur
  // =============================================
  ERROR: {
    AUTH: {
      INVALID_CREDENTIALS: 'האימייל או הסיסמה שגויים',
      EMAIL_EXISTS: 'כתובת האימייל כבר קיימת במערכת',
      PASSWORD_TOO_WEAK: 'הסיסמה חייבת להכיל לפחות 8 תווים',
      PASSWORD_MISMATCH: 'הסיסמה הנוכחית שגויה',
      TOKEN_EXPIRED: 'פג תוקף ההתחברות. אנא התחבר מחדש',
      TOKEN_INVALID: 'טוקן איפוס לא תקף או פג תוקף',
      ACCESS_DENIED: 'אין הרשאה לפעולה זו',
      LOGIN_REQUIRED: 'נדרשת התחברות למערכת',
      RATE_LIMITED: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות'
    },
    
    VALIDATION: {
      REQUIRED_FIELD: 'שדה חובה חסר',
      INVALID_EMAIL: 'כתובת אימייל לא תקינה',
      INVALID_PHONE: 'מספר טלפון לא תקין (05xxxxxxxx)',
      INVALID_FORMAT: 'פורמט לא תקין',
      DATA_INVALID: 'נתונים לא תקינים',
      PASSWORD_COMPLEXITY: 'הסיסמה חייבת להכיל לפחות אות גדולה, אות קטנה וספרה',
      COMMON_PASSWORD: 'הסיסמה לא יכולה להכיל מילים נפוצות'
    },
    
    RESOURCE: {
      USER_NOT_FOUND: 'משתמש לא נמצא',
      PROVIDER_NOT_FOUND: 'ספק השירות לא נמצא או אינו זמין',
      PROFILE_NOT_FOUND: 'פרופיל לא נמצא',
      RESOURCE_NOT_FOUND: 'המשאב המבוקש לא נמצא',
      PROFILE_INCOMPLETE: 'פרופיל לא הושלם'
    },
    
    BUSINESS: {
      CREDITS_INSUFFICIENT: 'אין מספיק קרדיטים. שדרג לפרימיום',
      PREMIUM_REQUIRED: 'נדרש חשבון פרימיום',
      SERVICE_UNAVAILABLE: 'השירות אינו זמין כרגע',
      ALREADY_CONTACTED: 'כבר יצרת קשר עם ספק זה החודש',
      MAX_CONTACTS_REACHED: 'הגעת למקסימום צפיות החודש (3)'
    },
    
    UPLOAD: {
      FILE_TOO_LARGE: 'הקובץ גדול מדי. מקסימום 5MB',
      INVALID_FILE_TYPE: 'רק קבצי תמונה מותרים (JPEG, PNG, WebP)',
      UPLOAD_FAILED: 'שגיאה בהעלאת התמונה',
      NO_FILE_SELECTED: 'לא נבחר קובץ'
    },
    
    SYSTEM: {
      SERVER_ERROR: 'שגיאת שרת פנימית',
      DATABASE_ERROR: 'שגיאה במאגר המידע',
      EXTERNAL_SERVICE: 'שגיאה בשירות חיצוני',
      CONFIGURATION_ERROR: 'שגיאה בהגדרות המערכת',
      NETWORK_ERROR: 'שגיאה ברשת. בדוק את החיבור לאינטרנט',
      MAINTENANCE: 'המערכת בתחזוקה. נסה שוב מאוחר יותר'
    },
    
    EMAIL: {
      SEND_FAILED: 'שגיאה בשליחת האימייל',
      SERVICE_UNAVAILABLE: 'שירות האימייל אינו זמין',
      INVALID_TEMPLATE: 'תבנית אימייל לא תקינה',
      RATE_LIMITED: 'ניתן לבקש איפוס סיסמה עד 3 פעמים בכל 15 דקות'
    }
  },

  // =============================================
  // INFORMATIONS - Messages informatifs
  // =============================================
  INFO: {
    SEARCH: {
      NO_RESULTS: 'לא נמצאו תוצאות המתאימות לחיפוש',
      REFINE_SEARCH: 'נסה לשנות את מונחי החיפוש או הסר מסננים',
      RESULTS_FOUND: 'נמצאו {count} תוצאות',
      LOADING: 'טוען תוצאות...'
    },
    
    PROVIDER: {
      VERIFICATION_PENDING: 'הפרופיל שלך ממתין לאימות',
      PROFILE_VIEWED: 'הפרופיל שלך נצפה {count} פעמים השבוע',
      NEW_CONTACT: 'יש לך הודעה חדשה מלקוח',
      PREMIUM_EXPIRES: 'החשבון הפרימיום יפוג בעוד {days} ימים'
    },
    
    CLIENT: {
      CREDITS_REMAINING: 'נותרו לך {count} צפיות חינמיות החודש',
      PREMIUM_BENEFITS: 'עם פרימיום תקבל צפיות ללא הגבלה',
      CONTACT_SENT: 'ההודעה נשלחה. הספק יחזור אליך בהקדם',
      SAVE_FAVORITE: 'שמור בעדפות כדי לא לאבד את הספק'
    },
    
    GENERAL: {
      WELCOME: 'ברוכים הבאים להומשרות!',
      LOADING: 'טוען...',
      PROCESSING: 'מעבד...',
      SAVING: 'שומר...',
      SUCCESS: 'פעולה הושלמה בהצלחה',
      PLEASE_WAIT: 'אנא המתן...'
    }
  },

  // =============================================
  // LABELS - Étiquettes interface
  // =============================================
  LABELS: {
    SERVICES: {
      babysitting: 'בייביסיטר',
      cleaning: 'ניקיון',
      gardening: 'גינון', 
      petcare: 'טיפוח חיות מחמד',
      tutoring: 'שיעורים פרטיים',
      eldercare: 'עזרה לקשישים'
    },
    
    ROLES: {
      client: 'לקוח',
      provider: 'ספק שירות',
      admin: 'מנהל'
    },
    
    STATUS: {
      active: 'פעיל',
      inactive: 'לא פעיל',
      pending: 'ממתין',
      verified: 'מאומת',
      suspended: 'מושעה'
    },
    
    CONTACT: {
      phone: 'טלפון',
      email: 'אימייל',
      whatsapp: 'וואטסאפ',
      telegram: 'טלגרם'
    }
  }
};

// =============================================
// LOGS DÉVELOPPEUR (français)
// =============================================
const DEV_LOGS = {
  AUTH: {
    LOGIN_ATTEMPT: 'Tentative de connexion pour email:',
    LOGIN_SUCCESS: 'Connexion réussie pour utilisateur ID:',
    LOGIN_FAILED: 'Échec connexion pour email:',
    TOKEN_GENERATED: 'Token JWT généré pour utilisateur:',
    TOKEN_VERIFIED: 'Token vérifié avec succès:',
    PASSWORD_RESET_REQUESTED: 'Reset password demandé pour:',
    PASSWORD_RESET_COMPLETED: 'Reset password complété pour:'
  },
  
  DATABASE: {
    QUERY_EXECUTED: 'Requête exécutée:',
    QUERY_ERROR: 'Erreur requête SQL:',
    CONNECTION_ERROR: 'Erreur connexion DB:',
    TRANSACTION_START: 'Transaction démarrée',
    TRANSACTION_COMMIT: 'Transaction commitée',
    TRANSACTION_ROLLBACK: 'Transaction rollback'
  },
  
  API: {
    REQUEST_RECEIVED: 'Requête reçue:',
    RESPONSE_SENT: 'Réponse envoyée:',
    ERROR_OCCURRED: 'Erreur survenue dans:',
    VALIDATION_FAILED: 'Validation échouée:',
    UPLOAD_STARTED: 'Upload démarré:',
    UPLOAD_COMPLETED: 'Upload terminé:'
  },
  
  BUSINESS: {
    PROVIDER_CREATED: 'Provider créé avec ID:',
    PROFILE_COMPLETED: 'Profil provider complété:',
    CONTACT_ATTEMPT: 'Tentative contact client vers provider:',
    CREDIT_USED: 'Crédit utilisé par client:',
    PREMIUM_GRANTED: 'Premium accordé à utilisateur:'
  }
};

// =============================================
// HELPERS
// =============================================
const formatMessage = (template, variables = {}) => {
  let message = template;
  Object.keys(variables).forEach(key => {
    message = message.replace(`{${key}}`, variables[key]);
  });
  return message;
};

const getServiceLabel = (serviceType) => {
  return MESSAGES.LABELS.SERVICES[serviceType] || serviceType;
};

const getRoleLabel = (role) => {
  return MESSAGES.LABELS.ROLES[role] || role;
};

module.exports = {
  MESSAGES,
  DEV_LOGS,
  formatMessage,
  getServiceLabel,
  getRoleLabel
};