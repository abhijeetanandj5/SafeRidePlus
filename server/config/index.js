// ============================================
// SafeLink – Server Configuration
// ============================================
require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 5000,
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_me',
    nodeEnv: process.env.NODE_ENV || 'development',
    bcryptRounds: 10,
    jwtExpiresIn: '7d',
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
    },
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
};
