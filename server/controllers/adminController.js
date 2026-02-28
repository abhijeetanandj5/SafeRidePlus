// ============================================
// SafeLink – Admin Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAnalytics(req, res, next) {
    try {
        const [totalRides, activeRides, completedRides, totalAlerts, emergencyEvents, allRides] = await Promise.all([
            prisma.ride.count(),
            prisma.ride.count({ where: { status: 'active' } }),
            prisma.ride.count({ where: { status: 'completed' } }),
            prisma.alert.count(),
            prisma.analyticsLog.count({ where: { event: 'emergency_activated' } }),
            prisma.ride.findMany({ select: { safetyScore: true } }),
        ]);

        const avgSafetyScore = allRides.length > 0
            ? Math.round(allRides.reduce((sum, r) => sum + r.safetyScore, 0) / allRides.length)
            : 100;

        // Alert distribution
        const alertsByCategory = await prisma.alert.groupBy({
            by: ['category'],
            _count: { id: true },
        });

        // Recent analytics timeline
        const recentLogs = await prisma.analyticsLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json({
            totalRides,
            activeRides,
            completedRides,
            totalAlerts,
            emergencyEvents,
            avgSafetyScore,
            alertDistribution: alertsByCategory.map(a => ({
                category: a.category,
                count: a._count.id,
            })),
            recentActivity: recentLogs,
        });
    } catch (err) { next(err); }
}

module.exports = { getAnalytics };
