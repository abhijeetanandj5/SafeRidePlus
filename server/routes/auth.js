// ============================================
// SafeLink – Auth Routes
// ============================================
const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = Router();

router.post('/register',
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
    body('name').notEmpty().withMessage('Name required'),
    validate,
    authController.register
);

router.post('/login',
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate,
    authController.login
);

module.exports = router;
