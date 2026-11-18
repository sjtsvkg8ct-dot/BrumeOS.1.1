// Vigie, le navigateur de Brume : ce qui doit se passer hors de la page de Brume.
// - Raccourcis du navigateur (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+F…) même quand une page web a le clavier.
// - Liens « nouvel onglet » (target=_blank, clic du milieu) : ils s'ouvrent dans un onglet de Vigie.
// - Téléchargements : enregistrés dans le dossier Téléchargements (ou là où on le demande),
//   avec leur progression ; ouvrir, afficher dans le dossier, pause, reprise, annulation.
// - Autorisations des sites : caméra, micro et position sont demandées, comme dans Chrome ; le choix
//   « toujours » est retenu par site (pas en navigation privée).
// - Effacer les données de navigation : sans toucher aux données de Brume elle-même (file://).
'use strict';
const fs = require('fs');
const path = require('path');

function createWeb({ app, session, shell, clipboard, webContents, kiosk, sysEvent, getMain }) {
  const SITES_FILE = () => path.join(app.getPath('userData'), 'vigie-sites.json');
  const DL_FILE = () => path.join(app.getPath('userData'), 'vigie-downloads.json');
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const writeJson = (f, v) => { try { fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); } catch (e) { /* disque plein */ } };
  let sites = null;                       // { origin: { camera: 'allow'|'block', microphone, geolocation } }
  const siteDb = () => (sites || (sites = readJson(SITES_FILE(), {})));
  const privSites = new WeakMap();        // session privée → décisions en mémoire
  let prefs = { ask: false };
  const pending = new Map(); let permSeq = 0;
  const downloads = []; const live = new Map(); let dlSeq = 0, dlLoaded = false;
  const isMain = (wc) => { const m = getMain(); return !!m && !!wc && wc === m.webContents; };

  // ---------- Raccourcis captés dans les pages ----------
  function keyAction(i) {
    const mod = process.platform === 'darwin' ? i.meta : i.control;
    const k = String(i.key || '').toLowerCase(), c = String(i.code || '');
    if (i.alt && !mod && !i.shift && !i.control && !i.meta) {
      if (c === 'ArrowLeft') return 'back';
      if (c === 'ArrowRight') return 'fwd';
      if (c === 'Home') return 'home';
      if (c === 'KeyD') return 'focus-url';
      if (c === 'Space') return 'sys-phare';
      if (c === 'KeyW') return 'sys-closewin';
      if (c === 'KeyM') return 'sys-min';
      if (c === 'KeyN') return 'sys-note';
      return null;
    }
    if (i.control && i.alt && !i.shift && c === 'KeyL') return 'sys-lock';
    if (!i.alt && !mod) {
      if (c === 'F5') return i.shift ? 'reload-hard' : 'reload';
      if (c === 'F6') return 'focus-url';
      if (c === 'F3') return i.shift ? 'find-prev' : 'find-next';
      if (c === 'F11') return 'fullscreen';
      if (c === 'F12') return 'devtools';
      return null;
    }
    if (!mod || i.alt) return null;
    if (c === 'Space') return 'sys-phare';
    if (/^Digit[1-9]$/.test(c) && !i.shift) return c === 'Digit9' ? 'tab-last' : 'tab-' + c.slice(5);
    if (c === 'Digit0' || c === 'Numpad0') return i.shift ? null : 'zoom-reset';
    if (k === '+' || k === '=' || c === 'NumpadAdd' || (c === 'Equal')) return 'zoom-in';
    if (k === '-' || c === 'NumpadSubtract' || c === 'Minus') return 'zoom-out';
    if (c === 'Tab') return i.shift ? 'tab-prev' : 'tab-next';
    if (c === 'PageDown') return 'tab-next';
    if (c === 'PageUp') return 'tab-prev';
    if (c === 'F5') return 'reload-hard';
    if (c === 'F4') return 'tab-close';
    if (c === 'Delete' && i.shift) return 'clear';
    if (i.shift) return ({ t: 'tab-reopen', n: 'win-private', b: 'bar', r: 'reload-hard', i: 'devtools', g: 'find-prev' })[k] || null;
    return ({ t: 'tab-new', n: 'win-new', w: 'tab-close', l: 'focus-url', d: 'bookmark', f: 'find', g: 'find-next', h: 'history',
      j: 'downloads', p: 'print', r: 'reload', u: 'source' })[k] || null;
  }
  function hookContents(contents) {
    contents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      const a = keyAction(input); if (!a) return;
      e.preventDefault();
      sysEvent({ type: 'web-key', wc: contents.id, key: a });
    });
  }
  // Un lien qui demande un nouvel onglet (target=_blank, Ctrl+clic, clic du milieu) : Vigie l'ouvre
  function newTab(contents, url, disposition) {
    if (!contents || contents.getType() !== 'webview') return false;
    if (disposition !== 'foreground-tab' && disposition !== 'background-tab') return false;
    sysEvent({ type: 'web-tab', wc: contents.id, url: String(url).slice(0, 8000), background: disposition === 'background-tab' });
    return true;
  }

  // ---------- Autorisations ----------
  function kindsOf(permission, details) {
    if (permission === 'geolocation') return ['geolocation'];
    if (permission === 'media') {
      const t = (details && details.mediaTypes) || [], k = [];
      if (t.includes('video')) k.push('camera');
      if (t.includes('audio')) k.push('microphone');
      return k.length ? k : ['camera', 'microphone'];
    }
    return null;
  }
  const originOf = (u) => { try { const x = new URL(u); return x.origin === 'null' ? '' : x.origin; } catch (e) { return ''; } };
  function dbFor(sess) {
    if (sess && !sess.isPersistent()) { if (!privSites.has(sess)) privSites.set(sess, {}); return { db: privSites.get(sess), save: () => {} }; }
    return { db: siteDb(), save: () => writeJson(SITES_FILE(), siteDb()) };
  }
  function permission(wc, permission, callback, details) {
    if (permission === 'openExternal') {
      const url = String((details && details.externalURL) || '');
      if (/^mailto:/i.test(url)) sysEvent({ type: 'open-url', url: url.slice(0, 4000) });
      return callback(false);
    }
    const kinds = kindsOf(permission, details);
    if (!kinds || !wc || wc.isDestroyed() || wc.getType() !== 'webview') return callback(true);
    const origin = originOf((details && (details.requestingUrl || details.securityOrigin)) || wc.getURL());
    if (!origin) return callback(false);
    const { db } = dbFor(wc.session);
    const st = kinds.map((k) => (db[origin] || {})[k]);
    if (st.every((x) => x === 'allow')) return callback(true);
    if (st.some((x) => x === 'block')) return callback(false);
    const id = ++permSeq;
    const timer = setTimeout(() => answer({ id, allow: false }), 120000);
    pending.set(id, { callback, origin, kinds, sess: wc.session, timer });
    sysEvent({ type: 'web-perm', id, wc: wc.id, origin, kinds });
  }
  function answer({ id, allow, remember }) {
    const p = pending.get(id); if (!p) return { ok: false };
    pending.delete(id); clearTimeout(p.timer);
    if (remember || !allow) {   // « Bloquer » est retenu, comme dans Chrome
      const { db, save } = dbFor(p.sess);
      db[p.origin] = db[p.origin] || {};
      p.kinds.forEach((k) => { db[p.origin][k] = allow ? 'allow' : 'block'; });
      save();
    }
    try { p.callback(!!allow); } catch (e) { /* page fermée */ }
    return { ok: true };
  }

  // ---------- Téléchargements ----------
  function loadDl() {
    if (dlLoaded) return; dlLoaded = true;
    const old = readJson(DL_FILE(), []);
    if (Array.isArray(old)) old.slice(0, 200).forEach((d) => {
      if (d && d.id) { if (d.state === 'progressing') d.state = 'interrupted'; downloads.push(d); dlSeq = Math.max(dlSeq, d.id | 0); }
    });
  }
  let saveT = null;
  const saveDl = () => { clearTimeout(saveT); saveT = setTimeout(() => writeJson(DL_FILE(), downloads.filter((d) => !d.priv).slice(0, 200)), 400); };
  const pub = (d) => Object.assign({}, d, { exists: d.state === 'completed' && !!d.path && fs.existsSync(d.path) });
  function uniquePath(dir, name) {
    const safe = String(name || 'telechargement').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'telechargement';
    const ext = path.extname(safe), base = safe.slice(0, safe.length - ext.length);
    let p = path.join(dir, safe), n = 1;
    while (fs.existsSync(p) || downloads.some((d) => d.path === p && d.state === 'progressing')) p = path.join(dir, `${base} (${n++})${ext}`);
    return p;
  }
  const dlDir = () => { const d = app.getPath('downloads'); try { fs.mkdirSync(d, { recursive: true }); } catch (e) { /* déjà là */ } return d; };
  function hookSession(sess) {
    if (!sess || sess.__brumeWeb) return; sess.__brumeWeb = true;
    sess.setPermissionRequestHandler(permission);
    sess.on('will-download', (_e, item, wc) => {
      if (isMain(wc)) return;   // les exports de Brume gardent leur fenêtre « Enregistrer sous »
      loadDl();
      const priv = !sess.isPersistent();
      const name = item.getFilename();
      if (kiosk || !prefs.ask) item.setSavePath(uniquePath(dlDir(), name));
      else item.setSaveDialogOptions({ defaultPath: path.join(dlDir(), name) });
      const d = { id: ++dlSeq, name, url: item.getURL().slice(0, 4000), mime: item.getMimeType(), total: item.getTotalBytes(), received: 0,
        state: 'progressing', paused: false, path: item.getSavePath(), start: Date.now(), end: 0, priv, wc: wc && !wc.isDestroyed() ? wc.id : 0 };
      downloads.unshift(d); live.set(d.id, item);
      let last = 0;
      const push = (force) => {
        const now = Date.now(); if (!force && now - last < 300) return; last = now;
        d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.paused = item.isPaused();
        const sp = item.getSavePath(); if (sp) { d.path = sp; d.name = path.basename(sp); }
        sysEvent({ type: 'web-download', d: pub(d) }); saveDl();
      };
      item.on('updated', (_x, state) => { d.state = state === 'interrupted' ? 'interrupted' : 'progressing'; push(state === 'interrupted'); });
      item.once('done', (_x, state) => { d.state = state; d.end = Date.now(); live.delete(d.id); push(true); });
      push(true);
    });
  }

  async function clearData({ cookies, cache, origin }) {
    const types = [];
    if (cookies) types.push('cookies', 'localStorage', 'indexedDB', 'serviceWorkers', 'fileSystems', 'webSQL', 'backgroundFetch');
    if (cache) types.push('cache');
    if (!types.length) return { ok: true };
    const ses = session.defaultSession;
    // Les données de Brume (sa propre page, en file://) ne sont jamais effacées
    if (typeof ses.clearData === 'function') {
      await ses.clearData(origin ? { dataTypes: types, origins: [origin] } : { dataTypes: types, excludeOrigins: ['file://'] });
    } else {
      if (cache) await ses.clearCache();
      if (cookies) await ses.clearStorageData(origin ? { origin, storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers'] } : { storages: ['cookies'] });
    }
    return { ok: true };
  }

  async function call(op, a) {
    a = a && typeof a === 'object' ? a : {};
    const find = () => downloads.find((d) => d.id === (a.id | 0));
    switch (op) {
      case 'prefs': if (typeof a.ask === 'boolean') prefs.ask = a.ask; return { ok: true, dir: dlDir(), kiosk: !!kiosk };
      case 'perm': return answer(a);
      case 'perm-list': return { ok: true, sites: siteDb() };
      case 'perm-set': {
        const db = siteDb(), o = String(a.origin || ''); if (!o) return { ok: false };
        if (a.kind) { db[o] = db[o] || {}; if (a.value === 'allow' || a.value === 'block') db[o][a.kind] = a.value; else delete db[o][a.kind]; if (!Object.keys(db[o]).length) delete db[o]; }
        else delete db[o];
        writeJson(SITES_FILE(), db); return { ok: true, sites: db };
      }
      case 'dl-list': loadDl(); return { ok: true, list: downloads.map(pub), dir: dlDir() };
      case 'dl-pause': { const it = live.get(a.id | 0); if (it) it.pause(); return { ok: !!it }; }
      case 'dl-resume': { const it = live.get(a.id | 0); if (it && it.canResume()) it.resume(); return { ok: !!it }; }
      case 'dl-cancel': { const it = live.get(a.id | 0); if (it) it.cancel(); return { ok: !!it }; }
      case 'dl-retry': { const d = find(); if (!d) return { ok: false }; session.defaultSession.downloadURL(d.url); return { ok: true }; }
      case 'dl-open': { const d = find(); if (!d || kiosk) return { ok: false }; const e = await shell.openPath(d.path); return { ok: !e, error: e }; }
      case 'dl-show': { const d = find(); if (!d || kiosk) return { ok: false }; shell.showItemInFolder(d.path); return { ok: true }; }
      case 'dl-folder': if (kiosk) return { ok: false }; await shell.openPath(dlDir()); return { ok: true };
      case 'dl-read': {
        const d = find(); if (!d || d.state !== 'completed') return { ok: false };
        const st = fs.statSync(d.path); if (st.size > 300 * 1024 * 1024) return { ok: false, error: 'big' };
        return { ok: true, name: d.name, mime: d.mime, data: new Uint8Array(fs.readFileSync(d.path)) };
      }
      case 'dl-remove': { const i = downloads.findIndex((d) => d.id === (a.id | 0)); if (i >= 0 && downloads[i].state !== 'progressing') downloads.splice(i, 1); saveDl(); return { ok: true }; }
      case 'dl-clear': for (let i = downloads.length - 1; i >= 0; i--) if (downloads[i].state !== 'progressing') downloads.splice(i, 1); saveDl(); return { ok: true };
      case 'clear': return clearData(a);
      case 'copy-image': { const wc = webContents.fromId(a.wc | 0); if (wc && wc.getType() === 'webview') wc.copyImageAt(a.x | 0, a.y | 0); return { ok: !!wc }; }
      case 'copy-text': clipboard.writeText(String(a.text || '').slice(0, 100000)); return { ok: true };
      case 'spell-add': if (a.word) session.defaultSession.addWordToSpellCheckerDictionary(String(a.word).slice(0, 80)); return { ok: true };
      case 'spell-langs': {
        try {
          const ses = session.defaultSession, av = ses.availableSpellCheckerLanguages || [];
          const want = (Array.isArray(a.langs) ? a.langs : []).filter((l) => av.includes(l));
          if (want.length) ses.setSpellCheckerLanguages(want);
        } catch (e) { /* macOS : la langue du système */ }
        return { ok: true };
      }
      default: return { ok: false, error: 'op' };
    }
  }
  return { call, hookContents, hookSession, newTab, permission };
}

module.exports = { createWeb };
