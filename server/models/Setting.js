const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, { timestamps: true });


// Ensure keys are unique GLOBALLY
settingSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('Setting', settingSchema);
