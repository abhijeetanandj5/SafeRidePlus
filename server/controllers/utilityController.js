// ============================================
// SafeLink – Utility Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const geo = require('../services/geoService');

const prisma = new PrismaClient();

const TYPE_ICONS = { police: '🏛️', hospital: '🏥', pharmacy: '💊', safezone: '🛡️' };
const TYPE_LABELS = { police: 'Police Station', hospital: 'Hospital', pharmacy: '24/7 Pharmacy', safezone: 'Public Safe Zone' };

/**
 * GET /api/utilities/nearby?lat=&lng=&type=
 */
async function getNearby(req, res, next) {
    try {
        const lat = parseFloat(req.query.lat) || 12.9352;
        const lng = parseFloat(req.query.lng) || 77.6245;
        const type = req.query.type;

        const where = type && type !== 'all' ? { type } : {};
        const utilities = await prisma.utility.findMany({ where });

        const results = utilities.map(u => {
            const distance = geo.haversineDistance(lat, lng, u.lat, u.lng);
            const eta = geo.estimateArrivalTime(distance);
            const riskProximity = geo.calculateRiskProximity(distance, u.type);

            return {
                ...u,
                distance: Math.round(distance * 100) / 100,
                distanceFormatted: distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)} km`,
                eta,
                etaFormatted: eta < 60 ? `${eta} min` : `${Math.floor(eta / 60)}h ${eta % 60}m`,
                riskProximity,
                icon: TYPE_ICONS[u.type] || '📍',
                typeLabel: TYPE_LABELS[u.type] || 'Utility',
            };
        }).sort((a, b) => a.distance - b.distance);

        res.json(results);
    } catch (err) { next(err); }
}

module.exports = { getNearby };
