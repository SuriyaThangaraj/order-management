const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    // Validate file types if needed (images/audio)
});

// @desc    Upload generic file (Image or Audio)
// @route   POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No file uploaded' });
        }

        // Return relative path
        res.status(200).json({
            filePath: `/uploads/${req.file.filename}`,
            fileName: req.file.filename
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Upload failed' });
    }
});

module.exports = router;
