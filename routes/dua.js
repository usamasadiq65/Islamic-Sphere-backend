const express = require('express');
const router = express.Router();
const {
  getRandomDua,
  addDua,
  updateDua,
  deleteDua,
  getAllDuas
} = require('../controllers/dua.controller');
const authorize = require('../middlewares/authorization');

// Public routes
router.get('/random', getRandomDua);
router.get('/', getAllDuas);

// Protected routes (admin only)
router.post('/', authorize, addDua);
router.put('/:id', authorize, updateDua);
router.delete('/:id', authorize, deleteDua);
// router.post('/', addDua);
// router.put('/:id',  updateDua);
// router.delete('/:id',  deleteDua);

module.exports = router;
