// Brume OS — application de bureau (Electron)
// Charge index.html dans une fenêtre et autorise les vues web de Vigie.
// En mode système (image Linux), Brume occupe tout l'écran, règle le Wi-Fi,
// le Bluetooth, éteint la machine et peut ouvrir l'installateur.
// `components` n'existe que dans l'Electron de castlabs, qui sait lire les contenus protégés (Widevine).
const { app, BaseWindow, BrowserWindow, WebContentsView, Menu, shell, ipcMain, powerMonitor, safeStorage, session, net: electronNet, components, clipboard, ClipboardItem, nativeImage, webContents } = require('electron');
const { execFile } = require('child_process');
const { createMail } = require('./mail');
const { createPrinting } = require('./printing');
const { createGame } = require('./game');
const { createDisplay } = require('./display');
const { createMac } = require('./mac');
const { createWeb } = require('./web');
const { createHardware } = require('./hardware');
const { createSiteIcons } = require('./siteicons');
const { createNearby } = require('./nearby');
const { createSecurity } = require('./security');
const { createVolume } = require('./volume');
const { createCalendar } = require('./calendar');
const fs = require('fs');
const path = require('path');
const { createStore, liveInfo, diskInfo, createNetwork, createBluetooth } = require('./system');

const KIOSK = process.env.BRUME_KIOSK === '1' || process.argv.includes('--brume-kiosk');
const LIVE = KIOSK ? liveInfo() : { live: false, persistent: false };
let mainWindow = null;

// Le dernier essai de l'installateur (posé par brume-session quand il se ferme) : code de sortie et fin du journal.
function readInstaller() {
  if (!KIOSK || !LIVE.live || !process.env.XDG_RUNTIME_DIR) return null;
  const dir = process.env.XDG_RUNTIME_DIR, res = path.join(dir, 'brume-install-result'), log = path.join(dir, 'brume-installer.log');
  try {
    const m = /status=(\d+)/.exec(fs.readFileSync(res, 'utf8'));
    fs.unlinkSync(res);
    if (!m) return null;
    let tail = '';
    try { tail = fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.trim()).slice(-14).join('\n').slice(-3000); } catch (e) { /* pas de journal */ }
    return { code: +m[1], log: tail };
  } catch (e) { return null; }
}
const INSTALLER = readInstaller();

// Langue et clavier choisis dans Brume (Réglages › Langue et région).
const LANG_OK = ['fr', 'en', 'es', 'de', 'it', 'pt'];
const KB_OK = ['fr', 'be', 'ch', 'us', 'gb', 'es', 'de', 'it', 'pt'];
const prefsFile = () => path.join(app.getPath('userData'), 'system.json');
function readPrefs() {
  try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) || {}; } catch (e) { return {}; }
}
const prefs = readPrefs();
// La langue de Chromium règle aussi la langue demandée aux sites ouverts dans Vigie.
if (LANG_OK.includes(prefs.lang)) app.commandLine.appendSwitch('lang', prefs.lang);

// Vigie se présente aux sites comme Chrome, sans les mentions « Electron » ni « Brume » :
// certains sites (Apple Music, connexions à un compte…) refusent les navigateurs qu'ils ne connaissent pas.
const UA_OS = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
  : process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : 'X11; Linux x86_64';
app.userAgentFallback = `Mozilla/5.0 (${UA_OS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome.split('.')[0]}.0.0.0 Safari/537.36`;

// Fichiers, comptes et réglages de Brume : sur le disque, sans limite de taille.
const store = createStore(path.join(app.getPath('userData'), 'donnees'), {
  onError: (e) => console.error('Brume : enregistrement impossible :', e.message)
});
// Ce qu'il faut arrêter avant de quitter : les processus que Brume a lancés et qui tourneraient sans fin
// (pactl qui écoute le son…). Sur le système Linux, la session attend qu'ils soient tous partis :
// un seul oublié, et l'écran resterait noir au lieu d'ouvrir l'installateur ou de relancer Brume.
const exitHooks = [];
function quitNow(code = 0) {
  for (const f of exitHooks) { try { f(); } catch (e) { /* on quitte quand même */ } }
  store.flushSync();
  app.exit(code);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Brume OS',
    backgroundColor: '#11151b',
    fullscreen: KIOSK,
    frame: !KIOSK,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,        // nécessaire pour les onglets du vrai Web dans Vigie
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Les liens « nouvel onglet » de Brume lui-même s'ouvrent dans le navigateur du système.
  // En mode système, il n'y a pas d'autre navigateur : le lien est ignoré.
  // Un lien qui voudrait ouvrir une fenêtre (dans un e-mail, par exemple) s'ouvre dans Brume :
  // les pages web dans Vigie, les adresses « mailto: » dans Courrier.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) sysEvent({ type: 'open-url', url: String(url).slice(0, 4000) });
    return { action: 'deny' };
  });
  mainWindow.on('close', () => store.flushSync());
  mainWindow.on('closed', () => { mainWindow = null; game.close(); mac.close(); });
}

// Sur Windows et Linux, pas de barre de menus : Alt reste libre pour les raccourcis de Brume.
if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

// Seule la page de Brume parle au système, jamais les sites ouverts dans Vigie.
const fromBrume = (event) => !!mainWindow && event.sender === mainWindow.webContents;

// Ce que la page peut demander au système (voir preload.js).
ipcMain.on('brume:info', (event) => {
  event.returnValue = fromBrume(event) ? { kiosk: KIOSK, live: LIVE.live, persistent: LIVE.persistent, installer: INSTALLER } : {};
});
ipcMain.on('brume:kiosk', (event) => { event.returnValue = KIOSK; });
ipcMain.on('brume:store-load', (event) => {
  event.returnValue = fromBrume(event) ? store.load() : null;
});
ipcMain.on('brume:store-set', (event, k, v) => {
  if (fromBrume(event)) store.set(k, v);
});
ipcMain.on('brume:disk', (event) => {
  event.returnValue = fromBrume(event) ? diskInfo(store.dir) || diskInfo(app.getPath('userData')) : null;
});
ipcMain.on('brume:prefs', (event, p) => {
  if (!fromBrume(event) || !p || typeof p !== 'object') return;
  const next = readPrefs();
  if (LANG_OK.includes(p.lang)) next.lang = p.lang;
  if (KB_OK.includes(p.keyboard)) next.keyboard = p.keyboard;
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(next));
    // Le système Linux lit la disposition du clavier avant chaque lancement de Brume.
    if (KIOSK && next.keyboard) {
      const envFile = path.join(app.getPath('home'), '.config', 'brume-os', 'session.env');
      fs.mkdirSync(path.dirname(envFile), { recursive: true });
      fs.writeFileSync(envFile, `XKB_DEFAULT_LAYOUT=${next.keyboard}\n`);
    }
  } catch (e) { /* le réglage s'appliquera au prochain essai */ }
  if (p.restart) {
    setTimeout(() => {
      if (!KIOSK) app.relaunch();   // en mode système, la session relance Brume elle-même
      quitNow(0);
    }, 150);
  }
});
ipcMain.on('brume:power', (event, action, lang) => {
  if (!fromBrume(event)) return;
  if (action !== 'poweroff' && action !== 'reboot') return;
  // Application (Mac, Windows, Linux) : Éteindre ferme Brume, après son écran d'arrêt.
  if (!KIOSK) {
    if (action === 'poweroff') quitNow(0);
    return;
  }
  store.flushSync();
  // L'écran d'arrêt du système (thème Plymouth « brume ») dans la langue de Brume :
  // /usr/local/sbin/brume-arret lit ce fichier au début de l'extinction.
  try {
    const f = path.join(app.getPath('home'), '.config', 'brume-os', 'arret');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, `LANG=${LANG_OK.includes(lang) ? lang : 'fr'}\n`);
  } catch (e) { /* l'écran du système restera en français */ }
  execFile('sudo', ['-n', '/usr/bin/systemctl', action], (err) => {
    if (err) execFile('/usr/bin/systemctl', [action], () => {});
  });
});

// Installation sur le disque (seulement depuis la clé USB) : Brume se ferme et
// la session ouvre l'installateur à sa place (voir /usr/local/bin/brume-session).
// Au retour, la session laisse le résultat : s'il s'est arrêté sur une erreur, Brume le dit.
ipcMain.on('brume:install', (event, o) => {
  if (!KIOSK || !LIVE.live || !fromBrume(event)) return;
  const lang = LANG_OK.includes(o && o.lang) ? o.lang : 'fr';
  const keep = o && o.keep === false ? 0 : 1;
  const flag = path.join(process.env.XDG_RUNTIME_DIR || '/tmp', 'brume-install');
  try {
    fs.writeFileSync(flag, `LANG=${lang}\nKEEP=${keep}\n`, { mode: 0o600 });
  } catch (e) {
    event.sender.send('brume:install-failed');
    return;
  }
  setTimeout(() => quitNow(0), 400);
});

// Wi-Fi : seulement en mode système, où Brume est le seul bureau.
const net = KIOSK ? createNetwork() : null;
let lastNet = '';
async function pushNet(force) {
  if (!net || !mainWindow || (!force && net.busy())) return;
  try {
    const st = await net.status();
    const s = JSON.stringify(st);
    if ((force || s !== lastNet) && mainWindow) { lastNet = s; mainWindow.webContents.send('brume:net-change', st); }
  } catch (e) { /* NetworkManager redémarre peut-être */ }
}
ipcMain.handle('brume:net', async (event, op, arg) => {
  if (!net || !fromBrume(event)) return { available: false };
  let res;
  if (op === 'status') res = await net.status();
  else if (op === 'scan') res = await net.scan(arg === true);
  else if (op === 'connect') res = await net.connect(arg && typeof arg === 'object' ? { ssid: arg.ssid, password: arg.password, hidden: !!arg.hidden } : {});
  else if (op === 'disconnect') res = await net.disconnect();
  else if (op === 'forget') res = await net.forget(arg);
  else if (op === 'radio') res = await net.radio(arg === true);
  else return { ok: false, error: 'invalid' };
  if (op !== 'status' && op !== 'scan') setTimeout(() => pushNet(true), 300);
  return res;
});
if (net) setInterval(() => pushNet(false), 6000);

// Bluetooth : seulement en mode système. Les questions d'association (code à confirmer,
// code PIN…) sont posées dans Brume, qui renvoie la réponse.
const btAsks = new Map();
function btAsk(q) {
  return new Promise((resolve) => {
    if (!mainWindow) { resolve(null); return; }
    btAsks.set(q.id, resolve);
    mainWindow.webContents.send('brume:bt-prompt', q);
  });
}
function btShow(m) {
  if (m.type === 'close' && m.id === 0) { for (const r of btAsks.values()) r(null); btAsks.clear(); }
  if (mainWindow) mainWindow.webContents.send('brume:bt-prompt', m);
}
ipcMain.on('brume:bt-answer', (event, id, value) => {
  if (!fromBrume(event)) return;
  const r = btAsks.get(id);
  if (!r) return;
  btAsks.delete(id);
  const t = typeof value;
  r(t === 'boolean' || t === 'number' || (t === 'string' && value.length <= 16) ? value : null);
});
const bt = KIOSK ? createBluetooth({ ask: btAsk, show: btShow }) : null;
let lastBt = '';
let btDelay = 5000;
async function pushBt(force) {
  if (!bt || !mainWindow) return;
  try {
    const st = await bt.status();
    btDelay = !st.available ? 15000 : (st.adapter && st.adapter.discovering) || bt.pairing() ? 2000 : 5000;
    const s = JSON.stringify(st);
    if ((force || s !== lastBt) && mainWindow) { lastBt = s; mainWindow.webContents.send('brume:bt-change', st); }
  } catch (e) { /* BlueZ redémarre peut-être */ }
}
const BT_OPS = ['power', 'scan', 'pair', 'connect', 'disconnect', 'forget', 'cancel'];
ipcMain.handle('brume:bt', async (event, op, arg) => {
  if (!bt || !fromBrume(event)) return { available: false };
  if (op === 'status') return bt.status();
  if (!BT_OPS.includes(op)) return { ok: false, error: 'invalid' };
  const res = await bt[op](op === 'power' || op === 'scan' ? arg === true : String(arg || ''));
  setTimeout(() => pushBt(true), 300);
  return res;
});
if (bt) (function loop() { pushBt(false).finally(() => setTimeout(loop, btDelay)); })();

app.on('web-contents-created', (_event, contents) => {
  // Les pages affichées dans Vigie n'ont jamais accès à Node.js ni au système.
  contents.on('will-attach-webview', (_e, webPreferences) => {
    // Seul préchargement permis : celui de Brume, qui relaie les notifications des sites.
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(__dirname, 'webview-preload.js');
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
  });
  if (contents.getType() === 'webview') {
    webWindowRules(contents);
    if (web) web.hookContents(contents);   // raccourcis du navigateur, même quand la page a le clavier
    // Ce qu'on fait dans une page de Vigie compte comme activité (verrouillage automatique),
    // et une vidéo qui joue empêche le verrouillage.
    let last = 0;
    contents.on('input-event', () => {
      const now = Date.now();
      if (now - last > 4000) { last = now; sysEvent({ type: 'activity' }); }
    });
    contents.on('media-started-playing', () => sysEvent({ type: 'media', playing: true }));
    contents.on('media-paused', () => sysEvent({ type: 'media', playing: false }));
    contents.on('destroyed', () => sysEvent({ type: 'media', playing: false }));
  }
});

// Dans un onglet de Vigie, un lien qui ouvrirait un onglet s'ouvre dans le même onglet.
// Une vraie fenêtre surgissante (window.open avec une taille, comme « Se connecter avec Apple »)
// s'ouvre en petite fenêtre au-dessus de Brume : la page qui l'a ouverte reçoit la réponse,
// puis la fenêtre se ferme d'elle-même. `parent` donne la fenêtre au-dessus de laquelle elle s'ouvre
// (Brume, ou la fenêtre de GeForce NOW).
function webWindowRules(contents, parent) {
  contents.setWindowOpenHandler(({ url, disposition, features }) => {
    if (!/^https?:/i.test(url)) return { action: 'deny' };
    if (disposition === 'new-window') {
      const f = {};
      String(features || '').split(',').forEach((kv) => { const [k, v] = kv.split('='); if (k && v) f[k.trim()] = parseInt(v, 10); });
      const size = (v, def, min, max) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : def));
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: (parent ? parent() : mainWindow) || undefined,
          width: size(f.width, 520, 360, 1100),
          height: size(f.height, 700, 420, 900),
          minimizable: false,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
        }
      };
    }
    // Vigie : un lien « nouvel onglet » (target=_blank, Ctrl+clic, clic du milieu) ouvre un onglet
    if (web && web.newTab(contents, url, disposition)) return { action: 'deny' };
    contents.loadURL(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (win) => {
    win.setMenu(null);
    webWindowRules(win.webContents, parent);
  });
}

function sysEvent(ev) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('brume:sys-event', ev);
}

// ---------- Lecture protégée (Widevine) ----------
// Apple Music, Netflix ou Spotify chiffrent leurs morceaux et leurs vidéos. L'Electron de castlabs
// les lit avec le module Widevine de Google, qui n'est pas inclus dans Brume : le service de
// composants le télécharge au premier lancement connecté à Internet, puis le tient à jour.
// Sur Linux, un module installé pendant la session ne sert qu'après un redémarrage de Brume.
// États : none (Electron sans Widevine), waiting (pas encore installé), ready, restart.
const CDM_DIR = () => path.join(app.getPath('userData'), 'WidevineCdm');
const CDM_MARK = () => path.join(app.getPath('userData'), 'widevine.json');
let drm = { state: components ? 'waiting' : 'none' };
let drmKnown = false, drmBusy = false, drmTimer = null, drmDelay = 30000;
function drmSet(state) {
  if (drm.state === state) return;
  drm = { state };
  sysEvent({ type: 'drm', state });
}
async function drmInstall() {
  if (!components || drmBusy || drm.state === 'ready' || drm.state === 'restart') return;
  drmBusy = true;
  clearTimeout(drmTimer);
  try {
    await components.whenReady([components.WIDEVINE_CDM_ID]);
    const st = components.status()[components.WIDEVINE_CDM_ID] || {};
    try { fs.writeFileSync(CDM_MARK(), JSON.stringify({ version: st.version || '', at: Date.now() })); } catch (e) { /* sans importance */ }
    drmSet(!drmKnown && process.platform === 'linux' ? 'restart' : 'ready');
  } catch (e) {
    // Hors ligne, le plus souvent : on réessaie plus tard (et dès que la page signale le retour du réseau).
    drmTimer = setTimeout(drmInstall, drmDelay);
    drmDelay = Math.min(drmDelay * 2, 10 * 60 * 1000);
  } finally {
    drmBusy = false;
  }
}
ipcMain.handle('brume:drm', (event, op) => {
  if (!fromBrume(event)) return 'none';
  if (op === 'retry' && drm.state === 'waiting') { drmDelay = 30000; drmInstall(); }
  return drm.state;
});

// ---------- Impression (voir printing.js) ----------
const printing = createPrinting({ BrowserWindow, getMain: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null) });
ipcMain.handle('brume:print', async (event, op, args) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  return printing.call(String(op), args && typeof args === 'object' ? args : {});
});

// ---------- Écran : résolution et taille des éléments (voir display.js) ----------
const display = createDisplay({
  kiosk: KIOSK,
  file: path.join(app.getPath('userData'), 'ecran.json'),
  // Application : la résolution se règle dans le système, dont on ouvre les réglages d'affichage
  openSettings: () => {
    const url = process.platform === 'win32' ? 'ms-settings:display'
      : process.platform === 'darwin' ? 'x-apple.systempreferences:com.apple.preference.displays' : null;
    if (!url) return false;
    shell.openExternal(url).catch(() => {});
    return true;
  },
  log: (m) => console.warn(m)
});
ipcMain.handle('brume:display', (event, op, args) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  return display.call(String(op), args && typeof args === 'object' ? args : {});
});

// ---------- GeForce NOW : le jeu en nuage, dans sa propre fenêtre (voir game.js) ----------
const game = createGame({
  BaseWindow, WebContentsView, kiosk: KIOSK, sysEvent, webWindowRules,
  getMain: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)
});
ipcMain.handle('brume:game', (event, op, args) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  return game.call(String(op), args && typeof args === 'object' ? args : {});
});

// ---------- Mac distant : macOS sur un Mac mini Scaleway, dans sa propre fenêtre (voir mac.js) ----------
const mac = createMac({
  app, BrowserWindow, ipcMain, safeStorage, net: electronNet, clipboard, kiosk: KIOSK, sysEvent,
  getMain: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)
});
ipcMain.handle('brume:mac', (event, op, args) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  return mac.call(String(op), args && typeof args === 'object' ? args : {});
});

// ---------- Cet appareil : processeur, mémoire, carte graphique, écrans, disques… (voir hardware.js) ----------
let hardware = null;
ipcMain.handle('brume:hw', async (event, fresh) => {
  if (!fromBrume(event)) return null;
  if (!hardware) {
    hardware = createHardware({ app, screen: require('electron').screen, kiosk: KIOSK, live: { live: LIVE.live, persistent: LIVE.persistent },
      diskInfo: () => diskInfo(store.dir) || diskInfo(app.getPath('userData')) });
  }
  try { return await hardware.info(fresh === true); } catch (e) { return null; }
});

// ---------- Partage à proximité : LocalSend, AirDrop (omdrop, système Linux), menu de partage de macOS (voir nearby.js) ----------
let nearby = null;
const getNearby = () => nearby || (nearby = createNearby({ app, shell, ShareMenu: require('electron').ShareMenu, kiosk: KIOSK, sysEvent,
  getMain: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null) }));
ipcMain.handle('brume:nearby', async (event, op, args) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  try { return await getNearby().call(String(op), args && typeof args === 'object' ? args : {}); } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});

// ---------- Comptoir : l'icône que chaque site publie (voir siteicons.js) ----------
let siteIcons = null;
ipcMain.handle('brume:siteicon', async (event, req) => {
  if (!fromBrume(event)) return null;
  if (!siteIcons) siteIcons = createSiteIcons({ app, session });
  try { return req && req.clear ? siteIcons.clear() : await siteIcons.icon(req && typeof req === 'object' ? req : {}); } catch (e) { return { none: true }; }
});

// ---------- Vigie : téléchargements, autorisations des sites, données de navigation (voir web.js) ----------
let web = null;
app.on('session-created', (s) => { if (web) web.hookSession(s); });
ipcMain.handle('brume:web', async (event, op, args) => {
  if (!fromBrume(event) || !web) return { ok: false, error: 'op' };
  try { return await web.call(String(op), args && typeof args === 'object' ? args : {}); }
  catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 200) }; }
});

// ---------- Sécurité : mises à jour de Brume, pare-feu, chiffrement (voir security.js) ----------
let security = null;
ipcMain.handle('brume:security', async (event, op) => {
  if (!fromBrume(event) || !security) return { ok: false, error: 'op' };
  // Système Linux : une nouvelle version de Brume est installée, on redémarre Brume (la session le relance)
  if (op === 'restart') { if (KIOSK) setTimeout(() => quitNow(0), 300); return { ok: KIOSK }; }
  return security.call(String(op));
});

// ---------- Volume (système Linux) : voir volume.js ----------
// La page règle le volume ; les touches du clavier le règlent où que soit le clavier (Brume, un onglet de Vigie,
// GeForce NOW), et la page affiche alors l'indicateur. Ailleurs (application), le volume est celui de l'ordinateur.
const volume = KIOSK ? createVolume({ onChange: (st) => sysEvent({ type: 'volume', state: st }), log: (m) => console.warn(m) }) : null;
ipcMain.handle('brume:volume', async (event, op, args) => {
  if (!fromBrume(event) || !volume) return { ok: false, error: 'op' };
  return volume.call(String(op), args && typeof args === 'object' ? args : {});
});
if (volume) {
  const VOL_KEYS = { AudioVolumeUp: 1, AudioVolumeDown: -1, AudioVolumeMute: 0 };
  app.on('web-contents-created', (_e, contents) => {
    contents.on('before-input-event', (ev, input) => {
      if (input.type !== 'keyDown' || !(input.key in VOL_KEYS)) return;
      ev.preventDefault();
      const dir = VOL_KEYS[input.key];
      const job = dir ? volume.call('step', { dir, fine: !!(input.shift && input.alt) }) : volume.call('mute', {});
      job.then((st) => sysEvent({ type: 'volume', state: st, show: true, key: input.key, repeat: !!input.isAutoRepeat })).catch(() => {});
    });
  });
  app.whenReady().then(() => volume.watch());
  app.on('will-quit', () => volume.stop());
  exitHooks.push(() => volume.stop());
}

// ---------- Capture d'écran ----------
// 'shot' : l'image de la fenêtre de Brume, telle qu'à l'écran (onglets de Vigie compris), en PNG.
// 'copy' : une image PNG (venue de la page) dans le presse-papiers du système.
ipcMain.handle('brume:capture', async (event, op, data) => {
  if (!fromBrume(event)) return { ok: false, error: 'op' };
  try {
    if (op === 'shot') {
      const img = await event.sender.capturePage();
      if (img.isEmpty()) return { ok: false, error: 'vide' };
      return { ok: true, png: img.toPNG() };
    }
    if (op === 'copy' && data instanceof Uint8Array && data.length < 80 * 1024 * 1024) {
      const img = nativeImage.createFromBuffer(Buffer.from(data));
      if (img.isEmpty()) return { ok: false, error: 'image' };
      // Electron récent : presse-papiers asynchrone, comme celui du Web ; avant : writeImage
      if (typeof clipboard.writeImage === 'function') clipboard.writeImage(img);
      else await clipboard.write([new ClipboardItem({ 'image/png': new Blob([img.toPNG()], { type: 'image/png' }) })]);
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  return { ok: false, error: 'op' };
});

// ---------- Courrier : comptes de messagerie (voir mail.js) ----------
let mail = null;
ipcMain.handle('brume:mail', async (event, op, args) => {
  if (!fromBrume(event) || !mail) return { ok: false, error: 'op' };
  return mail.call(String(op), args && typeof args === 'object' ? args : {});
});
app.on('before-quit', () => { if (mail) mail.closeAll(); });

// ---------- Calendrier : comptes CalDAV et abonnements .ics (voir calendar.js) ----------
let calendar = null;
ipcMain.handle('brume:calendar', async (event, op, args) => {
  if (!fromBrume(event) || !calendar) return { ok: false, error: 'op' };
  return calendar.call(String(op), args && typeof args === 'object' ? args : {});
});

app.whenReady().then(() => {
  mail = createMail({ app, safeStorage, net: electronNet, sysEvent });
  calendar = createCalendar({ app, safeStorage, net: electronNet, mail });
  security = createSecurity({ app, net: electronNet, shell, kiosk: KIOSK, live: LIVE.live, sysEvent,
    repo: process.env.BRUME_DEPOT || require('./package.json').brumeRepo });
  // Les autres protocoles (mailto:, whatsapp:…) ne lancent pas de logiciel extérieur :
  // une adresse « mailto: » ouvre un nouveau message dans Courrier, le reste est ignoré.
  // Toutes les autres permissions restent accordées, comme avant.
  // Vigie : autorisations demandées (caméra, micro, position), téléchargements ; aussi pour les
  // fenêtres de navigation privée, dont la session est créée à la volée (voir web.js)
  web = createWeb({ app, session, shell, clipboard, webContents, kiosk: KIOSK, sysEvent, getMain: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null) });
  getNearby();   // si la réception LocalSend est activée, elle reprend tout de suite
  web.hookSession(session.defaultSession);
  if (components) {
    // Le module déjà présent au lancement est chargé avec Brume : il fonctionne tout de suite.
    drmKnown = fs.existsSync(path.join(CDM_DIR(), 'latest-component-updated-widevine-cdm')) || fs.existsSync(CDM_MARK());
  }
  // Système Linux : la résolution gardée dans Réglages › Écran
  if (KIOSK) display.restore().catch(() => {});
  createWindow();
  drmInstall();
  // L'ordinateur se met en veille (couvercle fermé…) : Brume se verrouille.
  powerMonitor.on('suspend', () => sysEvent({ type: 'suspend' }));
  powerMonitor.on('lock-screen', () => sysEvent({ type: 'suspend' }));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Rien ne se perd à la fermeture, ni quand le système s'éteint.
app.on('before-quit', () => store.flushSync());
app.on('will-quit', () => store.flushSync());
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => quitNow(0));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
