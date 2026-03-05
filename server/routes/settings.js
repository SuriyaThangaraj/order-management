const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Setting = require('../models/Setting');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'sound-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio and image files are allowed!'), false);
        }
    }
});

// Get branding settings (Public)
router.get('/branding', async (req, res) => {
    try {


        const query = {}; // Global settings

        /*
        const query = {
            tenantId: tenantId || (req.user ? req.user.tenantId : null)
        };
        */

        const watermarkSetting = await Setting.findOne({ key: 'watermarkUrl', ...query });
        const colorSetting = await Setting.findOne({ key: 'themeColor', ...query });
        const navColorSetting = await Setting.findOne({ key: 'navColor', ...query });
        const bgColorSetting = await Setting.findOne({ key: 'backgroundColor', ...query });
        const navOpacitySetting = await Setting.findOne({ key: 'navOpacity', ...query });
        const opacitySetting = await Setting.findOne({ key: 'watermarkOpacity', ...query });
        const sizeSetting = await Setting.findOne({ key: 'watermarkSize', ...query });

        res.json({
            watermarkUrl: watermarkSetting ? watermarkSetting.value : null,
            themeColor: colorSetting ? colorSetting.value : '#E23744', // Default Red
            navColor: navColorSetting ? navColorSetting.value : '#000000', // Default Black
            navOpacity: navOpacitySetting ? parseFloat(navOpacitySetting.value) : 0.4,
            backgroundColor: bgColorSetting ? bgColorSetting.value : '#0a0a0a',
            watermarkOpacity: opacitySetting ? parseFloat(opacitySetting.value) : 0.1,
            watermarkSize: sizeSetting ? sizeSetting.value : '300px' // Default 300px
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update branding settings (Admin)
router.post('/branding', require('../middleware/authMiddleware').protect, require('../middleware/authMiddleware').admin, upload.single('watermark'), async (req, res) => {
    try {
        const { themeColor, navColor, navOpacity, backgroundColor, watermarkOpacity, watermarkSize, cardOpacity } = req.body;


        /* Helper to update setting (Global) */
        const updateSetting = async (key, value) => {
            await Setting.findOneAndUpdate(
                { key }, // Global key match
                { value, adminId: req.user._id },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        let updateData = {}; // Capture updates for emit

        if (themeColor) await updateSetting('themeColor', themeColor);
        if (navColor) await updateSetting('navColor', navColor);
        if (backgroundColor) await updateSetting('backgroundColor', backgroundColor);
        if (watermarkOpacity !== undefined) await updateSetting('watermarkOpacity', watermarkOpacity);

        // ... (add others similarly if needed)

        if (req.file) {
            const watermarkUrl = `/uploads/${req.file.filename}`;
            await updateSetting('watermarkUrl', watermarkUrl);
            updateData.watermarkUrl = watermarkUrl;
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.emit('brandingUpdated', { ...req.body, ...updateData });

        res.json({ message: 'Branding updated successfully', ...updateData });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get notification sound
router.get('/notification-sound', async (req, res) => {

    try {
        const query = req.query.adminId ? { adminId: req.query.adminId } : {};
        // If auth user calls this, we could use tenantId, but allow query param for flexibility

        const setting = await Setting.findOne({ key: 'notificationSound', ...query });
        if (!setting) {
            return res.json({ soundUrl: null });
        }
        // Return full URL or relative? Frontend usually prepends API_URL or serves from static.
        // Assuming static serve from root or /uploads. 
        // If server serves 'uploads' at '/uploads', then relative path is fine if frontend uses backend base URL.
        res.json({ soundUrl: setting.value });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Upload/Update notification sound
router.post('/notification-sound', require('../middleware/authMiddleware').protect, require('../middleware/authMiddleware').admin, upload.single('sound'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const soundUrl = `/uploads/${req.file.filename}`;

        const setting = await Setting.findOneAndUpdate(
            { key: 'notificationSound' },
            { value: soundUrl },
            { new: true, upsert: true }
        );

        const io = req.app.get('io');
        io.emit('settingsUpdated', { type: 'sound', value: soundUrl });

        res.json({ message: 'Sound updated successfully', soundUrl: setting.value });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Get table configuration
router.get('/table-config', async (req, res) => {

    try {
        const query = req.query.adminId ? { adminId: req.query.adminId } : {};
        const setting = await Setting.findOne({ key: 'tableCount', ...query });
        // Default to 20 if not set
        const count = setting ? parseInt(setting.value, 10) : 20;
        res.json({ tableCount: count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// Fix: Add protect/admin middleware to this since it's an admin setting
router.post('/table-config', require('../middleware/authMiddleware').protect, require('../middleware/authMiddleware').admin, async (req, res) => {
    try {
        const { tableCount } = req.body;
        if (!tableCount || isNaN(tableCount) || tableCount < 1) res.status(400).json({ message: 'Invalid table count' });

        const setting = await Setting.findOneAndUpdate(
            { key: 'tableCount' },
            { value: String(tableCount) },
            { new: true, upsert: true }
        );
        res.json({ message: 'Table count updated', tableCount: parseInt(setting.value, 10) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
