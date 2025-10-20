const mongoose = require('mongoose');

const emailMessageSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true
    },
    accountId: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    service: {
        type: String,
        required: true,
        enum: ['mail.tm', 'guerrillamail', 'temp-mail', 'mintemail', 'maildrop']
    },
    sender: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        default: 'No Subject'
    },
    content: {
        type: String,
        default: 'No content'
    },
    preview: {
        type: String,
        default: 'No preview'
    },
    date: {
        type: String,
        required: true
    },
    unread: {
        type: Boolean,
        default: true
    },
    receivedAt: {
        type: Date,
        default: Date.now
    },
    lastChecked: {
        type: Date,
        default: Date.now
    }
});

// فهارس للبحث السريع
emailMessageSchema.index({ accountId: 1, messageId: 1 }, { unique: true });
emailMessageSchema.index({ email: 1, receivedAt: -1 });
emailMessageSchema.index({ service: 1, receivedAt: -1 });
emailMessageSchema.index({ unread: 1 });

module.exports = mongoose.model('EmailMessage', emailMessageSchema);