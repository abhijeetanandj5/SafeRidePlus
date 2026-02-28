// ============================================
// SafeLink – AI Safety Engine (Server-Side)
// Scoring, Anomaly Detection, Alert Generation
// ============================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const geo = require('./geoService');

// ─── Score Modifiers ───
const PENALTIES = {
    routeDeviation: -15,
    inactivity: -10,
    highRiskZone: -20,
    speedAnomaly: -10,
    nightTimeMin: -5,
    nightTimeMax: -15,
};

const BONUSES = {
    policeProximity: 10,
};

// ─── Thresholds ───
const THRESHOLDS = {
    deviationKm: 0.5,        // Route deviation trigger
    speedMaxKmh: 80,         // Speed anomaly trigger
    speedMinKmh: 2,          // Below this = inactivity (when ride active)
    inactivityMinutes: 2,    // Inactivity time threshold
    policeProximityKm: 1.5,  // Bonus radius
};

/**
 * Processes a location update for a ride.
 * Runs all safety checks, calculates score, persists alerts.
 * @param {number} rideId
 * @param {number} lat
 * @param {number} lng
 * @param {number} speed - km/h
 * @returns {object} { safetyScore, level, alerts }
 */
async function processLocationUpdate(rideId, lat, lng, speed) {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
            locations: { orderBy: { timestamp: 'desc' }, take: 5 },
        },
    });

    if (!ride || ride.status !== 'active') {
        return null;
    }

    const newAlerts = [];

    // ─── 1. Route Deviation ───
    const deviation = geo.calculateRouteDeviation(
        lat, lng,
        ride.pickupLat, ride.pickupLng,
        ride.destLat, ride.destLng
    );

    if (deviation > THRESHOLDS.deviationKm) {
        newAlerts.push({
            rideId,
            type: 'critical',
            category: 'route_deviation',
            title: 'Route Deviation Detected',
            message: `Vehicle deviated ${deviation.toFixed(1)} km from planned route. AI engine analyzing alternate path.`,
            icon: '⚠️',
        });
    }

    // ─── 2. Speed Anomaly ───
    if (speed > THRESHOLDS.speedMaxKmh) {
        newAlerts.push({
            rideId,
            type: 'warning',
            category: 'speed_anomaly',
            title: 'Speed Anomaly Detected',
            message: `Vehicle speed ${speed.toFixed(0)} km/h exceeds safe threshold. Driver advisory issued.`,
            icon: '💨',
        });
    }

    // ─── 3. Inactivity Detection ───
    if (speed < THRESHOLDS.speedMinKmh && ride.locations.length > 0) {
        const lastMovement = ride.locations.find(l => l.speed >= THRESHOLDS.speedMinKmh);
        if (lastMovement) {
            const inactiveMinutes = (Date.now() - new Date(lastMovement.timestamp).getTime()) / 60000;
            if (inactiveMinutes >= THRESHOLDS.inactivityMinutes) {
                newAlerts.push({
                    rideId,
                    type: 'critical',
                    category: 'inactivity',
                    title: `Unexpected Stop > ${Math.floor(inactiveMinutes)} Minutes`,
                    message: 'Vehicle stationary at unscheduled location. Emergency contacts on standby.',
                    icon: '🛑',
                });
            }
        }
    }

    // ─── 4. Geofence / Risk Zone Check ───
    const riskZones = await prisma.riskZone.findMany();
    let inHighRiskZone = false;

    for (const zone of riskZones) {
        if (geo.isInsideGeofence(lat, lng, zone.lat, zone.lng, zone.radiusKm)) {
            if (zone.riskLevel === 'high') {
                inHighRiskZone = true;
                newAlerts.push({
                    rideId,
                    type: 'critical',
                    category: 'high_risk_zone',
                    title: 'High-Risk Area Proximity',
                    message: `Vehicle entered "${zone.name}". All safety systems at maximum alert.`,
                    icon: '🔴',
                });
            } else {
                newAlerts.push({
                    rideId,
                    type: 'warning',
                    category: 'geofence_breach',
                    title: `Entering ${zone.name}`,
                    message: `Medium-risk zone detected. Enhanced monitoring activated.`,
                    icon: '🟡',
                });
            }
        }
    }

    // ─── 5. Police Proximity Bonus ───
    const policeStations = await prisma.utility.findMany({ where: { type: 'police' } });
    let nearPolice = false;

    for (const station of policeStations) {
        const dist = geo.haversineDistance(lat, lng, station.lat, station.lng);
        if (dist <= THRESHOLDS.policeProximityKm) {
            nearPolice = true;
            newAlerts.push({
                rideId,
                type: 'safe',
                category: 'police_nearby',
                title: 'Police Station Nearby',
                message: `${station.name} within ${(dist * 1000).toFixed(0)}m. Score adjusted positively.`,
                icon: '🏛️',
            });
            break;
        }
    }

    // ─── 6. Night-Time Multiplier ───
    const nightPenalty = calculateNightPenalty();
    if (nightPenalty < 0) {
        newAlerts.push({
            rideId,
            type: 'warning',
            category: 'night_risk',
            title: 'Night-Time Vulnerability Active',
            message: 'Current time within high-risk window. Additional safety layers engaged.',
            icon: '🌃',
        });
    }

    // ─── Calculate Score ───
    let score = 100;
    if (deviation > THRESHOLDS.deviationKm) score += PENALTIES.routeDeviation;
    if (speed > THRESHOLDS.speedMaxKmh) score += PENALTIES.speedAnomaly;
    if (inHighRiskZone) score += PENALTIES.highRiskZone;
    if (nearPolice) score += BONUSES.policeProximity;
    score += nightPenalty;

    // Check inactivity penalty
    if (speed < THRESHOLDS.speedMinKmh && ride.locations.length > 0) {
        const lastMovement = ride.locations.find(l => l.speed >= THRESHOLDS.speedMinKmh);
        if (lastMovement) {
            const inactiveMinutes = (Date.now() - new Date(lastMovement.timestamp).getTime()) / 60000;
            if (inactiveMinutes >= THRESHOLDS.inactivityMinutes) {
                score += PENALTIES.inactivity;
            }
        }
    }

    score = Math.max(0, Math.min(100, score));

    // ─── Persist ───
    // Save alerts (deduplicate by category within last 30 seconds)
    const recentAlerts = await prisma.alert.findMany({
        where: {
            rideId,
            createdAt: { gte: new Date(Date.now() - 30000) },
        },
    });
    const recentCategories = new Set(recentAlerts.map(a => a.category));

    const alertsToCreate = newAlerts.filter(a => !recentCategories.has(a.category));
    if (alertsToCreate.length > 0) {
        await prisma.alert.createMany({ data: alertsToCreate });

        // Log analytics
        for (const a of alertsToCreate) {
            await prisma.analyticsLog.create({
                data: { event: 'alert_triggered', data: JSON.stringify({ rideId, category: a.category }) },
            });
        }
    }

    // Update ride safety score
    await prisma.ride.update({
        where: { id: rideId },
        data: { safetyScore: score },
    });

    const level = score >= 75 ? 'safe' : score >= 50 ? 'warning' : 'danger';

    return {
        safetyScore: score,
        level,
        alerts: alertsToCreate,
    };
}

/**
 * Night-time penalty based on current hour.
 */
function calculateNightPenalty() {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) return PENALTIES.nightTimeMax;
    if (hour >= 20 || hour < 6) return PENALTIES.nightTimeMin;
    return 0;
}

module.exports = {
    processLocationUpdate,
    PENALTIES,
    BONUSES,
    THRESHOLDS,
};
