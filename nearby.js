// Partage à proximité :
// - LocalSend (protocole ouvert v2) : découverte par multicast UDP (224.0.0.167:53317), envoi et réception en HTTP.
//   Marche avec l'app LocalSend sur iPhone, Android, Windows, macOS et Linux, sur le même réseau.
// - AirDrop sur le système Linux : par la commande « omdrop » (projet libre omdrop-owl / omdrop-plugin), quand elle est
//   installée et que la carte Wi-Fi le permet. Visible quelques minutes, envoi vers les appareils Apple proches.
// - Sur un Mac : le menu de partage de macOS (AirDrop, Messages, Mail…).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const dgram = require('dgram');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const MCAST = '224.0.0.167';
const API = '/api/localsend/v2';

function createNearby({ app, shell, ShareMenu, kiosk, sysEvent, getMain, port: PORT = Number(process.env.BRUME_LOCALSEND_PORT) || 53317, omdropBin = process.env.BRUME_OMDROP || '' }) {
  const prefsFile = path.join(app.getPath('userData'), 'nearby.json');
  let prefs = { receive: false, name: '' };
  try { prefs = Object.assign(prefs, JSON.parse(fs.readFileSync(prefsFile, 'utf8'))); } catch (e) {}
  const savePrefs = () => { try { fs.writeFileSync(prefsFile, JSON.stringify(prefs)); } catch (e) {} };
  const fingerprint = crypto.randomBytes(16).toString('hex');   // en HTTP, LocalSend accepte un identifiant au hasard
  const alias = () => String(prefs.name || '').trim().slice(0, 60) || ('Brume ' + os.hostname()).slice(0, 60);
  const tmpRoot = path.join(os.tmpdir(), 'brume-partage');   // fichiers à envoyer, écrits par Brume
  const recvDir = () => { const d = path.join(app.getPath('downloads'), 'Partage à proximité'); fs.mkdirSync(d, { recursive: true }); return d; };
  const model = () => ({ darwin: 'Mac', win32: 'Windows', linux: 'Linux' })[process.platform] || 'Brume';
  const me = () => ({ alias: alias(), version: '2.1', deviceModel: 'Brume (' + model() + ')', deviceType: 'desktop', fingerprint, port: PORT, protocol: 'http', download: false });

  // ---------- LocalSend : appareils voisins ----------
  const peers = new Map();   // fingerprint → { alias, deviceModel, deviceType, ip, port, protocol, fingerprint, seen }
  let udp = null, server = null, running = false;
  const emitPeers = () => sysEvent({ type: 'nearby-peers', peers: peerList() });
  const peerList = () => [...peers.values()].filter((p) => Date.now() - p.seen < 5 * 60e3).map(({ alias, deviceModel, deviceType, fingerprint, ip }) => ({ id: fingerprint, alias, deviceModel, deviceType, ip }));
  function addPeer(info, ip) {
    if (!info || typeof info !== 'object' || !info.fingerprint || info.fingerprint === fingerprint) return;
    const p = { alias: String(info.alias || '').slice(0, 80) || '?', deviceModel: String(info.deviceModel || '').slice(0, 60), deviceType: String(info.deviceType || ''),
      fingerprint: String(info.fingerprint).slice(0, 128), ip, port: Number(info.port) || 53317, protocol: info.protocol === 'http' ? 'http' : 'https', seen: Date.now() };
    const was = peers.get(p.fingerprint);
    peers.set(p.fingerprint, p);
    if (!was || was.alias !== p.alias || was.ip !== p.ip) emitPeers();
  }
  function announce(isAnnounce = true) {
    if (!udp) return;
    const msg = Buffer.from(JSON.stringify(Object.assign(me(), { announce: isAnnounce, announcement: isAnnounce })));
    try { udp.send(msg, PORT, MCAST); } catch (e) {}
  }
  // Connexion à un autre appareil. LocalSend utilise HTTPS avec un certificat auto-signé : on vérifie qu'il correspond
  // à l'empreinte annoncée avant d'envoyer quoi que ce soit.
  function open(peer, opts, onRes) {
    return new Promise((resolve) => {
      const tls = peer.protocol !== 'http', want = String(peer.fingerprint || '').replace(/:/g, '').toLowerCase();
      const req = (tls ? https : http).request(Object.assign({ host: peer.ip, port: peer.port, agent: false, rejectUnauthorized: false }, opts), onRes);
      let ready = false;
      req.on('error', (e) => { if (!ready) resolve({ error: e.code || e.message }); });
      if (tls && /^[0-9a-f]{64}$/.test(want)) {
        req.on('socket', (sock) => sock.once('secureConnect', () => {
          const c = sock.getPeerCertificate(); const fp = c && c.raw ? crypto.createHash('sha256').update(c.raw).digest('hex') : '';
          if (fp !== want) { ready = true; req.destroy(); resolve({ error: 'empreinte' }); } else { ready = true; resolve({ req }); }
        }));
      } else { ready = true; resolve({ req }); }
    });
  }
  function request(peer, method, pathQ, body, { timeout = 15000, type = 'application/json' } = {}) {
    return new Promise(async (resolve) => {
      const o = await open(peer, { path: pathQ, method, timeout, headers: { 'content-type': type, 'content-length': body ? Buffer.byteLength(body) : 0 } }, (res) => {
        const chunks = []; res.on('data', (d) => { if (chunks.length < 200) chunks.push(d); });
        res.on('end', () => { const t = Buffer.concat(chunks).toString('utf8'); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} resolve({ status: res.statusCode, json: j }); });
      });
      if (o.error) return resolve({ status: 0, error: o.error });
      o.req.on('timeout', () => { o.req.destroy(); resolve({ status: 0, error: 'timeout' }); });
      o.req.on('error', (e) => resolve({ status: 0, error: e.code || e.message }));
      if (body) o.req.write(body);
      o.req.end();
    });
  }
  function startUdp() {
    if (udp) return;
    udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    udp.on('error', () => {});
    udp.on('message', (buf, rinfo) => {
      let j; try { j = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
      if (!j || j.fingerprint === fingerprint) return;
      addPeer(j, rinfo.address);
      if (j.announce || j.announcement) {   // on répond : par HTTP à l'appareil, et en multicast
        const p = peers.get(String(j.fingerprint));
        if (p) request(p, 'POST', API + '/register', JSON.stringify(me()), { timeout: 4000 }).then((r) => { if (r.json) addPeer(r.json, p.ip); });
        announce(false);
      }
    });
    udp.bind(PORT, () => { try { udp.addMembership(MCAST); udp.setMulticastTTL(2); udp.setMulticastLoopback(true); } catch (e) {} announce(true); });
  }

  // ---------- LocalSend : réception ----------
  const asks = new Map();      // id → { resolve }
  const sessions = new Map();  // sessionId → { from, ip, files: { fileId: { token, name, size, type, done } }, at }
  const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(obj ? JSON.stringify(obj) : ''); };
  const readBody = (req, limit) => new Promise((resolve) => { const c = []; let n = 0; req.on('data', (d) => { n += d.length; if (n <= limit) c.push(d); }); req.on('end', () => resolve(n > limit ? null : Buffer.concat(c))); req.on('error', () => resolve(null)); });
  const safeName = (s) => String(s || 'fichier').split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '_').slice(0, 180) || 'fichier';
  const unique = (dir, name) => { let p = path.join(dir, name); const ext = path.extname(name), base = name.slice(0, name.length - ext.length); for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`); return p; };
  async function onRequest(req, res) {
    const u = new URL(req.url, 'http://x'), ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!u.pathname.startsWith('/api/localsend/')) return json(res, 404);
    const route = u.pathname.replace(/^\/api\/localsend\/v[12]/, '');
    if (route === '/info' && req.method === 'GET') return json(res, 200, me());
    if (route === '/register' && req.method === 'POST') {
      const b = await readBody(req, 64 * 1024); let j = null; try { j = JSON.parse(b); } catch (e) {}
      if (j) addPeer(j, ip);
      return json(res, 200, me());
    }
    if (route === '/prepare-upload' && req.method === 'POST') {
      if (!prefs.receive) return json(res, 403, { message: 'Réception désactivée' });
      const b = await readBody(req, 4 * 1024 * 1024); let j = null; try { j = JSON.parse(b); } catch (e) {}
      if (!j || !j.files || typeof j.files !== 'object') return json(res, 400);
      if ([...sessions.values()].some((s) => Date.now() - s.at < 10 * 60e3 && Object.values(s.files).some((f) => !f.done))) return json(res, 409, { message: 'Occupé' });
      if (j.info) addPeer(Object.assign({ port: 53317, protocol: 'https' }, j.info), ip);
      const files = Object.values(j.files).slice(0, 500).map((f) => ({ id: String(f.id || ''), name: safeName(f.fileName), size: Number(f.size) || 0, type: String(f.fileType || ''),
        text: /^text\/plain/.test(String(f.fileType || '')) && typeof f.preview === 'string' ? f.preview.slice(0, 100000) : null }));
      const from = String((j.info && j.info.alias) || ip).slice(0, 80);
      const id = crypto.randomBytes(8).toString('hex');
      const ok = await new Promise((resolve) => {
        asks.set(id, { resolve });
        sysEvent({ type: 'nearby-ask', id, via: 'localsend', from, model: String((j.info && j.info.deviceModel) || ''), files: files.map(({ name, size, type, text }) => ({ name, size, type, text: text ? text.slice(0, 2000) : null })) });
        setTimeout(() => { if (asks.has(id)) { asks.delete(id); resolve(false); } }, 90e3);
      });
      if (!ok) return json(res, 403, { message: 'Refusé' });
      // Un message (texte seul) n'a pas besoin de transfert : il est arrivé avec la demande
      if (files.length && files.every((f) => f.text != null && f.size <= 100000)) {
        for (const f of files) saved({ name: /\.\w+$/.test(f.name) ? f.name : f.name + '.txt', data: Buffer.from(f.text, 'utf8'), type: 'text/plain', from });
        return json(res, 204);
      }
      const sessionId = crypto.randomBytes(12).toString('hex'), map = {}, toks = {};
      for (const f of files) { const token = crypto.randomBytes(12).toString('hex'); map[f.id] = Object.assign({ token, done: false }, f); toks[f.id] = token; }
      sessions.set(sessionId, { from, ip, files: map, at: Date.now() });
      return json(res, 200, { sessionId, files: toks });
    }
    if (route === '/upload' && req.method === 'POST') {
      const s = sessions.get(u.searchParams.get('sessionId') || ''), f = s && s.files[u.searchParams.get('fileId') || ''];
      if (!s || !f || f.token !== u.searchParams.get('token') || s.ip !== ip) { req.resume(); return json(res, 403); }
      const dest = unique(recvDir(), f.name), tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      let n = 0, failed = false;
      req.on('data', (d) => { n += d.length; });
      req.pipe(out);
      req.on('aborted', () => { failed = true; out.destroy(); try { fs.unlinkSync(tmp); } catch (e) {} });
      out.on('finish', () => {
        if (failed) return;
        try { fs.renameSync(tmp, dest); } catch (e) { return json(res, 500); }
        f.done = true;
        sysEvent({ type: 'nearby-file', via: 'localsend', from: s.from, path: dest, name: path.basename(dest), mime: f.type, size: n });
        if (Object.values(s.files).every((x) => x.done)) sessions.delete(u.searchParams.get('sessionId'));
        json(res, 200);
      });
      out.on('error', () => json(res, 500));
      return;
    }
    if (route === '/cancel' && req.method === 'POST') { sessions.delete(u.searchParams.get('sessionId') || ''); return json(res, 200); }
    return json(res, 404);
  }
  function saved({ name, data, type, from, via = 'localsend' }) {
    const dest = unique(recvDir(), safeName(name));
    fs.writeFileSync(dest, data);
    sysEvent({ type: 'nearby-file', via, from, path: dest, name: path.basename(dest), mime: type, size: data.length });
  }
  function startServer() {
    if (server) return;
    server = http.createServer((req, res) => { onRequest(req, res).catch(() => { try { json(res, 500); } catch (e) {} }); });
    server.on('error', () => { server = null; });
    server.listen(PORT, '0.0.0.0');
  }
  function start() { if (running) return; running = true; startUdp(); startServer(); }
  function stop() { running = false; try { udp && udp.close(); } catch (e) {} udp = null; try { server && server.close(); } catch (e) {} server = null; }

  // ---------- LocalSend : envoi ----------
  const sends = new Map();   // id → { cancel }
  async function sendLocal({ peer: pid, files }) {
    const peer = peers.get(String(pid));
    if (!peer) return { ok: false, error: 'peer' };
    const list = (files || []).map((f, i) => ({ id: 'f' + i, file: String(f.path || ''), name: safeName(f.name), type: String(f.type || 'application/octet-stream') }))
      .filter((f) => f.file && path.resolve(f.file).startsWith(tmpRoot + path.sep) && fs.existsSync(f.file));
    if (!list.length) return { ok: false, error: 'files' };
    const body = { info: me(), files: {} };
    for (const f of list) body.files[f.id] = { id: f.id, fileName: f.name, size: fs.statSync(f.file).size, fileType: f.type };
    const r = await request(peer, 'POST', API + '/prepare-upload', JSON.stringify(body), { timeout: 120000 });   // le temps que l'autre accepte
    if (r.status === 204) return { ok: true, sent: list.length };
    if (r.status === 403) return { ok: false, error: 'refused' };
    if (r.status === 409) return { ok: false, error: 'busy' };
    if (r.status === 401) return { ok: false, error: 'pin' };
    if (r.status !== 200 || !r.json || !r.json.sessionId) return { ok: false, error: r.error || ('http ' + r.status) };
    let sent = 0;
    for (const f of list) {
      const token = r.json.files && r.json.files[f.id]; if (!token) continue;
      const q = `${API}/upload?sessionId=${encodeURIComponent(r.json.sessionId)}&fileId=${encodeURIComponent(f.id)}&token=${encodeURIComponent(token)}`;
      const ok = await new Promise(async (resolve) => {
        const o = await open(peer, { path: q, method: 'POST', headers: { 'content-type': f.type, 'content-length': fs.statSync(f.file).size } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode === 200)); });
        if (o.error) return resolve(false);
        o.req.on('error', () => resolve(false));
        fs.createReadStream(f.file).pipe(o.req);
      });
      if (!ok) { request(peer, 'POST', `${API}/cancel?sessionId=${encodeURIComponent(r.json.sessionId)}`, null, { timeout: 4000 }); return { ok: false, error: 'upload', sent }; }
      sent++;
    }
    return { ok: true, sent };
  }

  // ---------- AirDrop par omdrop (système Linux) ----------
  const omCandidates = () => [omdropBin, '/opt/omdrop-plugin/bin/omdrop', '/usr/lib/omdrop-plugin/bin/omdrop', '/usr/local/bin/omdrop', '/usr/bin/omdrop', path.join(os.homedir(), '.local/bin/omdrop')].filter(Boolean);
  const omPath = () => omCandidates().find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch (e) { return false; } }) || '';
  const om = (args, timeout = 60000) => new Promise((resolve) => {
    const bin = omPath(); if (!bin) return resolve({ code: -1, out: '', err: 'absent' });
    execFile(bin, args, { timeout, maxBuffer: 2 * 1024 * 1024, env: Object.assign({}, process.env, { OMDROP_NAME_WAIT: '8' }) }, (e, out, err) =>
      resolve({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(out || ''), err: String(err || '') }));
  });
  let airUntil = 0, airTimer = null, watcher = null, airDirSet = false;
  const airDir = () => { const d = path.join(recvDir(), 'AirDrop'); fs.mkdirSync(d, { recursive: true }); return d; };
  // Les fichiers reçus par AirDrop arrivent dans un dossier : on les signale à Brume dès qu'ils sont complets
  function watchAir() {
    if (watcher) return;
    const dir = airDir(), known = new Set(fs.readdirSync(dir));
    const check = () => {
      for (const n of fs.readdirSync(dir)) {
        if (known.has(n) || /\.(part|tmp|download)$/i.test(n) || n.startsWith('.')) continue;
        const p = path.join(dir, n); let st; try { st = fs.statSync(p); } catch (e) { continue; }
        if (!st.isFile()) continue;
        if (Date.now() - st.mtimeMs < 1500) { setTimeout(check, 1600); continue; }   // encore en cours d'écriture
        known.add(n);
        sysEvent({ type: 'nearby-file', via: 'airdrop', from: '', path: p, name: n, mime: '', size: st.size });
      }
    };
    try { watcher = fs.watch(dir, () => setTimeout(check, 400)); } catch (e) {}
    setInterval(check, 5000).unref();
  }
  async function airStatus() {
    const bin = omPath();
    return { installed: !!bin, visibleUntil: airUntil > Date.now() ? airUntil : 0 };
  }
  async function airOn({ minutes = 10, name } = {}) {
    if (!omPath()) return { ok: false, error: 'absent' };
    if (!airDirSet) { const r = await om(['dir', airDir()], 20000); airDirSet = r.code === 0; }
    if (name) await om(['name', String(name).slice(0, 60)], 20000);
    const m = Math.max(1, Math.min(60, Number(minutes) || 10));
    const r = await om(['on', String(m)], 120000);
    if (r.code !== 0) return { ok: false, error: (r.err || r.out).trim().split('\n').slice(-3).join('\n') || 'on' };
    airUntil = Date.now() + m * 60e3; clearTimeout(airTimer);
    airTimer = setTimeout(() => { airUntil = 0; sysEvent({ type: 'nearby-air', visibleUntil: 0 }); }, m * 60e3);
    watchAir();
    sysEvent({ type: 'nearby-air', visibleUntil: airUntil });
    return { ok: true, visibleUntil: airUntil };
  }
  async function airOff() {
    const r = await om(['off'], 60000);
    airUntil = 0; clearTimeout(airTimer); sysEvent({ type: 'nearby-air', visibleUntil: 0 });
    return { ok: r.code === 0 || r.code === -1 };
  }
  // « omdrop peers -n » : une ligne par appareil (nom, éventuellement adresse) ; « (no response) » = ne peut pas recevoir
  function parsePeers(out) {
    const list = [];
    for (let line of String(out).split('\n')) {
      line = line.replace(/\u001b\[[0-9;]*m/g, '').trim();
      if (!line || /^(no |aucun|searching|scanning|nearby|peers|looking|waking)/i.test(line) || /^[-=─]+$/.test(line)) continue;
      const addr = (/(fe80::[0-9a-f:]+(%\w+)?)/i.exec(line) || [])[1] || '';
      const silent = /\(no response\)/i.test(line), anon = /\(anonymous\)/i.test(line);
      let name = line.replace(addr, '').replace(/\((no response|anonymous)\)/ig, '').replace(/^[\s*•·\-\d.)]+/, '').replace(/[\s\-–:|]+$/, '').trim();
      if (!name && !addr) continue;
      list.push({ id: addr || name, name: name || '', addr, anonymous: anon || !name, reachable: !silent });
    }
    return list;
  }
  async function airPeers() {
    const r = await om(['peers', '-n'], 45000);
    if (r.code === -1) return { ok: false, error: 'absent' };
    if (r.code !== 0 && !r.out.trim()) return { ok: false, error: (r.err || '').trim().split('\n').pop() || 'peers' };
    return { ok: true, peers: parsePeers(r.out) };
  }
  async function airSend({ files, peer }) {
    const list = (files || []).map((f) => String(f.path || '')).filter((p) => p && path.resolve(p).startsWith(tmpRoot + path.sep) && fs.existsSync(p));
    if (!list.length || !peer) return { ok: false, error: 'files' };
    const target = peer.addr ? ['--to', String(peer.addr)] : [String(peer.name || peer.id)];
    const r = await om(['send', ...list, ...target, '--wait', '90'], 180000);
    return r.code === 0 ? { ok: true } : { ok: false, error: (r.err || r.out).trim().split('\n').slice(-2).join('\n') || 'send' };
  }

  function stage({ name, data }) {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const d = fs.mkdtempSync(path.join(tmpRoot, 'f-'));
    const p = path.join(d, safeName(name));
    fs.writeFileSync(p, Buffer.from(data));
    return p;
  }
  function cleanTmp() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {} }
  cleanTmp();

  // ---------- Opérations demandées par Brume ----------
  async function call(op, a = {}) {
    switch (op) {
      case 'caps': return { ok: true, native: process.platform === 'darwin' && !!ShareMenu, localsend: true, airdrop: !!omPath(), kiosk: !!kiosk, platform: process.platform };
      case 'state': return { ok: true, receive: !!prefs.receive, name: prefs.name || '', alias: alias(), port: PORT, peers: peerList(), air: await airStatus() };
      case 'config': {
        if (typeof a.name === 'string') prefs.name = a.name.trim().slice(0, 60);
        if (typeof a.receive === 'boolean') prefs.receive = a.receive;
        savePrefs();
        if (prefs.receive) start();
        if (running) announce(true);
        return { ok: true, receive: prefs.receive, alias: alias() };
      }
      case 'scan': start(); announce(true); setTimeout(emitPeers, 1500); return { ok: true, peers: peerList() };
      case 'answer': { const q = asks.get(String(a.id)); if (q) { asks.delete(String(a.id)); q.resolve(!!a.accept); } return { ok: !!q }; }
      case 'stage': { const out = []; for (const f of a.files || []) out.push({ path: stage(f), name: safeName(f.name), type: String(f.type || '') }); return { ok: true, files: out }; }
      case 'send': start(); return sendLocal(a);
      case 'native': {
        if (process.platform !== 'darwin' || !ShareMenu) return { ok: false, error: 'platform' };
        const paths = (a.files || []).map((f) => String(f.path || '')).filter((p) => p.startsWith(tmpRoot) && fs.existsSync(p));
        if (!paths.length) return { ok: false, error: 'files' };
        const win = getMain(); new ShareMenu({ filePaths: paths }).popup(win ? { window: win } : {});
        return { ok: true };
      }
      case 'read': {   // un fichier reçu, pour le ranger dans Brume
        const p = path.resolve(String(a.path || ''));
        if (!p.startsWith(recvDir() + path.sep) || !fs.existsSync(p)) return { ok: false };
        const st = fs.statSync(p); if (st.size > 1024 * 1024 * 1024) return { ok: false, error: 'big' };
        const b = fs.readFileSync(p);
        return { ok: true, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), name: path.basename(p), size: st.size };
      }
      case 'show': { const p = path.resolve(String(a.path || '')); if (p.startsWith(recvDir())) shell.showItemInFolder(p); return { ok: true }; }
      case 'air-on': return airOn(a);
      case 'air-off': return airOff();
      case 'air-peers': return airPeers();
      case 'air-send': return airSend(a);
      default: return { ok: false, error: 'op' };
    }
  }
  if (prefs.receive) start();
  app.on('will-quit', () => { stop(); cleanTmp(); if (airUntil > Date.now()) om(['off'], 5000); });
  return { call, start, stop, _parsePeers: parsePeers, _me: me };
}

module.exports = { createNearby };
