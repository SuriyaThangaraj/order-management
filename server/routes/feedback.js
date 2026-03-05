
const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Submit Feedback
// @route   POST /api/feedback
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { adminId, tableNo, rating, comment, customerName } = req.body;



        const feedback = new Feedback({
            adminId, // Legacy
            adminId, // Legacy
            tableNo,
            rating,
            comment,
            customerName
        });

        await feedback.save();

        // Notify admin/tenant
        const io = req.app.get('io');
        io.emit('newFeedback', feedback);

        res.status(201).json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get All Feedback
// @route   GET /api/feedback
// @access  Private (Admin)
router.get('/', protect, admin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find({}).sort({ createdAt: -1 });
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Clear all feedback for tenant
// @route   DELETE /api/feedback
// @access  Private (Admin)
router.delete('/', protect, admin, async (req, res) => {
    try {
        await Feedback.deleteMany({});
        res.json({ message: 'All feedback cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
