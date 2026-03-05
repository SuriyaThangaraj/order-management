const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    tableNo: {
        type: String,
        required: true,
    },
    waiterId: {
        type: mongoose.Schema.Types.ObjectId, // Could be String if just passing waiter name, but ID is safer
        ref: 'User',
        required: false // Optional for initial flexibility
    },
    items: [
        {
            menuId: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            qty: { type: Number, required: true },
        }
    ],
    totalAmount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING_APPROVAL', 'SENT', 'RECEIVED', 'PREPARING', 'READY', 'PAID'],
        default: 'SENT',
    },
    orderSource: { // Track if order is from 'WAITER' or 'CUSTOMER'
        type: String,
        enum: ['WAITER', 'CUSTOMER'],
        default: 'WAITER'
    },
    note: { type: String, required: false }, // Customer text note
    voiceNoteUrl: { type: String, required: false }, // URL to uploaded audio file
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPaid: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
