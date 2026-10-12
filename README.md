# SheboyHaat — Full Stack Project

React frontend + Node.js/Express REST API + SQLite database. SQLite avoids XAMPP and a separate database server; the database file is created automatically by the backend.

## Requirements
Install Node.js 18 or newer (recommended: current Node.js LTS), then open this folder in VS Code.

## Start backend (Terminal 1)
```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```
If `.env` already exists, keep it rather than overwriting it. API address: `http://localhost:5000`. Test by opening `http://localhost:5000/api/health`.

Demo admin account:
- Email: `admin@sheboyhaat.local`
- Password: `Admin123!`

## Start frontend (Terminal 2)
Open a second terminal in VS Code:
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Included
- Responsive home, services, worker search and profile pages
- Registration/login API (password hashing + JWT)
- SQLite tables for users, workers, bookings, reviews and reports
- API endpoints for worker listing, bookings, status updates, reviews, reports, admin overview and worker verification
- Booking form, customer booking list, worker dashboard and admin panel prototype

## Notes
- For database-backed bookings, register/login first and keep both terminals running.
- The frontend keeps sample fallback data for demos if the API is unavailable.
- Your original proposal specifies MySQL. This build uses SQLite to simplify local setup. Confirm with your instructor before final submission; if MySQL is mandatory, migrate the database layer.
- Real OTP, real NID upload/verification, payment processing, maps, live notifications and production deployment are not implemented yet.
- This is an academic prototype, not a production-ready service. Change the demo admin password and JWT secret before using real/private data.


## Easiest way to run on Windows
Double-click `START-SHEBOYHAAT.bat`. On first run it installs packages, then starts the backend and frontend in separate terminal windows. Keep both windows open. Visit `http://127.0.0.1:5173`. Admin page: `http://127.0.0.1:5173/admin`. Do not open the API health page as a normal step; it is only a diagnostic endpoint.
