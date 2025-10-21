// file name: public/script.js
class HackMailPro {
    constructor() {
        this.baseURL = window.location.origin;
        this.sessionId = this.generateSessionId();
        this.currentAccount = null;
        this.autoRefresh = true;
        this.refreshInterval = null;
        this.services = ['mail.tm', 'guerrillamail'];
        this.allMessages = [];
        
        this.init();
    }

    init() {
        this.log('جاري تهيئة نظام HackMail Pro v5.0...', 'info');
        this.validateDOMElements();
        this.updateConnectionStatus();
        this.loadServiceStatus();
        this.startAutoRefresh();
        this.loadSessionAccounts();
        this.updateServerTime();
        
        // تحديث الوقت كل ثانية
        setInterval(() => this.updateServerTime(), 1000);
    }

    validateDOMElements() {
        const requiredElements = [
            'serverTime',
            'currentTime', 
            'connectionStatus',
            'servicesCount',
            'dbStatus',
            'serviceSelect',
            'accountsList',
            'accountsCount',
            'messagesList',
            'messagesCount',
            'consoleOutput',
            'currentService',
            'loadingOverlay'
        ];
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`⚠️ العنصر ${id} غير موجود في الـ DOM`);
            }
        });
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async apiCall(endpoint, options = {}) {
        this.showLoading();
        
        try {
            const timestamp = new Date().getTime();
            const url = endpoint.includes('?') 
                ? `${this.baseURL}${endpoint}&t=${timestamp}`
                : `${this.baseURL}${endpoint}?t=${timestamp}`;

            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.hideLoading();
            
            return data;
        } catch (error) {
            this.hideLoading();
            this.log(`خطأ في الاتصال: ${error.message}`, 'error');
            throw error;
        }
    }

    async createEmail() {
        const serviceSelect = document.getElementById('serviceSelect');
        const selectedService = serviceSelect.value;
        
        try {
            this.log(`جاري إنشاء إيميل جديد... ${selectedService ? `باستخدام ${selectedService}` : 'تلقائياً'}`, 'info');
            
            const result = await this.apiCall('/api/email/create', {
                method: 'POST',
                body: JSON.stringify({ 
                    sessionId: this.sessionId,
                    service: selectedService || null
                })
            });

            if (result.success) {
                this.log(`✅ تم إنشاء الإيميل: ${result.email} (${result.service})`, 'success');
                this.currentAccount = {
                    email: result.email,
                    accountId: result.accountId,
                    service: result.service,
                    password: result.password,
                    expiresAt: result.expiresAt
                };
                this.updateAccountsList();
                this.updateServiceStatus();
                this.autoRefresh = true;
                
                // عرض تفاصيل الحساب
                this.showAccountDetails(result);
            }
        } catch (error) {
            this.log(`❌ فشل في إنشاء الإيميل: ${error.message}`, 'error');
        }
    }

    showAccountDetails(result) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            outputElement.innerHTML = `
                <div class="account-details">
                    <h3>✅ تم إنشاء الإيميل بنجاح</h3>
                    <div class="account-info">
                        <p><strong>📧 الإيميل:</strong> ${result.email}</p>
                        <p><strong>🔐 كلمة المرور:</strong> ${result.password || 'غير مطلوبة'}</p>
                        <p><strong>🛠️ الخدمة:</strong> ${result.service}</p>
                        <p><strong>🌐 النطاق:</strong> ${result.email.split('@')[1]}</p>
                        <p><strong>⏰ ينتهي في:</strong> ${result.expiresAt ? new Date(result.expiresAt).toLocaleString('ar-EG') : '24 ساعة'}</p>
                    </div>
                    <div class="account-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard('${result.email}')">
                            📋 نسخ الإيميل
                        </button>
                        <button class="btn btn-success" onclick="checkMessages()">
                            📨 فحص الرسائل
                        </button>
                        <button class="btn btn-warning" onclick="createEmail()">
                            🔄 إيميل جديد
                        </button>
                    </div>
                    <div class="account-tips">
                        <p><strong>💡 نصائح الاستخدام:</strong></p>
                        <ul>
                            <li>انسخ الإيميل واستخدمه للتسجيل في أي منصة</li>
                            <li>الرسائل ستظهر هنا تلقائياً عند استقبالها</li>
                            <li>يمكنك إنشاء عدة إيميلات في نفس الوقت</li>
                            <li>الإيميل صالح لمدة 24 ساعة من وقت الإنشاء</li>
                            <li>يعمل مع جميع المنصات والخدمات</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    }

    async checkMessages() {
        if (!this.currentAccount) {
            this.log('⚠️ لا يوجد حساب نشط', 'warning');
            return;
        }

        try {
            this.log('جاري فحص الرسائل...', 'info');
            
            const result = await this.apiCall(
                `/api/email/messages?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}&service=${encodeURIComponent(this.currentAccount.service)}`
            );
            
            if (result.success) {
                this.allMessages = result.messages;
                this.updateMessagesList(result.messages);
                this.log(`✅ تم تحديث الرسائل: ${result.messages.length} رسالة`, 'success');
                
                // إذا كانت هناك رسائل غير مقروءة، نعرض إشعار
                const unreadCount = result.messages.filter(msg => msg.unread).length;
                if (unreadCount > 0) {
                    this.showMessageNotification(unreadCount);
                }
            }
        } catch (error) {
            this.log(`❌ فشل في جلب الرسائل: ${error.message}`, 'error');
        }
    }

    async loadServiceStatus() {
        try {
            const result = await this.apiCall('/api/email/services/status');
            
            if (result.success) {
                this.updateConnectionStatus('online');
                this.updateServicesStatus(result);
                const dbStatusElement = document.getElementById('dbStatus');
                if (dbStatusElement) {
                    dbStatusElement.textContent = 'متصل';
                }
                const servicesCountElement = document.getElementById('servicesCount');
                if (servicesCountElement) {
                    servicesCountElement.textContent = `${result.availableServices.length}/${this.services.length}`;
                }
            }
        } catch (error) {
            this.updateConnectionStatus('offline');
            const dbStatusElement = document.getElementById('dbStatus');
            if (dbStatusElement) {
                dbStatusElement.textContent = 'غير متصل';
            }
            this.log('⚠️ لا يمكن الاتصال بالخادم', 'warning');
        }
    }

    async loadSessionAccounts() {
        try {
            const result = await this.apiCall(`/api/email/session/${this.sessionId}`);
            if (result.success && result.accounts.length > 0) {
                this.currentAccount = {
                    email: result.accounts[0].email,
                    accountId: result.accounts[0].id,
                    service: result.accounts[0].service,
                    expiresAt: result.accounts[0].expiresAt
                };
                this.updateAccountsList();
                this.log(`📧 تم تحميل الحساب: ${this.currentAccount.email}`, 'success');
                
                // فحص الرسائل تلقائياً
                this.checkMessages();
            }
        } catch (error) {
            this.log('لا توجد حسابات نشطة في الجلسة', 'info');
        }
    }

    updateServicesStatus(status) {
        const statusElement = document.getElementById('servicesStatus');
        if (statusElement) {
            let statusHTML = '<div class="services-grid">';
            
            this.services.forEach(service => {
                const isActive = status.availableServices.includes(service);
                statusHTML += `
                    <div class="service-status ${isActive ? 'active' : 'inactive'}">
                        <span class="service-name">${service}</span>
                        <span class="service-indicator">${isActive ? '✅' : '❌'}</span>
                    </div>
                `;
            });
            
            statusHTML += '</div>';
            statusElement.innerHTML = statusHTML;
        }
    }

    updateAccountsList() {
        const accountsList = document.getElementById('accountsList');
        const accountsCount = document.getElementById('accountsCount');
        
        if (!accountsList || !accountsCount) return;
        
        if (!this.currentAccount) {
            accountsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد حسابات نشطة</p>
                    <small>انقر على "إنشاء إيميل جديد" لبدء الاستخدام</small>
                </div>
            `;
            accountsCount.textContent = '0';
            return;
        }

        const timeLeft = this.getTimeLeft(this.currentAccount.expiresAt);
        
        accountsList.innerHTML = `
            <div class="account-item active">
                <div class="account-header">
                    <span class="account-email">${this.currentAccount.email}</span>
                    <span class="account-service ${this.currentAccount.service}">${this.currentAccount.service}</span>
                </div>
                <div class="account-info-small">
                    <span class="account-time">⏰ ${timeLeft}</span>
                </div>
                <div class="account-actions">
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')" title="نسخ الإيميل">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="refresh-btn" onclick="checkMessages()" title="تحديث الرسائل">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteAccount('${this.currentAccount.email}')" title="حذف الحساب">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        accountsCount.textContent = '1';
    }

    getTimeLeft(expiresAt) {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;
        
        if (diff <= 0) return 'منتهي';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}س ${minutes}د`;
    }

    updateMessagesList(messages) {
        const messagesList = document.getElementById('messagesList');
        const messagesCount = document.getElementById('messagesCount');
        
        if (!messagesList || !messagesCount) return;
        
        // معالجة آمنة للمصفوفة
        const validMessages = Array.isArray(messages) ? messages : [];

        if (validMessages.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <p>لا توجد رسائل بعد</p>
                    <small>الرسائل ستظهر هنا عند استقبالها</small>
                    <br>
                    <small>استخدم الإيميل أعلاه للتسجيل في المنصات</small>
                </div>
            `;
            messagesCount.textContent = '0';
            return;
        }

        // ترتيب الرسائل من الأحدث إلى الأقدم
        const sortedMessages = validMessages.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        // عرض آخر 5 رسائل فقط في اللوحة الرئيسية
        const recentMessages = sortedMessages.slice(0, 5);

        messagesList.innerHTML = recentMessages.map(message => `
            <div class="message-item ${message.unread ? 'unread' : ''}" onclick="showMessageDetail('${message.id}')">
                <div class="message-header">
                    <strong class="message-subject">${message.subject || 'بدون عنوان'}</strong>
                    <span class="message-date">${message.date || new Date().toLocaleString('ar-EG')}</span>
                </div>
                <div class="message-preview">${message.preview || 'لا يوجد معاينة'}</div>
                <div class="message-sender">
                    <i class="fas fa-user"></i>
                    <span>${message.sender || 'مرسل غير معروف'}</span>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = validMessages.length.toString();
    }

    updateAllMessagesModal() {
        const container = document.getElementById('allMessagesContainer');
        if (!container) return;

        if (this.allMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <p>لا توجد رسائل</p>
                    <small>لم يتم استلام أي رسائل بعد</small>
                </div>
            `;
            return;
        }

        const sortedMessages = this.allMessages.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        container.innerHTML = sortedMessages.map(message => `
            <div class="message-card ${message.unread ? 'unread' : ''}" onclick="showMessageDetail('${message.id}')">
                <div class="message-card-header">
                    <h4 class="message-card-subject">${message.subject || 'بدون عنوان'}</h4>
                    <span class="message-card-date">${message.date || new Date().toLocaleString('ar-EG')}</span>
                </div>
                <div class="message-card-sender">
                    <i class="fas fa-user"></i>
                    ${message.sender || 'مرسل غير معروف'}
                </div>
                <div class="message-card-preview">
                    ${message.preview || 'لا يوجد معاينة للمحتوى'}
                </div>
            </div>
        `).join('');
    }

    updateConnectionStatus(status = 'online') {
        try {
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.textContent = status === 'online' ? '🟢 متصل' : '🔴 غير متصل';
                statusElement.className = `status-${status}`;
            }
        } catch (error) {
            console.warn('خطأ في تحديث حالة الاتصال:', error);
        }
    }

    updateServiceStatus() {
        if (this.currentAccount) {
            const currentServiceElement = document.getElementById('currentService');
            if (currentServiceElement) {
                currentServiceElement.textContent = this.currentAccount.service;
            }
        }
    }

    updateServerTime() {
        try {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ar-EG');
            
            // تحديث وقت الخادم في الفوتر
            const serverTimeElement = document.getElementById('serverTime');
            if (serverTimeElement) {
                serverTimeElement.textContent = timeString;
            }
            
            // تحديث الوقت الحالي في الكونسول
            const currentTimeElement = document.getElementById('currentTime');
            if (currentTimeElement) {
                currentTimeElement.textContent = `[${timeString}]`;
            }
        } catch (error) {
            console.warn('خطأ في تحديث الوقت:', error);
        }
    }

    log(message, type = 'info') {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput) return;
        
        const timestamp = new Date().toLocaleTimeString('ar-EG');
        const typeIcon = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[type] || '📝';
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="type-icon">${typeIcon}</span>
            <span class="message">${message}</span>
        `;
        
        consoleOutput.appendChild(logEntry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            if (this.autoRefresh && this.currentAccount) {
                this.checkMessages();
                this.loadServiceStatus();
            }
        }, 30000); // كل 30 ثانية
    }

    showMessageNotification(count) {
        this.log(`🔔 لديك ${count} رسالة جديدة`, 'success');
    }

    // دالة لاستخراج الأكواد من النص
    extractCodesFromText(text) {
        const patterns = [
            { pattern: /\b\d{4,8}\b/g, type: 'رقم عادي' },
            { pattern: /كود[\s:]*(\d{4,8})/gi, type: 'كود عربي' },
            { pattern: /رمز[\s:]*(\d{4,8})/gi, type: 'رمز عربي' },
            { pattern: /code[\s:]*(\d{4,8})/gi, type: 'كود إنجليزي' },
            { pattern: /verification[\s:]*(\d{4,8})/gi, type: 'كود تحقق' },
            { pattern: /password[\s:]*(\d{4,8})/gi, type: 'كلمة مرور' },
            { pattern: /:\s*(\d{4,8})/g, type: 'بعد النقطتين' }
        ];
        
        let foundCodes = [];
        
        patterns.forEach(({pattern, type}) => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const code = match.replace(/\D/g, '');
                    if (code.length >= 4 && code.length <= 8) {
                        foundCodes.push({ code, type, original: match });
                    }
                });
            }
        });
        
        // إزالة التكرارات
        const uniqueCodes = [];
        const seen = new Set();
        
        foundCodes.forEach(item => {
            if (!seen.has(item.code)) {
                seen.add(item.code);
                uniqueCodes.push(item);
            }
        });
        
        return uniqueCodes;
    }
}

// الدوال العامة
function copyToClipboard(text) {
    if (!text) {
        showTempNotification('❌ لا يوجد نص للنسخ');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        if (window.hackmail) {
            window.hackmail.log('تم النسخ إلى الحافظة', 'success');
        }
        showTempNotification('✅ تم النسخ إلى الحافظة!');
    }).catch(err => {
        if (window.hackmail) {
            window.hackmail.log('فشل في النسخ', 'error');
        }
        showTempNotification('❌ فشل في النسخ');
    });
}

function showTempNotification(message) {
    // إنشاء إشعار بسيط
    if (window.hackmail) {
        window.hackmail.log(message, 'info');
    }
}

function createEmail() {
    if (window.hackmail) {
        window.hackmail.createEmail();
    }
}

function checkMessages() {
    if (window.hackmail) {
        window.hackmail.checkMessages();
    }
}

function showAllMessages() {
    if (!window.hackmail || !window.hackmail.currentAccount) {
        showTempNotification('⚠️ لا يوجد حساب نشط لعرض الرسائل');
        return;
    }

    // تحديث قائمة الرسائل أولاً
    if (window.hackmail.allMessages.length === 0) {
        checkMessages();
    }

    window.hackmail.updateAllMessagesModal();
    document.getElementById('allMessagesModal').classList.add('active');
}

function closeAllMessagesModal() {
    document.getElementById('allMessagesModal').classList.remove('active');
}

function showMessageDetail(messageId) {
    if (!window.hackmail) return;

    const message = window.hackmail.allMessages.find(msg => msg.id === messageId);
    if (!message) {
        showTempNotification('❌ لم يتم العثور على الرسالة');
        return;
    }

    const content = document.getElementById('messageDetailContent');
    content.innerHTML = `
        <div class="message-detail-content">
            <div class="message-detail-header">
                <div class="message-detail-meta">
                    <div class="meta-item">
                        <i class="fas fa-user"></i>
                        <span><strong>المرسل:</strong> ${message.sender || 'غير معروف'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-tag"></i>
                        <span><strong>الموضوع:</strong> ${message.subject || 'بدون عنوان'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span><strong>التاريخ:</strong> ${message.date || 'غير محدد'}</span>
                    </div>
                </div>
                ${message.unread ? '<div class="unread-badge">📧 رسالة جديدة</div>' : ''}
            </div>
            <div class="message-detail-body">
                <div class="message-content">${message.content || 'لا يوجد محتوى'}</div>
            </div>
        </div>
    `;

    // تخزين محتوى الرسالة للنسخ لاحقاً
    window.currentMessageContent = message.content || '';

    document.getElementById('messageDetailModal').classList.add('active');
}

function closeMessageDetailModal() {
    document.getElementById('messageDetailModal').classList.remove('active');
}

function copyMessageContent() {
    if (window.currentMessageContent) {
        copyToClipboard(window.currentMessageContent);
    } else {
        showTempNotification('❌ لا يوجد محتوى للنسخ');
    }
}

function extractCodeFromText() {
    const codeInput = document.getElementById('codeInput');
    const codeResults = document.getElementById('codeResults');
    
    if (!codeInput || !codeResults) return;
    
    const text = codeInput.value.trim();
    if (!text) {
        showTempNotification('❌ يرجى إدخال نص لاستخراج الأكواد');
        return;
    }
    
    if (!window.hackmail) return;
    
    const codes = window.hackmail.extractCodesFromText(text);
    
    if (codes.length === 0) {
        codeResults.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>لم يتم العثور على أي أكواد</p>
                <small>جرب نصاً مختلفاً أو تحقق من تنسيق الأكواد</small>
            </div>
        `;
        return;
    }
    
    codeResults.innerHTML = codes.map((item, index) => `
        <div class="code-item">
            <div class="code-info">
                <div class="code-value">${item.code}</div>
                <div class="code-type">${item.type}</div>
            </div>
            <div class="code-actions">
                <button class="btn-small" onclick="copyToClipboard('${item.code}')">
                    <i class="fas fa-copy"></i> نسخ
                </button>
            </div>
        </div>
    `).join('');
    
    showTempNotification(`✅ تم العثور على ${codes.length} كود`);
}

function resetSystem() {
    if (confirm('هل أنت متأكد من إعادة تعيين النظام؟ سيتم حذف جميع الحسابات والرسائل.')) {
        if (window.hackmail) {
            window.hackmail.log('تم طلب إعادة تعيين النظام', 'info');
            window.hackmail.currentAccount = null;
            window.hackmail.allMessages = [];
            window.hackmail.updateAccountsList();
            window.hackmail.updateMessagesList([]);
            showTempNotification('🔄 تم إعادة تعيين النظام');
        }
    }
}

function deleteAccount(email) {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
        if (window.hackmail) {
            window.hackmail.log(`تم حذف الحساب ${email}`, 'success');
            window.hackmail.currentAccount = null;
            window.hackmail.allMessages = [];
            window.hackmail.updateAccountsList();
            window.hackmail.updateMessagesList([]);
            showTempNotification('🗑️ تم حذف الحساب');
        }
    }
}

function clearConsole() {
    const consoleOutput = document.getElementById('consoleOutput');
    if (consoleOutput) {
        consoleOutput.innerHTML = '';
        if (window.hackmail) {
            window.hackmail.log('تم مسح سجل النظام', 'info');
        }
    }
}

// إغلاق النوافذ بالضغط على ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAllMessagesModal();
        closeMessageDetailModal();
    }
});

// إغلاق النوافذ بالضغط خارج المحتوى
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeAllMessagesModal();
        closeMessageDetailModal();
    }
});

// تهيئة النظام
document.addEventListener('DOMContentLoaded', () => {
    window.hackmail = new HackMailPro();
});