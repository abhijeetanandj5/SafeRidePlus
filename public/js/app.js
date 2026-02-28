// ============================================
// SafeLink – Main Application Controller  
// (Integrated with Backend API + WebSocket)
// ============================================
(function () {
    'use strict';

    // ─── State ───
    let socket = null;
    let currentRideId = null;
    let routeAnimationFrame = null;
    let routeProgress = 0;
    let alertCount = 0;

    // Base coordinates for Bangalore ride area
    const RIDE_START = { lat: 12.9352, lng: 77.6245 };
    const RIDE_END = { lat: 12.9784, lng: 77.6408 };
    const MAP_CENTER = { lat: 12.9568, lng: 77.6326 };

    // Leaflet map state
    let rideMap = null;
    let rideMapLayers = [];
    let vehicleMarker = null;
    let completedRoute = null;
    let safeRouteCoords = [];
    let dangerZones = [];

    // ═══════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        if (!SafeLinkAPI.isLoggedIn()) {
            showAuthScreen();
        } else {
            showMainApp();
            connectSocket();
        }
        setupAuthListeners();
        setupNavigation();
        setupBookingActions();
        setupSOSButton();
        setupIncidentModal();
        setupSafetyToggle();
        setupMobileMenu();
    }

    // ═══════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════
    function showAuthScreen() {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appShell').style.display = 'none';
    }

    function showMainApp() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        updateHeaderUserInfo();
        navigateTo('home');
    }

    function updateHeaderUserInfo() {
        const user = SafeLinkAPI.getUser();
        if (!user) return;

        const nameEl = document.getElementById('headerUserName');
        const emailEl = document.getElementById('headerUserEmail');
        const avatarEl = document.getElementById('headerAvatar');

        if (nameEl) nameEl.textContent = user.name || 'User';
        if (emailEl) emailEl.textContent = user.email || '';
        if (avatarEl) {
            const name = user.name || user.email || 'SL';
            const parts = name.trim().split(/\s+/);
            const initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : name.substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }
    }

    function setupAuthListeners() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const toggleAuth = document.getElementById('toggleAuth');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginBtn) loginBtn.addEventListener('click', handleLogin);
        if (registerBtn) registerBtn.addEventListener('click', handleRegister);
        if (toggleAuth) toggleAuth.addEventListener('click', () => {
            const regFields = document.getElementById('registerFields');
            const isLogin = regFields.style.display === 'none';
            regFields.style.display = isLogin ? 'block' : 'none';
            loginBtn.style.display = isLogin ? 'none' : 'block';
            registerBtn.style.display = isLogin ? 'block' : 'none';
            toggleAuth.textContent = isLogin ? 'Already have an account? Login' : "Don't have an account? Register";
            document.getElementById('authTitle').textContent = isLogin ? 'Create Account' : 'Welcome Back';
        });
        if (logoutBtn) logoutBtn.addEventListener('click', () => {
            SafeLinkAPI.logout();
            if (socket) socket.disconnect();
            showAuthScreen();
        });
    }

    async function handleLogin() {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const errorEl = document.getElementById('authError');
        try {
            errorEl.textContent = '';
            await SafeLinkAPI.login(email, password);
            showMainApp();
            connectSocket();
        } catch (err) {
            errorEl.textContent = err.message;
        }
    }

    async function handleRegister() {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const name = document.getElementById('authName').value;
        const phone = document.getElementById('authPhone').value;
        const errorEl = document.getElementById('authError');
        try {
            errorEl.textContent = '';
            await SafeLinkAPI.register(email, password, name, phone);
            showMainApp();
            connectSocket();
        } catch (err) {
            errorEl.textContent = err.message;
        }
    }

    // ═══════════════════════════════════════
    // WEBSOCKET
    // ═══════════════════════════════════════
    function connectSocket() {
        if (typeof io === 'undefined') return;
        socket = io({ auth: { token: SafeLinkAPI.getToken() } });

        socket.on('connect', () => console.log('[WS] Connected:', socket.id));

        socket.on('safety_update', (data) => {
            updateScoreGauge(data.safetyScore, data.level);
        });

        socket.on('alerts', (data) => {
            if (data.alerts && data.alerts.length > 0) {
                data.alerts.forEach(addAlertToFeed);
                showFloatingAlert(data.alerts[0]);
            }
        });

        socket.on('location_update', (data) => {
            // Update handled by vehicle animation
        });

        socket.on('ride_ended', () => {
            showFloatingAlert({ title: 'Ride Completed', message: 'Your ride has been completed safely.', icon: '✅', type: 'safe' });
        });
    }

    // ═══════════════════════════════════════
    // NAVIGATION (SPA)
    // ═══════════════════════════════════════
    function setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => navigateTo(item.dataset.page));
        });
    }

    function navigateTo(page) {
        // Update nav
        document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`page-${page}`);
        if (target) target.classList.add('active');

        // Update header
        const titles = { home: 'Home', ride: 'Active Ride', safety: 'AI Safety Engine', utilities: 'Nearby Utilities', family: 'Family Tracking', analytics: 'Analytics Dashboard' };
        const titleEl = document.getElementById('headerTitle');
        if (titleEl) titleEl.textContent = titles[page] || page;

        // Page-specific init
        if (page === 'home') initHomePage();
        if (page === 'ride') initRidePage();
        if (page === 'safety') initSafetyPage();
        if (page === 'utilities') initUtilitiesPage();
        if (page === 'family') initFamilyPage();
        if (page === 'analytics') initAnalyticsPage();

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    // ═══════════════════════════════════════
    // HOME PAGE
    // ═══════════════════════════════════════
    function initHomePage() {
        animateCounters();
    }

    function animateCounters() {
        document.querySelectorAll('.stat-value[data-target], .analytics-stat-value[data-target]').forEach(el => {
            const target = parseInt(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            let current = 0;
            const step = Math.ceil(target / 60);
            const timer = setInterval(() => {
                current += step;
                if (current >= target) { current = target; clearInterval(timer); }
                el.textContent = current.toLocaleString() + suffix;
            }, 16);
        });
    }

    // ═══════════════════════════════════════
    // BOOKING
    // ═══════════════════════════════════════
    function setupBookingActions() {
        const bookRideBtn = document.getElementById('bookRideBtn');
        const bookDeliveryBtn = document.getElementById('bookDeliveryBtn');
        const confirmBtn = document.getElementById('confirmBookingBtn');
        const cancelBtn = document.getElementById('cancelBookingFormBtn');

        if (bookRideBtn) bookRideBtn.addEventListener('click', () => openBookingForm('ride'));
        if (bookDeliveryBtn) bookDeliveryBtn.addEventListener('click', () => openBookingForm('delivery'));
        if (confirmBtn) confirmBtn.addEventListener('click', confirmBooking);
        if (cancelBtn) cancelBtn.addEventListener('click', () => {
            document.getElementById('bookingFormOverlay').classList.remove('active');
        });
    }

    function openBookingForm(type) {
        document.getElementById('bookingTypeInput').value = type;
        document.getElementById('bookingFormTitle').textContent = type === 'ride' ? '🏍️ Book a Ride' : '📦 Book Delivery';
        document.getElementById('bookingFormOverlay').classList.add('active');
    }

    async function confirmBooking() {
        const type = document.getElementById('bookingTypeInput').value;
        const pickup = document.getElementById('pickupInput').value;
        const dest = document.getElementById('destinationInput').value;

        try {
            const ride = await SafeLinkAPI.createRide({
                type,
                pickupAddress: pickup,
                destAddress: dest,
                pickupLat: 12.9352,
                pickupLng: 77.6245,
                destLat: 12.9784,
                destLng: 77.6408,
            });

            currentRideId = ride.id;

            // Join socket room
            if (socket) socket.emit('join_ride', ride.id);

            // Update rider details
            document.getElementById('riderName').textContent = ride.driverName;
            document.getElementById('riderVehicle').textContent = `${ride.driverVehicle} • ${ride.driverPlate}`;
            document.getElementById('riderRating').textContent = ride.driverRating;
            document.getElementById('rideOTP').textContent = ride.otp;

            // Update timeline
            const timelineEl = document.getElementById('timelineList');
            if (timelineEl) {
                const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                timelineEl.innerHTML = `
          <div class="timeline-item"><h6>Booking confirmed</h6><p>${now}</p></div>
          <div class="timeline-item"><h6>Driver assigned — ${ride.driverName}</h6><p>${now}</p></div>
          <div class="timeline-item"><h6>AI Safety Engine activated</h6><p>${now}</p></div>
        `;
            }

            document.getElementById('bookingFormOverlay').classList.remove('active');
            showFloatingAlert({ title: 'Ride Booked!', message: `Driver ${ride.driverName} assigned. OTP: ${ride.otp}`, icon: '✅', type: 'safe' });
            navigateTo('ride');

            // Start the route simulation (sends location updates to server)
            startRouteSimulation(ride.id);

        } catch (err) {
            showFloatingAlert({ title: 'Booking Failed', message: err.message, icon: '❌', type: 'critical' });
        }
    }

    // ═══════════════════════════════════════
    // RIDE PAGE (Leaflet Map + Heatmaps + Safe Navigation)
    // ═══════════════════════════════════════

    function initRidePage() {
        const mapEl = document.getElementById('rideMap');
        if (!mapEl) return;

        // Destroy existing map if re-navigating
        if (rideMap) {
            rideMap.remove();
            rideMap = null;
        }
        rideMapLayers = [];

        // Create Leaflet map
        rideMap = L.map('rideMap', {
            center: [MAP_CENTER.lat, MAP_CENTER.lng],
            zoom: 14,
            zoomControl: true,
            attributionControl: true,
        });

        // Dark-themed OpenStreetMap tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(rideMap);

        // Generate random heatmap zones
        dangerZones = generateRandomHeatmapZones();
        renderHeatmapZones(rideMap, dangerZones);

        // Compute and render safe route
        safeRouteCoords = computeSafeRoute(RIDE_START, RIDE_END, dangerZones);
        renderSafeRoute(rideMap, safeRouteCoords);

        // Populate legend
        populateHeatmapLegend(dangerZones);

        // Fit bounds to show entire route
        const allPoints = safeRouteCoords.map(c => [c.lat, c.lng]);
        if (allPoints.length > 0) {
            rideMap.fitBounds(allPoints, { padding: [40, 40] });
        }

        // Force a re-size after a tick (Leaflet needs this when container is hidden initially)
        setTimeout(() => { if (rideMap) rideMap.invalidateSize(); }, 200);
    }

    // ─── Random Heatmap Zone Generation ───
    function generateRandomHeatmapZones() {
        const zoneNames = [
            'Isolated Highway Stretch', 'Under-Construction Area', 'Industrial District',
            'Poor Connectivity Zone', 'Unlit Road Segment', 'Accident-Prone Junction',
            'Waterlogged Area', 'High Crime Zone', 'Narrow Lane Cluster',
            'Construction Detour', 'Abandoned Factory Area', 'Night Risk Corridor',
        ];

        const numZones = 6 + Math.floor(Math.random() * 5); // 6-10 zones
        const zones = [];

        const latMin = Math.min(RIDE_START.lat, RIDE_END.lat) - 0.008;
        const latMax = Math.max(RIDE_START.lat, RIDE_END.lat) + 0.008;
        const lngMin = Math.min(RIDE_START.lng, RIDE_END.lng) - 0.008;
        const lngMax = Math.max(RIDE_START.lng, RIDE_END.lng) + 0.008;

        for (let i = 0; i < numZones; i++) {
            const lat = latMin + Math.random() * (latMax - latMin);
            const lng = lngMin + Math.random() * (lngMax - lngMin);
            const radius = 200 + Math.random() * 600; // 200m - 800m
            const intensity = 0.3 + Math.random() * 0.7;  // 0.3 - 1.0
            const name = zoneNames[i % zoneNames.length];

            zones.push({ lat, lng, radius, intensity, name });
        }

        return zones;
    }

    // ─── Render Heatmap Zones on Map ───
    function renderHeatmapZones(map, zones) {
        // Generate heatmap data points (dense points inside each zone)
        const heatData = [];
        zones.forEach(z => {
            const numPoints = Math.floor(20 + z.intensity * 40);
            for (let i = 0; i < numPoints; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * z.radius / 111320; // Convert m to degrees approx
                const lat = z.lat + dist * Math.cos(angle);
                const lng = z.lng + dist * Math.sin(angle) / Math.cos(z.lat * Math.PI / 180);
                heatData.push([lat, lng, z.intensity]);
            }
        });

        // Add heat layer
        if (typeof L.heatLayer === 'function') {
            const heat = L.heatLayer(heatData, {
                radius: 35,
                blur: 25,
                maxZoom: 17,
                max: 1.0,
                gradient: {
                    0.0: 'rgba(0,0,0,0)',
                    0.2: 'rgba(255,145,0,0.3)',
                    0.4: 'rgba(255,100,0,0.5)',
                    0.6: 'rgba(255,50,20,0.65)',
                    0.8: 'rgba(255,23,68,0.8)',
                    1.0: 'rgba(255,23,68,1)',
                },
            }).addTo(map);
            rideMapLayers.push(heat);
        }

        // Add circle overlays with labels
        zones.forEach(z => {
            const circle = L.circle([z.lat, z.lng], {
                radius: z.radius,
                color: `rgba(255, 23, 68, ${0.2 + z.intensity * 0.3})`,
                fillColor: `rgba(255, 23, 68, ${0.05 + z.intensity * 0.1})`,
                fillOpacity: 1,
                weight: 1.5,
                dashArray: '6 4',
            }).addTo(map);

            circle.bindPopup(`<b>⚠️ ${z.name}</b><br/>Risk Intensity: ${Math.round(z.intensity * 100)}%<br/>Radius: ${Math.round(z.radius)}m`);
            rideMapLayers.push(circle);

            // Zone label marker
            const label = L.divIcon({
                className: 'zone-label',
                html: `<span style="
                    background: rgba(255,23,68,0.75);
                    color: #fff;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    font-family: Inter, sans-serif;
                    white-space: nowrap;
                    pointer-events: none;
                ">${z.name}</span>`,
                iconSize: [0, 0],
                iconAnchor: [0, 20],
            });
            const labelMarker = L.marker([z.lat, z.lng], { icon: label, interactive: false }).addTo(map);
            rideMapLayers.push(labelMarker);
        });
    }

    // ─── Safe Route Computation (avoids danger zones) ───
    function computeSafeRoute(start, end, zones) {
        // Generate base waypoints in a straight line
        const numWaypoints = 30;
        const waypoints = [];

        for (let i = 0; i <= numWaypoints; i++) {
            const t = i / numWaypoints;
            waypoints.push({
                lat: start.lat + (end.lat - start.lat) * t,
                lng: start.lng + (end.lng - start.lng) * t,
            });
        }

        // Deflect waypoints away from danger zones (multiple passes for convergence)
        for (let pass = 0; pass < 4; pass++) {
            for (let i = 1; i < waypoints.length - 1; i++) { // Don't move start/end
                const wp = waypoints[i];
                let totalDx = 0, totalDy = 0;

                zones.forEach(z => {
                    const dlat = wp.lat - z.lat;
                    const dlng = wp.lng - z.lng;
                    const dist = Math.sqrt(dlat * dlat + dlng * dlng);
                    const zoneRadiusDeg = z.radius / 111320; // meters to degrees approx

                    if (dist < zoneRadiusDeg * 1.5) {
                        // Push waypoint away from zone center
                        const pushStrength = (zoneRadiusDeg * 1.5 - dist) * 1.2 * z.intensity;
                        const angle = Math.atan2(dlat, dlng);
                        totalDx += Math.cos(angle) * pushStrength;
                        totalDy += Math.sin(angle) * pushStrength;
                    }
                });

                waypoints[i] = {
                    lat: wp.lat + totalDy,
                    lng: wp.lng + totalDx,
                };
            }
        }

        // Smooth path using Catmull-Rom interpolation
        const smoothed = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
            const p0 = waypoints[Math.max(0, i - 1)];
            const p1 = waypoints[i];
            const p2 = waypoints[Math.min(waypoints.length - 1, i + 1)];
            const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)];

            for (let t = 0; t < 1; t += 0.25) {
                const t2 = t * t;
                const t3 = t2 * t;
                const lat = 0.5 * ((2 * p1.lat) +
                    (-p0.lat + p2.lat) * t +
                    (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
                    (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3);
                const lng = 0.5 * ((2 * p1.lng) +
                    (-p0.lng + p2.lng) * t +
                    (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
                    (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3);
                smoothed.push({ lat, lng });
            }
        }
        smoothed.push(waypoints[waypoints.length - 1]);

        return smoothed;
    }

    // ─── Render Safe Route on Map ───
    function renderSafeRoute(map, route) {
        const coords = route.map(c => [c.lat, c.lng]);

        // Full route preview (dashed, faint)
        const previewLine = L.polyline(coords, {
            color: '#00e676',
            weight: 3,
            opacity: 0.25,
            dashArray: '8 6',
        }).addTo(map);
        rideMapLayers.push(previewLine);

        // Completed route (will grow during animation)
        completedRoute = L.polyline([], {
            color: '#00e676',
            weight: 4,
            opacity: 0.9,
        }).addTo(map);
        rideMapLayers.push(completedRoute);

        // Start marker
        const startIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#ff1744;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(255,23,68,0.6);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
        const startMarker = L.marker([route[0].lat, route[0].lng], { icon: startIcon })
            .bindPopup('<b>📍 Pickup</b><br/>Koramangala 4th Block')
            .addTo(map);
        rideMapLayers.push(startMarker);

        // End marker
        const endIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#00e676;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(0,230,118,0.6);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
        const lastPt = route[route.length - 1];
        const endMarker = L.marker([lastPt.lat, lastPt.lng], { icon: endIcon })
            .bindPopup('<b>🏁 Destination</b><br/>Indiranagar 100ft Road')
            .addTo(map);
        rideMapLayers.push(endMarker);

        // Vehicle marker
        const vehicleIcon = L.divIcon({
            className: 'vehicle-marker',
            html: `<div style="
                width: 24px; height: 24px; border-radius: 50%;
                background: radial-gradient(circle, #00e676 40%, rgba(0,230,118,0.3) 100%);
                border: 3px solid #fff;
                box-shadow: 0 0 20px rgba(0,230,118,0.5), 0 0 40px rgba(0,230,118,0.2);
                display: flex; align-items: center; justify-content: center;
                font-size: 12px;
            ">🏍️</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
        });
        vehicleMarker = L.marker([route[0].lat, route[0].lng], { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
        rideMapLayers.push(vehicleMarker);
    }

    // ─── Populate Heatmap Legend ───
    function populateHeatmapLegend(zones) {
        const legendEl = document.getElementById('legendItems');
        if (!legendEl) return;

        // Sort by intensity descending, show top 5
        const sorted = [...zones].sort((a, b) => b.intensity - a.intensity).slice(0, 5);
        legendEl.innerHTML = sorted.map(z => {
            const r = Math.round(180 + z.intensity * 75);
            const g = Math.round(40 - z.intensity * 30);
            const b = Math.round(40 + z.intensity * 28);
            return `<div class="legend-item">
                <span class="legend-dot" style="background: rgb(${r},${g},${b});"></span>
                <span>${z.name} (${Math.round(z.intensity * 100)}%)</span>
            </div>`;
        }).join('');
    }

    // ─── Route Simulation (Leaflet-based) ───
    function startRouteSimulation(rideId) {
        routeProgress = 0;
        let etaSeconds = 13 * 60;

        if (!rideMap) initRidePage(); // Ensure map is initialized
        if (safeRouteCoords.length === 0) return;

        function tick() {
            routeProgress += 0.0015;
            if (routeProgress >= 1) routeProgress = 0; // Loop

            const totalPoints = safeRouteCoords.length;
            const currentIdx = Math.min(Math.floor(routeProgress * (totalPoints - 1)), totalPoints - 2);
            const frac = (routeProgress * (totalPoints - 1)) - currentIdx;

            // Interpolate position
            const p1 = safeRouteCoords[currentIdx];
            const p2 = safeRouteCoords[currentIdx + 1];
            const lat = p1.lat + (p2.lat - p1.lat) * frac;
            const lng = p1.lng + (p2.lng - p1.lng) * frac;

            // Update vehicle marker
            if (vehicleMarker) {
                vehicleMarker.setLatLng([lat, lng]);
            }

            // Update completed route
            if (completedRoute) {
                const completedCoords = safeRouteCoords.slice(0, currentIdx + 1).map(c => [c.lat, c.lng]);
                completedCoords.push([lat, lng]);
                completedRoute.setLatLngs(completedCoords);
            }

            // Update ETA
            etaSeconds = Math.max(0, etaSeconds - 1);
            const m = Math.floor(etaSeconds / 60);
            const s = etaSeconds % 60;
            const etaEl = document.getElementById('etaDisplay');
            if (etaEl) etaEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;

            const progEl = document.getElementById('rideProgress');
            if (progEl) progEl.textContent = `${Math.floor(routeProgress * 100)}%`;

            // Send location to backend periodically
            if (Math.floor(routeProgress * 1000) % 6 === 0) {
                const speed = 20 + Math.random() * 40;
                if (socket) {
                    socket.emit('simulate_location', {
                        rideId,
                        lat: lat + (Math.random() - 0.5) * 0.001,
                        lng: lng + (Math.random() - 0.5) * 0.001,
                        speed,
                        heading: Math.random() * 360,
                    });
                }
            }

            routeAnimationFrame = requestAnimationFrame(tick);
        }

        if (routeAnimationFrame) cancelAnimationFrame(routeAnimationFrame);
        routeAnimationFrame = requestAnimationFrame(tick);
    }

    // ═══════════════════════════════════════
    // SAFETY SCORE GAUGE
    // ═══════════════════════════════════════
    function updateScoreGauge(score, level) {
        const fill = document.getElementById('scoreGaugeFill');
        const number = document.getElementById('scoreNumber');
        const status = document.getElementById('scoreStatus');
        if (!fill) return;

        const circumference = 364.4;
        const offset = circumference - (score / 100) * circumference;
        fill.style.strokeDashoffset = offset;

        const colors = { safe: '#00e676', warning: '#ff9100', danger: '#ff1744' };
        fill.style.stroke = colors[level] || colors.safe;
        if (number) number.textContent = score;
        if (status) {
            const labels = { safe: '✓ Safe', warning: '⚠ Caution', danger: '🚨 Danger' };
            status.textContent = labels[level];
            status.className = 'score-status ' + level;
        }
    }

    // ═══════════════════════════════════════
    // SAFETY PAGE (Alerts from Backend)
    // ═══════════════════════════════════════
    async function initSafetyPage() {
        if (!currentRideId) return;
        try {
            const alerts = await SafeLinkAPI.getAlerts(currentRideId);
            const listEl = document.getElementById('alertsList');
            if (listEl && alerts.length > 0) {
                listEl.innerHTML = '';
                alerts.forEach(a => addAlertToFeed(a));
            }
            const badge = document.getElementById('alertCountBadge');
            if (badge) badge.textContent = alerts.length;
        } catch (_) { }
    }

    function addAlertToFeed(alert) {
        const listEl = document.getElementById('alertsList');
        if (!listEl) return;

        // Remove placeholder
        if (listEl.querySelector('[style*="text-align: center"]')) listEl.innerHTML = '';

        alertCount++;
        const time = new Date(alert.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const html = `
      <div class="alert-item ${alert.type}">
        <div class="alert-icon">${alert.icon}</div>
        <div class="alert-body">
          <h5>${alert.title}</h5>
          <p>${alert.message}</p>
          <span class="alert-time">${time}</span>
        </div>
      </div>`;
        listEl.insertAdjacentHTML('afterbegin', html);

        // Update badge
        const badge = document.getElementById('alertBadge');
        if (badge) { badge.textContent = alertCount; badge.style.display = 'flex'; }
        const countBadge = document.getElementById('alertCountBadge');
        if (countBadge) countBadge.textContent = alertCount;
    }

    // ═══════════════════════════════════════
    // UTILITIES PAGE (from Backend)
    // ═══════════════════════════════════════
    async function initUtilitiesPage() {
        try {
            const utilities = await SafeLinkAPI.getNearbyUtilities(12.9352, 77.6245);
            renderUtilities(utilities);
        } catch (err) {
            console.error('Failed to load utilities:', err);
        }

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                try {
                    const utils = await SafeLinkAPI.getNearbyUtilities(12.9352, 77.6245, tab.dataset.filter);
                    renderUtilities(utils);
                } catch (_) { }
            });
        });
    }

    function renderUtilities(utilities) {
        const grid = document.getElementById('utilitiesGrid');
        if (!grid) return;

        const riskColors = { low: '#00e676', medium: '#ff9100', high: '#ff1744' };
        const typeBg = { police: 'rgba(68,138,255,0.12)', hospital: 'rgba(255,23,68,0.12)', pharmacy: 'rgba(0,230,118,0.12)', safezone: 'rgba(179,136,255,0.12)' };

        grid.innerHTML = utilities.map(u => `
      <div class="utility-card">
        <div class="utility-card-header">
          <div class="utility-icon" style="background:${typeBg[u.type] || '#333'}">${u.icon}</div>
          <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;padding:4px 10px;border-radius:10px;background:${riskColors[u.riskProximity]}22;color:${riskColors[u.riskProximity]}">${u.riskProximity} risk</span>
        </div>
        <h4 style="font-size:0.95rem;font-weight:600;margin-bottom:4px;">${u.name}</h4>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:16px;">${u.address}</p>
        <div style="display:flex;gap:16px;font-size:0.75rem;color:var(--text-secondary);">
          <span>📏 ${u.distanceFormatted}</span>
          <span>⏱️ ${u.etaFormatted}</span>
          ${u.phone ? `<span>📞 ${u.phone}</span>` : ''}
        </div>
      </div>
    `).join('');
    }

    // ═══════════════════════════════════════
    // FAMILY TRACKING PAGE
    // ═══════════════════════════════════════
    let familyMembers = [];

    async function initFamilyPage() {
        const canvas = document.getElementById('familyTrackingCanvas');
        if (!canvas) return;
        const c = canvas.parentElement;
        canvas.width = c.clientWidth;
        canvas.height = 400;

        // Fetch members from backend
        try {
            familyMembers = await SafeLinkAPI.getFamily();
        } catch (e) {
            console.error('Failed to fetch family members:', e);
            familyMembers = [];
        }

        renderFamilyMembers();
        drawFamilyMap(canvas);
        setupFamilyModal();
    }

    function renderFamilyMembers() {
        const container = document.getElementById('familyMembersList');
        if (!container) return;

        if (familyMembers.length === 0) {
            container.innerHTML = `
                <div class="family-empty-state">
                    <div class="empty-icon">👨‍👩‍👧</div>
                    <p>No family members added yet.<br>Click the button below to add your first family member.</p>
                </div>`;
            return;
        }

        const avatarColors = ['#00e676,#00c853', '#448aff,#2962ff', '#b388ff,#7c4dff', '#ff9100,#ff6d00', '#ff4081,#f50057', '#00e5ff,#00b8d4', '#ea80fc,#d500f9', '#ffab40,#ff9100'];

        container.innerHTML = familyMembers.map((m, i) => {
            const colors = m.avatarColor ? `${m.avatarColor}, ${adjustColor(m.avatarColor, -30)}` : avatarColors[i % avatarColors.length];
            const scoreColor = m.safetyScore > 0 ? 'var(--green-primary)' : 'var(--text-muted)';
            const scoreVal = m.safetyScore > 0 ? m.safetyScore : '—';
            const statusText = m.status === 'active' ? (m.location ? 'Commuting' : 'Active') : 'At Home';

            return `<div class="family-member-card" data-id="${m.id}">
                <div class="family-member-header">
                    <div class="family-member-avatar" style="background: linear-gradient(135deg, ${colors});">${m.avatarEmoji || '👤'}</div>
                    <div class="family-member-info">
                        <h5>${escapeHtml(m.name)}${m.relationship && m.relationship !== 'Other' ? ` <span style="color:var(--text-muted);font-weight:400;font-size:0.75rem;">(${escapeHtml(m.relationship)})</span>` : ''}</h5>
                        <p>${m.location ? escapeHtml(m.location) : 'Location not set'}</p>
                    </div>
                    <button class="family-delete-btn" data-delete-id="${m.id}" title="Remove member">✕</button>
                </div>
                <div class="family-member-meta">
                    <div class="family-meta-item">
                        <div class="fmv" style="color: ${scoreColor};">${scoreVal}</div>
                        <div class="fml">Safety Score</div>
                    </div>
                    <div class="family-meta-item">
                        <div class="fmv">${statusText}</div>
                        <div class="fml">Status</div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Wire up delete buttons
        container.querySelectorAll('.family-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.deleteId, 10);
                if (!confirm('Remove this family member?')) return;
                try {
                    await SafeLinkAPI.deleteFamily(id);
                    familyMembers = familyMembers.filter(m => m.id !== id);
                    renderFamilyMembers();
                    const canvas = document.getElementById('familyTrackingCanvas');
                    if (canvas) drawFamilyMap(canvas);
                } catch (err) {
                    showFloatingAlert({ title: 'Delete Failed', message: err.message, icon: '❌', type: 'critical' });
                }
            });
        });
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function adjustColor(hex, amount) {
        hex = hex.replace('#', '');
        if (hex.length !== 6) return '#448aff';
        const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
        const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
        const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    function setupFamilyModal() {
        const modal = document.getElementById('addFamilyModal');
        const addBtn = document.getElementById('addFamilyBtn');
        const closeBtn = document.getElementById('closeFamilyModal');
        const cancelBtn = document.getElementById('cancelFamilyBtn');
        const confirmBtn = document.getElementById('confirmAddFamilyBtn');

        if (!modal || !addBtn) return;

        function openModal() { modal.classList.add('active'); }
        function closeModal() {
            modal.classList.remove('active');
            document.getElementById('familyNameInput').value = '';
            document.getElementById('familyPhoneInput').value = '';
            document.getElementById('familyLocationInput').value = '';
            document.getElementById('familyRelationInput').selectedIndex = 0;
            document.querySelectorAll('#emojiPicker .emoji-option').forEach(e => e.classList.remove('selected'));
            const first = document.querySelector('#emojiPicker .emoji-option');
            if (first) first.classList.add('selected');
        }

        addBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Emoji picker
        document.querySelectorAll('#emojiPicker .emoji-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('#emojiPicker .emoji-option').forEach(e => e.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        // Submit
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const name = document.getElementById('familyNameInput').value.trim();
                if (!name) {
                    document.getElementById('familyNameInput').style.borderColor = 'var(--red-primary)';
                    document.getElementById('familyNameInput').focus();
                    return;
                }
                const relationship = document.getElementById('familyRelationInput').value;
                const phone = document.getElementById('familyPhoneInput').value.trim();
                const location = document.getElementById('familyLocationInput').value.trim();
                const selectedEmoji = document.querySelector('#emojiPicker .emoji-option.selected');
                const avatarEmoji = selectedEmoji ? selectedEmoji.dataset.emoji : '👤';

                const colors = ['#00e676', '#448aff', '#b388ff', '#ff9100', '#ff4081', '#00e5ff', '#ea80fc', '#ffab40'];
                const avatarColor = colors[Math.floor(Math.random() * colors.length)];

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Adding...';

                try {
                    const member = await SafeLinkAPI.addFamily({ name, relationship, phone, location, avatarEmoji, avatarColor });
                    familyMembers.push(member);
                    renderFamilyMembers();
                    const canvas = document.getElementById('familyTrackingCanvas');
                    if (canvas) drawFamilyMap(canvas);
                    closeModal();
                    showFloatingAlert({ title: 'Member Added!', message: `${name} has been added to your family.`, icon: '✅', type: 'safe' });
                } catch (err) {
                    showFloatingAlert({ title: 'Failed to Add', message: err.message, icon: '❌', type: 'critical' });
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Add Member →';
                }
            });
        }

        // Reset border color on input
        const nameInput = document.getElementById('familyNameInput');
        if (nameInput) nameInput.addEventListener('input', function () { this.style.borderColor = ''; });
    }

    function drawFamilyMap(canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const mapMembers = [{ name: 'You', x: 0.3, y: 0.5, color: '#00e676' }];
        const positions = [
            { x: 0.6, y: 0.35 }, { x: 0.5, y: 0.7 }, { x: 0.75, y: 0.55 },
            { x: 0.2, y: 0.3 }, { x: 0.8, y: 0.25 }, { x: 0.65, y: 0.75 },
            { x: 0.4, y: 0.2 }, { x: 0.85, y: 0.6 },
        ];
        familyMembers.forEach((m, i) => {
            const pos = positions[i % positions.length];
            mapMembers.push({ name: m.name, x: pos.x, y: pos.y, color: m.avatarColor || '#448aff' });
        });

        // Connection lines
        ctx.strokeStyle = 'rgba(0,230,118,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        mapMembers.forEach((m, i) => {
            mapMembers.forEach((n, j) => {
                if (j > i) { ctx.beginPath(); ctx.moveTo(m.x * W, m.y * H); ctx.lineTo(n.x * W, n.y * H); ctx.stroke(); }
            });
        });
        ctx.setLineDash([]);

        // Member dots
        mapMembers.forEach(m => {
            ctx.beginPath();
            ctx.arc(m.x * W, m.y * H, 20, 0, Math.PI * 2);
            ctx.fillStyle = m.color + '22';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(m.x * W, m.y * H, 8, 0, Math.PI * 2);
            ctx.fillStyle = m.color;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px Inter';
            ctx.fillText(m.name, m.x * W + 14, m.y * H + 4);
        });
    }

    // ═══════════════════════════════════════
    // ANALYTICS PAGE (from Backend)
    // ═══════════════════════════════════════
    async function initAnalyticsPage() {
        animateCounters();
        try {
            const data = await SafeLinkAPI.getAnalytics();
            // Update stat cards with real data
            const statValues = document.querySelectorAll('.analytics-stat-value');
            if (statValues[0]) { statValues[0].textContent = data.totalRides.toLocaleString(); statValues[0].removeAttribute('data-target'); }
            if (statValues[1]) { statValues[1].textContent = data.totalAlerts.toLocaleString(); statValues[1].removeAttribute('data-target'); }
            if (statValues[2]) { statValues[2].textContent = data.avgSafetyScore + '%'; statValues[2].removeAttribute('data-target'); }
            if (statValues[3]) { statValues[3].textContent = data.emergencyEvents; statValues[3].removeAttribute('data-target'); }
            drawTrendChart(data);
            drawDistributionChart(data);
        } catch (err) {
            console.error('Analytics load failed:', err);
            drawTrendChart(null);
            drawDistributionChart(null);
        }
    }

    function drawTrendChart(data) {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        const c = canvas.parentElement;
        canvas.width = c.clientWidth - 48;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const P = 30;

        const scores = [82, 78, 85, 83, 88, 80, 86, 84, 90, 85];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(v => {
            const y = P + (100 - v) / 100 * (H - P * 2);
            ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px Inter'; ctx.fillText(v, 5, y + 3);
        });

        days.forEach((d, i) => {
            const x = P + i * ((W - P * 2) / (days.length - 1));
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px Inter'; ctx.fillText(d, x - 10, H - 8);
        });

        // Area fill
        ctx.beginPath();
        scores.slice(0, 7).forEach((s, i) => {
            const x = P + i * ((W - P * 2) / 6);
            const y = P + (100 - s) / 100 * (H - P * 2);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.lineTo(P + 6 * ((W - P * 2) / 6), H - P);
        ctx.lineTo(P, H - P);
        ctx.closePath();
        const grd = ctx.createLinearGradient(0, P, 0, H - P);
        grd.addColorStop(0, 'rgba(0,230,118,0.25)');
        grd.addColorStop(1, 'rgba(0,230,118,0)');
        ctx.fillStyle = grd;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2;
        scores.slice(0, 7).forEach((s, i) => {
            const x = P + i * ((W - P * 2) / 6);
            const y = P + (100 - s) / 100 * (H - P * 2);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Points
        scores.slice(0, 7).forEach((s, i) => {
            const x = P + i * ((W - P * 2) / 6);
            const y = P + (100 - s) / 100 * (H - P * 2);
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#111'; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#00e676'; ctx.fill();
        });
    }

    function drawDistributionChart(data) {
        const canvas = document.getElementById('distributionChart');
        if (!canvas) return;
        const c = canvas.parentElement;
        canvas.width = 240; canvas.height = 240;
        const ctx = canvas.getContext('2d');
        const cx = 120, cy = 110, r = 80;

        const slices = [
            { label: 'Route Deviation', pct: 0.35, color: '#ff1744' },
            { label: 'Night Risk', pct: 0.25, color: '#ff9100' },
            { label: 'Speed Anomaly', pct: 0.20, color: '#448aff' },
            { label: 'Geofence Breach', pct: 0.12, color: '#b388ff' },
            { label: 'Inactivity', pct: 0.08, color: '#00e676' },
        ];

        // Overwrite with real data if available
        if (data && data.alertDistribution && data.alertDistribution.length > 0) {
            const total = data.alertDistribution.reduce((s, a) => s + a.count, 0) || 1;
            data.alertDistribution.forEach((a, i) => {
                if (slices[i]) {
                    slices[i].label = a.category.replace(/_/g, ' ');
                    slices[i].pct = a.count / total;
                }
            });
        }

        let angle = -Math.PI / 2;
        slices.forEach(s => {
            const arcAngle = s.pct * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + arcAngle);
            ctx.closePath();
            ctx.fillStyle = s.color;
            ctx.fill();
            angle += arcAngle;
        });

        // Inner ring
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.fillStyle = '#0d1117';
        ctx.fill();

        // Center text
        const total = data ? data.totalAlerts : 100;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(total, cx, cy + 2);
        ctx.font = '9px Inter';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('TOTAL ALERTS', cx, cy + 16);

        // Legend
        ctx.textAlign = 'left';
        slices.forEach((s, i) => {
            const ly = 195 + i * 14;
            if (ly > 240) return;
            ctx.fillStyle = s.color;
            ctx.fillRect(20, ly - 6, 10, 10);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '10px Inter';
            ctx.fillText(`${s.label} (${Math.round(s.pct * 100)}%)`, 35, ly + 3);
        });
    }

    // ═══════════════════════════════════════
    // SOS
    // ═══════════════════════════════════════
    function setupSOSButton() {
        const btn = document.getElementById('sosBtn');
        const dismiss = document.getElementById('sosDismiss');
        const call = document.getElementById('sosCall');

        if (btn) btn.addEventListener('click', async () => {
            document.getElementById('sosOverlay').classList.add('active');
            try {
                if (currentRideId) {
                    await SafeLinkAPI.createIncident({
                        type: 'SOS Emergency',
                        severity: 'Critical',
                        description: 'SOS activated during ride',
                        rideId: currentRideId,
                    });
                }
            } catch (_) { }
        });

        if (dismiss) dismiss.addEventListener('click', () => {
            document.getElementById('sosOverlay').classList.remove('active');
        });
        if (call) call.addEventListener('click', () => {
            alert('📞 Connecting to Emergency Services...\n(Simulated in prototype)');
        });
    }

    // ═══════════════════════════════════════
    // INCIDENT MODAL
    // ═══════════════════════════════════════
    function setupIncidentModal() {
        const openBtn = document.getElementById('openIncidentReport');
        const closeBtn = document.getElementById('closeIncidentModal');
        const cancelBtn = document.getElementById('cancelIncidentBtn');
        const submitBtn = document.getElementById('submitIncidentBtn');

        if (openBtn) openBtn.addEventListener('click', () => {
            document.getElementById('incidentModal').classList.add('active');
            loadReportHistory();
        });
        if (closeBtn) closeBtn.addEventListener('click', () => {
            document.getElementById('incidentModal').classList.remove('active');
        });
        if (cancelBtn) cancelBtn.addEventListener('click', () => {
            document.getElementById('incidentModal').classList.remove('active');
        });
        if (submitBtn) submitBtn.addEventListener('click', async () => {
            try {
                await SafeLinkAPI.createIncident({
                    type: document.getElementById('incidentType').value,
                    severity: document.getElementById('incidentSeverity').value,
                    description: document.getElementById('incidentDescription').value,
                    rideId: currentRideId,
                });
                document.getElementById('incidentDescription').value = '';
                document.getElementById('incidentBookingId').value = '';
                showFloatingAlert({ title: 'Report Submitted', message: 'Incident report filed successfully.', icon: '✅', type: 'safe' });
                loadReportHistory();
            } catch (err) {
                showFloatingAlert({ title: 'Submission Failed', message: err.message, icon: '❌', type: 'critical' });
            }
        });
    }

    async function loadReportHistory() {
        const listEl = document.getElementById('reportHistoryList');
        const countEl = document.getElementById('reportHistoryCount');
        if (!listEl) return;
        try {
            const incidents = await SafeLinkAPI.getMyIncidents();
            if (countEl) countEl.textContent = incidents.length;
            renderReportHistory(listEl, incidents);
        } catch (_) {
            listEl.innerHTML = '<div class="report-history-empty"><span>⚠️</span><p>Failed to load history.</p></div>';
        }
    }

    function renderReportHistory(container, incidents) {
        if (!incidents || incidents.length === 0) {
            container.innerHTML = '<div class="report-history-empty"><span>📭</span><p>No reports submitted yet.</p></div>';
            return;
        }

        const severityColors = {
            'Low – General feedback': { bg: 'rgba(0,230,118,0.12)', color: '#00e676' },
            'Medium – Requires attention': { bg: 'rgba(255,145,0,0.12)', color: '#ff9100' },
            'High – Immediate action needed': { bg: 'rgba(255,23,68,0.12)', color: '#ff1744' },
            'Critical – Emergency': { bg: 'rgba(255,23,68,0.25)', color: '#ff1744' },
            'Critical': { bg: 'rgba(255,23,68,0.25)', color: '#ff1744' },
        };
        const statusIcons = { open: '🔴', investigating: '🟡', resolved: '🟢' };

        container.innerHTML = incidents.map(inc => {
            const sevStyle = severityColors[inc.severity] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' };
            const sevLabel = inc.severity.split(' – ')[0] || inc.severity;
            const statusIcon = statusIcons[inc.status] || '⚪';
            const date = new Date(inc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const time = new Date(inc.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const desc = inc.description.length > 80 ? inc.description.slice(0, 80) + '…' : inc.description;

            return `
            <div class="report-history-item">
                <div class="rh-top">
                    <span class="rh-type">${inc.type}</span>
                    <span class="rh-severity" style="background:${sevStyle.bg};color:${sevStyle.color}">${sevLabel}</span>
                </div>
                <p class="rh-desc">${desc}</p>
                <div class="rh-bottom">
                    <span class="rh-date">${date} · ${time}</span>
                    <span class="rh-status">${statusIcon} ${inc.status}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ═══════════════════════════════════════
    // SAFETY MODE TOGGLE
    // ═══════════════════════════════════════
    function setupSafetyToggle() {
        const toggle = document.getElementById('safetyModeToggle');
        if (toggle) {
            toggle.addEventListener('change', () => {
                const enabled = toggle.checked;
                showFloatingAlert({
                    title: enabled ? 'AI Safety Mode Enabled' : 'AI Safety Mode Disabled',
                    message: enabled ? 'Enhanced safety monitoring is now active.' : 'Safety features reduced. Enable for full protection.',
                    icon: enabled ? '🛡️' : '⚠️',
                    type: enabled ? 'safe' : 'warning',
                });
            });
        }
    }

    // ═══════════════════════════════════════
    // FLOATING ALERT
    // ═══════════════════════════════════════
    function showFloatingAlert(alert) {
        const el = document.getElementById('floatingAlert');
        if (!el) return;
        el.querySelector('.fa-icon').textContent = alert.icon;
        el.querySelector('.fa-content h5').textContent = alert.title;
        el.querySelector('.fa-content p').textContent = alert.message;
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 5000);

        const dismiss = el.querySelector('.fa-dismiss');
        if (dismiss) dismiss.onclick = () => el.classList.remove('visible');
    }

    // ═══════════════════════════════════════
    // MOBILE MENU
    // ═══════════════════════════════════════
    function setupMobileMenu() {
        const btn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        if (btn && sidebar) {
            btn.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
    }

})();
