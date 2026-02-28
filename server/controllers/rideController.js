// ============================================
// SafeLink – Ride Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const safetyEngine = require('../services/safetyEngine');
const { getIO } = require('../sockets');

const prisma = new PrismaClient();

// ─── Driver Pool (Simulated) ───
const DRIVERS = [
    { name: 'Rajesh Kumar', vehicle: 'Honda Activa 6G', plate: 'KA 01 AB 1234', rating: 4.8, phone: '+91 98765 43210' },
    { name: 'Priya Sharma', vehicle: 'TVS Jupiter', plate: 'MH 02 CD 5678', rating: 4.9, phone: '+91 98765 43211' },
    { name: 'Amit Patel', vehicle: 'Bajaj Pulsar', plate: 'DL 03 EF 9012', rating: 4.7, phone: '+91 98765 43212' },
    { name: 'Sneha Reddy', vehicle: 'Ola Electric S1', plate: 'TN 04 GH 3456', rating: 4.9, phone: '+91 98765 43213' },
];

/**
 * POST /api/rides — Create a new ride
 */
async function createRide(req, res, next) {
    try {
        const { type, pickupAddress, destAddress, pickupLat, pickupLng, destLat, destLng, aiSafetyMode } = req.body;
        const driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        const fare = Math.floor(40 + Math.random() * 160);

        const ride = await prisma.ride.create({
            data: {
                userId: req.user.id,
                type: type || 'ride',
                pickupAddress: pickupAddress || 'Koramangala 4th Block, Bangalore',
                destAddress: destAddress || 'Indiranagar 100ft Road, Bangalore',
                pickupLat: pickupLat || 12.9352,
                pickupLng: pickupLng || 77.6245,
                destLat: destLat || 12.9784,
                destLng: destLng || 77.6408,
                driverName: driver.name,
                driverVehicle: driver.vehicle,
                driverPlate: driver.plate,
                driverPhone: driver.phone,
                driverRating: driver.rating,
                otp,
                fare,
                aiSafetyMode: aiSafetyMode !== false,
            },
        });

        // Log analytics
        await prisma.analyticsLog.create({
            data: { event: 'ride_started', data: JSON.stringify({ rideId: ride.id, type: ride.type }) },
        });

        res.status(201).json(ride);
    } catch (err) { next(err); }
}

/**
 * GET /api/rides/:id — Get ride details
 */
async function getRide(req, res, next) {
    try {
        const ride = await prisma.ride.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                locations: { orderBy: { timestamp: 'desc' }, take: 20 },
                alerts: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(ride);
    } catch (err) { next(err); }
}

/**
 * POST /api/rides/:id/location — Update ride location
 */
async function updateLocation(req, res, next) {
    try {
        const rideId = parseInt(req.params.id);
        const { lat, lng, speed, heading } = req.body;

        // Save location
        await prisma.rideLocation.create({
            data: {
                rideId,
                lat,
                lng,
                speed: speed || 0,
                heading: heading || 0,
            },
        });

        // Run safety engine
        const result = await safetyEngine.processLocationUpdate(rideId, lat, lng, speed || 0);

        // Broadcast via Socket.io
        try {
            const io = getIO();
            if (io) {
                io.to(`ride-${rideId}`).emit('location_update', { rideId, lat, lng, speed, heading });
                if (result) {
                    io.to(`ride-${rideId}`).emit('safety_update', {
                        rideId,
                        safetyScore: result.safetyScore,
                        level: result.level,
                    });
                    if (result.alerts.length > 0) {
                        io.to(`ride-${rideId}`).emit('alerts', {
                            rideId,
                            alerts: result.alerts,
                        });
                    }
                }
            }
        } catch (socketErr) {
            console.error('[Socket] Broadcast error:', socketErr.message);
        }

        res.json({
            location: { lat, lng, speed, heading },
            safety: result,
        });
    } catch (err) { next(err); }
}

/**
 * POST /api/rides/:id/end — End a ride
 */
async function endRide(req, res, next) {
    try {
        const rideId = parseInt(req.params.id);
        const ride = await prisma.ride.update({
            where: { id: rideId },
            data: { status: 'completed', endedAt: new Date() },
        });

        await prisma.analyticsLog.create({
            data: { event: 'ride_completed', data: JSON.stringify({ rideId, safetyScore: ride.safetyScore }) },
        });

        try {
            const io = getIO();
            if (io) io.to(`ride-${rideId}`).emit('ride_ended', { rideId });
        } catch (_) { }

        res.json(ride);
    } catch (err) { next(err); }
}

/**
 * GET /api/rides/:id/safety-score
 */
async function getSafetyScore(req, res, next) {
    try {
        const ride = await prisma.ride.findUnique({
            where: { id: parseInt(req.params.id) },
            select: { id: true, safetyScore: true, status: true },
        });
        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        const level = ride.safetyScore >= 75 ? 'safe' : ride.safetyScore >= 50 ? 'warning' : 'danger';
        res.json({ rideId: ride.id, safetyScore: ride.safetyScore, level, status: ride.status });
    } catch (err) { next(err); }
}

/**
 * GET /api/rides/:id/alerts
 */
async function getAlerts(req, res, next) {
    try {
        const rideId = parseInt(req.params.id);
        const alerts = await prisma.alert.findMany({
            where: { rideId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json(alerts);
    } catch (err) { next(err); }
}

module.exports = { createRide, getRide, updateLocation, endRide, getSafetyScore, getAlerts };
