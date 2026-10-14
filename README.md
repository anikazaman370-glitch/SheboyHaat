# SheboyHaat — Full Stack Project

React frontend + Node.js/Express REST API + PostgreSQL (Neon) with the Prisma ORM.

## Requirements
Install Node.js 18 or newer (recommended: current Node.js LTS), then open this folder in VS Code.

## 1. Create the database (Neon)
1. Create a free project at https://neon.tech.
2. Open **Connection Details** and copy the connection string (it looks like `postgresql://user:password@host/dbname?sslmode=require`).
3. Paste it into `backend/.env` as `DATABASE_URL`.

## 1b. Configure Cloudinary (worker NID uploads)
Worker NID documents are uploaded to Cloudinary so the admin can open and manually verify them before approving a worker.
1. Create a free account at https://cloudinary.com.
2. Open **Dashboard → Product Environment Credentials** and copy the **Cloud name**, **API Key** and **API Secret**.
3. Add them to `backend/.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_NID_FOLDER=sheboyhaat/nid
   ```
   (Alternatively set a single `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.)
4. Restart the backend. `GET /api/health` reports `"cloudinary": true` once configured.

Uploading happens **server-side** during registration, so the API secret never reaches the browser. If Cloudinary is not
configured the NID is stored locally as a data URL (development fallback) and a warning is printed in the server console.
The admin panel shows a **View NID** link (with an inline thumbnail for image files) for every worker awaiting verification.

> If workers may upload PDF NIDs, make sure **Settings → Security → "Allow delivery of PDF and ZIP files"** is enabled in
> Cloudinary, otherwise the stored PDF cannot be opened from the admin panel.

> **403 "missing permissions (actions=[\"create\"])" when uploading?** The API key's role lacks upload permission. Open
> **Console → Settings → API Keys**, pick the key used in `.env`, and assign it a role with the **create** (upload)
> permission — e.g. **Master Admin**. Alternatively paste a full-access key. EU-region accounts must also set
> `CLOUDINARY_API_HOST=api-eu.cloudinary.com`.

### Worker verification workflow
Every new worker starts as **Pending verification** and is hidden from customers until an admin approves them. In the admin
panel (`/admin`) each pending worker shows the uploaded NID plus **Approve** and **Reject** actions.
- **Approve** sets the worker live (visible to customers).
- **Reject** asks the admin for a reason in **English and/or Bangla**; the profile stays hidden and the worker sees the
  comment on their dashboard with a form to **re-upload their NID and/or correct their details**, which puts them back to
  Pending. Rejected workers are listed separately in the admin panel and can be approved later.


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

## Sessions & staying logged in
Login returns a **short-lived access token** (default 15 minutes) plus a **refresh token** stored in an `httpOnly` cookie (default 30 days).
The frontend silently renews the access token when it expires, so users stay logged in between visits without re-entering credentials.
Refresh tokens are rotated on every use and revoked on logout.

Relevant env vars in `backend/.env`:
| Variable | Default | Purpose |
| --- | --- | --- |
| `ACCESS_TOKEN_TTL` | `15m` | Lifetime of the short-lived session token |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | How long a user stays logged in |
| `COOKIE_SECURE` | `false` | Set `true` (HTTPS) in production |
| `COOKIE_SAMESITE` | `lax` | Set `none` with `COOKIE_SECURE=true` for cross-site production |

Auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.

## Worker profile visibility
Worker details are gated behind login, both in the listing (`GET /api/workers`) and on the profile (`GET /api/workers/:id`).
Logged-in users receive full details (area, price, rating, reviews, experience, phone, bio); guests receive only the worker's
**name, category and verification status**, together with a `locked: true` flag. Contact/NID fields are never exposed to guests,
and the admin listing always requests the full record.

## Notes
- For database-backed bookings, register/login first and keep both terminals running.
- The frontend keeps sample fallback data for demos if the API is unavailable.
- Real OTP, payment processing, maps, live notifications and production deployment are not implemented yet.
- This is an academic prototype, not a production-ready service. Change the demo admin password and JWT secret before using real/private data.
- Never commit `backend/.env` — it holds your database credentials.

## Easiest way to run on Windows
Set `DATABASE_URL` in `backend/.env`, then double-click `START-SHEBOYHAAT.bat`. On first run it installs packages, syncs/seeds the database, then starts the backend and frontend in separate windows. Visit `http://127.0.0.1:5173`. Admin page: `http://127.0.0.1:5173/admin`.
