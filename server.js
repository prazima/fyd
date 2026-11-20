const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'registrations.json');
const PORT = Number(process.env.PORT || 4173);
const ADMIN_USER = process.env.ADMIN_USER || 'FYD';
const ADMIN_PASS = process.env.ADMIN_PASS || 'FYDDANCE';
const sessions = new Map();
let registrations = [];
fs.mkdirSync(DATA_DIR, { recursive: true });
try { registrations = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { registrations = []; }

function persist() {
  const temp = DB_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(registrations, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 20000) reject(new Error('Too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); } });
  });
}
function authed(req) { const id = (req.headers.cookie || '').match(/(?:^|;\s*)fyd_session=([^;]+)/)?.[1]; return id && sessions.has(id); }
function clean(v, max = 120) { return String(v || '').trim().replace(/[<>]/g, '').slice(0, max); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'POST' && url.pathname === '/api/register') {
      const b = await body(req);
      const name = clean(b.name), phone = clean(b.phone, 20), age = Number(b.age), email = clean(b.email, 120), category = clean(b.category, 40), entry = clean(b.entry, 40), transactionId = clean(b.transactionId, 80), teamName = clean(b.teamName, 80);
      if (name.length < 2 || !/^\+?[0-9\s-]{8,15}$/.test(phone) || !Number.isInteger(age) || age < 4 || age > 100 || !['Hip Hop Battle','Open Style Battle','Tamil Song Battle','Kids Battle'].includes(category) || !['Registration','Solo 3 Battles','Group of 3','Group of 5'].includes(entry) || transactionId.length < 4) return send(res, 400, { error: 'Please complete all required fields and enter a valid transaction ID.' });
      if (category === 'Kids Battle' && age >= 14) return send(res, 400, { error: 'Kids Battle is only for dancers under 14.' });
      if (entry.startsWith('Group') && !teamName) return send(res, 400, { error: 'Please enter your group name.' });
      const id = crypto.randomUUID();
      const record = { id, name, phone, age, email, category, entry, teamName, transactionId, paymentStatus: 'Reference submitted - awaiting organizer verification', registeredAt: new Date().toISOString(), checkedIn: false };
      registrations.push(record); persist();
      return send(res, 201, { id, name, category, entry, paymentStatus: record.paymentStatus });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      const b = await body(req);
      if (clean(b.username) !== ADMIN_USER || String(b.password || '') !== ADMIN_PASS) return send(res, 401, { error: 'Username or password is incorrect.' });
      const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Date.now());
      res.setHeader('Set-Cookie', `fyd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
      const token = (req.headers.cookie || '').match(/(?:^|;\s*)fyd_session=([^;]+)/)?.[1]; if (token) sessions.delete(token);
      res.setHeader('Set-Cookie', 'fyd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/me') return send(res, 200, { authenticated: !!authed(req) });
    if (url.pathname.startsWith('/api/admin/') && !authed(req)) return send(res, 401, { error: 'Please sign in.' });
    if (req.method === 'GET' && url.pathname === '/api/admin/registrations') return send(res, 200, registrations.slice().reverse());
    if (req.method === 'GET' && url.pathname.startsWith('/api/admin/scan/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/admin/scan/'.length)); const record = registrations.find(x => x.id === id);
      return record ? send(res, 200, record) : send(res, 404, { error: 'No registration found for this QR.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/checkin') {
      const b = await body(req); const record = registrations.find(x => x.id === clean(b.id, 80));
      if (!record) return send(res, 404, { error: 'Registration not found.' });
      record.checkedIn = true; record.checkedInAt = new Date().toISOString(); persist(); return send(res, 200, record);
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found.' });
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(ROOT, 'public', '.' + requested);
    if (!file.startsWith(path.resolve(ROOT, 'public') + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, bytes) => {
      if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      const ext = path.extname(file); const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml' };
      send(res, 200, bytes, types[ext] || 'application/octet-stream');
    });
  } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message === 'Too large' ? 'Request too large.' : 'Could not process request.' }); }
});
server.listen(PORT, () => console.log(`FYD Namma Namakkal is running at http://localhost:${PORT}`));
