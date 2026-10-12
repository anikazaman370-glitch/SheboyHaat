import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SECRET = process.env.JWT_SECRET || 'development_only_change_me';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(cors({ origin: (origin, cb) => { if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true); return cb(null, false); } }));
app.use(express.json({ limit: '3mb' }));

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function tokenFor(u) { return jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) { const h = req.headers.authorization || ''; try { if (!h.startsWith('Bearer ')) throw Error(); req.user = jwt.verify(h.slice(7), SECRET); next(); } catch { return res.status(401).json({ message: 'Please log in to continue.' }); } }
function admin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }

function workerOut(w) {
  return {
    id: w.id, userId: w.userId, name: w.name, service: w.service, area: w.area,
    rating: Number(w.rating), reviews: w.reviewCount, price: w.price, verified: !!w.verified,
    avatar: w.avatar || w.name.split(' ').map(x => x[0]).join('').slice(0, 2),
    jobs: w.jobs, phone: w.phone || '', experience: w.experience || '',
    nidFileName: w.nidFileName || '', bio: w.bio || ''
  };
}
function bookingOut(b) {
  return { id: b.bookingCode, service: b.service, worker: b.workerName, date: b.date, time: b.time, area: b.address, status: b.status, amount: b.amount };
}

app.get('/api/health', (_q, r) => r.json({ ok: true, service: 'SheboyHaat API', database: 'PostgreSQL' }));

app.get('/api/services', (_q, r) => r.json({ services: [{ id: 'plumbing', name: 'Plumbing' }, { id: 'electrical', name: 'Electrical' }, { id: 'cleaning', name: 'Cleaning' }, { id: 'ac', name: 'AC Service' }, { id: 'appliance', name: 'Appliance Repair' }, { id: 'painting', name: 'Painting' }] }));

app.get('/api/workers', ah(async (q, r) => {
  const AND = [];
  if (q.query.service) AND.push({ service: { contains: String(q.query.service), mode: 'insensitive' } });
  if (q.query.area) AND.push({ area: { equals: String(q.query.area), mode: 'insensitive' } });
  if (q.query.search) AND.push({ OR: [{ name: { contains: String(q.query.search), mode: 'insensitive' } }, { service: { contains: String(q.query.search), mode: 'insensitive' } }] });
  const workers = await prisma.worker.findMany({ where: { verified: true, ...(AND.length ? { AND } : {}) }, orderBy: { rating: 'desc' } });
  r.json({ workers: workers.map(workerOut) });
}));

app.get('/api/workers/:id', ah(async (q, r) => {
  const w = await prisma.worker.findUnique({ where: { id: Number(q.params.id) } });
  if (!w) return r.status(404).json({ message: 'Worker not found.' });
  const reviews = await prisma.review.findMany({ where: { workerId: w.id }, orderBy: { id: 'desc' }, include: { customer: { select: { name: true } } } });
  r.json({ worker: workerOut(w), bio: w.bio, reviews: reviews.map(rv => ({ rating: rv.rating, comment: rv.comment, created_at: rv.createdAt, customerName: rv.customer.name })) });
}));

app.post('/api/auth/register', ah(async (q, r) => {
  const { name, email, password, role = 'customer', phone = '', service = 'General Service', area = 'Dhaka', experience = '', price = '500', nidFileName = '', nidData = '' } = q.body || {};
  if (!name || !email || !password || String(password).length < 6) return r.status(400).json({ message: 'Name, email and password (at least 6 characters) are required.' });
  if (!['customer', 'worker'].includes(role)) return r.status(400).json({ message: 'Invalid role.' });
  if (role === 'worker' && (!phone || !service || !area || !nidFileName || !nidData)) return r.status(400).json({ message: 'Worker phone, service, area and NID upload are required.' });
  const normalized = String(email).trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) return r.status(409).json({ message: 'Email already registered.' });
  const passwordHash = await bcrypt.hash(String(password), 10);
  const u = await prisma.user.create({ data: { name: String(name).trim(), email: normalized, passwordHash, role } });
  if (role === 'worker') {
    await prisma.worker.create({ data: { userId: u.id, name: u.name, service: String(service), area: String(area), rating: 5, reviewCount: 0, price: '৳' + String(price), verified: false, avatar: u.name.slice(0, 2).toUpperCase(), jobs: 0, bio: 'Awaiting admin verification.', phone: String(phone), experience: String(experience), nidFileName: String(nidFileName), nidData: String(nidData) } });
  }
  const safe = { id: u.id, name: u.name, email: u.email, role: u.role };
  r.status(201).json({ user: safe, token: tokenFor(safe) });
}));

app.post('/api/auth/login', ah(async (q, r) => {
  const email = String(q.body?.email || '').trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(String(q.body?.password || ''), u.passwordHash))) return r.status(401).json({ message: 'Incorrect email or password.' });
  const safe = { id: u.id, name: u.name, email: u.email, role: u.role };
  r.json({ user: safe, token: tokenFor(safe) });
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
    prisma.worker.count({ where: { verified: false } }),
    prisma.booking.count(),
    prisma.report.count({ where: { status: 'Open' } })
  ]);
  r.json({ workers, pendingVerification, bookings, openReports });
}));

app.get('/api/admin/workers', auth, admin, ah(async (_q, r) => {
  const workers = await prisma.worker.findMany({ orderBy: [{ verified: 'asc' }, { id: 'desc' }] });
  r.json({ workers: workers.map(workerOut) });
}));

app.patch('/api/admin/workers/:id/verify', auth, admin, ah(async (q, r) => {
  const id = Number(q.params.id);
  if (!await prisma.worker.findUnique({ where: { id } })) return r.status(404).json({ message: 'Worker not found.' });
  await prisma.worker.update({ where: { id }, data: { verified: true } });
  r.json({ message: 'Worker verified.' });
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
