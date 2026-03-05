const express = require('express');
const router = express.Router();
const User = require('../models/User');

const jwt = require('jsonwebtoken');
const { protect, admin } = require('../middleware/authMiddleware');

// Generate JWT
// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Rate Limiter: 3 requests per hour
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { message: 'Too many OTP requests. Please try again after an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ... (existing imports)

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// @desc    User Signup
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', async (req, res) => {
    // Updated Signup: Registers a new Tenant and a Tenant Admin
    const { name, email, password, restaurantName } = req.body;

    // Default restaurant name if not provided (for backward comp with existing frontend for now)
    const storeName = restaurantName || `${name}'s Restaurant`;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username: name }] });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create User (Admin)
        const user = await User.create({
            username: name,
            password,
            email,
            role: 'admin', // Default to admin for signup
            isVerified: false,
        });

        await user.save();
        const verificationToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

        const mailOptions = {
            from: '"Nikola Order Management" <no-reply@nikolaordermanagement.com>',
            to: email,
            subject: 'Verify Your Email - Nikola Order Management',
            html: `
                <h3>Hello ${name},</h3>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="${verificationLink}">Verify Email</a>
                <p>This link expires in 24 hours.</p>
            `
        };

        try {
            if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
                console.warn("[SIGNUP] Email credentials missing or default in .env. Skipping email verification.");
                console.warn(`[SIGNUP] => VERIFICATION LINK FOR ${email}: ${verificationLink}`);
                // Auto-verify if no email service for testing convenience
                user.isVerified = true;
                await user.save();
                return res.status(201).json({
                    message: 'Signup successful (Email skipped - Auto Verified). Please Login.'
                });
            }
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error("Email send failed:", emailError);
            // Let's delete to keep state clean, but give clear error.
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ message: 'Failed to send verification email. Check server logs/credentials.' });
        }

        res.status(201).json({
            message: 'Signup successful. Please check your email to verify your account.'
        });

    } catch (error) {
        console.error("[SIGNUP ERROR]", error);
        // Better error message for duplicate keys that might slip through
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Username or Email already exists' });
        }
        res.status(500).json({ message: 'Server Error during signup: ' + error.message });
    }
});

// @desc    Verify Email
// @route   POST /api/auth/verify-email
// @access  Public
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        user.isVerified = true;
        await user.save();

        res.json({ message: 'Email verified successfully. You can now login.' });

    } catch (error) {
        res.status(400).json({ message: 'Invalid or expired token' });
    }
});



// @desc    Create Staff Account (Waiter/Kitchen)
// @route   POST /api/auth/create-staff
// @access  Private/Admin

router.post('/create-staff', protect, admin, async (req, res) => {
    const { username, password, role } = req.body; // Email removed as per request

    if (role !== 'waiter' && role !== 'kitchen') {
        return res.status(400).json({ message: 'Invalid role. Can only create Waiter or Kitchen accounts.' });
    }

    const userExists = await User.findOne({ username });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
        username,
        password,
        role,
        role,
        isVerified: true, // Staff created by admin are auto-verified
        adminId: req.user._id // Legacy support
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            message: `${role} account created successfully`
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
});

// @desc    Get All Users
// @route   GET /api/auth/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
});

// @desc    Delete User
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent self-deletion
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        // Removed the check that blocked deleting ANY admin. 
        // Now admins can delete other admins/staff.

        await user.deleteOne();
        res.json({ message: 'User removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Reset User Password
// @route   PUT /api/auth/users/:id/password
// @access  Private/Admin
router.put('/users/:id/password', protect, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = req.body.password;
        await user.save(); // Will trigger pre-save hash

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Send OTP for Password Reset OR Login
// @route   POST /api/auth/send-otp
// @access  Public
router.post('/send-otp', otpLimiter, async (req, res) => {
    const { email, type = 'login' } = req.body; // type: 'login' or 'reset'

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Requirement: "Email not registered. Please sign up first."
            // For security (enumeration), usually we shouldn't say this, but user explicitly requested it.
            return res.status(404).json({ message: 'Email not registered. Please sign up first.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

        if (type === 'login') {
            user.loginOTP = otp;
            user.loginOTPExpires = expiry;
        } else {
            user.resetPasswordOTP = otp;
            // Default to 10 mins usually, but let's sync to 5 for consistency or keep logic separate
            user.resetPasswordOTPExpire = Date.now() + 10 * 60 * 1000;
        }
        await user.save();

        const mailOptions = {
            from: '"Nikola Order Management" <no-reply@nikolaordermanagement.com>', // User requested custom domain
            to: email,
            subject: `${type === 'login' ? 'Login' : 'Password Reset'} OTP - Nikola Order Management`,
            html: `
                <h3>Hello ${user.username},</h3>
                <p>You requested a ${type === 'login' ? 'login' : 'password reset'} OTP. Your code is:</p>
                <h1 style="color: #4CAF50;">${otp}</h1>
                <p>This code expires in ${type === 'login' ? '5' : '10'} minutes.</p>
            `
        };

        // Use custom SMTP from env if available, else default transporter
        try {
            if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
                console.warn(`[OTP] Email credentials missing. SIMULATING EMAIL for ${email}`);
                console.warn(`[OTP] => YOUR OTP IS: ${otp}`);
            } else {
                await transporter.sendMail(mailOptions);
            }
        } catch (emailError) {
            console.error("[OTP] Email send failed:", emailError);
            return res.status(500).json({ message: 'Failed to send OTP email.' });
        }

        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error: ' + error.message, stack: error.stack });
    }
});

// @desc    Verify OTP (Login or Password Reset)
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { email, otp, type = 'login' } = req.body;

    try {
        let query = { email };
        if (type === 'login') {
            query.loginOTP = otp;
            query.loginOTPExpires = { $gt: Date.now() };
        } else {
            query.resetPasswordOTP = otp;
            query.resetPasswordOTPExpire = { $gt: Date.now() };
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Clear OTP
        if (type === 'login') {
            user.loginOTP = undefined;
            user.loginOTPExpires = undefined;
            // Also mark verify if not
            if (!user.isVerified) user.isVerified = true;
            await user.save();

            // Return Login Token
            return res.json({
                success: true,
                message: 'Login Successful',
                _id: user._id,
                username: user.username,
                role: user.role,
                token: generateToken(user._id)
            });
        } else {
            // Just verify for reset flow doesn't clear strictly until password reset, 
            // OR client proceeds to reset immediately. Current flow re-verifies in reset call.
            // So we don't clear resetOTP here, or we do and issue a temp token for reset?
            // "reset-password-email" checks OTP again. So we just return success.
            res.json({ success: true, message: 'OTP verified' });
        }

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Reset Password via Email (Forgot Password)
// @route   PUT /api/auth/reset-password-email
// @access  Public
router.put('/reset-password-email', async (req, res) => {
    const { email, newPassword, otp } = req.body;
    try {
        // Find user by email and Valid OTP
        // We verify OTP again here to ensure no one bypasses the verify step directly to here
        const query = {
            email,
            resetPasswordOTP: otp,
            resetPasswordOTPExpire: { $gt: Date.now() }
        };

        const user = await User.findOne(query);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
        }

        user.password = newPassword;
        user.resetPasswordOTP = undefined; // Clear OTP
        user.resetPasswordOTPExpire = undefined;
        user.isVerified = true; // Auto-verify since they proved email ownership
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});






// DEBUG ROUTE: Delete User
router.get('/debug/delete-user', async (req, res) => {
    const username = req.query.username;
    await User.deleteOne({ username });
    res.send(`Deleted ${username}`);
});

router.get('/debug/users', async (req, res) => {
    try {
        const users = await User.find({}).lean();
        const summary = {
            users: users.map(u => ({
                id: u._id,
                username: u.username,
                role: u.role,
                // tenantId: u.tenantId, // Removed
                email: u.email
            })),
            // tenants: tenants.map(t => ({
            //     id: t._id,
            //     name: t.name
            // }))
        };
        res.json(summary);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// @desc    Auth user via Firebase & get token
// @route   POST /api/auth/firebase-login
// @access  Public
router.post('/firebase-login', async (req, res) => {
    const { email, uid } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (user) {
        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(404).json({ message: 'User not found in hotel system. Please contact administrator.' });
    }
});

// @desc    Auth user via Google & get token
// @route   POST /api/auth/google-login
// @access  Public
router.post('/google-login', async (req, res) => {
    const { token } = req.body;
    try {
        const response = await require('axios').get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const { email } = response.data;

        // Find user by email
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'account is not founted' });
        }

        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error("Google login error:", error.response?.data || error.message);
        res.status(401).json({ message: 'Invalid Google token' });
    }
});

// @desc    Register user via Google
// @route   POST /api/auth/google-signup
// @access  Public
router.post('/google-signup', async (req, res) => {
    const { token } = req.body;
    try {
        const response = await require('axios').get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const { email, name, sub } = response.data;

        // Check if user already exists
        let userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this email. Please login.' });
        }

        const user = await User.create({
            username: name || email.split('@')[0],
            email: email,
            password: sub + "_googleAuth", // Dummy secure password using google sub
            role: 'admin',
            isVerified: true
        });

        res.status(201).json({
            message: 'Signup successful. You can now log in via Google.',
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error("Google signup error:", error.response?.data || error.message);
        res.status(401).json({ message: 'Invalid Google token' });
    }
});




// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        let user;
        // Priority 1: Lookup by Email (Admin Flow)
        if (email) {
            user = await User.findOne({ email });
        }
        // Priority 2: Lookup by Username (Staff Flow)
        else if (username) {
            user = await User.findOne({ username });
        }

        if (user && (await user.matchPassword(password))) {
            console.log(`[LOGIN] Successful for ${user.username} (${user.role})`);

            res.json({
                _id: user._id,
                username: user.username,
                role: user.role,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error("[LOGIN ERROR]", error);
        res.status(500).json({ message: 'Server Error during login: ' + error.message });
    }
});


// @desc    Get Public User Info (e.g. Waiter Name)
// @route   GET /api/auth/public/:id
// @access  Public
router.get('/public/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('username role adminId');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        // If invalid ID format, just return 404
        res.status(404).json({ message: 'User not found' });
    }
});

module.exports = router;
