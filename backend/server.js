import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const CLOUDINARY_READY = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);
if (CLOUDINARY_READY) {
  // ES module imports run before dotenv.config(), so the SDK may not have seen
  // process.env.CLOUDINARY_URL yet. Force a reload from the environment now.
  if (process.env.CLOUDINARY_URL) cloudinary.config(true);
  const explicit = { secure: true };
  if (process.env.CLOUDINARY_CLOUD_NAME) explicit.cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  if (process.env.CLOUDINARY_API_KEY) explicit.api_key = process.env.CLOUDINARY_API_KEY;
  if (process.env.CLOUDINARY_API_SECRET) explicit.api_secret = process.env.CLOUDINARY_API_SECRET;
  cloudinary.config(explicit);
}
const CLOUDINARY_CONF = CLOUDINARY_READY ? cloudinary.config() : {};
const CLOUDINARY_CLOUD = CLOUDINARY_CONF.cloud_name || '';
const CLOUDINARY_KEY = CLOUDINARY_CONF.api_key || '';
const CLOUDINARY_SECRET = CLOUDINARY_CONF.api_secret || '';
const CLOUDINARY_API_HOST = process.env.CLOUDINARY_API_HOST || 'api.cloudinary.com';
const CLOUDINARY_NID_FOLDER = process.env.CLOUDINARY_NID_FOLDER || 'sheboyhaat/nid';
console.log(
  CLOUDINARY_READY
    ? `Cloudinary configured (cloud: ${CLOUDINARY_CLOUD || 'from CLOUDINARY_URL'}, host: ${CLOUDINARY_API_HOST})`
    : 'Cloudinary not configured: NID files will be stored locally as data URLs.'
);

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SECRET = process.env.JWT_SECRET || 'development_only_change_me';
const IS_PROD = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_COOKIE = 'sheboyhaat_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.COOKIE_SAMESITE || (IS_PROD ? 'strict' : 'lax'),
  secure: process.env.COOKIE_SECURE === 'true' || IS_PROD,
  path: REFRESH_COOKIE_PATH
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(cors({ credentials: true, origin: (origin, cb) => { if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true); return cb(null, false); } }));
app.use(express.json({ limit: '12mb' }));
app.use((req, _res, next) => {
  const header = req.headers.cookie;
  req.cookies = {};
  if (header) for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
});

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function tokenFor(u) { return jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET, { expiresIn: ACCESS_TOKEN_TTL }); }
function auth(req, res, next) { const h = req.headers.authorization || ''; try { if (!h.startsWith('Bearer ')) throw Error(); req.user = jwt.verify(h.slice(7), SECRET); next(); } catch { return res.status(401).json({ message: 'Please log in to continue.' }); } }
function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h) { req.user = null; return next(); }
  try { req.user = jwt.verify(h.replace(/^Bearer\s+/i, ''), SECRET); next(); }
  catch { return res.status(401).json({ message: 'Session expired.' }); }
}

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
function safeUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role }; }
async function issueRefreshToken(userId, res) {
  const raw = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(raw), userId, expiresAt } });
  res.cookie(REFRESH_COOKIE, raw, { ...REFRESH_COOKIE_OPTIONS, maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 });
  return raw;
}
async function startSession(user, res, status = 200) {
  const accessToken = tokenFor(user);
  await issueRefreshToken(user.id, res);
  res.status(status).json({ user: safeUser(user), accessToken, token: accessToken });
}
function admin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }

function workerOut(w, opts = {}) {
  const out = {
    id: w.id, userId: w.userId, name: w.name, service: w.service, area: w.area,
    rating: Number(w.rating), reviews: w.reviewCount, price: w.price, verified: !!w.verified,
    rejected: !!w.rejected,
    avatar: w.avatar || w.name.split(' ').map(x => x[0]).join('').slice(0, 2),
    jobs: w.jobs
  };
  if (opts.full) {
    out.phone = w.phone || '';
    out.experience = w.experience || '';
    out.bio = w.bio || '';
    out.rejectionReasonEn = w.rejectionReasonEn || '';
    out.rejectionReasonBn = w.rejectionReasonBn || '';
  }
  return out;
}
function adminWorkerOut(w) {
  const raw = String(w.nidData || '');
  const out = { ...workerOut(w, { full: true }), nidFileName: w.nidFileName || '' };
  out.nidUrl = (isHttpUrl(raw) || isDataUrl(raw)) ? raw : '';
  out.hasNid = Boolean(raw);
  return out;
}
const isDataUrl = (v) => /^data:/i.test(String(v || ''));
const isHttpUrl = (v) => /^https?:\/\//i.test(String(v || ''));
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp', 'application/pdf': 'pdf' };
function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]*)((?:;[^,]*)*),(.*)$/s.exec(String(dataUrl));
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const isBase64 = /base64/i.test(m[2] || '');
  let buffer;
  try {
    buffer = isBase64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'binary');
  } catch {
    return null;
  }
  return { mime, buffer };
}
async function uploadNidToCloudinary(fileData) {
  if (!CLOUDINARY_READY) return null;
  const parsed = parseDataUrl(fileData);
  if (!parsed) throw new Error('Unsupported NID payload (expected a base64 data URL).');
  const ext = MIME_EXT[parsed.mime] || 'bin';
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: CLOUDINARY_NID_FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_SECRET);
  const form = new FormData();
  form.append('file', new Blob([parsed.buffer], { type: parsed.mime }), `nid.${ext}`);
  form.append('api_key', CLOUDINARY_KEY);
  form.append('folder', String(params.folder));
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const url = `https://${CLOUDINARY_API_HOST}/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(detail);
    err.http_code = res.status;
    err.cloudinary = body?.error || null;
    throw err;
  }
  return body.secure_url || (body.url ? String(body.url).replace(/^http:/, 'https:') : '');
}
async function uploadWorkerNid(nidData) {
  const stored = String(nidData || '');
  if (!stored || isHttpUrl(stored)) return stored;
  if (!CLOUDINARY_READY) {
    if (isDataUrl(stored)) console.warn('Cloudinary is not configured; storing the NID locally as a data URL. Set CLOUDINARY_* in backend/.env for real uploads.');
    return stored;
  }
  return await uploadNidToCloudinary(stored);
}
function workerLimitedOut(w) {
  return {
    id: w.id, name: w.name, service: w.service, verified: !!w.verified,
    avatar: w.avatar || w.name.split(' ').map(x => x[0]).join('').slice(0, 2)
  };
}
function bookingOut(b) {
  return { id: b.bookingCode, service: b.service, worker: b.workerName, date: b.date, time: b.time, area: b.address, status: b.status, amount: b.amount };
}

app.get('/api/health', (_q, r) => r.json({ ok: true, service: 'SheboyHaat API', database: 'PostgreSQL', cloudinary: CLOUDINARY_READY }));

app.get('/api/services', (_q, r) => r.json({ services: [{ id: 'plumbing', name: 'Plumbing' }, { id: 'electrical', name: 'Electrical' }, { id: 'cleaning', name: 'Cleaning' }, { id: 'ac', name: 'AC Service' }, { id: 'appliance', name: 'Appliance Repair' }, { id: 'painting', name: 'Painting' }] }));

app.get('/api/workers', optionalAuth, ah(async (q, r) => {
  const AND = [];
  if (q.query.service) AND.push({ service: { contains: String(q.query.service), mode: 'insensitive' } });
  if (q.query.area) AND.push({ area: { equals: String(q.query.area), mode: 'insensitive' } });
  if (q.query.search) AND.push({ OR: [{ name: { contains: String(q.query.search), mode: 'insensitive' } }, { service: { contains: String(q.query.search), mode: 'insensitive' } }] });
  const workers = await prisma.worker.findMany({ where: { verified: true, ...(AND.length ? { AND } : {}) }, orderBy: { rating: 'desc' } });
  const full = !!q.user;
  r.json({ workers: workers.map(w => full ? workerOut(w) : workerLimitedOut(w)), locked: !full });
}));

app.get('/api/workers/me', auth, ah(async (q, r) => {
  const w = await prisma.worker.findFirst({ where: { userId: q.user.id } });
  if (!w) return r.status(404).json({ message: 'No worker profile is linked to this account.' });
  r.json({ worker: workerOut(w, { full: true }) });
}));

app.post('/api/workers/me/resubmit', auth, ah(async (q, r) => {
  const w = await prisma.worker.findFirst({ where: { userId: q.user.id } });
  if (!w) return r.status(404).json({ message: 'No worker profile is linked to this account.' });
  const { nidData = '', nidFileName = '', phone = '', service = '', area = '', experience = '', price = '' } = q.body || {};
  if (!nidData && !phone && !service && !area && !experience && !price) return r.status(400).json({ message: 'Please upload your NID document again or update your details.' });
  let storedNid = w.nidData;
  if (nidData && !isHttpUrl(String(nidData))) {
    try {
      storedNid = await uploadWorkerNid(nidData);
    } catch (e) {
      const detail = e?.error?.message || e?.message || 'Unknown error';
      console.error('Cloudinary NID upload failed:', detail, e?.error || e);
      return r.status(502).json({ message: `Could not upload the NID document to Cloudinary (${detail}). Please try again.` });
    }
  } else if (nidData) {
    storedNid = String(nidData);
  }
  const data = {
    verified: false,
    rejected: false,
    rejectionReasonEn: '',
    rejectionReasonBn: '',
    nidData: storedNid,
    nidFileName: nidFileName || w.nidFileName
  };
  if (phone) data.phone = String(phone);
  if (service) data.service = String(service);
  if (area) data.area = String(area);
  if (experience) data.experience = String(experience);
  if (price) data.price = '৳' + String(price).replace(/^৳/, '');
  const updated = await prisma.worker.update({ where: { id: w.id }, data });
  r.json({ worker: workerOut(updated, { full: true }), message: 'Your details were resubmitted for verification.' });
}));

app.get('/api/workers/:id', optionalAuth, ah(async (q, r) => {
  const w = await prisma.worker.findUnique({ where: { id: Number(q.params.id) } });
  if (!w) return r.status(404).json({ message: 'Worker not found.' });
  const isOwner = q.user && w.userId && w.userId === q.user.id;
  const isAdmin = q.user && q.user.role === 'admin';
  if (!w.verified && !isOwner && !isAdmin) return r.status(404).json({ message: 'Worker not found.' });
  if (!q.user) return r.json({ worker: workerLimitedOut(w), bio: '', reviews: [], locked: true });
  const reviews = await prisma.review.findMany({ where: { workerId: w.id }, orderBy: { id: 'desc' }, include: { customer: { select: { name: true } } } });
  r.json({ worker: workerOut(w, { full: true }), bio: w.bio, reviews: reviews.map(rv => ({ rating: rv.rating, comment: rv.comment, created_at: rv.createdAt, customerName: rv.customer.name })), locked: false });
}));

app.post('/api/auth/register', ah(async (q, r) => {
  const { name, email, password, role = 'customer', phone = '', service = 'General Service', area = 'Dhaka', experience = '', price = '500', nidFileName = '', nidData = '' } = q.body || {};
  if (!name || !email || !password || String(password).length < 6) return r.status(400).json({ message: 'Name, email and password (at least 6 characters) are required.' });
  if (!['customer', 'worker'].includes(role)) return r.status(400).json({ message: 'Invalid role.' });
  if (role === 'worker' && (!phone || !service || !area || !nidFileName || !nidData)) return r.status(400).json({ message: 'Worker phone, service, area and NID upload are required.' });
  const normalized = String(email).trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) return r.status(409).json({ message: 'Email already registered.' });
  const passwordHash = await bcrypt.hash(String(password), 10);

  let storedNid = String(nidData || '');
  if (role === 'worker' && storedNid) {
    try {
      storedNid = await uploadWorkerNid(storedNid);
    } catch (e) {
      const detail = e?.error?.message || e?.message || 'Unknown error';
      console.error('Cloudinary NID upload failed:', detail, e?.error || e);
      return r.status(502).json({ message: `Could not upload the NID document to Cloudinary (${detail}). Please try again.` });
    }
  }

  const u = await prisma.user.create({ data: { name: String(name).trim(), email: normalized, passwordHash, role } });
  if (role === 'worker') {
    await prisma.worker.create({ data: { userId: u.id, name: u.name, service: String(service), area: String(area), rating: 5, reviewCount: 0, price: '৳' + String(price), verified: false, avatar: u.name.slice(0, 2).toUpperCase(), jobs: 0, bio: 'Awaiting admin verification.', phone: String(phone), experience: String(experience), nidFileName: String(nidFileName), nidData: storedNid } });
  }
  await startSession(u, r, 201);
}));

app.post('/api/auth/login', ah(async (q, r) => {
  const email = String(q.body?.email || '').trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(String(q.body?.password || ''), u.passwordHash))) return r.status(401).json({ message: 'Incorrect email or password.' });
  await startSession(u, r);
}));

app.post('/api/auth/refresh', ah(async (q, r) => {
  const raw = q.cookies?.[REFRESH_COOKIE];
  if (!raw) return r.status(401).json({ message: 'No active session. Please log in.' });
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!stored || stored.revoked || stored.expiresAt <= new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    r.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    return r.status(401).json({ message: 'Session expired. Please log in again.' });
  }
  const u = await prisma.user.findUnique({ where: { id: stored.userId }, select: { id: true, name: true, email: true, role: true } });
  if (!u) {
    await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    r.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    return r.status(401).json({ message: 'Account no longer exists.' });
  }
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  await startSession(u, r);
}));

app.post('/api/auth/logout', ah(async (q, r) => {
  const raw = q.cookies?.[REFRESH_COOKIE];
  if (raw) await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(raw) } });
  r.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  r.json({ message: 'Logged out.' });
}));

app.get('/api/auth/me', auth, ah(async (q, r) => {
  const u = await prisma.user.findUnique({ where: { id: q.user.id }, select: { id: true, name: true, email: true, role: true } });
  if (!u) return r.status(404).json({ message: 'User not found.' });
  r.json({ user: u });
}));

app.post('/api/bookings', auth, ah(async (q, r) => {
  const { workerId, service, date, time, address, note = '' } = q.body || {};
  if (!workerId || !service || !date || !time || !address) return r.status(400).json({ message: 'Worker, service, date, time and address are required.' });
  const w = await prisma.worker.findFirst({ where: { id: Number(workerId), verified: true } });
  if (!w) return r.status(404).json({ message: 'Verified worker not found.' });
  const bookingCode = 'SH-' + Date.now().toString().slice(-7);
  const booking = await prisma.booking.create({ data: { bookingCode, customerId: q.user.id, workerId: w.id, service: String(service), workerName: w.name, date: String(date), time: String(time), address: String(address), note: String(note), status: 'Requested', amount: w.price } });
  r.status(201).json({ booking: bookingOut(booking) });
}));

app.get('/api/bookings', auth, ah(async (q, r) => {
  let rows;
  if (q.user.role === 'admin') rows = await prisma.booking.findMany({ orderBy: { id: 'desc' } });
  else if (q.user.role === 'worker') rows = await prisma.booking.findMany({ where: { worker: { userId: q.user.id } }, orderBy: { id: 'desc' } });
  else rows = await prisma.booking.findMany({ where: { customerId: q.user.id }, orderBy: { id: 'desc' } });
  r.json({ bookings: rows.map(bookingOut) });
}));

app.patch('/api/bookings/:code/status', auth, ah(async (q, r) => {
  const status = q.body?.status;
  if (!['Accepted', 'Completed', 'Cancelled'].includes(status)) return r.status(400).json({ message: 'Invalid status.' });
  const b = await prisma.booking.findUnique({ where: { bookingCode: q.params.code } });
  if (!b) return r.status(404).json({ message: 'Booking not found.' });
  const isOwnWorker = q.user.role === 'worker' && b.workerId && await prisma.worker.findFirst({ where: { id: b.workerId, userId: q.user.id } });
  if (q.user.role !== 'admin' && !isOwnWorker) return r.status(403).json({ message: 'You cannot update this booking.' });
  const updated = await prisma.booking.update({ where: { bookingCode: q.params.code }, data: { status } });
  r.json({ booking: bookingOut(updated) });
}));

app.post('/api/reviews', auth, ah(async (q, r) => {
  const { bookingCode, rating, comment = '' } = q.body || {};
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) return r.status(400).json({ message: 'Rating must be 1 to 5.' });
  const b = await prisma.booking.findFirst({ where: { bookingCode, customerId: q.user.id, status: 'Completed' } });
  if (!b) return r.status(400).json({ message: 'Only your completed bookings can be reviewed.' });
  if (await prisma.review.findFirst({ where: { bookingId: b.id } })) return r.status(409).json({ message: 'Booking already reviewed.' });
  await prisma.review.create({ data: { bookingId: b.id, customerId: q.user.id, workerId: b.workerId, rating: n, comment: String(comment) } });
  const agg = await prisma.review.aggregate({ where: { workerId: b.workerId }, _avg: { rating: true } });
  const count = await prisma.review.count({ where: { workerId: b.workerId } });
  await prisma.worker.update({ where: { id: b.workerId }, data: { rating: agg._avg.rating ?? 5, reviewCount: count } });
  r.status(201).json({ message: 'Review submitted.' });
}));

app.get('/api/admin/overview', auth, admin, ah(async (_q, r) => {
  const [workers, pendingVerification, bookings, openReports] = await Promise.all([
    prisma.worker.count(),
    prisma.worker.count({ where: { verified: false, rejected: false } }),
    prisma.booking.count(),
    prisma.report.count({ where: { status: 'Open' } })
  ]);
  r.json({ workers, pendingVerification, bookings, openReports });
}));

app.get('/api/admin/workers', auth, admin, ah(async (_q, r) => {
  const workers = await prisma.worker.findMany({ orderBy: [{ verified: 'asc' }, { id: 'desc' }] });
  r.json({ workers: workers.map(adminWorkerOut) });
}));

app.patch('/api/admin/workers/:id/verify', auth, admin, ah(async (q, r) => {
  const id = Number(q.params.id);
  if (!await prisma.worker.findUnique({ where: { id } })) return r.status(404).json({ message: 'Worker not found.' });
  await prisma.worker.update({ where: { id }, data: { verified: true, rejected: false, rejectionReasonEn: '', rejectionReasonBn: '' } });
  r.json({ message: 'Worker verified.' });
}));

app.patch('/api/admin/workers/:id/reject', auth, admin, ah(async (q, r) => {
  const id = Number(q.params.id);
  if (!await prisma.worker.findUnique({ where: { id } })) return r.status(404).json({ message: 'Worker not found.' });
  const reasonEn = String(q.body?.reasonEn || '').trim();
  const reasonBn = String(q.body?.reasonBn || '').trim();
  if (!reasonEn && !reasonBn) return r.status(400).json({ message: 'Please provide a rejection reason in English or Bangla.' });
  await prisma.worker.update({ where: { id }, data: { verified: false, rejected: true, rejectionReasonEn: reasonEn, rejectionReasonBn: reasonBn } });
  r.json({ message: 'Worker rejected.' });
}));

app.post('/api/reports', auth, ah(async (q, r) => {
  const { bookingCode, subject, description } = q.body || {};
  if (!subject || !description) return r.status(400).json({ message: 'Subject and description are required.' });
  let bookingId = null;
  if (bookingCode) { const b = await prisma.booking.findUnique({ where: { bookingCode: String(bookingCode) } }); bookingId = b?.id || null; }
  await prisma.report.create({ data: { bookingId, reporterId: q.user.id, subject: String(subject), description: String(description) } });
  r.status(201).json({ message: 'Report submitted.' });
}));

app.get('/api/admin/database', auth, admin, ah(async (_q, r) => {
  const [users, workers, bookings, reviews, reports] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    prisma.worker.findMany({ orderBy: { id: 'desc' }, select: { id: true, userId: true, name: true, service: true, area: true, phone: true, experience: true, price: true, verified: true, nidFileName: true, rating: true, reviewCount: true, jobs: true } }),
    prisma.booking.findMany({ orderBy: { id: 'desc' }, select: { bookingCode: true, customerId: true, workerId: true, service: true, workerName: true, date: true, time: true, address: true, status: true, amount: true, createdAt: true } }),
    prisma.review.findMany({ orderBy: { id: 'desc' }, select: { id: true, bookingId: true, customerId: true, workerId: true, rating: true, comment: true, createdAt: true } }),
    prisma.report.findMany({ orderBy: { id: 'desc' } })
  ]);
  r.json({ users, workers, bookings, reviews, reports });
}));

app.get('/api/admin/reports', auth, admin, ah(async (_q, r) => {
  r.json({ reports: await prisma.report.findMany({ orderBy: { id: 'desc' } }) });
}));

app.use((err, _q, r, _n) => { console.error(err); r.status(500).json({ message: 'Unexpected server error.' }); });

prisma.$connect()
  .then(() => app.listen(PORT, () => console.log(`SheboyHaat API: http://localhost:${PORT}\nDatabase: PostgreSQL via Prisma`)))
  .catch((e) => { console.error('Could not connect to the database. Check DATABASE_URL in backend/.env', e); process.exit(1); });
