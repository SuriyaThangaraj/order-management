const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: false,
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    shortCode: {
        type: String,
        sparse: true,
        trim: true,
        uppercase: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, { timestamps: true });

const Menu = mongoose.model('Menu', menuSchema);

module.exports = Menu;
