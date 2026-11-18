// Mac distant : passer sur macOS, sur un Mac mini loué chez Scaleway (ou tout Mac qui partage son écran).
// - Le bureau du Mac s'affiche dans une fenêtre à part (mac/mac.html), avec noVNC : partage d'écran
//   d'Apple (VNC, connexion Apple Remote Desktop par utilisateur et mot de passe).
// - Le réseau passe par ici : la fenêtre ne choisit pas où elle se connecte, elle reçoit et envoie
//   des octets vers le Mac choisi dans Brume (une connexion TCP directe, sans relais).
// - Compte Scaleway relié (clé d'API) : la liste des Mac mini, leur adresse, leur port et leurs
//   identifiants viennent de l'API Apple silicon ; « Redémarrer » passe aussi par elle.
// - Mots de passe et clé d'API sont chiffrés par le système quand il le permet (comme le Courrier).
// - Sur le système Linux, la fenêtre prend tout l'écran ; « Revenir à Brume » la cache sans couper
//   la connexion, pour rebasculer tout de suite.
// - Le son : le partage d'écran d'Apple n'en transmet pas. Brume ouvre donc à côté une connexion SSH
//   (même utilisateur, même mot de passe), installe au besoin sur le Mac de quoi capter sa sortie son
//   (mac/son.sh : Homebrew, ffmpeg, BlackHole) et reçoit le son en Opus, que la fenêtre joue.
//   La clé du Mac est retenue à la première connexion : si elle change, Brume demande avant de continuer.
'use strict';
const tcp = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = process.env.BRUME_SCW_API || 'https://api.scaleway.com';
const ZONES = ['fr-par-1', 'fr-par-3'];   // zones où Scaleway loue des Mac mini
const CONSOLE_URL = 'https://console.scaleway.com/apple-silicon/servers';

function createMac({ app, BrowserWindow, ipcMain, safeStorage, net, clipboard, kiosk, sysEvent, getMain, dir }) {
  const DIR = dir || path.join(app.getPath('userData'), 'mac');
  let win = null, sock = null, cur = null, tcpErr = '', ping = null;
  const alive = () => !!win && !win.isDestroyed();
  const okUser = (u) => typeof u === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(u);
  const err = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

  // ---------- Ce qui est gardé, par utilisateur de Brume ----------
  const fileOf = (u) => path.join(DIR, u + '.json');
  function read(u) {
    try { const j = JSON.parse(fs.readFileSync(fileOf(u), 'utf8')); return { macs: Array.isArray(j.macs) ? j.macs : [], scw: j.scw || null, last: j.last || '', ctrlCmd: j.ctrlCmd !== false }; }
    catch (e) { return { macs: [], scw: null, last: '', ctrlCmd: true }; }
  }
  function write(u, data) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    const tmp = fileOf(u) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, fileOf(u));
  }
  function seal(s) {
    try { if (safeStorage && safeStorage.isEncryptionAvailable()) return { enc: 'safe', data: safeStorage.encryptString(String(s)).toString('base64') }; }
    catch (e) { /* brouillage simple */ }
    return { enc: 'plain', data: Buffer.from(String(s), 'utf8').toString('base64') };
  }
  function unseal(p) {
    if (!p || !p.data) return '';
    try { return p.enc === 'safe' ? safeStorage.decryptString(Buffer.from(p.data, 'base64')) : Buffer.from(p.data, 'base64').toString('utf8'); }
    catch (e) { return ''; }
  }
  const pub = (m) => ({ id: m.id, name: m.name, host: m.host, port: m.port, sshPort: m.sshPort || 22, user: m.user, source: m.source || 'manual',
    zone: m.zone || '', status: m.status || '', type: m.type || '', hasPass: !!(m.pass && m.pass.data) });
  const validHost = (h) => /^[A-Za-z0-9.-]{1,253}$/.test(h) || /^\[?[0-9A-Fa-f:.]{2,45}\]?$/.test(h);
  const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- API Scaleway (Apple silicon) ----------
  async function api(key, method, p, body) {
    let r;
    try {
      r = await net.fetch(API + p, { method, headers: { 'X-Auth-Token': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { throw err('net', e.message); }
    const text = await r.text(); let j = null;
    try { j = JSON.parse(text); } catch (e) { /* pas du JSON */ }
    if (!r.ok) throw err(r.status === 401 || r.status === 403 ? 'key' : r.status === 404 ? 'notfound' : 'api', (j && j.message) || ('HTTP ' + r.status));
    return j || {};
  }
  async function listServers(key, project) {
    const out = []; let okZones = 0, last = null;
    for (const z of ZONES) {
      try {
        for (let page = 1; page < 20; page++) {
          const j = await api(key, 'GET', `/apple-silicon/v1alpha1/zones/${z}/servers?page_size=100&page=${page}` + (project ? '&project_id=' + encodeURIComponent(project) : ''));
          okZones++;
          const s = Array.isArray(j.servers) ? j.servers : [];
          s.forEach((x) => out.push(Object.assign({ zone: z }, x)));
          if (s.length < 100) break;
        }
      } catch (e) { last = e; if (e.code === 'key' || e.code === 'net') throw e; }
    }
    if (!okZones) throw last || err('api');
    return out;
  }
  // Un Mac mini de l'API : adresse et identifiants du partage d'écran (vnc_url d'abord, sinon les champs à part)
  function fromServer(x) {
    let host = String(x.ip || ''), port = (x.vnc_port | 0) || 5900, user = String(x.ssh_username || 'm1'), pass = String(x.sudo_password || '');
    try {
      if (x.vnc_url) {
        const u = new URL(String(x.vnc_url));
        if (u.hostname) host = u.hostname.replace(/^\[|\]$/g, '');
        if (u.port) port = +u.port;
        if (u.username) user = decodeURIComponent(u.username);
        if (u.password) pass = decodeURIComponent(u.password);
      }
    } catch (e) { /* adresse illisible : on garde les champs à part */ }
    return { id: 'scw-' + x.id, source: 'scaleway', serverId: String(x.id), zone: x.zone, name: str(x.name, 80) || 'Mac mini',
      host, port, user, pass: pass ? seal(pass) : null, status: String(x.status || ''), type: String(x.type || '') };
  }
  async function syncScaleway(u, data) {
    const key = unseal(data.scw && data.scw.key); if (!key) throw err('key');
    const old = new Map(data.macs.map((m) => [m.id, m]));
    const list = (await listServers(key, data.scw.project || '')).map(fromServer);
    // ce que Brume a appris de chaque Mac (clé SSH, son) survit à la mise à jour de la liste
    list.forEach((m) => { const o = old.get(m.id); if (o) ['sshKey', 'sshPort', 'audio'].forEach((k) => { if (o[k] != null) m[k] = o[k]; }); });
    const manual = data.macs.filter((m) => m.source !== 'scaleway');
    data.macs = [...list, ...manual];
    data.scw.synced = Date.now();
    write(u, data);
    return list.length;
  }

  // ---------- Ce que Brume demande ----------
  async function brume(op, a) {
    const u = a.u; if (!okUser(u)) throw err('user');
    const data = read(u);
    const state = () => ({ ok: true, macs: data.macs.map(pub), last: data.last,
      scw: data.scw ? { linked: true, project: data.scw.project || '', synced: data.scw.synced || 0 } : { linked: false },
      session: cur && cur.u === u && alive() ? { id: cur.id, name: cur.name, visible: win.isVisible() && !win.isMinimized() } : null,
      console: CONSOLE_URL });
    if (op === 'state') return state();
    if (op === 'add' || op === 'edit') {
      const host = str(a.host, 253).replace(/^\[|\]$/g, ''), port = a.port | 0, user = str(a.user, 64), name = str(a.name, 80);
      const sshPort = a.sshPort == null || a.sshPort === '' ? 22 : a.sshPort | 0;
      if (!validHost(host)) throw err('host');
      if (port < 1 || port > 65535) throw err('port');
      if (sshPort < 1 || sshPort > 65535) throw err('ssh-port');
      if (!user) throw err('user-name');
      let m = op === 'edit' ? data.macs.find((x) => x.id === a.id && x.source !== 'scaleway') : null;
      if (op === 'edit' && !m) throw err('mac');
      if (!m) { m = { id: newId(), source: 'manual' }; data.macs.push(m); }
      if (m.host && m.host !== host) delete m.sshKey;   // un autre Mac : une autre clé
      Object.assign(m, { name: name || host, host, port, user, sshPort });
      if (typeof a.pass === 'string' && (a.pass || op === 'add')) m.pass = a.pass ? seal(a.pass.slice(0, 200)) : null;
      write(u, data);
      return Object.assign(state(), { id: m.id });
    }
    if (op === 'remove') {
      data.macs = data.macs.filter((x) => x.id !== a.id || x.source === 'scaleway');
      write(u, data);
      if (cur && cur.u === u && cur.id === a.id) close();
      return state();
    }
    if (op === 'link') {
      const key = str(a.key, 200), project = str(a.project, 80);
      if (!key) throw err('key');
      data.scw = { key: seal(key), project };
      try { await syncScaleway(u, data); }
      catch (e) { if (e.code === 'key') { data.scw = null; } throw e; }
      return state();
    }
    if (op === 'refresh') { await syncScaleway(u, data); return state(); }
    if (op === 'unlink') {
      data.scw = null; data.macs = data.macs.filter((x) => x.source !== 'scaleway');
      write(u, data);
      if (cur && cur.u === u && String(cur.id).startsWith('scw-')) close();
      return state();
    }
    if (op === 'reboot') {
      const m = data.macs.find((x) => x.id === a.id && x.source === 'scaleway'); if (!m) throw err('mac');
      const key = unseal(data.scw && data.scw.key); if (!key) throw err('key');
      await api(key, 'POST', `/apple-silicon/v1alpha1/zones/${m.zone}/servers/${encodeURIComponent(m.serverId)}/reboot`, {});
      if (cur && cur.u === u && cur.id === m.id) close();
      m.status = 'rebooting'; write(u, data);
      return state();
    }
    if (op === 'open') {
      const m = data.macs.find((x) => x.id === a.id); if (!m) throw err('mac');
      data.last = m.id; write(u, data);
      open(u, m, a.labels && typeof a.labels === 'object' ? a.labels : {}, data.ctrlCmd);
      return state();
    }
    if (op === 'show') { if (cur && cur.u === u && alive()) { show(); return state(); } throw err('session'); }
    if (op === 'hide') { hide(); return { ok: true }; }
    if (op === 'close') { if (!cur || cur.u === u || a.any) close(); return { ok: true }; }
    throw err('op');
  }
  async function call(op, args) {
    const a = args && typeof args === 'object' ? args : {};
    try {
      if (op === 'hide' && !a.u) { hide(); return { ok: true }; }
      if (op === 'close' && !a.u) { close(); return { ok: true }; }
      return await brume(String(op), a);
    } catch (e) { return { ok: false, error: e.code || 'failed', message: String(e.message || '').slice(0, 200) }; }
  }

  // ---------- La fenêtre du Mac ----------
  function show() {
    if (!alive()) return;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus(); win.webContents.focus();
  }
  function hide() {
    if (!alive()) return;
    if (kiosk) win.hide(); else win.minimize();
    const m = getMain(); if (m) m.focus();
  }
  function close() {
    if (sock) { try { sock.destroy(); } catch (e) { /* déjà fermée */ } sock = null; }
    audioClose(true);
    if (alive()) win.close();
  }
  function open(u, m, labels, ctrlCmd) {
    if (alive() && cur && cur.u === u && cur.id === m.id) { show(); return; }
    if (alive()) { const old = win; close(); if (win === old) { clearInterval(ping); ping = null; win = null; } }
    audioClose(true);
    cur = { u, id: m.id, name: m.name, host: m.host, port: m.port, user: m.user, pass: unseal(m.pass), labels, ctrlCmd,
      sshPort: m.sshPort || 22, sshKey: m.sshKey || '', audio: { on: !!(m.audio && m.audio.on), vol: m.audio && m.audio.vol >= 0 && m.audio.vol <= 1 ? m.audio.vol : 0.8 } };
    const w = win = new BrowserWindow({
      width: 1280, height: 840, minWidth: 640, minHeight: 420,
      title: m.name, backgroundColor: '#101216',
      fullscreen: kiosk, frame: !kiosk, autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, 'mac', 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false,
        autoplayPolicy: 'no-user-gesture-required' }   // le son du Mac reprend tout seul quand on revient
    });
    if (typeof win.setMenu === 'function') win.setMenu(null);
    const wc = win.webContents;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', (e) => e.preventDefault());
    // Travailler sur le Mac compte comme une activité : Brume ne se verrouille pas pendant ce temps
    let last = 0;
    wc.on('input-event', () => { const now = Date.now(); if (now - last > 4000) { last = now; sysEvent({ type: 'activity' }); } });
    ping = setInterval(() => { if (alive() && win.isVisible() && !win.isMinimized() && win.isFocused()) sysEvent({ type: 'activity' }); }, 30000);
    w.on('closed', () => {
      if (win !== w) return;   // une autre fenêtre a déjà pris la place
      clearInterval(ping); ping = null;
      if (sock) { try { sock.destroy(); } catch (e) { /* déjà fermée */ } sock = null; }
      audioClose(true);
      win = null; cur = null;
      const mw = getMain(); if (mw) mw.focus();
    });
    win.once('ready-to-show', () => { if (alive()) { win.show(); win.focus(); } });
    win.loadFile(path.join(__dirname, 'mac', 'mac.html'));
  }
  const fromMac = (e) => alive() && e.sender === win.webContents;
  const send = (type, data) => { if (alive() && !win.webContents.isDestroyed()) win.webContents.send('mac:evt', type, data); };

  // ---------- Le son du Mac (SSH à côté du partage d'écran) ----------
  // Une connexion SSH par fenêtre du Mac : le script mac/son.sh y est déposé, puis lancé pour
  // « status », « install » (le mot de passe passe par l'entrée, jamais dans la commande), « stream » et « stop ».
  let aud = null;   // { conn, ready, uploaded, connecting, stream, installing, newKey }
  const REMOTE = '"$HOME/Library/Application Support/Brume/son.sh"';
  let sonScript = null;
  const sonSh = () => sonScript || (sonScript = fs.readFileSync(path.join(__dirname, 'mac', 'son.sh'), 'utf8'));
  const sendAud = (o) => send('audio', o);
  const remoteErr = (t) => { const m = /@error ([\w-]+)/.exec(t || ''); return m ? m[1] : ''; };
  function sshCode(x) {
    const c = String((x && x.code) || ''), lvl = String((x && x.level) || '');
    if (lvl === 'client-authentication') return 'ssh-auth';
    if (lvl === 'client-timeout' || c === 'ETIMEDOUT') return 'timeout';
    if (c === 'ECONNREFUSED') return 'ssh-refused';
    if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'notfound';
    if (/^(ENETUNREACH|EHOSTUNREACH|ENETDOWN)$/.test(c)) return 'unreach';
    return 'ssh';
  }
  function saveMac(me, fields) {
    const data = read(me.u), m = data.macs.find((x) => x.id === me.id);
    if (m) { Object.assign(m, fields); write(me.u, data); }
  }
  function sshConnect() {
    if (aud && aud.conn && aud.ready) return Promise.resolve(aud.conn);
    if (aud && aud.connecting) return aud.connecting;
    const { Client } = require('ssh2');
    const me = cur, c = new Client();
    const a = aud = aud || {};
    a.connecting = new Promise((resolve, reject) => {
      let settled = false, badKey = false;
      const fin = (f, v) => { if (!settled) { settled = true; a.connecting = null; f(v); } };
      c.on('ready', () => { a.conn = c; a.ready = true; a.uploaded = false; fin(resolve, c); });
      c.on('error', (x) => fin(reject, err(badKey ? 'hostkey' : sshCode(x), x && x.message)));
      c.on('close', () => { if (a.conn === c) { a.conn = null; a.ready = false; a.uploaded = false; } fin(reject, err('ssh', 'closed')); });
      c.on('keyboard-interactive', (name, instr, lang, prompts, finish) => finish(prompts.map(() => me.pass || '')));
      try {
        c.connect({
          host: me.host, port: me.sshPort || 22, username: me.user, password: me.pass || undefined, tryKeyboard: true,
          readyTimeout: 20000, keepaliveInterval: 15000, keepaliveCountMax: 4,
          // La clé du Mac : retenue la première fois, vérifiée ensuite
          hostVerifier: (key) => {
            const fp = 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
            if (!me.sshKey) { me.sshKey = fp; saveMac(me, { sshKey: fp }); return true; }
            if (me.sshKey === fp) return true;
            badKey = true; a.newKey = fp; return false;
          }
        });
      } catch (x) { fin(reject, err('ssh', x.message)); }
    });
    return a.connecting;
  }
  function sshExec(c, cmd, o) {
    const opt = o || {};
    return new Promise((resolve, reject) => {
      c.exec(cmd, (e, st) => {
        if (e) { reject(err('ssh', e.message)); return; }
        let out = '', errText = '';
        st.on('data', (b) => { out += b; });
        st.stderr.on('data', (b) => { errText += b; if (opt.onErr) opt.onErr(String(b)); });
        st.on('close', (code) => resolve({ code, out, err: errText }));
        if (opt.input != null) st.end(opt.input); else st.end();
      });
    });
  }
  async function remote(op, o) {
    const c = await sshConnect();
    if (!aud.uploaded) {
      const r = await sshExec(c, 'mkdir -p "$HOME/Library/Application Support/Brume" && cat > ' + REMOTE + ' && chmod 700 ' + REMOTE, { input: sonSh() });
      if (r.code !== 0) throw err('ssh', r.err.slice(0, 200));
      aud.uploaded = true;
    }
    return sshExec(c, '/bin/bash ' + REMOTE + ' ' + op, o);
  }
  // Le flux : des pages Ogg Opus, envoyées telles quelles à la fenêtre
  async function startStream() {
    stopStream();
    await remote('status');   // (dépose le script si besoin)
    const a = aud;   // (la fenêtre a pu se fermer entre-temps)
    if (!a || !a.conn) throw err('ssh', 'closed');
    const c = a.conn;
    await new Promise((resolve, reject) => {
      c.exec('/bin/bash ' + REMOTE + ' stream', (e, st) => {
        if (e) { reject(err('ssh', e.message)); return; }
        const s = { st, got: 0, err: '', stopped: false, timer: 0 };
        if (aud !== a) { s.stopped = true; try { st.close(); } catch (x) { /* déjà fermé */ } resolve(); return; }
        a.stream = s;
        // Rien au bout de 25 s : le Mac attend sans doute qu'on autorise Terminal à utiliser le micro
        s.timer = setTimeout(() => { if (!s.got) { s.noData = true; try { st.close(); } catch (x) { /* déjà fermé */ } } }, 25000);
        st.on('data', (b) => {
          if (s.stopped) return;
          if (!s.got) { clearTimeout(s.timer); sendAud({ type: 'playing' }); }
          s.got += b.length;
          if (alive()) win.webContents.send('mac:aud', b);
        });
        st.stderr.on('data', (b) => { s.err += b; if (/@stream/.test(String(b)) && !s.got) sendAud({ type: 'waiting' }); });
        st.on('close', () => {
          clearTimeout(s.timer);
          if (a.stream === s) a.stream = null;
          if (!s.stopped) sendAud({ type: 'ended', error: remoteErr(s.err) || (s.got ? 'ended' : 'nosound') });
        });
        st.end();
        resolve();
      });
    });
  }
  function stopStream() {
    const s = aud && aud.stream; if (!s) return;
    s.stopped = true; aud.stream = null; clearTimeout(s.timer);
    try { s.st.close(); } catch (e) { /* déjà fermé */ }
  }
  // Fermer : le flux, puis (si demandé) remettre la sortie son d'avant sur le Mac, puis la connexion
  function audioClose(restore) {
    const a = aud; aud = null;
    if (!a) return;
    if (a.stream) { a.stream.stopped = true; clearTimeout(a.stream.timer); try { a.stream.st.close(); } catch (e) { /* déjà fermé */ } }
    const c = a.conn; if (!c) return;
    const end = () => { try { c.end(); } catch (e) { /* déjà fermée */ } };
    if (restore && a.ready && a.uploaded) { sshExec(c, '/bin/bash ' + REMOTE + ' stop').then(end, end); setTimeout(end, 4000); }
    else end();
  }
  async function audio(op) {
    const me = cur;
    try {
      if (op === 'status') {
        const r = await remote('status');
        let info = null;
        try { info = JSON.parse(String(r.out).trim().split('\n').pop()); } catch (e) { /* illisible */ }
        if (!info || typeof info !== 'object') throw err(remoteErr(r.err) || 'remote', r.err.slice(-200));
        return { ok: true, info, ready: !!(info.ffmpeg && info.switch && info.blackhole) };
      }
      if (op === 'install') {
        if (aud && aud.installing) return { ok: false, error: 'busy' };
        let buf = '';
        const onErr = (t) => {
          buf += t; const lines = buf.split(/\r?\n|\r/); buf = lines.pop();
          for (const l of lines) {
            const m = /^@step (\w+)/.exec(l);
            if (m) sendAud({ type: 'step', step: m[1] });
            else if (l.trim() && l[0] !== '@') sendAud({ type: 'log', line: l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim().slice(0, 160) });
          }
        };
        await sshConnect(); aud.installing = true;
        try {
          const r = await remote('install', { input: (me.pass || '') + '\n', onErr });
          const code = remoteErr(r.err);
          if (r.code !== 0 || code) throw err(code || 'install', r.err.slice(-300));
          return { ok: true };
        } finally { if (aud) aud.installing = false; }
      }
      if (op === 'start') { await startStream(); return { ok: true }; }
      if (op === 'stop') {
        stopStream();
        if (aud && aud.conn && aud.ready && aud.uploaded) await sshExec(aud.conn, '/bin/bash ' + REMOTE + ' stop').catch(() => {});
        return { ok: true };
      }
      if (op === 'trust') {
        if (!aud || !aud.newKey) return { ok: false, error: 'nokey' };
        me.sshKey = aud.newKey; aud.newKey = ''; saveMac(me, { sshKey: me.sshKey });
        return { ok: true };
      }
      return { ok: false, error: 'op' };
    } catch (e) {
      return { ok: false, error: e.code || 'failed', message: String(e.message || '').slice(0, 300) };
    }
  }

  ipcMain.handle('mac:init', (e) => {
    if (!fromMac(e) || !cur) return null;
    return { name: cur.name, host: cur.host, port: cur.port, user: cur.user, pass: cur.pass, labels: cur.labels, kiosk: !!kiosk, ctrlCmd: cur.ctrlCmd !== false,
      audio: Object.assign({}, cur.audio) };
  });
  // Connexion TCP vers le Mac choisi dans Brume (jamais vers une adresse donnée par la fenêtre)
  ipcMain.handle('mac:connect', (e) => {
    if (!fromMac(e) || !cur) return { ok: false };
    if (sock) { try { sock.destroy(); } catch (x) { /* déjà fermée */ } }
    tcpErr = '';
    const s = tcp.connect({ host: cur.host, port: cur.port });
    sock = s;
    s.setNoDelay(true);
    s.setTimeout(15000, () => { if (!s.connecting) return; tcpErr = 'ETIMEDOUT'; s.destroy(); });
    s.on('connect', () => { s.setTimeout(0); if (sock === s) send('open'); });
    s.on('data', (b) => { if (sock === s) send('data', b); });
    s.on('error', (x) => { tcpErr = x.code || 'ERROR'; });
    s.on('close', () => { if (sock === s) { sock = null; send('close', { error: tcpErr }); } });
    return { ok: true };
  });
  ipcMain.on('mac:send', (e, data) => {
    if (!fromMac(e) || !sock || sock.destroyed || !(data instanceof Uint8Array)) return;
    sock.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  });
  ipcMain.on('mac:disconnect', (e) => { if (fromMac(e) && sock) { try { sock.end(); sock.destroy(); } catch (x) { /* déjà fermée */ } } });
  ipcMain.on('mac:action', (e, a) => {
    if (!fromMac(e)) return;
    if (a === 'back') hide();
    else if (a === 'close') close();
    else if (a === 'fullscreen' && !kiosk) win.setFullScreen(!win.isFullScreen());
  });
  ipcMain.on('mac:pref', (e, p) => {
    if (!fromMac(e) || !cur || !p || typeof p !== 'object') return;
    const data = read(cur.u);
    if ('ctrlCmd' in p) { data.ctrlCmd = !!p.ctrlCmd; cur.ctrlCmd = data.ctrlCmd; }
    if (p.audio && typeof p.audio === 'object') {
      const vol = Number(p.audio.vol);
      cur.audio = { on: !!p.audio.on, vol: vol >= 0 && vol <= 1 ? Math.round(vol * 100) / 100 : cur.audio.vol };
      const m = data.macs.find((x) => x.id === cur.id); if (m) m.audio = Object.assign({}, cur.audio);
    }
    write(cur.u, data);
  });
  ipcMain.handle('mac:audio', (e, op) => (fromMac(e) && cur ? audio(String(op)) : { ok: false, error: 'session' }));
  // (selon la version d'Electron, readText rend le texte ou une promesse)
  ipcMain.handle('mac:clip-read', async (e) => (fromMac(e) && clipboard ? String((await clipboard.readText()) || '').slice(0, 1000000) : ''));
  ipcMain.on('mac:clip-write', (e, t) => { if (fromMac(e) && clipboard && typeof t === 'string') clipboard.writeText(t.slice(0, 1000000)); });

  return { call, hide, close, CONSOLE_URL };
}

module.exports = { createMac, ZONES };
