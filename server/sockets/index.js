// ============================================
// SafeLink – Socket.io Setup
// ============================================
const jwt = require('jsonwebtoken');
const config = require('../config');

let io = null;

/**
 * Initialize Socket.io with JWT auth on connection.
 * @param {import('http').Server} httpServer
 */
function initSockets(httpServer) {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
        cors: config.cors,
    });

    // Authenticate on connection
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            // Allow unauthenticated connections with limited access
            socket.user = { id: 0, role: 'guest' };
            return next();
        }
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            socket.user = decoded;
            next();
        } catch (err) {
            // Allow connection but mark as guest
            socket.user = { id: 0, role: 'guest' };
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id} (user: ${socket.user.id})`);

        // Join a ride room for live tracking
        socket.on('join_ride', (rideId) => {
            const room = `ride-${rideId}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined ${room}`);
        });

        // Leave a ride room
        socket.on('leave_ride', (rideId) => {
            const room = `ride-${rideId}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left ${room}`);
        });

        // Handle simulated location updates from frontend
        socket.on('simulate_location', async (data) => {
            const { rideId, lat, lng, speed, heading } = data;
            if (!rideId) return;

            try {
                // Import safety engine dynamically to avoid circular deps
                const safetyEngine = require('../services/safetyEngine');
                const { PrismaClient } = require('@prisma/client');
                const prisma = new PrismaClient();

                // Save location
                await prisma.rideLocation.create({
                    data: { rideId, lat, lng, speed: speed || 0, heading: heading || 0 },
                });

                // Process safety
                const result = await safetyEngine.processLocationUpdate(rideId, lat, lng, speed || 0);

                // Broadcast to ride room
                io.to(`ride-${rideId}`).emit('location_update', { rideId, lat, lng, speed, heading });
                if (result) {
                    io.to(`ride-${rideId}`).emit('safety_update', {
                        rideId,
                        safetyScore: result.safetyScore,
                        level: result.level,
                    });
                    if (result.alerts && result.alerts.length > 0) {
                        io.to(`ride-${rideId}`).emit('alerts', { rideId, alerts: result.alerts });
                    }
                }
            } catch (err) {
                console.error('[Socket] simulate_location error:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
}

/**
 * Get the Socket.io instance.
 */
function getIO() {
    return io;
}

module.exports = { initSockets, getIO };
