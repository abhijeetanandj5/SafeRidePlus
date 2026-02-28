// ============================================
// SafeLink – Express Application
// ============================================
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const config = require('./server/config');
const { errorHandler } = require('./server/middleware/errorHandler');

const app = express();

// ─── Security & Parsing ───
app.use(helmet({
    contentSecurityPolicy: false,  // Allow inline scripts for prototype
    crossOriginEmbedderPolicy: false,
}));
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Rate Limiting ───
app.use('/api/', rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: 'Too many requests, please try again later' },
}));

// ─── Static Files (Frontend) ───
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/users', require('./server/routes/users'));
app.use('/api/rides', require('./server/routes/rides'));
app.use('/api/utilities', require('./server/routes/utilities'));
app.use('/api/incidents', require('./server/routes/incidents'));
app.use('/api/admin', require('./server/routes/admin'));
app.use('/api/family', require('./server/routes/family'));

// ─── Health Check ───
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── SPA Fallback ───
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ───
app.use(errorHandler);

module.exports = app;
