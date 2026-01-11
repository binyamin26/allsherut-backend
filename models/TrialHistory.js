const crypto = require('crypto');
const { query } = require('../config/database');

class TrialHistory {
    
    static hashEmail(email) {
        if (!email) return null;
        const normalized = email.toLowerCase().trim();
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }
    
    static hashName(name) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }
    
    static encryptEmail(email) {
        if (!email || !process.env.ENCRYPTION_KEY) return null;
        
        try {
            const algorithm = 'aes-256-cbc';
            const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(email, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error('Erreur chiffrement email:', error);
            return null;
        }
    }
    
    static decryptEmail(encrypted) {
        if (!encrypted || !process.env.ENCRYPTION_KEY) return null;
        
        try {
            const algorithm = 'aes-256-cbc';
            const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
            
            const [ivHex, encryptedData] = encrypted.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Erreur déchiffrement email:', error);
            return null;
        }
    }

 static async hasUsedTrial(email, serviceType) {
    try {
        const emailHash = this.hashEmail(email);
        
const sql = `
            SELECT 
                th.id,
                th.trial_used_at,
                th.user_deleted,
                th.deleted_at,
                th.original_user_id,
                th.service_type
            FROM trial_history th
            INNER JOIN users u ON th.original_user_id = u.id AND u.is_active = 1
            WHERE th.email_hash = ? 
              AND th.service_type = ? 
              AND th.user_deleted = FALSE
            LIMIT 1
        `;
        
       const results = await query(sql, [emailHash, serviceType]);
        
        if (results.length > 0) {
            return {
                hasUsedTrial: true,
                details: {
                    trialUsedAt: results[0].trial_used_at,
                    userDeleted: results[0].user_deleted,
                    deletedAt: results[0].deleted_at,
                    originalUserId: results[0].original_user_id,
                    serviceType: results[0].service_type
                }
            };
        }
        
        return {
            hasUsedTrial: false,
            details: null
        };
        
    } catch (error) {
        console.error('Erreur vérification trial par téléphone:', error);
        throw new Error('Erreur lors de la vérification du trial');
    }
}
   
static async hasUsedTrialByPhone(phone, serviceType) {
    try {
        if (!phone) {
            return { hasUsedTrial: false, details: null };
        }
        
        const phoneHash = this.hashName(phone);
        
        console.log('🔍 CHECK PHONE TRIAL:');
        console.log('  Phone reçu:', phone);
        console.log('  Phone hash:', phoneHash.substring(0, 10) + '...');
        console.log('  Service demandé:', serviceType);
        
      const sql = `
            SELECT 
                th.id,
                th.trial_used_at,
                th.user_deleted,
                th.deleted_at,
                th.original_user_id,
                th.service_type
            FROM trial_history th
            INNER JOIN users u ON th.original_user_id = u.id AND u.is_active = 1
            WHERE th.phone_hash = ? 
              AND th.service_type = ? 
              AND th.user_deleted = FALSE
            LIMIT 1
        `;
        
        const results = await query(sql, [phoneHash, serviceType]);
        
        console.log('  Résultats trouvés:', results.length);
        if (results.length > 0) {
            console.log('  ⚠️ Service en conflit:', results[0].service_type);
        }
        
        if (results.length > 0) {
            return {
                hasUsedTrial: true,
                details: {
                    trialUsedAt: results[0].trial_used_at,
                    userDeleted: results[0].user_deleted,
                    deletedAt: results[0].deleted_at,
                    originalUserId: results[0].original_user_id,
                    serviceType: results[0].service_type
                }
            };
        }
        
        return {
            hasUsedTrial: false,
            details: null
        };
        
    } catch (error) {
        console.error('Erreur vérification trial par téléphone:', error);
        throw new Error('Erreur lors de la vérification du trial');
    }
}

  static async recordTrialUsage(userId, email, phone, serviceType) {
    try {
        const emailHash = this.hashEmail(email);
        const emailEncrypted = this.encryptEmail(email);
        const phoneHash = phone ? this.hashName(phone) : null;
        
        const sql = `
            INSERT INTO trial_history (
                email_hash,
                email_encrypted,
                phone_hash,
                service_type,
                original_user_id,
                trial_used_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                original_user_id = VALUES(original_user_id)
        `;
        
        const result = await query(sql, [
            emailHash,
            emailEncrypted,
            phoneHash,
            serviceType,
            userId
        ]);
        
        console.log(`✅ Trial enregistré pour user ${userId} - service ${serviceType}`);
        
        return result.insertId || result.affectedRows;
        
    } catch (error) {
        console.error('Erreur enregistrement trial:', error);
        throw new Error('Erreur lors de l\'enregistrement du trial');
    }
}
    
    static async markAccountDeleted(email) {
        try {
            const emailHash = this.hashEmail(email);
            
            const sql = `
                UPDATE trial_history
                SET user_deleted = TRUE,
                    deleted_at = NOW()
                WHERE email_hash = ?
            `;
            
            const result = await query(sql, [emailHash]);
            
            console.log(`✅ Compte marqué comme supprimé dans trial_history (email hash: ${emailHash.substring(0, 10)}...)`);
            
            return result.affectedRows > 0;
            
        } catch (error) {
            console.error('Erreur marquage compte supprimé:', error);
            return false;
        }
    }

    static async markAccountDeletedForService(email, serviceType) {
    try {
        const emailHash = this.hashEmail(email);
        
        const sql = `
            UPDATE trial_history
            SET user_deleted = TRUE,
                deleted_at = NOW()
            WHERE email_hash = ? AND service_type = ?
        `;
        
        const result = await query(sql, [emailHash, serviceType]);
        
        console.log(`✅ Service ${serviceType} marqué comme supprimé dans trial_history (email hash: ${emailHash.substring(0, 10)}...)`);
        
        return result.affectedRows > 0;
        
    } catch (error) {
        console.error('Erreur marquage service supprimé:', error);
        return false;
    }
}
    
    static async getStatistics() {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_trials,
                    COUNT(CASE WHEN user_deleted = TRUE THEN 1 END) as deleted_accounts,
                    COUNT(CASE WHEN user_deleted = FALSE THEN 1 END) as active_accounts,
                    MIN(trial_used_at) as first_trial,
                    MAX(trial_used_at) as last_trial
                FROM trial_history
            `;
            
            const results = await query(sql);
            
            return results[0] || {
                total_trials: 0,
                deleted_accounts: 0,
                active_accounts: 0,
                first_trial: null,
                last_trial: null
            };
            
        } catch (error) {
            console.error('Erreur récupération statistiques:', error);
            throw new Error('Erreur lors de la récupération des statistiques');
        }
    }
    
    static async findByEmail(email) {
        try {
            const emailHash = this.hashEmail(email);
            
            const sql = `
                SELECT 
                    id,
                    email_encrypted,
                    trial_used_at,
                    user_deleted,
                    deleted_at,
                    original_user_id
                FROM trial_history
                WHERE email_hash = ?
                LIMIT 1
            `;
            
            const results = await query(sql, [emailHash]);
            
            if (results.length === 0) return null;
            
            const record = results[0];
            
            if (record.email_encrypted) {
                record.email = this.decryptEmail(record.email_encrypted);
            }
            
            delete record.email_encrypted;
            
            return record;
            
        } catch (error) {
            console.error('Erreur recherche email:', error);
            return null;
        }
    }
}

module.exports = TrialHistory;