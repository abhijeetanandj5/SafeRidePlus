// ============================================
// SafeLink – Incident Routes
// ============================================
const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

const router = Router();

router.get('/', authenticate, incidentController.getMyIncidents);

router.post('/',
    authenticate,
    body('type').notEmpty().withMessage('Incident type required'),
    body('severity').notEmpty().withMessage('Severity required'),
    body('description').notEmpty().withMessage('Description required'),
    validate,
    incidentController.createIncident
);

module.exports = router;
