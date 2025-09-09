const express = require('express');
const router = express.Router();
const multer = require('multer');
const scholarController = require('../controllers/scholarSession.controller');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Route to get scholar count
router.get('/count', scholarController.getScholarCount);

router.get('/', scholarController.getAllScholars);
router.get('/:id', scholarController.getScholarById);
router.post('/', upload.single('image'), scholarController.createScholar);
router.put('/:id', upload.single('image'), scholarController.updateScholar);
router.delete('/:id', scholarController.deleteScholar);

module.exports = router; 