const mongoose = require('mongoose');

const emailAccountSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    service: {
        type: String,
        required: true,
        enum: ['mail.tm', 'guerrillamail', 'temp-mail', 'mintemail', 'maildrop']
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    token: {
        type: String,
        default: null
    },
    accountId: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// تنظيف الحسابات المنتهية تلقائياً
emailAccountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// فهرس مركب للبحث السريع
emailAccountSchema.index({ sessionId: 1, isActive: 1 });
emailAccountSchema.index({ service: 1, createdAt: -1 });

module.exports = mongoose.model('EmailAccount', emailAccountSchema);