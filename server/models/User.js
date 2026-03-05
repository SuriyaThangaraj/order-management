const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        // super_admin: System Owner
        // tenant_admin: Restaurant Owner
        // waiter/kitchen: Staff
        enum: ['super_admin', 'tenant_admin', 'waiter', 'kitchen', 'admin'], // kept 'admin' for legacy/transition compatibility
        required: true,
    },
    email: {
        type: String,
        required: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    loginOTP: String,
    loginOTPExpires: Date,
    resetPasswordOTP: String,
    resetPasswordOTPExpire: Date,
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
