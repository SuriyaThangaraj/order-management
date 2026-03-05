const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const { protect, admin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Images only!');
        }
    },
});

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public (requires context)
router.get('/', async (req, res) => {
    try {

        // REMOVED MULTI-TENANCY: Global access
        // const menuItems = await Menu.find(query);
        const menuItems = await Menu.find({}); // Fetch ALL items
        res.json(menuItems);

    } catch (err) {
        console.error("Menu fetch error:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add a menu item
// @route   POST /api/menu
// @access  Private/Admin
router.post('/', protect, admin, upload.single('image'), async (req, res) => {
    try {
        let { name, price, category, shortCode } = req.body;

        // If shortcode is empty string, set it to undefined 
        // to prevent Mongoose from inserting empty strings and causing unique key collisions
        if (!shortCode || shortCode.trim() === '') {
            shortCode = undefined;
        }

        // Image is optional now
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/${req.file.path.replace(/\\/g, "/")}`;
        }

        const menuItem = new Menu({
            name,
            price,
            category,
            shortCode,
            imageUrl, // Can be empty string if no image
            isAvailable: true,
            adminId: req.user._id, // Legacy
        });

        const createdMenuItem = await menuItem.save();

        // Emit event (to be handled if we want real-time menu updates for waiters)
        const io = req.app.get('io');
        io.emit('menuUpdated', createdMenuItem);

        res.status(201).json(createdMenuItem);
    } catch (error) {
        console.error("Error creating menu item:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Short Code must be unique. Another item already has this code or lack thereof.' });
        }
        res.status(400).json({ message: 'Invalid menu data: ' + error.message });
    }
});

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const { name, price, category, isAvailable, shortCode } = req.body;

        // REMOVED TENANT ISOLATION
        // REMOVED TENANT ISOLATION
        const menuItem = await Menu.findById(req.params.id);

        if (menuItem) {
            menuItem.name = name || menuItem.name;
            menuItem.price = price || menuItem.price;
            menuItem.category = category || menuItem.category;
            if (isAvailable !== undefined) menuItem.isAvailable = isAvailable;
            // Short code might be unset so we handle it explicitly if provided
            if (shortCode !== undefined) menuItem.shortCode = shortCode;

            const updatedMenuItem = await menuItem.save();

            const io = req.app.get('io');
            io.emit('menuUpdated', updatedMenuItem);

            res.json(updatedMenuItem);
        } else {
            res.status(404).json({ message: 'Menu item not found' });
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Short Code must be unique' });
        }
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
    // Use findOneAndDelete
    // REMOVED TENANT ISOLATION
    // REMOVED TENANT ISOLATION
    const menuItem = await Menu.findByIdAndDelete(req.params.id);

    if (menuItem) {
        const io = req.app.get('io');
        io.emit('menuUpdated', { _id: req.params.id, deleted: true });

        res.json({ message: 'Menu item removed' });
    } else {
        res.status(404).json({ message: 'Menu item not found' });
    }
});

// DEBUG ROUTE: Inspect specific menu item
router.get('/debug/:id', async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);

        let user = null;
        if (req.query.username) {
            const User = require('../models/User');
            user = await User.findOne({ username: req.query.username });
        }

        res.json({
            item,
            user, // Returns user info if username provided
            message: item ? 'Item Found' : 'Item Not Found'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
