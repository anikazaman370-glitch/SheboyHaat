# SheboyHaat — Full Stack Project

React frontend + Node.js/Express REST API + PostgreSQL (Neon) with the Prisma ORM.

## Requirements
Install Node.js 18 or newer (recommended: current Node.js LTS), then open this folder in VS Code.

## 1. Create the database (Neon)
1. Create a free project at https://neon.tech.
2. Open **Connection Details** and copy the connection string (it looks like `postgresql://user:password@host/dbname?sslmode=require`).
3. Paste it into `backend/.env` as `DATABASE_URL`.

## 2. Start backend (Terminal 1)
```powershell
cd backend
npm install
Copy-Item .env.example .env   # skip if .env already exists
# edit .env and set DATABASE_URL to your Neon connection string
npm run db:setup              # prisma generate + create tables + seed demo data
npm run dev
```
`npm run db:setup` only needs to be run once (re-run it after changing `prisma/schema.prisma`).
API address: `http://localhost:5000`. Test with `http://localhost:5000/api/health` — it should report `"database":"PostgreSQL"`.

Demo admin account (only this account can open `/admin`):
- Email: `admin@sheboyhaat.local`
- Password: `sheboyhaat123#`

## 3. Start frontend (Terminal 2)
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
- Prisma models for users, workers, bookings, reviews and reports
- API endpoints for worker listing, bookings, status updates, reviews, reports, admin overview and worker verification
- Booking form, customer booking list, worker dashboard and admin panel prototype

## Database commands (run inside `backend/`)
| Command | Purpose |
| --- | --- |
| `npm run prisma:generate` | Regenerate the Prisma Client after schema edits |
| `npm run db:push` | Create/update tables in the database from the schema |
| `npm run db:seed` | Insert sample workers and the demo admin |
| `npm run db:setup` | All three above, in order |

## Notes
- For database-backed bookings, register/login first and keep both terminals running.
- The frontend keeps sample fallback data for demos if the API is unavailable.
- Real OTP, real NID upload/verification, payment processing, maps, live notifications and production deployment are not implemented yet.
- This is an academic prototype, not a production-ready service. Change the demo admin password and JWT secret before using real/private data.
- Never commit `backend/.env` — it holds your database credentials.

## Easiest way to run on Windows
Set `DATABASE_URL` in `backend/.env`, then double-click `START-SHEBOYHAAT.bat`. On first run it installs packages, syncs/seeds the database, then starts the backend and frontend in separate windows. Visit `http://127.0.0.1:5173`. Admin page: `http://127.0.0.1:5173/admin`.
