// Préchargement des onglets de Vigie (les sites du vrai Web, et les apps du Comptoir). Deux tâches :
// - relayer à Brume les notifications des sites (WhatsApp Web, Messenger…), qui deviennent des avis de Brume ;
// - dire à Brume ce que la page joue (Apple Music, Spotify, YouTube, Netflix…), pour le Panneau rapide :
//   titre, artiste, pochette (« Media Session » de la page), lecture ou pause, morceau précédent et suivant.
// Il tourne à part de la page, sans accès à Node ; la page ne reçoit qu'une petite imitation de l'API Notification
// et une petite surveillance de ses lecteurs audio et vidéo, qui lui envoient des messages.
const { ipcRenderer, webFrame, contextBridge } = require('electron');

const rnd = () => Math.random().toString(36).slice(2);
const KEY = '__brume_notification_' + rnd();
const MKEY = '__brume_media_' + rnd();
let last = 0;

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || typeof e.data !== 'object' || !e.data[KEY]) return;
  const n = e.data[KEY];
  const now = Date.now();
  if (now - last < 1500) return; // pas plus d'un avis toutes les secondes et demie
  last = now;
  ipcRenderer.sendToHost('brume-notification', {
    title: String(n.title || '').slice(0, 120),
    body: String(n.body || '').slice(0, 300)
  });
});

// Ce que la page joue : un état complet à chaque changement (ou null quand plus rien ne joue)
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || typeof e.data !== 'object' || !(MKEY in e.data)) return;
  const s = e.data[MKEY];
  if (!s || typeof s !== 'object') { ipcRenderer.sendToHost('brume-media', null); return; }
  ipcRenderer.sendToHost('brume-media', {
    playing: !!s.playing, video: !!s.video, prev: !!s.prev, next: !!s.next,
    title: str(s.title, 200), artist: str(s.artist, 200), album: str(s.album, 200),
    art: (Array.isArray(s.art) ? s.art : []).slice(0, 8)
      .map((a) => ({ src: str(a && a.src, 2000), sizes: str(a && a.sizes, 40) }))
      .filter((a) => /^(https?:|data:image\/)/i.test(a.src))
  });
});

// Dans la page : imitation de l'API Notification
function notificationMain(KEY) {
  class Notification extends EventTarget {
    constructor(title, options) {
      super();
      const o = options || {};
      this.title = String(title || ''); this.body = String(o.body || ''); this.tag = String(o.tag || '');
      this.icon = o.icon || ''; this.data = o.data; this.silent = !!o.silent;
      this.onclick = null; this.onshow = null; this.onclose = null; this.onerror = null;
      window.postMessage({ [KEY]: { title: this.title, body: this.body } }, '*');
      setTimeout(() => { const ev = new Event('show'); this.dispatchEvent(ev); if (typeof this.onshow === 'function') this.onshow(ev); }, 0);
    }
    close() { const ev = new Event('close'); this.dispatchEvent(ev); if (typeof this.onclose === 'function') this.onclose(ev); }
    static get permission() { return 'granted'; }
    static get maxActions() { return 0; }
    static requestPermission(cb) { if (typeof cb === 'function') cb('granted'); return Promise.resolve('granted'); }
  }
  try { Object.defineProperty(window, 'Notification', { value: Notification, configurable: true, writable: true }); } catch (e) {}
}

// Dans la page : les lecteurs audio et vidéo, et la « Media Session » (titre, pochette, boutons du site).
// Brume commande la lecture par window.__brumeMedia('play' | 'pause' | 'previoustrack' | 'nexttrack').
function mediaMain(KEY) {
  const post = window.postMessage.bind(window);
  const ms = navigator.mediaSession;
  const handlers = {};
  const els = new Set();
  let lastEl = null, timer = 0, sent = '';
  const changed = () => { clearTimeout(timer); timer = setTimeout(send, 250); };
  if (ms && ms.setActionHandler) {
    const orig = ms.setActionHandler.bind(ms);
    try {
      ms.setActionHandler = function (action, fn) { handlers[action] = typeof fn === 'function' ? fn : null; changed(); return orig(action, fn); };
    } catch (e) {}
    try {
      const d = Object.getOwnPropertyDescriptor(MediaSession.prototype, 'metadata');
      if (d && d.set) Object.defineProperty(ms, 'metadata', { configurable: true, get() { return d.get.call(ms); }, set(v) { d.set.call(ms, v); changed(); } });
    } catch (e) {}
  }
  const EVENTS = ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied', 'loadedmetadata'];
  const watch = (el) => {
    if (!el || els.has(el)) return;
    els.add(el);
    EVENTS.forEach((t) => el.addEventListener(t, () => { if (t === 'play' || t === 'playing') lastEl = el; changed(); }));
  };
  try {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { watch(this); return play.apply(this, arguments); };
  } catch (e) {}
  document.addEventListener('play', (e) => { if (e.target instanceof HTMLMediaElement) { watch(e.target); lastEl = e.target; changed(); } }, true);
  // Un lecteur muet (bande-annonce, aperçu au survol) ne compte pas
  const audible = (el) => !el.paused && !el.ended && !el.muted && el.volume > 0;
  function state() {
    for (const el of els) if (el !== lastEl && el.paused && !el.isConnected) els.delete(el);
    const md = ms && ms.metadata;
    const on = [...els].find(audible);
    const el = on || lastEl;
    const playing = !!on || (ms && ms.playbackState === 'playing');
    const started = el && !el.muted && el.volume > 0 && !el.ended && el.currentTime > 0;
    if (!(md && md.title) && !on && !started) return null;
    return {
      playing, prev: !!handlers.previoustrack, next: !!handlers.nexttrack,
      video: !!(el && el.tagName === 'VIDEO' && el.videoWidth),
      title: md ? md.title : '', artist: md ? md.artist : '', album: md ? md.album : '',
      art: md && md.artwork ? Array.from(md.artwork).map((a) => ({ src: String(a.src || ''), sizes: String(a.sizes || '') })) : []
    };
  }
  function send() {
    let s = null;
    try { s = state(); } catch (e) {}
    const j = JSON.stringify(s);
    if (j === sent) return;
    sent = j;
    post({ [KEY]: s }, '*');
  }
  setInterval(changed, 3000);   // titres changés sans événement
  try {
    Object.defineProperty(window, '__brumeMedia', { configurable: true, value(act) {
      try {
        if (handlers[act]) { handlers[act]({ action: act }); setTimeout(send, 400); return true; }
        const el = [...els].find(audible) || lastEl;
        if (!el) return false;
        if (act === 'play') el.play(); else if (act === 'pause') el.pause(); else return false;
        return true;
      } catch (e) { return false; }
    } });
  } catch (e) {}
}

// Au plus tôt dans la page, avant ses propres scripts
function inMain(fn, arg) {
  try {
    if (contextBridge && contextBridge.executeInMainWorld) { contextBridge.executeInMainWorld({ func: fn, args: [arg] }); return; }
  } catch (e) {}
  webFrame.executeJavaScript('(' + fn.toString() + ')(' + JSON.stringify(arg) + ')').catch(() => {});
}
inMain(notificationMain, KEY);
inMain(mediaMain, MKEY);
