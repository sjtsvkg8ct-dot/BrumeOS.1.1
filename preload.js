// Pont minimal entre la page de Brume et le système.
// La page ne reçoit que ces éléments, jamais Node.js.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('brume:info') || {};
const kiosk = info.kiosk === true;

// Stockage sur disque : la page lit tout au démarrage, puis chaque modification
// est envoyée au processus principal, qui l'écrit dans un fichier.
const data = ipcRenderer.sendSync('brume:store-load');
const own = (k) => Object.prototype.hasOwnProperty.call(data, k);
const storage = data && typeof data === 'object' ? {
  get: (k) => (own(String(k)) ? data[String(k)] : null),
  set: (k, v) => {
    k = String(k); v = String(v);
    data[k] = v;
    ipcRenderer.send('brume:store-set', k, v);
    return true;
  },
  remove: (k) => {
    k = String(k);
    if (own(k)) { delete data[k]; ipcRenderer.send('brume:store-set', k, null); }
  },
  keys: () => Object.keys(data)
} : null;

contextBridge.exposeInMainWorld('brumeSystem', {
  kiosk,
  live: info.live === true,             // démarré depuis la clé USB
  persistent: info.persistent === true, // … avec une partition de conservation
  // Le dernier essai de l'installateur, s'il vient de se fermer : { code, log } (code 0 : fermé normalement)
  installer: info.installer && typeof info.installer.code === 'number' ? { code: info.installer.code, log: String(info.installer.log || '').slice(0, 3000) } : null,
  storage,
  disk: () => ipcRenderer.sendSync('brume:disk'),
  // Éteindre, redémarrer. Système Linux : la langue de Brume sert à l'écran d'arrêt du système.
  // Application : Éteindre ferme Brume (Redémarrer se contente de recharger la page).
  poweroff: (o) => ipcRenderer.send('brume:power', 'poweroff', o && o.lang),
  reboot: (o) => ipcRenderer.send('brume:power', 'reboot', o && o.lang),
  setPrefs: (prefs) => ipcRenderer.send('brume:prefs', prefs),
  // Événements du système : activité dans Vigie, vidéo en cours, mise en veille.
  onSystem: (cb) => {
    const fn = (_e, ev) => { try { cb(ev); } catch (e) { /* la page gère */ } };
    ipcRenderer.on('brume:sys-event', fn);
    return () => ipcRenderer.removeListener('brume:sys-event', fn);
  },
  install: (opts) => ipcRenderer.send('brume:install', { lang: opts && opts.lang, keep: !(opts && opts.keep === false) }),
  // Impression : imprimantes, travaux, réglage (Linux) et impression silencieuse d'un document
  print: (op, args) => ipcRenderer.invoke('brume:print', op, args),
  // Écran : 'list', 'set' (à confirmer par 'keep', sinon retour automatique), 'revert', 'reset', 'os-settings'
  display: (op, args) => ipcRenderer.invoke('brume:display', op, args),
  // GeForce NOW : 'open' (avec les libellés de la barre), 'hide', 'close', 'state'
  game: (op, args) => ipcRenderer.invoke('brume:game', op, args),
  // Mac distant (Scaleway) : 'state', 'add', 'edit', 'remove', 'link', 'refresh', 'unlink', 'reboot', 'open', 'show', 'hide', 'close'
  mac: (op, args) => ipcRenderer.invoke('brume:mac', op, args),
  // Vigie : téléchargements, autorisations des sites, effacer les données de navigation…
  web: (op, args) => ipcRenderer.invoke('brume:web', op, args),
  // Cet appareil : processeur, mémoire, carte graphique, écrans, disques, batterie, réseau…
  hardware: (fresh) => ipcRenderer.invoke('brume:hw', fresh === true),
  // Comptoir : l'icône publiée par un site ({ id, url } → { data } ou { none })
  siteIcon: (req) => ipcRenderer.invoke('brume:siteicon', req),
  // Partage à proximité : LocalSend, AirDrop (omdrop), menu de partage de macOS
  nearby: (op, args) => ipcRenderer.invoke('brume:nearby', op, args),
  // Sécurité : 'state', 'check' (rechercher les mises à jour), 'download' (application), 'restart' (système Linux)
  security: (op) => ipcRenderer.invoke('brume:security', op),
  // Volume du système Linux : 'state', 'set' ({ level }), 'mute' ({ on }), 'step' ({ dir }) ; les changements arrivent par onSystem
  volume: kiosk ? (op, args) => ipcRenderer.invoke('brume:volume', String(op), args && typeof args === 'object' ? { level: Number(args.level), on: typeof args.on === 'boolean' ? args.on : undefined, dir: Number(args.dir) || 0 } : {}) : null,
  // Capture d'écran : 'shot' (l'image de la fenêtre, en PNG), 'copy' (une image PNG dans le presse-papiers)
  capture: (op, data) => ipcRenderer.invoke('brume:capture', op === 'copy' ? 'copy' : 'shot', op === 'copy' && data instanceof Uint8Array ? data : undefined),
  // Courrier : comptes de messagerie (les mots de passe restent dans le processus principal)
  mail: (op, args) => ipcRenderer.invoke('brume:mail', op, args),
  // Calendrier : comptes CalDAV (requêtes WebDAV signées par le processus principal) et abonnements .ics
  calendar: (op, args) => ipcRenderer.invoke('brume:calendar', op, args),
  // Lecture protégée (Widevine) : 'none' | 'waiting' | 'ready' | 'restart' ; les changements arrivent par onSystem.
  drm: {
    state: () => ipcRenderer.invoke('brume:drm', 'state'),
    retry: () => ipcRenderer.invoke('brume:drm', 'retry')
  },
  wifi: kiosk ? {
    status: () => ipcRenderer.invoke('brume:net', 'status'),
    scan: (rescan) => ipcRenderer.invoke('brume:net', 'scan', rescan === true),
    connect: (ssid, password, hidden) => ipcRenderer.invoke('brume:net', 'connect', { ssid: String(ssid), password: password == null ? '' : String(password), hidden: hidden === true }),
    disconnect: () => ipcRenderer.invoke('brume:net', 'disconnect'),
    forget: (ssid) => ipcRenderer.invoke('brume:net', 'forget', String(ssid)),
    setEnabled: (on) => ipcRenderer.invoke('brume:net', 'radio', on === true),
    onChange: (cb) => {
      const fn = (_e, st) => { try { cb(st); } catch (e) { /* la page gère */ } };
      ipcRenderer.on('brume:net-change', fn);
      return () => ipcRenderer.removeListener('brume:net-change', fn);
    }
  } : null,
  bluetooth: kiosk ? {
    status: () => ipcRenderer.invoke('brume:bt', 'status'),
    power: (on) => ipcRenderer.invoke('brume:bt', 'power', on === true),
    scan: (on) => ipcRenderer.invoke('brume:bt', 'scan', on === true),
    pair: (address) => ipcRenderer.invoke('brume:bt', 'pair', String(address)),
    connect: (address) => ipcRenderer.invoke('brume:bt', 'connect', String(address)),
    disconnect: (address) => ipcRenderer.invoke('brume:bt', 'disconnect', String(address)),
    forget: (address) => ipcRenderer.invoke('brume:bt', 'forget', String(address)),
    cancel: (address) => ipcRenderer.invoke('brume:bt', 'cancel', String(address)),
    onChange: (cb) => {
      const fn = (_e, st) => { try { cb(st); } catch (e) { /* la page gère */ } };
      ipcRenderer.on('brume:bt-change', fn);
      return () => ipcRenderer.removeListener('brume:bt-change', fn);
    },
    // Questions pendant une association : { id, type: 'confirm' | 'pin' | 'passkey' | 'authorize' | 'display' | 'close', name, passkey }
    onPrompt: (cb) => {
      const fn = (_e, q) => { try { cb(q); } catch (e) { /* la page gère */ } };
      ipcRenderer.on('brume:bt-prompt', fn);
      return () => ipcRenderer.removeListener('brume:bt-prompt', fn);
    },
    answer: (id, value) => ipcRenderer.send('brume:bt-answer', Number(id), value)
  } : null
});
