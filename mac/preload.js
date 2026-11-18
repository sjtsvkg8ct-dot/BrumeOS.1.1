// Fenêtre du Mac : un petit pont vers le processus principal (octets du partage d'écran, presse-papiers, son).
// La fenêtre ne choisit pas où elle se connecte : c'est le Mac choisi dans Brume.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
let handler = null, audioHandler = null;
ipcRenderer.on('mac:evt', (_e, type, data) => { if (handler) handler(type, data); });
ipcRenderer.on('mac:aud', (_e, data) => { if (audioHandler) audioHandler(data); });
contextBridge.exposeInMainWorld('brumeMac', {
  init: () => ipcRenderer.invoke('mac:init'),
  connect: () => ipcRenderer.invoke('mac:connect'),
  send: (bytes) => { if (bytes instanceof Uint8Array) ipcRenderer.send('mac:send', bytes); },
  disconnect: () => ipcRenderer.send('mac:disconnect'),
  on: (fn) => { handler = typeof fn === 'function' ? fn : null; },
  action: (a) => ipcRenderer.send('mac:action', String(a)),
  pref: (p) => {
    const o = {};
    if (p && 'ctrlCmd' in p) o.ctrlCmd = !!p.ctrlCmd;
    if (p && p.audio && typeof p.audio === 'object') o.audio = { on: !!p.audio.on, vol: Number(p.audio.vol) };
    ipcRenderer.send('mac:pref', o);
  },
  clipRead: () => ipcRenderer.invoke('mac:clip-read'),
  clipWrite: (t) => ipcRenderer.send('mac:clip-write', String(t || '')),
  // Son : status | install | start | stop | trust ; les pages Ogg Opus arrivent par onAudio
  audio: (op) => ipcRenderer.invoke('mac:audio', String(op)),
  onAudio: (fn) => { audioHandler = typeof fn === 'function' ? fn : null; }
});
