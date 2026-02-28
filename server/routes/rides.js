// ============================================
// SafeLink – Ride Routes
// ============================================
const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const rideController = require('../controllers/rideController');

const router = Router();

router.post('/',
    authenticate,
    body('pickupAddress').optional().isString(),
    body('destAddress').optional().isString(),
    body('pickupLat').optional().isFloat(),
    body('pickupLng').optional().isFloat(),
    body('destLat').optional().isFloat(),
    body('destLng').optional().isFloat(),
    validate,
    rideController.createRide
);

router.get('/:id', authenticate, rideController.getRide);

router.post('/:id/location',
    authenticate,
    body('lat').isFloat().withMessage('Latitude required'),
    body('lng').isFloat().withMessage('Longitude required'),
    body('speed').optional().isFloat(),
    body('heading').optional().isFloat(),
    validate,
    rideController.updateLocation
);

router.post('/:id/end', authenticate, rideController.endRide);
router.get('/:id/safety-score', authenticate, rideController.getSafetyScore);
router.get('/:id/alerts', authenticate, rideController.getAlerts);

module.exports = router;
