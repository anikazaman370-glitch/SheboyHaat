# SheboyHaat — Trust-Based Home Service Booking Platform

A full-stack project for booking verified local home-service workers in Bangladesh. Customers can discover workers, book a time, chat, confirm completed work and leave reviews. Workers can register, submit NID documents for admin verification, accept jobs and track earnings. Admins verify workers and inspect platform data.

This README is the single reference for the whole project: setup, architecture, routes, API, database, features and known limitations.

---

## 1. Project status at a glance

Implemented:

- Customer and worker registration/login with OTP email verification.
- JWT access tokens plus rotating refresh tokens stored in an httpOnly cookie.
- Public worker discovery with locked details for guests.
- Worker profiles, bookings, booking chat, reviews and spending/earnings history.
- Worker registration with NID upload, admin verification/rejection and resubmission.
- Admin panel with worker verification, rejection reasons, database records and report counts.
- English and Bangla UI with persisted language choice and Bangla digit formatting.
- Account sidebar accessible from the profile chip in the header, with dedicated profile information and account settings pages.
- Account settings: update name/email/phone and permanently delete an account (password-confirmed).
- Responsive marketing pages (Home, Services, Find Workers) and info pages (How it works, Important notes, Need help).

Not implemented yet (see Section 19):

- Password reset / forgot password.
- Frontend UI for submitting and managing reports (backend endpoints exist).
- Real notification settings (the settings row is static).
- Production deployment configuration and automated tests.

---

## 2. Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router 6, Vite 5, plain CSS |
| State / i18n | React Context, localStorage |
| Backend | Node.js 18+, Express 4 (ES modules) |
| ORM / DB | Prisma 7 with `@prisma/adapter-pg`, PostgreSQL (Neon in development) |
| Auth | `jsonwebtoken` access tokens, SHA-256-hashed refresh tokens, `bcryptjs` password hashing |
| Media | Cloudinary (worker NID documents) |
| Email | Nodemailer / SMTP for OTP codes |
| SMS | Generic HTTP SMS gateway or Twilio fallback (optional) |
| Tooling | npm, Prisma CLI, Vite, Nodemon-style `node --watch` |

---

## 3. Architecture

```
Browser (React + Vite, default http://127.0.0.1:5173)
  |
  |  fetch JSON + Bearer access token, credentials: include
  v
Express REST API (default http://127.0.0.1:5000/api)
  |-- JWT auth middleware (auth / optionalAuth / admin)
  |-- Prisma Client (PrismaPg adapter)
  |     -> PostgreSQL database (Neon or local Postgres)
  |-- Cloudinary API (worker NID uploads)
  |-- SMTP (OTP email)
  |-- SMS gateway / Twilio (optional OTP SMS)
```

The frontend never receives database credentials or the Cloudinary API secret. NID URLs are only returned to admins and to the worker who owns the profile.

---

## 4. Project structure

```
SheboyHaat-FullStack/
|-- README.md                     This file
|-- START-SHEBOYHAAT.bat          One-click Windows setup + start script
|-- .gitignore
|-- backend/
|   |-- server.js                 Entire Express API, auth, bookings, admin, chat
|   |-- package.json              Backend scripts and dependencies
|   |-- .env.example              All backend environment variables
|   |-- prisma/
|   |   |-- schema.prisma         Database models
|   |   `-- seed.js               Demo workers + demo admin
|   `-- prisma7.config.ts         Prisma 7 config (schema, seed, datasource)
|-- frontend/
|   |-- index.html
|   |-- package.json              Vite scripts and dependencies
|   |-- .env / .env.example       VITE_API_URL
|   `-- src/
|       |-- main.jsx              React root + BrowserRouter
|       |-- App.jsx               All pages, routes, header, sidebar, dashboards
|       |-- api.js                fetch wrapper, token storage, silent refresh
|       |-- i18n.jsx              EN/BN translations and number/area/service helpers
|       `-- styles.css            Global styles, dashboard, sidebar, info pages
`-- database/
    |-- README.md                 Database notes
    `-- sheboyhaat.sqlite         Legacy SQLite file (no longer used)
```

Note: `frontend/dist/` is a build output and is ignored by Git.

---

## 5. Quick start

### Option A — Windows one-click script

1. Install Node.js 18+.
2. Double-click `START-SHEBOYHAAT.bat`.
3. On first run it installs backend/frontend packages, copies `backend/.env.example` to `backend/.env` if missing, and runs `npm run db:setup`.
4. Put a valid `DATABASE_URL` into `backend/.env` before running it, or run it once and it will stop and tell you to set the database URL.
5. It starts two terminals (backend and frontend) and prints the URLs.

Open:

- App: `http://127.0.0.1:5173`
- Admin panel: `http://127.0.0.1:5173/admin`
- API health: `http://127.0.0.1:5000/api/health`

### Option B — Manual start

```bash
# 1. Backend setup
cd backend
npm install
# create backend/.env from backend/.env.example and fill DATABASE_URL
npm run db:setup        # prisma generate + db push + seed

# 2. Frontend setup (new terminal)
cd frontend
npm install

# 3. Run (separate terminals)
cd backend
npm run dev             # http://localhost:5000

cd frontend
npm run dev             # http://localhost:5173
```

### Database

1. Create a free PostgreSQL project at https://neon.tech.
2. Copy the connection string from **Connection Details**.
3. Set it in `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
```

4. Run `npm run db:setup` once in `backend/`.

### Cloudinary (NID uploads)

Create a free account at https://cloudinary.com and add the credentials from **Dashboard → Product Environment Credentials**:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_NID_FOLDER=sheboyhaat/nid
# Optional:
CLOUDINARY_API_HOST=api.cloudinary.com
# Or use one URL instead of the three keys:
# CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

If Cloudinary is not configured, the backend stores the NID data URL in the database as a development fallback. This is not recommended for production.

### Email / SMS OTP

- Registration, login and resend OTPs are currently requested with the email channel.
- If `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are blank, the server prints the OTP to its console.
- In non-production mode, OTP endpoints also return `devOtp` in the JSON response so the flow can be tested without email.
- SMS gateway and Twilio code exists and can be configured, but the current registration/login flow does not call it. It is ready for a future phone-verification flow.

---

## 6. Environment variables (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `JWT_SECRET` | dev fallback | Secret for signing access tokens; change in real use |
| `FRONTEND_URL` | `http://localhost:5173` | Reserved for production CORS config; current CORS allows localhost/127.0.0.1 only |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime in days |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `COOKIE_SAMESITE` | `lax` (`strict` in production) | Refresh cookie SameSite policy |
| `DATABASE_URL` | required | PostgreSQL connection string |
| `NODE_ENV` | not set | `production` disables `devOtp` and enables secure cookie defaults |
| `CLOUDINARY_CLOUD_NAME` | empty | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | empty | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | empty | Cloudinary API secret |
| `CLOUDINARY_NID_FOLDER` | `sheboyhaat/nid` | Folder for NID uploads |
| `CLOUDINARY_API_HOST` | `api.cloudinary.com` | Use `api-eu.cloudinary.com` for EU accounts |
| `OTP_TTL_MINUTES` | `5` | OTP expiry |
| `SMS_API_URL` | empty | Generic SMS gateway URL with `{phone}` `{otp}` `{message}` placeholders |
| `SMS_API_KEY` | empty | Gateway API key |
| `SMS_SENDER_ID` | empty | SMS sender ID |
| `SMS_HTTP_METHOD` | `GET` | `GET` or `POST` |
| `SMS_POST_BODY` | empty | POST body template |
| `SMS_BODY_ENCODE` | `true` | Set `false` for JSON bodies |
| `SMS_MESSAGE_TEMPLATE` | built-in | OTP message template |
| `SMS_HEADERS` | `{}` | Extra headers as JSON |
| `SMS_SUCCESS_REGEX` | empty | Regex a successful gateway response must match |
| `TWILIO_ACCOUNT_SID` | empty | Twilio fallback |
| `TWILIO_AUTH_TOKEN` | empty | Twilio fallback |
| `TWILIO_FROM_NUMBER` | empty | Twilio sender number |
| `TWILIO_MESSAGING_SERVICE_SID` | empty | Twilio messaging service |
| `MAIL_FROM` | `SheboyHaat <no-reply@sheboyhaat.local>` | From address for OTP emails |
| `SMTP_HOST` | empty | SMTP host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` | empty | SMTP username |
| `SMTP_PASS` | empty | SMTP password |

Frontend configuration (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5000/api
```

The `SMS_*` and `TWILIO_*` variables are optional scaffolding for future phone verification. The current auth flow uses email OTP only.

---

## 7. Demo accounts and test data

The seed script creates:

| Account | Email | Password | Role |
| --- | --- | --- | --- |
| Demo admin | `admin@sheboyhaat.local` | `sheboyhaat123#` | admin |

It also seeds six verified demo workers in Mirpur, Uttara, Dhanmondi, Mohammadpur and Banani.

Important: seeded demo workers are not linked to login accounts. To test the worker dashboard, register a new worker account through the UI, then log in with that account. The seeded workers are useful for browsing and booking as a customer.

Seed behavior:

- Workers are only inserted when the `workers` table is empty.
- The admin user is upserted every time, so its password is reset to `sheboyhaat123#`.

---

## 8. Roles and permissions

| Capability | Guest | Customer | Worker | Admin |
| --- | --- | --- | --- | --- |
| Browse services and worker cards | Yes (limited details) | Yes | Yes | Yes |
| See worker rating/price/area/reviews | No | Yes | Yes | Yes |
| Register / login / OTP | Yes | Yes | Yes | Login only (seeded) |
| Book a worker | No | Yes | Yes (API, intended for customers) | Yes (API, intended for customers) |
| View own bookings | No | Yes | Yes (jobs assigned) | Yes (all) |
| Chat on a booking | No | Own bookings | Assigned bookings | Any booking |
| Update booking status | No | Complete own booking | Accept / finish / cancel assigned | Any valid status |
| Leave a review | No | Own completed booking | No | No |
| Worker dashboard / earnings | No | No | Yes | No |
| Profile / settings / spending pages | No | Yes | Yes (profile/settings) | Yes (profile/settings) |
| Admin panel | No | No | No | Yes |

---

## 9. Frontend routes and pages

| Route | Page | Access |
| --- | --- | --- |
| `/` | Marketing home | Public |
| `/services` | All services | Public |
| `/workers` | Find workers with filters | Public (details locked until login) |
| `/worker/:id` | Worker profile and reviews | Public (limited until login) |
| `/book/:workerId` | Booking form | Public form; submitting requires login |
| `/bookings` | Customer/worker/admin booking list | Auth |
| `/chat/:code` | Booking chat | Auth + participant |
| `/login` | Login | Guest only (redirects logged-in users) |
| `/register` | Customer/worker registration | Guest only |
| `/verify-otp` | OTP verification | Public |
| `/worker-dashboard` | Worker dashboard and job requests | Worker |
| `/worker-earnings` | Worker earnings history | Worker |
| `/admin` | Admin verification and database panel | Admin |
| `/dashboard` | Customer dashboard (stats, recent bookings, account summary) | Customer |
| `/profile` | Profile information (name, email, phone, role, activity) | Auth |
| `/settings` | Account settings (update profile, delete account) | Auth |
| `/spending` | Customer spending history | Auth |
| `/how-it-works` | How the platform works | Public |
| `/notes` | Important booking notes | Public |
| `/help` | FAQ and support contact | Public |
| `*` | 404 page | Public |

After successful login or registration:

- Customer → `/dashboard`
- Worker → `/worker-dashboard`
- Admin → `/admin`

### Header profile chip and account sidebar

The header shows a profile chip when logged in. Clicking it opens a right-side sidebar with:

| Item | Action |
| --- | --- |
| Dashboard | `/dashboard` for customers, `/worker-dashboard` for workers, `/admin` for admins |
| Profile | `/profile` (read-only profile information) |
| How it works | `/how-it-works` |
| Important notes | `/notes` |
| Need help | `/help` |
| Share this app | Web Share API, or copies the site URL to the clipboard |
| Settings | `/settings` (update profile, delete account) |
| Logout | Calls the logout API, clears local tokens/user and returns home |

The sidebar closes on overlay click or Escape, and locks body scrolling while open.

### Frontend state

| localStorage key | Contents |
| --- | --- |
| `sheboyhaat_token` | JWT access token |
| `sheboyhaat_user` | Cached user object (`id`, `name`, `email`, `phone`, `role`) |
| `sheboyhaat_lang` | `EN` or `বাংলা` |

`frontend/src/api.js` attaches the Bearer token, sends cookies, and silently retries a request once after a `401` by calling `/auth/refresh`.

---

## 10. Authentication and session flow

1. **Register** (`POST /api/auth/register`)
   - Validates email, Bangladeshi phone (`01[3-9]XXXXXXXX`), password length and role.
   - Workers must provide service, area, NID file name and NID data.
   - Creates the user with `isVerified = false` and, for workers, a `Worker` row with `verified = false`.
   - Issues a 6-digit OTP, hashes it with SHA-256, stores the hash and expiry, and emails it.
   - Response contains `requiresOtp: true`; in non-production with email delivery unavailable it can include `devOtp`.

2. **Verify OTP** (`POST /api/auth/verify-otp`)
   - Compares the SHA-256 hash and expiry.
   - Marks the user verified and starts a session.

3. **Login** (`POST /api/auth/login`)
   - bcrypt-compares the password.
   - Unverified accounts receive a fresh OTP and a `403` with `requiresOtp`.
   - Verified accounts receive an access token and refresh cookie.

4. **Access token**
   - JWT payload: `id`, `email`, `role`.
   - Default lifetime: 15 minutes.
   - Sent as `Authorization: Bearer <token>`.
   - Stored in localStorage by the frontend.

5. **Refresh token**
   - 40 random bytes, returned only as an httpOnly cookie named `sheboyhaat_refresh` scoped to `/api/auth`.
   - Only a SHA-256 hash is stored in `refresh_tokens`.
   - On refresh, the old token is deleted and a new one is issued (rotation).
   - Default lifetime: 30 days.
   - Logout deletes the stored token and clears the cookie.

6. **Session restore on app load**
   - If an access token exists, call `/api/auth/me`.
   - If that fails, call `/api/auth/refresh`.
   - Clear the user if both fail.

7. **Rate limiting / lockout**
   - No rate limiter is implemented yet.

---

## 11. Worker verification flow

1. Worker registers with NID file (image or PDF as a data URL from the browser).
2. Backend uploads the NID to Cloudinary when configured.
3. Worker is created with `verified = false`, `rejected = false` and `rating = 5` (no reviews yet).
4. The worker can log in immediately and sees a pending notice on the dashboard.
5. Unverified workers are hidden from public worker listings and public profiles.
6. Admin reviews the NID in `/admin`:
   - Approve: `verified = true`, clears rejection fields.
   - Reject: `verified = false`, `rejected = true`, stores English and/or Bangla reason.
7. A rejected worker sees the reason and can resubmit via `POST /api/workers/me/resubmit`, which resets the verification state and allows another admin review.

NID exposure:

- Public worker responses never include NID data.
- The worker owner can see their own full profile.
- Admins receive `nidUrl`, `nidFileName` and `hasNid` for review.

---

## 12. Booking lifecycle

```
Requested --(worker accepts)--> Accepted --(worker marks done)--> Work Done --(customer confirms)--> Completed
     \                              \                                  \
      \------------------------------(worker/admin cancel)--------------> Cancelled
```

Rules enforced by `PATCH /api/bookings/:code/status`:

- Worker owning the booking:
  - `Requested -> Accepted`
  - `Accepted -> Work Done`
  - `Requested | Accepted | Work Done -> Cancelled`
- Customer:
  - `Accepted | Work Done -> Completed` (own booking only)
- Admin: any valid status (`Accepted`, `Work Done`, `Completed`, `Cancelled`).

On the first transition to `Completed`:

- The worker's `jobs` is incremented by 1.
- The worker's `earnings` is incremented by the numeric part of the booking amount.

Booking creation:

- Customer must be logged in.
- The worker must exist and be verified.
- Booking code format: `SH-` followed by the last 7 digits of the current timestamp.
- `amount` is copied from the worker's current starting price.
- `address` doubles as the displayed area in list views.

---

## 13. Booking chat

- `GET /api/bookings/:code/messages` returns the booking summary and up to 500 messages.
- Passing `?after=<messageId>` returns only newer messages (used for polling).
- `POST /api/bookings/:code/messages` creates a message (max 2000 characters).
- Participants: the booking's customer, the worker whose `userId` owns the booking, and admins.
- The frontend polls every 3 seconds while the chat page is open.
- Each message includes `mine`, `senderName`, `senderId` and `createdAt`.

---

## 14. Reviews and ratings

- Only the customer who owns a booking can review it.
- The booking must be `Completed`.
- One review per booking.
- Rating must be an integer from 1 to 5; comment max 1000 characters.
- After a review, the worker's `rating` and `reviewCount` are recalculated from all reviews.
- Worker profile and cards display the average rating and review count.

---

## 15. Internationalization

- Translations live in `frontend/src/i18n.jsx`.
- Two locales: `EN` and `বাংলা`.
- The selected language is stored in `sheboyhaat_lang`.
- Bangla mode:
  - Adds `lang-bn` class for typography.
  - Converts digits with `localizeNumber` (for example `500` -> `৫০০`).
  - Translates service names and areas through lookup maps.
- A language toggle appears in the header and in account settings.
- All new sidebar and info pages have both English and Bangla text.

---

## 16. API reference

Base URL: `http://localhost:5000/api`

Auth column:

- `Public` — no token needed.
- `Optional` — works without a token but returns limited data.
- `Auth` — valid Bearer token required.
- `Worker` / `Admin` — role-specific.

### Health and public data

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | `{ ok, service, database, cloudinary }` |
| GET | `/services` | Public | Static list of six services |
| GET | `/workers` | Optional | Verified workers. Query: `service`, `area`, `search`. Limited fields + `locked: true` for guests |
| GET | `/workers/:id` | Optional | Full profile + reviews for logged-in users; limited + `locked: true` for guests |

### Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create customer/worker, issue OTP |
| POST | `/auth/login` | Public | Login, returns access token + refresh cookie |
| POST | `/auth/verify-otp` | Public | Verify email OTP and start session |
| POST | `/auth/resend-otp` | Public | Issue a new OTP |
| POST | `/auth/refresh` | Cookie | Rotate refresh token, return new access token |
| POST | `/auth/logout` | Cookie | Revoke refresh token and clear cookie |
| GET | `/auth/me` | Auth | Current user (`id`, `name`, `email`, `phone`, `role`) |
| PATCH | `/auth/profile` | Auth | Update name, email and phone (validates format and uniqueness) |
| DELETE | `/auth/account` | Auth | Permanently delete account (requires password; removes profile, reviews, messages and sessions; admin accounts are protected) |

### Worker self-service

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/workers/me` | Auth | Logged-in user's worker profile (full) |
| POST | `/workers/me/resubmit` | Auth | Update NID/details and reset verification |

### Bookings and chat

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/bookings` | Auth | Create a booking (`workerId`, `service`, `date`, `time`, `address`, `note`) |
| GET | `/bookings` | Auth | Role-scoped list: customer's, worker's or all for admin |
| PATCH | `/bookings/:code/status` | Auth | Update status with role/transition checks |
| POST | `/bookings/:code/review` | Auth | Customer review after completion |
| GET | `/bookings/:code/messages` | Auth | Booking summary + messages (`?after=id`) |
| POST | `/bookings/:code/messages` | Auth | Send a chat message |

### Reports

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/reports` | Auth | Submit a report (`subject`, `description`, optional `bookingCode`) |

### Admin

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/admin/overview` | Admin | Worker/booking/report counters |
| GET | `/admin/workers` | Admin | All workers with NID info |
| PATCH | `/admin/workers/:id/verify` | Admin | Approve a worker |
| PATCH | `/admin/workers/:id/reject` | Admin | Reject with English/Bangla reason |
| GET | `/admin/reports` | Admin | All reports |
| GET | `/admin/database` | Admin | Raw records for users, workers, bookings, reviews, reports |

### Response shape examples

Worker (public, logged in):

```json
{
  "id": 1,
  "name": "Md. Rahim Uddin",
  "service": "Plumber",
  "area": "Mirpur",
  "rating": 4.9,
  "reviews": 128,
  "price": "৳500",
  "verified": true,
  "avatar": "RU",
  "jobs": 312
}
```

Booking list item:

```json
{
  "id": "SH-1234567",
  "service": "Plumbing",
  "worker": "Md. Rahim Uddin",
  "customer": "Customer Name",
  "date": "2026-11-05",
  "time": "10:00 AM",
  "area": "House 12, Road 3, Mirpur",
  "note": "",
  "status": "Requested",
  "amount": "৳500",
  "reviewed": false
}
```

---

## 17. Database schema

Defined in `backend/prisma/schema.prisma` and mapped to snake_case table names.

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK, autoincrement |
| `name` | String | |
| `email` | String | unique |
| `phone` | String? | unique, normalized to `+880...` |
| `passwordHash` | String | bcrypt |
| `role` | String | `customer` (default), `worker`, `admin` |
| `isVerified` | Boolean | OTP verified |
| `otpCode` | String? | SHA-256 hash of OTP |
| `otpExpiresAt` | DateTime? | |
| `createdAt` | DateTime | |

Relations: `workers`, `bookings`, `reviews`, `reports`, `messages`, `refreshTokens`.

### `refresh_tokens`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `tokenHash` | String | unique SHA-256 hash |
| `userId` | Int | FK to users, cascade delete |
| `expiresAt` | DateTime | |
| `revoked` | Boolean | default false |
| `createdAt` | DateTime | |

### `workers`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `userId` | Int? | FK to users (nullable for seeded demo workers) |
| `name` | String | |
| `service` | String | |
| `area` | String | |
| `rating` | Float | default 0; registration starts at 5 |
| `reviewCount` | Int | mapped column `reviews` |
| `price` | String | stored as text such as `৳500` |
| `earnings` | Int | incremented on completion |
| `verified` | Boolean | public visibility |
| `avatar` | String? | initials |
| `jobs` | Int | completed job count |
| `bio` | String | |
| `phone` | String | |
| `experience` | String | |
| `nidFileName` | String | |
| `nidData` | String | Cloudinary URL or data URL fallback |
| `rejected` | Boolean | |
| `rejectionReasonEn` | String | |
| `rejectionReasonBn` | String | |

Relations: `user`, `bookings`, `reviews`.

### `bookings`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `bookingCode` | String | unique, exposed as `id` in API |
| `customerId` | Int? | FK users |
| `workerId` | Int? | FK workers |
| `service` | String | |
| `workerName` | String | snapshot |
| `date` | String | |
| `time` | String | |
| `address` | String | shown as `area` in API |
| `note` | String | |
| `status` | String | default `Requested` |
| `amount` | String | snapshot of worker price |
| `createdAt` | DateTime | |

Relations: `customer`, `worker`, `reviews`, `reports`, `messages`.

### `messages`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `bookingId` | Int | FK bookings, cascade delete |
| `senderId` | Int | FK users, cascade delete |
| `body` | String | max 2000 enforced in API |
| `createdAt` | DateTime | |

Index: `bookingId`.

### `reviews`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `bookingId` | Int | FK bookings |
| `customerId` | Int | FK users |
| `workerId` | Int | FK workers |
| `rating` | Int | 1-5 |
| `comment` | String | |
| `createdAt` | DateTime | |

### `reports`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int | PK |
| `bookingId` | Int? | FK bookings |
| `reporterId` | Int? | FK users |
| `subject` | String | |
| `description` | String | |
| `status` | String | default `Open` |
| `createdAt` | DateTime | |

---

## 18. npm scripts

### Backend (`backend/package.json`)

| Script | What it does |
| --- | --- |
| `npm run dev` | Start API with `node --watch server.js` |
| `npm start` | Start API normally |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run db:push` | Push schema to the database |
| `npm run db:seed` | Seed demo workers and admin |
| `npm run db:setup` | generate + push + seed |
| `postinstall` | Runs `prisma generate` after install |

### Frontend (`frontend/package.json`)

| Script | What it does |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build |

---

## 19. Known limitations and next steps

Limitations:

- No automated tests (unit, integration or E2E).
- No password reset flow.
- No frontend for reports, although `POST /api/reports` and admin report endpoints exist.
- Notification settings are display-only.
- Admin map, platform settings and analytics buttons are placeholder alerts.
- CORS currently accepts only `localhost` / `127.0.0.1` origins; production domains must be added in `server.js`.
- Access tokens are stored in localStorage (convenient for a prototype, but exposed to XSS).
- No rate limiting on login/OTP endpoints.
- Unverified worker accounts can log in and use the worker dashboard, but are hidden publicly.
- If Cloudinary is missing, NID files are stored as data URLs in the database.
- `database/sheboyhaat.sqlite` is a legacy file and is not used by the current code.
- `frontend/src/App.jsx` still contains a small sample `workers` array used only as a display fallback in the worker detail page.

Suggested next steps:

1. Add password reset with OTP or email link.
2. Add a report submission UI and an admin report review screen.
3. Add rate limiting and stronger input validation.
4. Move access tokens to memory or use the refresh cookie for all requests.
5. Add automated tests and a CI pipeline.
6. Add production CORS configuration and deployment docs.
7. Replace the static notification setting with real preferences.

---

## 20. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot connect to SheboyHaat server` | Start the backend and confirm `VITE_API_URL` points to it |
| Database connection error on startup | Check `DATABASE_URL` in `backend/.env`; keep `?sslmode=require` for Neon |
| Prisma client errors | Run `npm run prisma:generate` in `backend/` |
| OTP not received | Configure SMTP, or check the backend console for the development OTP (`devOtp` is also returned outside production) |
| Cannot log in as a demo worker | Seeded workers have no user account; register a new worker |
| NID upload fails | Check Cloudinary credentials or remove them to use the local data-URL fallback |
| Worker not visible after registration | An admin must approve the worker in `/admin` |
| Port already in use | Change `PORT` (backend) or start Vite with another port (`npm run dev -- --port 5174`) |
| Bangla text looks broken | Ensure the file is opened as UTF-8; the app loads Noto Sans Bengali from Google Fonts |

---

## 21. Team and course context

Software Development-I (SDP I) lab project: "SheboyHaat — A Trust-Based Booking Platform for Local Home-Service Workers".

If you change the setup steps, environment variables, routes or API, update this README in the same commit so it stays the single source of truth.
