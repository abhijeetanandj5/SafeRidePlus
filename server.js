// ============================================
// SafeLink – Server Entry Point
// ============================================
require('dotenv').config();
const http = require('http');
const app = require('./app');
const config = require('./server/config');
const { initSockets } = require('./server/sockets');

const server = http.createServer(app);

// Initialize Socket.io
initSockets(server);

server.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║   🛡️  SafeLink Server Running                ║');
    console.log(`  ║   🌐 http://localhost:${config.port}                  ║`);
    console.log(`  ║   📡 WebSocket: ws://localhost:${config.port}          ║`);
    console.log(`  ║   🔧 Environment: ${config.nodeEnv.padEnd(21)}║`);
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
});
