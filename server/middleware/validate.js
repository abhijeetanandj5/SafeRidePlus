// ============================================
// SafeLink – Validation Middleware
// ============================================
const { validationResult } = require('express-validator');

/**
 * Checks express-validator results and returns 400 if invalid.
 */
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    next();
}

module.exports = { validate };
