# 🛡️ SafeLink – AI-Powered Intelligent Safety Layer for Mobility & Delivery

A production-grade full-stack application combining ride booking, instant delivery, and AI-based real-time safety monitoring.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client + create database + run migrations
npx prisma generate
npx prisma migrate dev --name init

# 3. Seed the database (users, utilities, risk zones)
node prisma/seed.js

# 4. Start the server
npm start
```

Open **http://localhost:5000** in your browser.

## 🔑 Default Accounts

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| User  | user@safelink.io  | user123   |
| Admin | admin@safelink.io | admin123  |

## 📡 API Endpoints

| Method | Endpoint                     | Auth | Description           |
|--------|------------------------------|------|-----------------------|
| POST   | /api/auth/register           | ✗    | Register new user     |
| POST   | /api/auth/login              | ✗    | Login, returns JWT    |
| GET    | /api/users/me                | ✓    | Get current profile   |
| PUT    | /api/users/me                | ✓    | Update profile        |
| POST   | /api/rides                   | ✓    | Create a ride         |
| GET    | /api/rides/:id               | ✓    | Get ride details      |
| POST   | /api/rides/:id/location      | ✓    | Update ride location  |
| POST   | /api/rides/:id/end           | ✓    | End ride              |
| GET    | /api/rides/:id/safety-score  | ✓    | Get safety score      |
| GET    | /api/rides/:id/alerts        | ✓    | Get ride alerts       |
| GET    | /api/utilities/nearby        | ✓    | Nearby utilities      |
| POST   | /api/incidents               | ✓    | Report incident       |
| GET    | /api/admin/analytics         | ✓    | Analytics dashboard   |
| GET    | /api/health                  | ✗    | Health check          |

## 🔌 WebSocket Events

| Event              | Direction | Description                |
|--------------------|-----------|----------------------------|
| join_ride          | Client→   | Join ride tracking room    |
| simulate_location  | Client→   | Send location update       |
| location_update    | →Client   | Real-time location data    |
| safety_update      | →Client   | Safety score change        |
| alerts             | →Client   | New safety alerts          |
| ride_ended         | →Client   | Ride completed             |

## 🏗 Architecture

```
SafeRidePlus/
├── server.js              # HTTP + Socket.io entry
├── app.js                 # Express app + middleware
├── .env                   # Environment config
├── prisma/
│   ├── schema.prisma      # 8 database models
│   └── seed.js            # Seed data script
├── server/
│   ├── config/            # Centralized config
│   ├── controllers/       # 6 controllers
│   ├── routes/            # 6 route files
│   ├── services/          # Safety engine + geo service
│   ├── middleware/         # Auth, validation, errors
│   └── sockets/           # Socket.io setup
└── public/                # Frontend (static)
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── api.js         # Backend API client
        └── app.js         # UI controller
```

## 🔧 Tech Stack

**Backend:** Node.js, Express, Socket.io, Prisma, SQLite, JWT, bcryptjs  
**Frontend:** Vanilla HTML/CSS/JS  
**Security:** Helmet, CORS, Rate Limiting, bcrypt, JWT auth
