// Icônes des apps du Comptoir : celle que chaque site publie lui-même (icône Apple, manifeste d'application web,
// icône déclarée dans la page), comme le fait Chrome quand on installe un site. Rien n'est livré avec Brume : l'icône est
// lue sur le site à la première demande, puis gardée dans userData/site-icons. Session à part, sans cookies.
'use strict';
const fs = require('fs');
const path = require('path');

const MIN = 64;                 // en dessous, l'icône serait floue : on garde celle de Brume
const MAX_BYTES = 2 * 1024 * 1024;
const TTL = 30 * 864e5;         // on relit l'icône d'un site au bout de 30 jours
const RETRY = 864e5;            // un site sans icône utilisable est réessayé le lendemain

function createSiteIcons({ app, session, fetchImpl }) {
  const dir = path.join(app.getPath('userData'), 'site-icons');
  const idxFile = path.join(dir, 'index.json');
  let idx = {};
  try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')) || {}; } catch (e) { idx = {}; }
  let ses = null;
  const sess = () => ses || (ses = session.fromPartition('brume-site-icons'));
  const doFetch = fetchImpl || ((url, opts) => sess().fetch(url, opts));
  const saveIdx = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(idxFile, JSON.stringify(idx)); } catch (e) {} };
  const waiting = new Map();
  let active = 0; const queue = [];
  const slot = () => new Promise((res) => { if (active < 4) { active++; res(); } else queue.push(res); });
  const free = () => { const n = queue.shift(); if (n) n(); else active--; };

  async function get(url, { accept = '*/*', limit = MAX_BYTES } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await doFetch(url, { headers: { accept, 'accept-language': 'fr,en;q=0.8' }, redirect: 'follow', signal: ctl.signal });
      if (!r.ok) return null;
      const len = Number(r.headers.get('content-length') || 0);
      if (len > limit) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > limit) return null;
      return { buf, type: String(r.headers.get('content-type') || '').toLowerCase(), url: r.url || url };
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  const attr = (tag, name) => { const m = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : ''; };
  const sizeOf = (s) => Math.max(0, ...String(s || '').split(/\s+/).map((x) => { if (/^any$/i.test(x)) return 512; const m = /^(\d+)x(\d+)$/i.exec(x); return m ? Math.min(+m[1], +m[2]) : 0; }));
  const abs = (href, base) => { try { const u = new URL(href.replace(/&amp;/g, '&'), base); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (e) { return null; } };

  // Les icônes candidates d'une page, de la meilleure à la moins bonne
  async function candidates(pageUrl) {
    const page = await get(pageUrl, { accept: 'text/html,application/xhtml+xml', limit: 1.5 * 1024 * 1024 });
    const base = page ? page.url : pageUrl;
    const list = [];
    if (page && /html/.test(page.type || 'html')) {
      const html = page.buf.toString('utf8');
      const bm = /<base\s[^>]*href\s*=\s*["']([^"']+)["']/i.exec(html);
      const b = bm ? abs(bm[1], base) || base : base;
      let manifest = null;
      for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
        const rel = attr(tag, 'rel').toLowerCase(), href = attr(tag, 'href');
        if (!href) continue;
        const u = abs(href, b); if (!u) continue;
        const sz = sizeOf(attr(tag, 'sizes')), svg = /svg/.test(attr(tag, 'type')) || /\.svg(\?|$)/i.test(u);
        if (/apple-touch-icon/.test(rel)) list.push({ url: u, size: sz || 180, score: (sz || 180) + 300 });
        else if (/(^|\s)(icon|shortcut icon)(\s|$)/.test(rel) || rel === 'icon') list.push({ url: u, size: svg ? 512 : (sz || 32), score: (svg ? 260 : (sz || 32)) });
        else if (/(^|\s)manifest(\s|$)/.test(rel)) manifest = u;
      }
      if (manifest) {
        const m = await get(manifest, { accept: 'application/manifest+json,application/json', limit: 512 * 1024 });
        try {
          const j = JSON.parse(m.buf.toString('utf8'));
          for (const ic of j.icons || []) {
            const u = abs(String(ic.src || ''), m.url); if (!u) continue;
            const sz = sizeOf(ic.sizes) || (/svg/.test(ic.type || '') ? 512 : 0);
            list.push({ url: u, size: sz, score: Math.min(sz, 512) + (/maskable/.test(ic.purpose || '') ? 150 : 100) });
          }
        } catch (e) {}
      }
    }
    try { const o = new URL(base).origin; list.push({ url: o + '/apple-touch-icon.png', size: 180, score: 1 }); } catch (e) {}
    const seen = new Set();
    return list.filter((c) => c.size >= MIN && !seen.has(c.url) && seen.add(c.url)).sort((a, b) => b.score - a.score);
  }

  // Taille réelle de l'image (PNG, ICO, GIF, JPEG, WebP) ; SVG : sans limite
  function dims(buf, type) {
    if (/svg/.test(type) || /^\s*(<\?xml|<svg)/.test(buf.slice(0, 200).toString('utf8'))) return 512;
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return Math.min(buf.readUInt32BE(16), buf.readUInt32BE(20));
    if (buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {
      let best = 0; const n = buf.readUInt16LE(4);
      for (let i = 0; i < n && 6 + i * 16 + 2 <= buf.length; i++) { const w = buf[6 + i * 16] || 256, h = buf[7 + i * 16] || 256; best = Math.max(best, Math.min(w, h)); }
      return best;
    }
    if (buf.length > 10 && buf.slice(0, 3).toString() === 'GIF') return Math.min(buf.readUInt16LE(6), buf.readUInt16LE(8));
    if (buf.length > 30 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
      const k = buf.slice(12, 16).toString();
      if (k === 'VP8X') return Math.min(1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
      if (k === 'VP8 ') return Math.min(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
      if (k === 'VP8L') { const b = buf.readUInt32LE(21); return Math.min((b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1); }
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      for (let i = 2; i + 9 < buf.length;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1], L = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return Math.min(buf.readUInt16BE(i + 5), buf.readUInt16BE(i + 7));
        i += 2 + L;
      }
    }
    return 0;
  }
  const mimeOf = (buf, type) => {
    if (/svg/.test(type) || /^\s*(<\?xml|<svg)/.test(buf.slice(0, 200).toString('utf8'))) return 'image/svg+xml';
    if (buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
    if (buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) return 'image/x-icon';
    if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
    if (buf.slice(0, 4).toString() === 'RIFF') return 'image/webp';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    return '';
  };
  const extOf = (m) => ({ 'image/svg+xml': 'svg', 'image/png': 'png', 'image/x-icon': 'ico', 'image/gif': 'gif', 'image/webp': 'webp', 'image/jpeg': 'jpg' })[m] || 'bin';
  const dataOf = (e) => { try { return `data:${e.mime};base64,` + fs.readFileSync(path.join(dir, e.file)).toString('base64'); } catch (er) { return null; } };

  async function fetchIcon(id, url) {
    for (const c of (await candidates(url)).slice(0, 5)) {
      const img = await get(c.url, { accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8' });
      if (!img || !img.buf.length) continue;
      const mime = mimeOf(img.buf, img.type);
      if (!mime) continue;
      const size = dims(img.buf, mime);
      if (size < MIN) continue;
      fs.mkdirSync(dir, { recursive: true });
      const file = id.replace(/[^a-z0-9_-]/gi, '_') + '.' + extOf(mime);
      fs.writeFileSync(path.join(dir, file), img.buf);
      return { file, mime, size, src: c.url };
    }
    return null;
  }

  // { id, url, fresh } → { data, size, src } ou { none: true }
  async function icon({ id, url, fresh } = {}) {
    id = String(id || ''); url = String(url || '');
    if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !/^https?:\/\//i.test(url)) return { none: true };
    const e = idx[id], now = Date.now();
    if (!fresh && e && e.url === url) {
      if (e.file && now - e.at < TTL) { const data = dataOf(e); if (data) return { data, size: e.size, src: e.src }; }
      if (e.none && now - e.at < RETRY) return { none: true };
    }
    if (waiting.has(id)) return waiting.get(id);
    const p = (async () => {
      await slot();
      try {
        const got = await fetchIcon(id, url);
        if (got) {
          if (e && e.file && e.file !== got.file) { try { fs.unlinkSync(path.join(dir, e.file)); } catch (er) {} }
          idx[id] = { url, at: Date.now(), ...got }; saveIdx();
          return { data: dataOf(idx[id]), size: got.size, src: got.src };
        }
        if (e && e.file && e.url === url) { const data = dataOf(e); if (data) return { data, size: e.size, src: e.src }; }   // hors ligne : on garde l'ancienne
        idx[id] = { url, at: Date.now(), none: true }; saveIdx();
        return { none: true };
      } finally { free(); waiting.delete(id); }
    })();
    waiting.set(id, p);
    return p;
  }
  function clear() {
    for (const e of Object.values(idx)) if (e && e.file) { try { fs.unlinkSync(path.join(dir, e.file)); } catch (er) {} }
    idx = {}; saveIdx(); return { ok: true };
  }
  return { icon, clear, _dims: dims, _candidates: candidates };
}

module.exports = { createSiteIcons };
