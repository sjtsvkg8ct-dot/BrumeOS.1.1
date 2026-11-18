// Calendrier, côté processus principal : les comptes de calendrier de chaque utilisateur de Brume.
//   CalDAV (iCloud, Yahoo, Fastmail, Nextcloud…), avec l'identifiant et le mot de passe d'un compte de Courrier
//   ou les siens ;  abonnements à une adresse .ics (Google « adresse secrète », Outlook « publier », etc.).
// La page compose elle-même ses requêtes WebDAV (et lit les réponses) ; ce module y ajoute l'identifiant et le mot de
// passe, et refuse toute adresse hors du site du compte. La page ne voit jamais les mots de passe, et ils ne partent
// jamais vers un autre site (ni en clair sur Internet : http seulement sur ce PC ou le réseau de la maison).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Serveurs CalDAV connus, d'après le domaine de l'adresse e-mail
const DAV = [
  { domains: ['icloud.com', 'me.com', 'mac.com'], name: 'iCloud', url: 'https://caldav.icloud.com/', appPassword: true },
  { domains: ['yahoo.com', 'yahoo.fr', 'ymail.com'], name: 'Yahoo', url: 'https://caldav.calendar.yahoo.com/', appPassword: true },
  // Google : l'ancienne adresse CalDAV, qui accepte parfois un mot de passe d'application ; sinon, l'adresse secrète iCal
  { domains: ['gmail.com', 'googlemail.com'], name: 'Gmail', url: 'https://www.google.com/calendar/dav/{email}/events/', appPassword: true, google: true },
  { domains: ['fastmail.com', 'fastmail.fm'], name: 'Fastmail', url: 'https://caldav.fastmail.com/', appPassword: true },
  { domains: ['gmx.fr', 'gmx.com', 'gmx.de', 'gmx.net'], name: 'GMX', url: 'https://caldav.gmx.net/' },
  { domains: ['web.de'], name: 'WEB.DE', url: 'https://caldav.web.de/' },
  { domains: ['mailbox.org'], name: 'mailbox.org', url: 'https://dav.mailbox.org/' },
  { domains: ['posteo.de', 'posteo.net'], name: 'Posteo', url: 'https://posteo.de:8443/' },
  { domains: ['zoho.com', 'zohomail.com', 'zohomail.eu'], name: 'Zoho', url: 'https://calendar.zoho.com/' },
  // Pas de calendrier synchronisable avec un mot de passe : l'abonnement .ics reste possible
  { domains: ['outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com'], name: 'Outlook', oauthOnly: true },
  { domains: ['orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net'], none: true }
];
const METHODS = new Set(['PROPFIND', 'REPORT', 'GET', 'PUT', 'DELETE', 'OPTIONS']);
const MAX = 25 * 1024 * 1024;
const TWO_LEVEL = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br', 'com.mx', 'co.za', 'com.ar', 'com.tr', 'com.cn', 'com.tw', 'co.in', 'co.kr']);

// Le « site » d'une adresse : le domaine enregistré (p57-caldav.icloud.com → icloud.com), ou l'hôte tel quel
function siteOf(u) {
  const h = new URL(u).hostname.toLowerCase().replace(/\.$/, '');
  if (/^[\d.]+$/.test(h) || h.includes(':') || !h.includes('.')) return h;
  const p = h.split('.');
  return TWO_LEVEL.has(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.');
}
// http n'est permis que sur ce PC ou le réseau de la maison
function localHost(u) {
  const h = new URL(u).hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home') || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '[::1]';
}
function cleanUrl(u, forDav) {
  let s = String(u || '').trim();
  // webcal:// : https sur Internet ; http pour un serveur de la maison (localhost, réseau local)
  if (/^webcals?:\/\//i.test(s)) { const rest = s.replace(/^webcals?:\/\//i, ''); s = (!/^webcals:/i.test(s) && localHost('http://' + rest) ? 'http://' : 'https://') + rest; }
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  const x = new URL(s);
  if (x.protocol !== 'https:' && x.protocol !== 'http:') throw Object.assign(new Error('url'), { code: 'url' });
  if (forDav && x.protocol === 'http:' && !localHost(x.href)) throw Object.assign(new Error('http'), { code: 'http' });
  x.hash = '';
  return x.href;
}

function createCalendar({ app, safeStorage, net, mail }) {
  const DIR = path.join(app.getPath('userData'), 'calendrier');
  const okUser = (u) => typeof u === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(u);
  const fileOf = (u) => path.join(DIR, u + '.json');
  function readUser(u) { try { return JSON.parse(fs.readFileSync(fileOf(u), 'utf8')); } catch (e) { return { accounts: [] }; } }
  function writeUser(u, data) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    const tmp = fileOf(u) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, fileOf(u));
  }
  function seal(pass) {
    try { if (safeStorage && safeStorage.isEncryptionAvailable()) return { enc: 'safe', data: safeStorage.encryptString(pass).toString('base64') }; } catch (e) { /* brouillage */ }
    return { enc: 'plain', data: Buffer.from(pass, 'utf8').toString('base64') };
  }
  function unseal(p) {
    if (!p) return '';
    if (p.enc === 'safe') return safeStorage.decryptString(Buffer.from(p.data, 'base64'));
    return Buffer.from(p.data, 'base64').toString('utf8');
  }
  const pub = (a) => ({ id: a.id, kind: a.kind, name: a.name, url: a.url, email: a.email || '', login: a.login || '', provider: a.provider || '', mailId: a.mailId || '' });
  const err = (code, detail) => Object.assign(new Error(detail || code), { code });

  // L'identifiant et le mot de passe d'un compte : les siens, ou ceux du compte de Courrier lié
  function creds(u, a) {
    if (a.mailId) {
      const c = mail && mail.credentials(u, a.mailId);
      if (!c) throw err('nomail');
      return { login: c.login, pass: c.pass };
    }
    return { login: a.login, pass: unseal(a.pass) };
  }

  // ---------- Une requête HTTP (moteur de Chrome : proxy et certificats du système) ----------
  // Les redirections sont suivies ici : l'identifiant ne suit que dans le même site.
  function once({ method, url, headers, body, auth }) {
    return new Promise((resolve, reject) => {
      let req, tries = 0, done = false;
      const end = (f, v) => { if (done) return; done = true; clearTimeout(timer); f(v); };
      try { req = net.request({ method, url, redirect: 'manual', useSessionCookies: false, cache: 'no-store' }); } catch (e) { reject(e); return; }
      for (const [k, v] of Object.entries(headers || {})) req.setHeader(k, v);
      if (auth) req.setHeader('Authorization', 'Basic ' + Buffer.from(auth.login + ':' + auth.pass, 'utf8').toString('base64'));
      // Serveur en « Digest » : Chrome calcule la réponse avec le même identifiant (une seule fois)
      req.on('login', (info, cb) => { if (auth && !tries++ && !info.isProxy) cb(auth.login, auth.pass); else cb(); });
      req.on('redirect', (status, _m, to) => { try { req.abort(); } catch (e) { /* déjà fini */ } end(resolve, { status, redirect: to }); });
      req.on('response', (r) => {
        const chunks = []; let size = 0;
        r.on('data', (c) => { size += c.length; if (size > MAX) { try { req.abort(); } catch (e) { /* fini */ } end(reject, err('size')); } else chunks.push(c); });
        r.on('end', () => end(resolve, { status: r.statusCode, headers: r.headers, text: Buffer.concat(chunks).toString('utf8') }));
        r.on('error', (e) => end(reject, e));
      });
      req.on('error', (e) => end(reject, e));
      const timer = setTimeout(() => { try { req.abort(); } catch (e) { /* fini */ } end(reject, err('timeout')); }, 25000);
      if (body != null) req.write(body);
      req.end();
    });
  }
  async function http({ method, url, headers, body, auth, site }) {
    let u = url;
    for (let i = 0; i < 6; i++) {
      const sameSite = !site || siteOf(u) === site;
      if (site && !sameSite) throw err('site');
      const r = await once({ method, url: u, headers, body, auth: sameSite ? auth : null });
      if (!r.redirect) return Object.assign(r, { url: u });
      const next = new URL(r.redirect, u).href;
      if (auth && new URL(next).protocol === 'http:' && !localHost(next)) throw err('http');
      u = next;
    }
    throw err('redirects');
  }
  const header = (r, k) => { const v = r.headers && (r.headers[k] || r.headers[k.toLowerCase()]); return Array.isArray(v) ? v[0] : (v || ''); };

  // ---------- Trouver le calendrier d'un compte ----------
  function suggest(email) {
    const domain = String(email || '').split('@')[1] || '';
    const known = DAV.find((p) => p.domains.includes(domain.toLowerCase()));
    if (known) return { provider: known.name || '', url: known.url ? known.url.replace('{email}', encodeURIComponent(email)) : '', appPassword: !!known.appPassword, oauthOnly: !!known.oauthOnly, none: !!known.none, google: !!known.google, known: true };
    return { provider: '', url: domain ? 'https://' + domain + '/.well-known/caldav' : '', appPassword: false, oauthOnly: false, none: false, google: false, known: false };
  }
  const PROBE = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/><d:resourcetype/></d:prop></d:propfind>';
  // Vérifie l'identifiant sur une adresse (et ses voisines : /.well-known/caldav, caldav.<domaine>) ; rend l'adresse qui répond
  async function probe(url, auth) {
    const tries = [url];
    if (!/\.well-known\/caldav/.test(url) && /^https?:\/\/[^/]+\/?$/.test(url)) tries.push(new URL('/.well-known/caldav', url).href);
    if (/\.well-known\/caldav/.test(url)) { const x = new URL(url); if (!x.hostname.startsWith('caldav.')) tries.push('https://caldav.' + x.hostname + '/.well-known/caldav'); }
    let last = err('nodav');
    for (const t of tries) {
      let r;
      try { r = await http({ method: 'PROPFIND', url: t, headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' }, body: PROBE, auth, site: siteOf(t) }); } catch (e) { last = e.code ? e : err('net', e.message); continue; }
      if (r.status === 401 || r.status === 403) { last = err('auth'); continue; }
      if (r.status === 207 && /current-user-principal|resourcetype/i.test(r.text)) return r.url;
      last = err('nodav', 'HTTP ' + r.status);
    }
    throw last;
  }

  async function addAccount(u, o) {
    if (!okUser(u)) throw err('user');
    const data = readUser(u), id = crypto.randomBytes(8).toString('hex');
    if (o.kind === 'ics') {
      const url = cleanUrl(o.url, false);
      const r = await http({ method: 'GET', url, headers: { Accept: 'text/calendar, */*' } });
      if (r.status === 401 || r.status === 403) throw err('auth');
      if (r.status >= 400 || !/BEGIN:VCALENDAR/i.test(r.text)) throw err('notics', 'HTTP ' + r.status);
      const m = /^X-WR-CALNAME:(.*)$/mi.exec(r.text);
      const a = { id, kind: 'ics', name: String(o.name || (m && m[1].trim()) || new URL(url).hostname).slice(0, 80), url };
      data.accounts.push(a); writeUser(u, data);
      return pub(a);
    }
    // CalDAV
    let email = String(o.email || '').trim(), login = String(o.login || '').trim(), pass = String(o.password || ''), provider = '', mailId = '';
    if (o.mailId) {
      const c = mail && mail.credentials(u, String(o.mailId));
      if (!c) throw err('nomail');
      mailId = String(o.mailId); email = c.email; login = c.login; pass = c.pass; provider = c.provider;
    }
    const sug = suggest(email);
    if (!o.url && sug.oauthOnly) throw err('oauth');
    if (!o.url && sug.none) throw err('nodav');
    const url = cleanUrl(o.url || sug.url, true);
    if (!login || !pass) throw err('invalid');
    let final;
    try { final = await probe(url, { login, pass }); } catch (e) { if (sug.google && !o.url && (e.code === 'auth' || e.code === 'nodav')) throw err('google'); throw e; }
    const a = { id, kind: 'caldav', name: String(o.name || sug.provider || email || new URL(final).hostname).slice(0, 80), url: final, email, provider: sug.provider || provider, login: mailId ? '' : login, pass: mailId ? null : seal(pass), mailId };
    data.accounts.push(a); writeUser(u, data);
    return pub(a);
  }
  function removeAccount(u, id) {
    if (!okUser(u)) return false;
    const data = readUser(u), n = data.accounts.length;
    data.accounts = data.accounts.filter((a) => a.id !== id);
    if (data.accounts.length !== n) writeUser(u, data);
    return data.accounts.length !== n;
  }
  function find(u, id) {
    if (!okUser(u)) throw err('user');
    const a = readUser(u).accounts.find((x) => x.id === id);
    if (!a) throw err('noaccount');
    return a;
  }
  // Une requête WebDAV sur le serveur d'un compte : adresse dans le même site, identifiant ajouté ici
  async function dav(u, o) {
    const a = find(u, String(o.id || ''));
    if (a.kind !== 'caldav') throw err('op');
    const method = String(o.method || '').toUpperCase();
    if (!METHODS.has(method)) throw err('op');
    const url = new URL(String(o.url || a.url), a.url).href;
    const site = siteOf(a.url);
    if (siteOf(url) !== site) throw err('site');
    if (new URL(url).protocol === 'http:' && !localHost(url)) throw err('http');
    const headers = {};
    if (o.depth != null) headers.Depth = String(o.depth);
    if (o.body != null) headers['Content-Type'] = String(o.type || 'application/xml; charset=utf-8');
    if (o.ifMatch) headers['If-Match'] = String(o.ifMatch);
    if (o.ifNoneMatch) headers['If-None-Match'] = String(o.ifNoneMatch);
    const r = await http({ method, url, headers, body: o.body != null ? String(o.body) : null, auth: creds(u, a), site });
    return { status: r.status, url: r.url, etag: header(r, 'etag'), text: method === 'DELETE' || method === 'PUT' ? '' : r.text };
  }
  async function fetchIcs(u, o) {
    const a = find(u, String(o.id || ''));
    if (a.kind !== 'ics') throw err('op');
    const r = await http({ method: 'GET', url: a.url, headers: { Accept: 'text/calendar, */*' } });
    return { status: r.status, text: r.status < 400 ? r.text : '' };
  }

  // ---------- Point d'entrée unique pour la page ----------
  const why = (e) => e.code || (/ENOTFOUND|NAME_NOT_RESOLVED/.test(String(e && e.message)) ? 'dns' : /CERT|SSL/.test(String(e && e.message)) ? 'cert' : 'net');
  async function call(op, x = {}) {
    try {
      switch (op) {
        case 'accounts': return { ok: true, value: okUser(x.user) ? readUser(x.user).accounts.map(pub) : [] };
        case 'suggest': {
          let email = String(x.email || '');
          if (x.mailId) { const c = mail && mail.credentials(x.user, String(x.mailId)); if (c) email = c.email; }
          return { ok: true, value: Object.assign(suggest(email), { email }) };
        }
        case 'add': return { ok: true, value: await addAccount(x.user, x) };
        case 'remove': return { ok: true, value: removeAccount(x.user, String(x.id || '')) };
        case 'dav': return { ok: true, value: await dav(x.user, x) };
        case 'ics': return { ok: true, value: await fetchIcs(x.user, x) };
        default: return { ok: false, error: 'op' };
      }
    } catch (e) {
      return { ok: false, error: why(e), detail: String((e && e.message) || '').slice(0, 300) };
    }
  }
  return { call };
}

module.exports = { createCalendar, siteOf, cleanUrl };
