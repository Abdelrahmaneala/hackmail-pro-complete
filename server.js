const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // السماح لجميع المنافذ في Vercel + localhost
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5000',
            'https://*.vercel.app',
            'https://hackmail-pro-complete.vercel.app'
        ];
        
        if (!origin || allowedOrigins.some(allowed => origin.match(allowed))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        error: 'Too many requests from this IP'
    }
});
app.use(limiter);

// خدمة الملفات الثابتة للفرونت اند
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hackmail', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Models
const EmailAccount = require('./models/EmailAccount');
const EmailMessage = require('./models/EmailMessage');

const axios = require('axios');

// خدمة البريد المتعددة - بس الخدمات اللي شغالة حقيقي
class MultiEmailService {
    constructor() {
        this.services = {
            'mail.tm': this.mailtmService.bind(this),
            'guerrillamail': this.guerrillaService.bind(this)
            // شيلنا temp-mail, mintemail, maildrop لأنها مش شغالة كويس
        };
    }

    // Mail.tm Service - يعمل بشكل ممتاز
    async mailtmService(sessionId) {
        try {
            console.log('🔄 Trying Mail.tm service...');
            const domains = await this.getMailTMDomains();
            const domain = domains[Math.floor(Math.random() * domains.length)];
            const username = this.generateUsername();
            const email = `${username}@${domain}`;
            const password = this.generatePassword();

            // إنشاء الحساب في mail.tm
            const accountResponse = await axios.post('https://api.mail.tm/accounts', {
                address: email,
                password: password
            }, {
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json'
                },
                timeout: 15000
            });

            if (accountResponse.status === 201) {
                const tokenResponse = await axios.post('https://api.mail.tm/token', {
                    address: email,
                    password: password
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/ld+json'
                    },
                    timeout: 15000
                });

                const accountData = {
                    email: email,
                    password: password,
                    service: 'mail.tm',
                    sessionId: sessionId,
                    token: tokenResponse.data.token,
                    accountId: accountResponse.data.id,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ساعة
                };

                const savedAccount = await EmailAccount.create(accountData);
                console.log(`✅ Mail.tm account created: ${email}`);
                return { success: true, ...savedAccount._doc };
            }
        } catch (error) {
            console.error('❌ Mail.tm error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // GuerrillaMail Service - يعمل بشكل ممتاز
    async guerrillaService(sessionId) {
        try {
            console.log('🔄 Trying GuerrillaMail service...');
            const response = await axios.get('https://www.guerrillamail.com/ajax.php?f=get_email_address&ip=&agent=Mozilla_foo_bar', {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.email_addr) {
                const accountData = {
                    email: response.data.email_addr,
                    password: 'not_required',
                    service: 'guerrillamail',
                    sessionId: sessionId,
                    token: response.data.sid_token || response.data.email_token,
                    accountId: response.data.email_addr,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 ساعة
                };

                const savedAccount = await EmailAccount.create(accountData);
                console.log(`✅ GuerrillaMail account created: ${response.data.email_addr}`);
                return { success: true, ...savedAccount._doc };
            }
        } catch (error) {
            console.error('❌ GuerrillaMail error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getMailTMDomains() {
        try {
            const response = await axios.get('https://api.mail.tm/domains', {
                timeout: 10000
            });
            return response.data['hydra:member'].map(d => d.domain);
        } catch (error) {
            console.log('⚠️ Using fallback domains for Mail.tm');
            return ['mail.tm', 'bugfoo.com', 'dcctb.com'];
        }
    }

    generateUsername() {
        const adjectives = ['quick', 'bold', 'clever', 'smart', 'fast', 'strong', 'brave', 'calm', 'deep', 'fair'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'tiger', 'bear', 'hawk', 'shark', 'owl', 'falcon'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`.toLowerCase();
    }

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async createAccount(sessionId, service = null) {
        const availableServices = Object.keys(this.services);
        
        // إذا طلب خدمة محددة
        if (service && this.services[service]) {
            console.log(`🎯 Creating account with specific service: ${service}`);
            const result = await this.services[service](sessionId);
            if (result.success) return result;
            
            console.log(`❌ Specific service ${service} failed, trying others...`);
        }

        // تجربة جميع الخدمات بالتسلسل
        const shuffledServices = [...availableServices].sort(() => Math.random() - 0.5);
        
        for (const serviceName of shuffledServices) {
            console.log(`🔄 Trying service: ${serviceName}`);
            const result = await this.services[serviceName](sessionId);
            if (result.success) {
                console.log(`✅ Success with service: ${serviceName}`);
                return result;
            }
        }

        return { success: false, error: 'All services failed. Please try again later.' };
    }

    async getMessages(accountId, email, service) {
        try {
            const account = await EmailAccount.findOne({ accountId });
            if (!account) {
                console.log(`❌ Account not found: ${accountId}`);
                return [];
            }

            let rawMessages = [];
            
            switch (service) {
                case 'mail.tm':
                    rawMessages = await this.getMailTMMessages(account.token);
                    break;
                case 'guerrillamail':
                    rawMessages = await this.getGuerrillaMessages(account.token || account.email);
                    break;
            }

            // معالجة الرسائل مع جلب المحتوى الكامل
            const processedMessages = await this.processMessagesWithFullContent(rawMessages, service, account, email);
            
            // حفظ الرسائل في MongoDB
            for (const msg of processedMessages) {
                await EmailMessage.findOneAndUpdate(
                    { 
                        messageId: msg.id, 
                        accountId: accountId 
                    },
                    { 
                        ...msg, 
                        accountId: accountId,
                        email: email,
                        service: service,
                        lastChecked: new Date() 
                    },
                    { upsert: true, new: true }
                );
            }

            console.log(`✅ تم جلب ${processedMessages.length} رسالة لـ ${email} (${service})`);
            return processedMessages;
            
        } catch (error) {
            console.error('❌ Error fetching messages:', error);
            return [];
        }
    }

    async processMessagesWithFullContent(rawMessages, service, account, email) {
        if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
            return [];
        }

        const processedMessages = [];
        
        for (const rawMsg of rawMessages) {
            try {
                let fullContent = '';
                let messageDetails = {};

                // جلب المحتوى الكامل حسب الخدمة
                switch (service) {
                    case 'mail.tm':
                        messageDetails = await this.getMailTMFullMessage(account.token, rawMsg.id);
                        fullContent = this.formatMailTMContent(messageDetails, rawMsg);
                        break;
                    case 'guerrillamail':
                        messageDetails = await this.getGuerrillaFullMessage(account.token, rawMsg.mail_id || rawMsg.id);
                        fullContent = this.formatGuerrillaContent(messageDetails, rawMsg);
                        break;
                }

                if (!fullContent || fullContent.trim() === '') {
                    console.log(`⚠️ تخطي رسالة بدون محتوى: ${rawMsg.id}`);
                    continue;
                }

                const processedMsg = {
                    id: rawMsg.id || rawMsg.mail_id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    sender: this.extractSender(rawMsg, service),
                    subject: this.extractSubject(rawMsg, service),
                    content: fullContent,
                    preview: this.generatePreview(fullContent),
                    date: this.extractDate(rawMsg, service),
                    unread: this.isUnread(rawMsg, service),
                    service: service
                };

                processedMessages.push(processedMsg);
                
            } catch (error) {
                console.error(`❌ Error processing message:`, error);
                continue;
            }
        }

        return processedMessages;
    }

    // دوال مساعدة لاستخراج المعلومات
    extractSender(rawMsg, service) {
        switch (service) {
            case 'mail.tm':
                return rawMsg.from?.name || rawMsg.from?.address || 'Unknown Sender';
            case 'guerrillamail':
                return rawMsg.mail_from || 'Unknown Sender';
            default:
                return rawMsg.from?.address || rawMsg.from || rawMsg.sender || 'Unknown Sender';
        }
    }

    extractSubject(rawMsg, service) {
        switch (service) {
            case 'mail.tm':
                return rawMsg.subject || 'No Subject';
            case 'guerrillamail':
                return rawMsg.mail_subject || 'No Subject';
            default:
                return rawMsg.subject || rawMsg.mail_subject || 'No Subject';
        }
    }

    extractDate(rawMsg, service) {
        switch (service) {
            case 'mail.tm':
                return rawMsg.createdAt ? new Date(rawMsg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
            case 'guerrillamail':
                return rawMsg.mail_timestamp ? new Date(rawMsg.mail_timestamp * 1000).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
            default:
                return rawMsg.date || rawMsg.createdAt || new Date().toLocaleString('ar-EG');
        }
    }

    isUnread(rawMsg, service) {
        switch (service) {
            case 'mail.tm':
                return !rawMsg.seen;
            case 'guerrillamail':
                return rawMsg.mail_read !== 1;
            default:
                return rawMsg.unread !== false;
        }
    }

    // دوال تنسيق المحتوى
    formatMailTMContent(messageDetails, rawMsg) {
        if (messageDetails && messageDetails.text) {
            return this.createDetailedContent(
                rawMsg.from?.name || rawMsg.from?.address,
                rawMsg.subject,
                messageDetails.text,
                messageDetails.html,
                'Mail.tm',
                rawMsg.createdAt
            );
        }
        return this.createDetailedContent(
            rawMsg.from?.name || rawMsg.from?.address,
            rawMsg.subject,
            rawMsg.intro || 'No content available from Mail.tm',
            null,
            'Mail.tm',
            rawMsg.createdAt
        );
    }

    formatGuerrillaContent(messageDetails, rawMsg) {
        if (messageDetails && messageDetails.mail_body) {
            return this.createDetailedContent(
                rawMsg.mail_from,
                rawMsg.mail_subject,
                messageDetails.mail_body,
                null,
                'GuerrillaMail',
                rawMsg.mail_timestamp
            );
        }
        return this.createDetailedContent(
            rawMsg.mail_from,
            rawMsg.mail_subject,
            rawMsg.mail_excerpt || 'No content available from GuerrillaMail',
            null,
            'GuerrillaMail',
            rawMsg.mail_timestamp
        );
    }

    // دالة لإنشاء محتوى مفصل
    createDetailedContent(sender, subject, textContent, htmlContent, service, date) {
        const timestamp = date ? new Date(date).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
        
        let content = `
📧 تفاصيل الرسالة الكاملة
══════════════════════════════════════

📋 المعلومات الأساسية:
────────────────────
• 🏷️  الموضوع: ${subject || 'بدون موضوع'}
• 👤 المرسل: ${sender || 'غير معروف'}
• 🕐 التاريخ: ${timestamp}
• 🛠️  الخدمة: ${service}
• 📬 حالة الرسالة: ${textContent ? 'مستلمة بنجاح' : 'غير متاحة'}

📄 محتوى الرسالة:
────────────────
${textContent || 'لا يوجد محتوى نصي'}

`;

        if (htmlContent) {
            content += `
🌐 المحتوى HTML:
────────────────
${htmlContent}

`;
        }

        content += `
🔍 المعلومات التقنية:
───────────────────
• ⏰ وقت المعالجة: ${new Date().toLocaleString('ar-EG')}
• 📊 حجم المحتوى: ${textContent ? textContent.length + ' حرف' : 'غير محدد'}
• 🔄 مصدر البيانات: ${service}
• 🆔 معرف فريد: ${Math.random().toString(36).substr(2, 9).toUpperCase()}

══════════════════════════════════════
💡 تم استلام هذه الرسالة عبر نظام HackMail Pro
        `;

        return content;
    }

    // دالة لإنشاء معاينة
    generatePreview(content) {
        if (!content) return 'لا يوجد محتوى للمعاينة';
        const cleanContent = content.replace(/\n\s*\n/g, '\n').trim();
        const preview = cleanContent.substring(0, 120);
        return cleanContent.length > 120 ? preview + '...' : preview;
    }

    // دوال جلب المحتوى الكامل
    async getMailTMFullMessage(token, messageId) {
        try {
            const response = await axios.get(`https://api.mail.tm/messages/${messageId}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching Mail.tm full message:', error.message);
            return null;
        }
    }

    async getGuerrillaFullMessage(sidToken, messageId) {
        try {
            const response = await axios.get(`https://www.guerrillamail.com/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${sidToken}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching GuerrillaMail full message:', error.message);
            return null;
        }
    }

    // دوال جلب الرسائل الأساسية
    async getMailTMMessages(token) {
        try {
            const response = await axios.get('https://api.mail.tm/messages', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 20000
            });
            return response.data['hydra:member'] || [];
        } catch (error) {
            console.error('❌ Mail.tm messages error:', error.message);
            return [];
        }
    }

    async getGuerrillaMessages(sidToken) {
        try {
            const response = await axios.get(`https://www.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.data.list || [];
        } catch (error) {
            console.error('❌ GuerrillaMail messages error:', error.message);
            return [];
        }
    }

    async getServiceStatus() {
        const accountsCount = await EmailAccount.countDocuments();
        const messagesCount = await EmailMessage.countDocuments();
        
        return {
            currentService: 'multi-service',
            domains: 15,
            availableServices: Object.keys(this.services),
            status: 'active',
            activeAccounts: accountsCount,
            totalMessages: messagesCount
        };
    }
}

const emailService = new MultiEmailService();

// Routes
app.get('/api/health', async (req, res) => {
    const accountsCount = await EmailAccount.countDocuments();
    const messagesCount = await EmailMessage.countDocuments();
    
    res.json({
        success: true,
        status: 'OK',
        message: '🚀 HackMail Pro with MongoDB is Running',
        timestamp: new Date().toISOString(),
        database: {
            status: 'connected',
            accounts: accountsCount,
            messages: messagesCount
        },
        services: Object.keys(emailService.services) // بس الخدمات الشغالة
    });
});

app.post('/api/email/create', async (req, res) => {
    try {
        const { sessionId = 'session_' + Date.now(), service } = req.body;
        
        console.log(`🎯 Creating email with service: ${service || 'auto'}`);

        const result = await emailService.createAccount(sessionId, service);

        if (result.success) {
            res.json({
                success: true,
                email: result.email,
                password: result.password,
                accountId: result.accountId,
                service: result.service,
                sessionId: result.sessionId,
                expiresAt: result.expiresAt,
                message: `Email created successfully using ${result.service}`
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Create email error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create email account'
        });
    }
});

app.get('/api/email/messages', async (req, res) => {
    try {
        const { accountId, email, service } = req.query;
        
        if (!accountId || !email || !service) {
            return res.status(400).json({
                success: false,
                error: 'Account ID, email, and service are required'
            });
        }

        const messages = await emailService.getMessages(accountId, email, service);

        res.json({
            success: true,
            messages: messages,
            count: messages.length,
            service: service,
            email: email
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});

app.get('/api/email/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const accounts = await EmailAccount.find({ sessionId }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            sessionId: sessionId,
            accounts: accounts.map(acc => ({
                id: acc.accountId,
                email: acc.email,
                service: acc.service,
                createdAt: acc.createdAt,
                expiresAt: acc.expiresAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session accounts'
        });
    }
});

app.get('/api/email/services/status', async (req, res) => {
    const status = await emailService.getServiceStatus();
    
    res.json({
        success: true,
        ...status,
        message: 'All services are operational'
    });
});

app.delete('/api/email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        await EmailAccount.deleteOne({ email });
        await EmailMessage.deleteMany({ email });
        
        res.json({
            success: true,
            message: `Email ${email} deleted successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete email'
        });
    }
});

// Route للصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// معالجة جميع الطلبات الأخرى
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Vercel compatibility - export the app
module.exports = app;

// Only listen locally, not on Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 HackMail Pro Server running on port ${PORT}`);
        console.log(`📧 Supported services: ${Object.keys(emailService.services).join(', ')}`);
        console.log(`💾 Database: MongoDB`);
        console.log(`🌐 Frontend: http://localhost:${PORT}`);
        console.log(`🔗 API: http://localhost:${PORT}/api/health`);
    });
}
