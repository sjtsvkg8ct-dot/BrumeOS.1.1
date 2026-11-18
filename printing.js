// Impression, côté processus principal : liste des imprimantes, impression silencieuse d'un document
// préparé par Brume (avec les réglages choisis dans sa feuille « Imprimer »), enregistrement en PDF,
// et, sur Linux, réglage des imprimantes avec CUPS (lpadmin, lpinfo, lpstat, lpoptions, cancel).
// Les commandes sont lancées sans shell, avec des arguments vérifiés.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PAPERS = ['A4', 'A3', 'A5', 'Letter', 'Legal'];
const DUPLEX = ['simplex', 'longEdge', 'shortEdge'];
const URI_RE = /^(usb|ipp|ipps|dnssd|socket|lpd|hp|ippusb):\/\/[^\s'"`<>]{1,500}$/;
// (jamais de tiret au début : ces noms passent en argument aux commandes de CUPS)
const QUEUE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,126}$/;
const JOB_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,126}-\d{1,9}$/;

function createPrinting({ BrowserWindow, getMain }) {
  const isLinux = process.platform === 'linux';
  const usesCups = isLinux || process.platform === 'darwin';
  const err = (code, detail) => { const e = new Error(detail || code); e.code = code; return e; };
  const run = (cmd, args, timeout = 15000) => new Promise((res) => {
    execFile(cmd, args, { timeout, env: Object.assign({}, process.env, { LANG: 'C', LC_ALL: 'C' }) },
      (e, stdout, stderr) => res({ ok: !e, missing: !!(e && e.code === 'ENOENT'), out: String(stdout || ''), err: String(stderr || '') }));
  });
  const denied = (r) => /forbidden|not authorized|unauthorized|not allowed|permission denied/i.test(r.err);

  // ---------- Imprimantes ----------
  async function printers() {
    const w = getMain();
    if (!w) return [];
    const list = await w.webContents.getPrintersAsync();
    let def = '';
    const states = {};
    if (usesCups) {
      const d = await run('lpstat', ['-d']);
      const m = /:\s*(\S+)\s*$/.exec(d.out.trim());
      if (d.ok && m) def = m[1];
      const p = await run('lpstat', ['-p']);
      p.out.split('\n').forEach((l) => {
        const mm = /^printer (\S+) (?:is )?(idle|now printing|disabled)/.exec(l);
        if (mm) states[mm[1]] = mm[2] === 'idle' ? 'idle' : mm[2] === 'disabled' ? 'stopped' : 'printing';
      });
    }
    return list.map((p) => {
      const o = p.options || {};
      const st = String(o['printer-state'] || '');
      return {
        // Avec CUPS, le nom affiché (« Laser du bureau ») est la description ; le nom de la file (Bureau_Laser) sert aux commandes.
        name: p.name, label: (usesCups && (o['printer-info'] || p.description)) || p.displayName || p.name, description: p.description || o['printer-info'] || '',
        location: o['printer-location'] || '', model: o['printer-make-and-model'] || '', uri: o['device-uri'] || '',
        isDefault: p.isDefault === true || o['printer-is-default'] === 'true' || (!!def && p.name === def),
        state: states[p.name] || (st === '5' ? 'stopped' : st === '4' ? 'printing' : 'idle')
      };
    });
  }

  // ---------- Impression d'un document HTML préparé par Brume ----------
  async function job(o) {
    const html = String(o.html || '');
    if (!html || html.length > 120 * 1024 * 1024) throw err('big');
    const pageSize = PAPERS.includes(o.pageSize) ? o.pageSize : 'A4';
    const file = path.join(os.tmpdir(), 'brume-impression-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.html');
    fs.writeFileSync(file, html, { mode: 0o600 });
    const win = new BrowserWindow({ show: false, width: 1000, height: 1300, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    try {
      await win.loadFile(file);
      await new Promise((r) => setTimeout(r, 400)); // polices et images
      const ranges = Array.isArray(o.pages) ? o.pages.filter((x) => x && x.from > 0 && x.to >= x.from).slice(0, 20) : [];
      if (o.pdf) {
        const buf = await win.webContents.printToPDF({
          landscape: !!o.landscape, pageSize, printBackground: true,
          pageRanges: ranges.length ? ranges.map((x) => x.from + '-' + x.to).join(',') : undefined
        });
        return { pdf: buf.toString('base64') };
      }
      const printer = String(o.printer || '');
      const known = (await win.webContents.getPrintersAsync()).some((p) => p.name === printer);
      if (!known) throw err('printer');
      const opts = {
        silent: true, printBackground: true, deviceName: printer,
        copies: Math.min(99, Math.max(1, parseInt(o.copies, 10) || 1)),
        landscape: !!o.landscape, color: o.color !== false, pageSize,
        duplexMode: DUPLEX.includes(o.duplex) ? o.duplex : 'simplex'
      };
      if (ranges.length) opts.pageRanges = ranges.map((x) => ({ from: x.from - 1, to: x.to - 1 }));
      const res = await new Promise((r) => win.webContents.print(opts, (success, reason) => r({ success, reason })));
      if (!res.success) throw err(res.reason === 'cancelled' ? 'cancelled' : 'failed', String(res.reason || ''));
      return true;
    } finally {
      win.destroy();
      fs.unlink(file, () => {});
    }
  }

  // ---------- File d'attente ----------
  async function jobs() {
    if (!usesCups) return [];
    const r = await run('lpstat', ['-o']);
    return r.out.split('\n').map((l) => {
      const m = /^(\S+-\d+)\s+(\S+)\s+(\d+)\s+(.+)$/.exec(l.trim());
      return m ? { id: m[1], printer: m[1].replace(/-\d+$/, ''), user: m[2], size: +m[3], when: m[4].trim() } : null;
    }).filter(Boolean);
  }
  async function cancel(id) {
    if (!usesCups || !JOB_RE.test(String(id))) throw err('invalid');
    const r = await run('cancel', [String(id)]);
    if (!r.ok) throw err(denied(r) ? 'forbidden' : 'cups', r.err);
    return true;
  }
  async function setDefault(name) {
    if (!usesCups || !QUEUE_RE.test(String(name))) throw err('invalid');
    const r = await run('lpoptions', ['-d', String(name)]);
    if (!r.ok) throw err('cups', r.err);
    return true;
  }

  // ---------- Réglage des imprimantes (Linux) ----------
  async function capabilities() {
    if (!isLinux) return { manage: false, cups: usesCups };
    const r = await run('lpstat', ['-r']);
    if (r.missing) return { manage: false, cups: false };
    return { manage: true, cups: true, running: /is running/.test(r.out) };
  }
  async function discover() {
    if (!isLinux) throw err('unsupported');
    const [r, v] = await Promise.all([run('lpinfo', ['-l', '-v', '--timeout', '8'], 25000), run('lpstat', ['-v'])]);
    if (!r.ok) throw err(r.missing ? 'nocups' : denied(r) ? 'forbidden' : 'cups', r.err);
    const used = new Set(v.out.split('\n').map((l) => (/:\s*(\S+)\s*$/.exec(l) || [])[1]).filter(Boolean));
    const out = [];
    let cur = null;
    for (const line of r.out.split('\n')) {
      const dev = /^Device:\s*uri\s*=\s*(\S+)/.exec(line);
      if (dev) { cur = { uri: dev[1] }; out.push(cur); continue; }
      const kv = /^\s+([a-z-]+)\s*=\s*(.*)$/.exec(line);
      if (cur && kv) cur[kv[1]] = kv[2].trim();
    }
    return out.filter((d) => URI_RE.test(d.uri) && !used.has(d.uri)).map((d) => {
      const mm = d['make-and-model'] && d['make-and-model'] !== 'Unknown' ? d['make-and-model'] : '';
      return { uri: d.uri, info: d.info || mm || d.uri, model: mm, kind: /^(usb|hp|ippusb):/.test(d.uri) ? 'usb' : 'network', location: d.location || '' };
    });
  }
  async function add(o) {
    if (!isLinux) throw err('unsupported');
    let uri = String(o.uri || '').trim();
    if (!uri && o.address) {
      // « 192.168.1.20 », « imprimante.local:631 » ou une adresse complète « ipp://hôte/chemin »
      const m = /^(?:(ipps?):\/\/)?([A-Za-z0-9.:\[\]-]{1,255})(\/[A-Za-z0-9._~\/-]{0,200})?$/i.exec(String(o.address).trim());
      if (!m) throw err('invalid');
      uri = (m[1] ? m[1].toLowerCase() : 'ipp') + '://' + m[2] + (m[3] && m[3] !== '/' ? m[3] : '/ipp/print');
    }
    if (!URI_RE.test(uri)) throw err('invalid');
    const info = String(o.info || o.address || 'Imprimante').replace(/[\x00-\x1f]/g, ' ').slice(0, 120);
    const existing = new Set((await run('lpstat', ['-e'])).out.split('\n').map((s) => s.trim()).filter(Boolean));
    const base = (info.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)) || 'Imprimante';
    let name = base, i = 2;
    while (existing.has(name)) name = base + '_' + i++;
    // Pilote : IPP Everywhere (sans pilote) pour les imprimantes qui parlent IPP, sinon le meilleur pilote installé
    let model = 'everywhere';
    if (/^(usb|socket|lpd|hp):/.test(uri)) {
      model = '';
      const mm = String(o.model || '').trim();
      if (mm) {
        const m = await run('lpinfo', ['--make-and-model', mm, '-m'], 20000);
        const first = m.out.split('\n').map((l) => l.trim().split(/\s+/)[0]).find((x) => x && !/^(raw|everywhere)$/.test(x));
        if (first) model = first;
      }
      if (!model) throw err('driver');
    }
    const r = await run('lpadmin', ['-p', name, '-E', '-v', uri, '-m', model, '-D', info, '-o', 'printer-is-shared=false'], 60000);
    if (!r.ok) {
      // lpadmin laisse parfois une file à moitié créée : on la retire
      if (!denied(r) && (await run('lpstat', ['-v', name])).ok) await run('lpadmin', ['-x', name]);
      throw err(denied(r) ? 'forbidden'
        : /unable to (query|connect)|host is down|not responding|bad device-uri|could not|connection refused|timed out/i.test(r.err) ? 'unreachable'
        : /unable to create ppd|does not support required ipp/i.test(r.err) ? 'driver' : 'cups', r.err);
    }
    await run('cupsenable', [name]);
    await run('cupsaccept', [name]);
    // Ajoutée par son adresse : on lui donne le nom de son modèle, plus parlant qu'une adresse IP
    let label = info;
    if (!o.uri && (!o.info || o.info === o.address)) {
      const p = await run('lpoptions', ['-p', name]);
      const mm = /printer-make-and-model='([^']{1,120})'|printer-make-and-model=(\S{1,120})/.exec(p.out);
      const model = mm ? (mm[1] || mm[2]).replace(/\\(.)/g, '$1').replace(/[\x00-\x1f]/g, ' ').replace(/\s+-\s+IPP Everywhere$/i, '').trim() : '';
      if (model && !/^(unknown|printer|local raw printer)$/i.test(model)) {
        label = model;
        await run('lpadmin', ['-p', name, '-D', label]);
      }
    }
    return { name, info: label };
  }
  async function remove(name) {
    if (!isLinux || !QUEUE_RE.test(String(name))) throw err('invalid');
    const r = await run('lpadmin', ['-x', String(name)]);
    if (!r.ok) throw err(denied(r) ? 'forbidden' : 'cups', r.err);
    return true;
  }

  // ---------- Point d'entrée unique pour la page ----------
  async function call(op, args) {
    const x = args || {};
    try {
      switch (op) {
        case 'printers': return { ok: true, value: await printers() };
        case 'capabilities': return { ok: true, value: await capabilities() };
        case 'job': return { ok: true, value: await job(x) };
        case 'jobs': return { ok: true, value: await jobs() };
        case 'cancel': return { ok: true, value: await cancel(x.id) };
        case 'default': return { ok: true, value: await setDefault(x.name) };
        case 'discover': return { ok: true, value: await discover() };
        case 'add': return { ok: true, value: await add(x) };
        case 'remove': return { ok: true, value: await remove(x.name) };
        default: return { ok: false, error: 'op' };
      }
    } catch (e) {
      return { ok: false, error: (e && e.code) || 'failed', detail: String((e && e.message) || '').slice(0, 300) };
    }
  }
  return { call };
}

module.exports = { createPrinting };
