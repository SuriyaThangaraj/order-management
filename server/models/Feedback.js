
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tableNo: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },

    customerName: {
        type: String,
        default: 'Guest'
    }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
