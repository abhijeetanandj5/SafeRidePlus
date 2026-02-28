// ============================================
// SafeLink – Geo Service
// Haversine, Geofencing, Distance Calculations
// ============================================

/**
 * Calculates distance between two coordinates using Haversine formula.
 * @param {number} lat1 - Start latitude
 * @param {number} lng1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lng2 - End longitude
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Checks if a point is inside a circular geofence.
 * @param {number} pointLat
 * @param {number} pointLng
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm
 * @returns {boolean}
 */
function isInsideGeofence(pointLat, pointLng, centerLat, centerLng, radiusKm) {
    return haversineDistance(pointLat, pointLng, centerLat, centerLng) <= radiusKm;
}

/**
 * Estimates arrival time based on distance.
 * @param {number} distanceKm
 * @param {number} avgSpeedKmh - Default 25 km/h (urban)
 * @returns {number} Minutes
 */
function estimateArrivalTime(distanceKm, avgSpeedKmh = 25) {
    return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

/**
 * Calculates risk proximity for a utility based on distance.
 * @param {number} distanceKm
 * @param {string} type - 'police', 'hospital', 'pharmacy', 'safezone'
 * @returns {'low'|'medium'|'high'}
 */
function calculateRiskProximity(distanceKm, type) {
    if (type === 'police' || type === 'hospital') {
        if (distanceKm < 2) return 'low';
        if (distanceKm < 5) return 'medium';
        return 'high';
    }
    if (distanceKm < 1) return 'low';
    if (distanceKm < 3) return 'medium';
    return 'high';
}

/**
 * Calculates deviation from expected path.
 * Computes min distance from current point to line segments of expected route.
 * Simplified: distance from current point to the straight line between pickup and destination.
 * @returns {number} Deviation in km
 */
function calculateRouteDeviation(currentLat, currentLng, pickupLat, pickupLng, destLat, destLng) {
    // Point-to-line distance using cross product formula
    const A = haversineDistance(pickupLat, pickupLng, currentLat, currentLng);
    const B = haversineDistance(destLat, destLng, currentLat, currentLng);
    const C = haversineDistance(pickupLat, pickupLng, destLat, destLng);

    if (C === 0) return A; // Pickup = Destination

    // Semi-perimeter
    const s = (A + B + C) / 2;
    // Area via Heron's formula
    const areaSquared = s * (s - A) * (s - B) * (s - C);
    const area = areaSquared > 0 ? Math.sqrt(areaSquared) : 0;
    // Height from current point to pickup-dest line = 2 * area / base
    return (2 * area) / C;
}

module.exports = {
    haversineDistance,
    isInsideGeofence,
    estimateArrivalTime,
    calculateRiskProximity,
    calculateRouteDeviation,
};
