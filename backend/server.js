import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
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

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const MAIL_FROM = process.env.MAIL_FROM || 'SheboyHaat <no-reply@sheboyhaat.local>';
const SMTP_READY = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailer = SMTP_READY ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

const SMS_API_URL = process.env.SMS_API_URL || '';
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || '';
const SMS_HTTP_METHOD = (process.env.SMS_HTTP_METHOD || 'GET').toUpperCase();
const SMS_POST_BODY = process.env.SMS_POST_BODY || '';
const SMS_BODY_ENCODE = process.env.SMS_BODY_ENCODE !== 'false';
const SMS_MESSAGE_TEMPLATE = process.env.SMS_MESSAGE_TEMPLATE || 'SheboyHaat: Your verification code is {otp}. It expires in {minutes} minutes. Do not share this code with anyone.';
const SMS_SUCCESS_REGEX = process.env.SMS_SUCCESS_REGEX || '';
const SMS_HEADERS = (() => {
  try {
    const parsed = JSON.parse(process.env.SMS_HEADERS || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.warn('SMS_HEADERS is not valid JSON; ignoring it.');
    return {};
  }
})();
const GENERIC_SMS_READY = Boolean(SMS_API_URL);

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || '';
const TWILIO_MESSAGING_SERVICE = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
const TWILIO_READY = Boolean(TWILIO_SID && TWILIO_TOKEN && (TWILIO_FROM || TWILIO_MESSAGING_SERVICE));
const SMS_READY = GENERIC_SMS_READY || TWILIO_READY;
console.log(GENERIC_SMS_READY
  ? 'SMS gateway configured: OTP codes will be sent to user phone numbers.'
  : TWILIO_READY
    ? 'Twilio configured: OTP codes will be sent to user phone numbers.'
    : 'SMS not configured: OTP codes will be printed to this console (development only).');

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return '+' + digits;
  if (digits.startsWith('0')) return '+880' + digits.slice(1);
  if (digits.startsWith('1') && digits.length === 10) return '+880' + digits;
  if (digits.length >= 10) return '+' + digits;
  return '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BD_PHONE_RE = /^01[3-9]\d{8}$/;
const isValidEmail = (v) => EMAIL_RE.test(String(v || '').trim());
function isValidBdPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('880')) digits = '0' + digits.slice(3);
  return BD_PHONE_RE.test(digits);
}

function generateOtp() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

async function sendOtpEmail(to, otp, name) {
  const subject = 'Your SheboyHaat verification code';
  const text = `Hello ${name || 'there'},\n\nYour SheboyHaat verification code is ${otp}.\nIt expires in ${OTP_TTL_MINUTES} minutes.\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2 style="color:#0f766e">SheboyHaat</h2><p>Hello ${name || 'there'},</p><p>Your verification code is:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0f766e">${otp}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p><p style="color:#6b7280;font-size:12px">If you did not create an account, you can ignore this email.</p></div>`;
  if (!mailer) {
    console.warn(IS_PROD
      ? `[OTP] SMTP not configured; cannot email ${to}.`
      : `[OTP] SMTP not configured. Verification code for ${to}: ${otp}`);
    return false;
  }
  await mailer.sendMail({ from: MAIL_FROM, to, subject, text, html });
  return true;
}

const smsText = (otp) => SMS_MESSAGE_TEMPLATE
  .replace(/\{otp\}/g, otp)
  .replace(/\{minutes\}/g, String(OTP_TTL_MINUTES));

function renderSmsTemplate(template, vars, encode = true) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = String(vars[key] ?? '');
    return encode ? encodeURIComponent(value) : value;
  });
}

function smsVars(phone, otp) {
  return {
    phone,
    otp,
    message: smsText(otp),
    apiKey: SMS_API_KEY,
    senderId: SMS_SENDER_ID,
    minutes: OTP_TTL_MINUTES
  };
}

function assertSmsDelivered(res, text) {
  if (!res.ok) throw new Error(`SMS gateway responded with HTTP ${res.status}: ${String(text).slice(0, 200)}`);
  if (SMS_SUCCESS_REGEX) {
    if (!new RegExp(SMS_SUCCESS_REGEX, 'i').test(text)) throw new Error(`SMS gateway rejected the request: ${String(text).slice(0, 200)}`);
    return;
  }
  if (/(error|failed|invalid|insufficient|denied|rejected)/i.test(text)) {
    throw new Error(`SMS gateway rejected the request: ${String(text).slice(0, 200)}`);
  }
}

async function sendViaGenericGateway(phone, otp) {
  const vars = smsVars(phone, otp);
  const headers = { ...SMS_HEADERS };
  let url = SMS_API_URL;
  let body;
  if (SMS_HTTP_METHOD === 'POST') {
    const qIndex = url.indexOf('?');
    const bodyTemplate = SMS_POST_BODY || (qIndex >= 0 ? url.slice(qIndex + 1) : '');
    if (qIndex >= 0) url = url.slice(0, qIndex);
    url = renderSmsTemplate(url, vars);
    body = renderSmsTemplate(bodyTemplate, vars, SMS_BODY_ENCODE);
    if (body && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  } else {
    url = renderSmsTemplate(url, vars);
  }
  const res = await fetch(url, { method: SMS_HTTP_METHOD === 'POST' ? 'POST' : 'GET', headers, ...(body ? { body } : {}) });
  const text = await res.text().catch(() => '');
  assertSmsDelivered(res, text);
  return true;
}

async function sendViaTwilio(phone, otp) {
  const params = new URLSearchParams({ To: phone, Body: smsText(otp) });
  if (TWILIO_MESSAGING_SERVICE) params.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE);
  else params.set('From', TWILIO_FROM);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `SMS gateway responded with HTTP ${res.status}`);
  }
  return true;
}

async function sendOtpSms(to, otp) {
  const phone = normalizePhone(to);
  if (!SMS_READY) {
    console.warn(`[OTP] SMS not configured. Verification code for ${phone}: ${otp}`);
    return false;
  }
  if (GENERIC_SMS_READY) return await sendViaGenericGateway(phone, otp);
  return await sendViaTwilio(phone, otp);
}

async function deliverOtp(user, otp) {
  if (user.phone) {
    if (!SMS_READY) {
      console.warn(`[OTP] SMS not configured. Verification code for ${user.phone}: ${otp}`);
      return { delivered: false, channel: 'sms' };
    }
    try {
      const delivered = await sendOtpSms(user.phone, otp);
      return { delivered, channel: 'sms' };
    } catch (e) {
      const smsError = e?.message || String(e);
      console.error('Failed to send OTP SMS:', smsError);
      if (!SMTP_READY) return { delivered: false, channel: 'sms', error: smsError };
      try {
        const delivered = await sendOtpEmail(user.email, otp, user.name);
        return { delivered, channel: 'email', error: smsError };
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError?.message || emailError);
        return { delivered: false, channel: 'sms', error: smsError };
      }
    }
  }
  try {
    const delivered = await sendOtpEmail(user.email, otp, user.name);
    return { delivered, channel: 'email' };
  } catch (e) {
    console.error('Failed to send OTP email:', e?.message || e);
    return { delivered: false, channel: 'email', error: e?.message || String(e) };
  }
}

async function issueOtp(user, { channel = 'auto' } = {}) {
  const otp = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { otpCode: hashOtp(otp), otpExpiresAt } });
  let result;
  if (channel === 'email') {
    try {
      const delivered = await sendOtpEmail(user.email, otp, user.name);
      result = { delivered, channel: 'email' };
    } catch (e) {
      console.error('Failed to send OTP email:', e?.message || e);
      result = { delivered: false, channel: 'email', error: e?.message || String(e) };
    }
  } else {
    result = await deliverOtp(user, otp);
  }
  return { otp, ...result };
}

const otpPayload = (user, { otp, delivered, channel, error }) => ({
  requiresOtp: true,
  email: user.email,
  phone: user.phone || '',
  channel,
  ...(delivered || IS_PROD ? {} : { devOtp: otp }),
  ...(error && !IS_PROD ? { smsError: error } : {})
});


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
function safeUser(u) { return { id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role }; }
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
  const profileComplete = Boolean(
    w.name &&
    w.service &&
    w.area &&
    w.phone &&
    w.experience !== '' &&
    w.price &&
    w.nidFileName &&
    w.nidData
  );
  const out = {
    id: w.id, userId: w.userId, name: w.name, service: w.service, area: w.area,
    rating: Number(w.rating), reviews: w.reviewCount, reviewCount: w.reviewCount, price: w.price, verified: !!w.verified,
    rejected: !!w.rejected,
    profileComplete,
    profileCompletion: profileComplete ? 100 : 85,
    avatar: w.avatar || w.name.split(' ').map(x => x[0]).join('').slice(0, 2),
    jobs: w.jobs
  };
  if (opts.full) {
    out.phone = w.phone || '';
    out.experience = w.experience || '';
    out.bio = w.bio || '';
    out.earnings = Number(w.earnings) || 0;
    out.rejectionReasonEn = w.rejectionReasonEn || '';
    out.rejectionReasonBn = w.rejectionReasonBn || '';
  }
  return out;
}
function adminWorkerOut(w) {
  const raw = String(w.nidData || '');
  const out = {
    ...workerOut(w, { full: true }),
    email: w.user?.email || '',
    nidFileName: w.nidFileName || ''
  };
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
  return { id: b.bookingCode, service: b.service, worker: b.workerName, customer: b.customer?.name || '', date: b.date, time: b.time, area: b.address, note: b.note || '', status: b.status, amount: b.amount, reviewed: Array.isArray(b.reviews) ? b.reviews.length > 0 : false };
}
function amountToNumber(value) {
  const parsed = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
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
  if (!isValidEmail(email)) return r.status(400).json({ message: 'Enter a valid email address, e.g. name@example.com.' });
  if (!isValidBdPhone(phone)) return r.status(400).json({ message: 'Enter a valid Bangladeshi phone number, e.g. 01712345678.' });
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return r.status(400).json({ message: 'A valid phone number is required.' });
  if (role === 'worker' && (!service || !area || !nidFileName || !nidData)) return r.status(400).json({ message: 'Worker service, area and NID upload are required.' });
  const normalized = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing?.isVerified) return r.status(409).json({ message: 'Email already registered.' });
  const phoneOwner = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (phoneOwner && phoneOwner.id !== existing?.id) return r.status(409).json({ message: 'This phone number is already registered.' });
  if (existing && !existing.isVerified) {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const updated = await prisma.user.update({ where: { id: existing.id }, data: { name: String(name).trim(), passwordHash, phone: normalizedPhone } });
    const issued = await issueOtp(updated, { channel: 'email' });
    return r.json({ ...otpPayload(updated, issued), message: `We emailed a new verification code to ${updated.email}. It expires in ${OTP_TTL_MINUTES} minutes.` });
  }
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

  const u = await prisma.user.create({ data: { name: String(name).trim(), email: normalized, phone: normalizedPhone, passwordHash, role, isVerified: false } });
  if (role === 'worker') {
    await prisma.worker.create({ data: { userId: u.id, name: u.name, service: String(service), area: String(area), rating: 5, reviewCount: 0, price: '৳' + String(price), verified: false, avatar: u.name.slice(0, 2).toUpperCase(), jobs: 0, bio: 'Awaiting admin verification.', phone: String(phone), experience: String(experience), nidFileName: String(nidFileName), nidData: storedNid } });
  }
  const issued = await issueOtp(u, { channel: 'email' });
  r.status(201).json({ ...otpPayload(u, issued), message: `We emailed a verification code to ${u.email}. It expires in ${OTP_TTL_MINUTES} minutes.` });
}));

app.post('/api/auth/login', ah(async (q, r) => {
  const email = String(q.body?.email || '').trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(String(q.body?.password || ''), u.passwordHash))) return r.status(401).json({ message: 'Incorrect email or password.' });
  if (!u.isVerified && u.role !== 'admin') {
    const issued = await issueOtp(u, { channel: 'email' });
    return r.status(403).json({ ...otpPayload(u, issued), message: `Your account is not verified yet. We emailed a new code to ${u.email}. It expires in ${OTP_TTL_MINUTES} minutes.` });
  }
  await startSession(u, r);
}));

app.post('/api/auth/verify-otp', ah(async (q, r) => {
  const phone = normalizePhone(q.body?.phone);
  const email = String(q.body?.email || '').trim().toLowerCase();
  const otp = String(q.body?.otp || '').trim();
  if ((!phone && !email) || !otp) return r.status(400).json({ message: 'Email and verification code are required.' });
  const u = phone
    ? await prisma.user.findUnique({ where: { phone } })
    : await prisma.user.findUnique({ where: { email } });
  if (!u) return r.status(404).json({ message: 'Account not found. Please register again.' });
  if (u.isVerified) return startSession(u, r);
  if (!u.otpCode || !u.otpExpiresAt || u.otpExpiresAt <= new Date()) return r.status(400).json({ message: 'This code has expired. Please request a new one.' });
  if (u.otpCode !== hashOtp(otp)) return r.status(400).json({ message: 'Incorrect verification code.' });
  const updated = await prisma.user.update({ where: { id: u.id }, data: { isVerified: true, otpCode: null, otpExpiresAt: null } });
  await startSession(updated, r);
}));

app.post('/api/auth/resend-otp', ah(async (q, r) => {
  const phone = normalizePhone(q.body?.phone);
  const email = String(q.body?.email || '').trim().toLowerCase();
  if (!phone && !email) return r.status(400).json({ message: 'Email is required.' });
  const u = phone
    ? await prisma.user.findUnique({ where: { phone } })
    : await prisma.user.findUnique({ where: { email } });
  if (!u) return r.status(404).json({ message: 'Account not found. Please register again.' });
  if (u.isVerified) return r.json({ message: 'This account is already verified.' });
  r.json({ ...otpPayload(u, await issueOtp(u, { channel: 'email' })), message: `A new verification code has been emailed to ${u.email}. It expires in ${OTP_TTL_MINUTES} minutes.` });
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
  const u = await prisma.user.findUnique({ where: { id: stored.userId }, select: { id: true, name: true, email: true, phone: true, role: true } });
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
  const u = await prisma.user.findUnique({ where: { id: q.user.id }, select: { id: true, name: true, email: true, phone: true, role: true } });
  if (!u) return r.status(404).json({ message: 'User not found.' });
  r.json({ user: u });
}));

app.patch('/api/auth/profile', auth, ah(async (q, r) => {
  const name = String(q.body?.name || '').trim();
  const email = String(q.body?.email || '').trim().toLowerCase();
  const phoneInput = String(q.body?.phone || '').trim();
  if (!name) return r.status(400).json({ message: 'Please enter your full name.' });
  if (!isValidEmail(email)) return r.status(400).json({ message: 'Enter a valid email address, e.g. name@example.com.' });
  if (!isValidBdPhone(phoneInput)) return r.status(400).json({ message: 'Enter a valid Bangladeshi phone number, e.g. 01712345678.' });
  const normalizedPhone = normalizePhone(phoneInput);
  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== q.user.id) return r.status(409).json({ message: 'Email already registered.' });
  const phoneOwner = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (phoneOwner && phoneOwner.id !== q.user.id) return r.status(409).json({ message: 'This phone number is already registered.' });
  const updated = await prisma.user.update({ where: { id: q.user.id }, data: { name, email, phone: normalizedPhone } });
  if (updated.role === 'worker') {
    await prisma.worker.updateMany({ where: { userId: updated.id }, data: { name: updated.name, phone: normalizedPhone } });
  }
  r.json({ user: safeUser(updated), message: 'Profile updated.' });
}));

app.delete('/api/auth/account', auth, ah(async (q, r) => {
  const password = String(q.body?.password || '');
  const user = await prisma.user.findUnique({ where: { id: q.user.id } });
  if (!user) return r.status(404).json({ message: 'User not found.' });
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) return r.status(401).json({ message: 'Incorrect password.' });
  if (user.role === 'admin') return r.status(403).json({ message: 'Admin accounts cannot be deleted.' });

  const worker = await prisma.worker.findFirst({ where: { userId: user.id } });
  const writtenReviews = await prisma.review.findMany({ where: { customerId: user.id }, select: { workerId: true } });
  const affectedWorkers = [...new Set(writtenReviews.map((rv) => rv.workerId))];

  await prisma.$transaction(async (tx) => {
    if (worker) {
      await tx.review.deleteMany({ where: { workerId: worker.id } });
      await tx.booking.updateMany({ where: { workerId: worker.id }, data: { workerId: null } });
      await tx.worker.delete({ where: { id: worker.id } });
    }
    await tx.review.deleteMany({ where: { customerId: user.id } });
    await tx.message.deleteMany({ where: { senderId: user.id } });
    await tx.report.updateMany({ where: { reporterId: user.id }, data: { reporterId: null } });
    await tx.booking.updateMany({ where: { customerId: user.id }, data: { customerId: null } });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  for (const workerId of affectedWorkers) {
    const exists = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!exists) continue;
    const [avg, count] = await Promise.all([
      prisma.review.aggregate({ where: { workerId }, _avg: { rating: true } }),
      prisma.review.count({ where: { workerId } })
    ]);
    await prisma.worker.update({ where: { id: workerId }, data: { rating: avg._avg.rating || 0, reviewCount: count } });
  }

  r.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  r.json({ message: 'Account deleted.' });
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
  const include = { customer: { select: { name: true } }, reviews: { select: { id: true } } };
  if (q.user.role === 'admin') rows = await prisma.booking.findMany({ orderBy: { id: 'desc' }, include });
  else if (q.user.role === 'worker') rows = await prisma.booking.findMany({ where: { worker: { userId: q.user.id } }, orderBy: { id: 'desc' }, include });
  else rows = await prisma.booking.findMany({ where: { customerId: q.user.id }, orderBy: { id: 'desc' }, include });
  r.json({ bookings: rows.map(bookingOut) });
}));

app.patch('/api/bookings/:code/status', auth, ah(async (q, r) => {
  const status = q.body?.status;
  if (!['Accepted', 'Work Done', 'Completed', 'Cancelled'].includes(status)) return r.status(400).json({ message: 'Invalid status.' });
  const b = await prisma.booking.findUnique({ where: { bookingCode: q.params.code } });
  if (!b) return r.status(404).json({ message: 'Booking not found.' });
  const isOwnWorker = q.user.role === 'worker' && b.workerId && await prisma.worker.findFirst({ where: { id: b.workerId, userId: q.user.id } });
  const workerCanUpdate = isOwnWorker && (
    (status === 'Accepted' && b.status === 'Requested') ||
    (status === 'Work Done' && b.status === 'Accepted') ||
    (status === 'Cancelled' && ['Requested', 'Accepted', 'Work Done'].includes(b.status))
  );
  const customerCanComplete = b.customerId === q.user.id && status === 'Completed' && ['Accepted', 'Work Done'].includes(b.status);
  if (q.user.role !== 'admin' && !workerCanUpdate && !customerCanComplete) return r.status(403).json({ message: 'You cannot update this booking.' });
  const updated = await prisma.booking.update({ where: { bookingCode: q.params.code }, data: { status } });
  if (status === 'Completed' && b.status !== 'Completed' && b.workerId) {
    await prisma.worker.update({ where: { id: b.workerId }, data: { jobs: { increment: 1 }, earnings: { increment: amountToNumber(b.amount) } } });
  }
  r.json({ booking: bookingOut(updated) });
}));

app.post('/api/bookings/:code/review', auth, ah(async (q, r) => {
  const rating = Number(q.body?.rating);
  const comment = String(q.body?.comment || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return r.status(400).json({ message: 'Rating must be between 1 and 5.' });
  if (comment.length > 1000) return r.status(400).json({ message: 'Comment is too long (max 1000 characters).' });
  const b = await prisma.booking.findUnique({ where: { bookingCode: q.params.code } });
  if (!b) return r.status(404).json({ message: 'Booking not found.' });
  if (b.customerId !== q.user.id) return r.status(403).json({ message: 'You can only review your own bookings.' });
  if (!b.workerId) return r.status(400).json({ message: 'This booking has no worker to review.' });
  if (b.status !== 'Completed') return r.status(400).json({ message: 'You can review a worker only after the work is completed.' });
  const existing = await prisma.review.findFirst({ where: { bookingId: b.id } });
  if (existing) return r.status(409).json({ message: 'You have already reviewed this booking.' });
  const review = await prisma.review.create({ data: { bookingId: b.id, customerId: b.customerId, workerId: b.workerId, rating, comment } });
  const [avg, count] = await Promise.all([
    prisma.review.aggregate({ where: { workerId: b.workerId }, _avg: { rating: true } }),
    prisma.review.count({ where: { workerId: b.workerId } })
  ]);
  await prisma.worker.update({ where: { id: b.workerId }, data: { rating: avg._avg.rating || 0, reviewCount: count } });
  r.status(201).json({ review: { rating: review.rating, comment: review.comment } });
}));

async function bookingChatContext(code, user) {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: String(code) },
    include: { worker: true, customer: { select: { id: true, name: true } } }
  });
  if (!booking) return { error: 404, message: 'Booking not found.' };
  const isCustomer = booking.customerId != null && booking.customerId === user.id;
  const isWorker = booking.worker?.userId != null && booking.worker.userId === user.id;
  const isAdmin = user.role === 'admin';
  if (!isCustomer && !isWorker && !isAdmin) return { error: 403, message: 'You can only chat about your own bookings.' };
  return { booking };
}

const messageOut = (m, userId) => ({
  id: m.id,
  body: m.body,
  senderId: m.senderId,
  senderName: m.sender?.name || '',
  createdAt: m.createdAt,
  mine: m.senderId === userId
});

const chatBookingOut = (b) => ({
  code: b.bookingCode,
  service: b.service,
  worker: b.workerName,
  customer: b.customer?.name || '',
  date: b.date,
  time: b.time,
  status: b.status
});

app.get('/api/bookings/:code/messages', auth, ah(async (q, r) => {
  const ctx = await bookingChatContext(q.params.code, q.user);
  if (ctx.error) return r.status(ctx.error).json({ message: ctx.message });
  const where = { bookingId: ctx.booking.id };
  const after = Number(q.query.after);
  let rows;
  if (Number.isFinite(after) && after > 0) {
    where.id = { gt: after };
    rows = await prisma.message.findMany({ where, orderBy: { id: 'asc' }, include: { sender: { select: { name: true } } } });
  } else {
    rows = await prisma.message.findMany({ where, orderBy: { id: 'desc' }, take: 500, include: { sender: { select: { name: true } } } });
    rows.reverse();
  }
  r.json({ booking: chatBookingOut(ctx.booking), messages: rows.map((m) => messageOut(m, q.user.id)) });
}));

app.post('/api/bookings/:code/messages', auth, ah(async (q, r) => {
  const ctx = await bookingChatContext(q.params.code, q.user);
  if (ctx.error) return r.status(ctx.error).json({ message: ctx.message });
  const body = String(q.body?.body || '').trim();
  if (!body) return r.status(400).json({ message: 'Message cannot be empty.' });
  if (body.length > 2000) return r.status(400).json({ message: 'Message is too long (maximum 2000 characters).' });
  const created = await prisma.message.create({
    data: { bookingId: ctx.booking.id, senderId: q.user.id, body },
    include: { sender: { select: { name: true } } }
  });
  r.status(201).json({ message: messageOut(created, q.user.id) });
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
  const workers = await prisma.worker.findMany({
    orderBy: [{ verified: 'asc' }, { id: 'desc' }],
    include: { user: { select: { email: true } } }
  });
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
