// ============================================
// SafeLink – Database Seed Script
// ============================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding SafeLink database...\n');

    // ─── Users ───
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@safelink.io' },
        update: {},
        create: {
            email: 'admin@safelink.io',
            password: adminPassword,
            name: 'SafeLink Admin',
            phone: '+91 98765 00000',
            role: 'admin',
        },
    });

    const user = await prisma.user.upsert({
        where: { email: 'user@safelink.io' },
        update: {},
        create: {
            email: 'user@safelink.io',
            password: userPassword,
            name: 'Abhishek',
            phone: '+91 98765 12345',
            role: 'user',
        },
    });

    console.log(`  ✅ Users: admin (admin@safelink.io / admin123), user (user@safelink.io / user123)`);

    // ─── Public Utilities ───
    const utilities = [
        { type: 'police', name: 'Koramangala Police Station', address: '80 Feet Road, Koramangala 4th Block', lat: 12.9347, lng: 77.6217, phone: '080-2553 2200', open24: true },
        { type: 'police', name: 'HSR Layout Police Station', address: '27th Main Road, HSR Layout', lat: 12.9116, lng: 77.6389, phone: '080-2553 4200', open24: true },
        { type: 'police', name: 'Madiwala Traffic Police', address: 'Hosur Main Road, Madiwala', lat: 12.9226, lng: 77.6174, phone: '080-2553 3100', open24: true },
        { type: 'hospital', name: 'Apollo Hospital', address: 'Bannerghatta Road, Bangalore', lat: 12.8958, lng: 77.5987, phone: '080-2630 4050', open24: true },
        { type: 'hospital', name: 'Fortis Hospital', address: '14th Cross, Bannerghatta Road', lat: 12.8891, lng: 77.5969, phone: '080-6621 4444', open24: true },
        { type: 'hospital', name: 'Narayana Health City', address: 'Hosur Road, Bommasandra', lat: 12.8141, lng: 77.6762, phone: '080-7122 2222', open24: true },
        { type: 'pharmacy', name: 'MedPlus 24 Hours', address: 'Sony World Signal, Koramangala', lat: 12.9345, lng: 77.6268, phone: '080-4040 2000', open24: true },
        { type: 'pharmacy', name: 'Apollo Pharmacy 24/7', address: 'Forum Mall, Koramangala', lat: 12.9341, lng: 77.6114, phone: '080-4920 1000', open24: true },
        { type: 'safezone', name: 'Forum Mall (Safe Haven)', address: 'Hosur Road, Koramangala', lat: 12.9348, lng: 77.6105, phone: '080-4151 7777', open24: false },
        { type: 'safezone', name: 'BDA Complex (Well-lit Zone)', address: 'Domlur, Indiranagar', lat: 12.9610, lng: 77.6387, phone: '', open24: false },
        { type: 'safezone', name: 'Metro Station – HSR Layout', address: 'Outer Ring Road, HSR Layout', lat: 12.9120, lng: 77.6386, phone: '080-2296 9999', open24: false },
    ];

    await prisma.utility.deleteMany();
    await prisma.utility.createMany({ data: utilities });
    console.log(`  ✅ Utilities: ${utilities.length} locations seeded`);

    // ─── Risk Zones ───
    const riskZones = [
        { name: 'Isolated Highway Stretch', lat: 12.9250, lng: 77.6150, radiusKm: 0.4, riskLevel: 'high' },
        { name: 'Under-construction Area', lat: 12.9450, lng: 77.6320, radiusKm: 0.3, riskLevel: 'medium' },
        { name: 'Industrial District', lat: 12.9580, lng: 77.6480, radiusKm: 0.5, riskLevel: 'high' },
        { name: 'Poor Connectivity Zone', lat: 12.9600, lng: 77.6550, radiusKm: 0.35, riskLevel: 'medium' },
    ];

    await prisma.riskZone.deleteMany();
    await prisma.riskZone.createMany({ data: riskZones });
    console.log(`  ✅ Risk Zones: ${riskZones.length} zones seeded`);

    // ─── Sample Analytics ───
    const events = [
        { event: 'ride_started', data: '{"rideId":1,"type":"ride"}' },
        { event: 'ride_completed', data: '{"rideId":1,"safetyScore":87}' },
        { event: 'alert_triggered', data: '{"rideId":1,"category":"route_deviation"}' },
        { event: 'alert_triggered', data: '{"rideId":1,"category":"night_risk"}' },
    ];

    await prisma.analyticsLog.deleteMany();
    await prisma.analyticsLog.createMany({ data: events });
    console.log(`  ✅ Analytics: ${events.length} sample events seeded`);

    console.log('\n🎉 Seeding complete!\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
