// ============================================
// SafeLink – Admin Routes
// ============================================
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = Router();
router.get('/analytics', authenticate, authorize('admin', 'user'), adminController.getAnalytics);

module.exports = router;
