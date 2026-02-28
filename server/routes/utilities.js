// ============================================
// SafeLink – Utility Routes
// ============================================
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const utilityController = require('../controllers/utilityController');

const router = Router();
router.get('/nearby', authenticate, utilityController.getNearby);

module.exports = router;
