// ============================================
// SafeLink – Incident Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createIncident(req, res, next) {
    try {
        const { type, severity, description, rideId } = req.body;
        const incident = await prisma.incident.create({
            data: {
                userId: req.user.id,
                rideId: rideId ? parseInt(rideId) : null,
                type,
                severity,
                description,
            },
        });

        await prisma.analyticsLog.create({
            data: { event: 'emergency_activated', data: JSON.stringify({ incidentId: incident.id, severity }) },
        });

        res.status(201).json(incident);
    } catch (err) { next(err); }
}

async function getMyIncidents(req, res, next) {
    try {
        const incidents = await prisma.incident.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(incidents);
    } catch (err) { next(err); }
}

module.exports = { createIncident, getMyIncidents };
