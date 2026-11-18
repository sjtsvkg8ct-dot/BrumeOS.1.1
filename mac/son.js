// Son du Mac : le bouton « Son » de la barre et son panneau, et la lecture.
// Les pages Ogg Opus arrivent du processus principal (SSH, voir mac.js et son.sh) ; elles sont découpées
// en paquets, décodées par le navigateur (WebCodecs) et jouées avec Web Audio, avec un petit tampon
// (une centaine de millisecondes) : assez pour ne pas hacher, assez peu pour suivre l'image.

// ---------- Ogg : des pages aux paquets ----------
export class OggPackets {
  constructor(onPacket) { this.onPacket = onPacket; this.buf = new Uint8Array(0); this.part = []; }
  push(u8) {
    const b = new Uint8Array(this.buf.length + u8.length); b.set(this.buf); b.set(u8, this.buf.length);
    let p = 0;
    while (b.length - p >= 27) {
      if (b[p] !== 0x4f || b[p + 1] !== 0x67 || b[p + 2] !== 0x67 || b[p + 3] !== 0x53) {   // « OggS » : se recaler
        let q = p + 1;
        while (q + 3 < b.length && !(b[q] === 0x4f && b[q + 1] === 0x67 && b[q + 2] === 0x67 && b[q + 3] === 0x53)) q++;
        if (q + 3 >= b.length) { p = Math.max(p, b.length - 3); break; }
        p = q; this.part = []; continue;
      }
      const flags = b[p + 5], n = b[p + 26];
      if (b.length - p < 27 + n) break;
      let len = 0; for (let i = 0; i < n; i++) len += b[p + 27 + i];
      if (b.length - p < 27 + n + len) break;
      if (flags & 0x02) this.part = [];                 // début d'un flux : un nouvel en-tête suit
      if ((flags & 0x01) === 0 && this.part.length) this.part = [];   // suite annoncée qui n'en est pas une
      let off = p + 27 + n;
      for (let i = 0; i < n; i++) {
        const l = b[p + 27 + i];
        this.part.push(b.subarray(off, off + l)); off += l;
        if (l < 255) {
          const size = this.part.reduce((s, x) => s + x.length, 0), pkt = new Uint8Array(size);
          let o = 0; for (const x of this.part) { pkt.set(x, o); o += x.length; }
          this.part = [];
          this.onPacket(pkt);
        }
      }
      p = off;
    }
    this.buf = b.slice(p);
  }
}

// ---------- Lecture ----------
const isHead = (p) => p.length >= 19 && String.fromCharCode(...p.subarray(0, 8)) === 'OpusHead';
const isTags = (p) => p.length >= 8 && String.fromCharCode(...p.subarray(0, 8)) === 'OpusTags';
export class Player {
  constructor() {
    this.ctx = null; this.gain = null; this.an = null; this.dec = null; this.ts = 0; this.next = 0;
    this.vol = 0.8; this.stats = { packets: 0, decoded: 0, played: 0, dropped: 0, underruns: 0 };
    this.ogg = new OggPackets((p) => this.packet(p));
  }
  static supported() { return typeof AudioDecoder === 'function' && typeof EncodedAudioChunk === 'function' && typeof AudioContext === 'function'; }
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
      this.gain = this.ctx.createGain(); this.gain.gain.value = this.vol;
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048;
      this.gain.connect(this.an); this.an.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.reset();
  }
  reset() {   // un flux neuf : un nouvel en-tête Opus arrivera
    if (this.dec) { try { this.dec.close(); } catch (e) { /* déjà fermé */ } }
    this.dec = null; this.ts = 0; this.next = 0;
    this.ogg = new OggPackets((p) => this.packet(p));
  }
  stop() { this.reset(); if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; this.gain = null; this.an = null; } }
  setVolume(v) { this.vol = v; if (this.gain) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  push(u8) { if (this.ctx) this.ogg.push(u8); }
  packet(p) {
    if (isHead(p)) {
      const channels = p[9] || 2;
      if (this.dec) { try { this.dec.close(); } catch (e) { /* déjà fermé */ } }
      this.dec = new AudioDecoder({ output: (d) => this.play(d), error: () => { this.dec = null; } });
      this.dec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: channels, description: p });
      return;
    }
    if (isTags(p) || !this.dec || this.dec.state !== 'configured') return;
    this.stats.packets++;
    this.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: this.ts, data: p }));
    this.ts += 20000;
  }
  play(d) {
    try {
      const ctx = this.ctx; if (!ctx) return;
      const n = d.numberOfFrames, chs = d.numberOfChannels;
      this.stats.decoded++;
      const now = ctx.currentTime;
      if (this.next < now + 0.02) { if (this.next) this.stats.underruns++; this.next = now + 0.1; }   // en retard : on se donne 100 ms
      if (this.next - now > 0.5) { this.stats.dropped++; return; }   // trop d'avance prise : on rattrape l'image
      const buf = ctx.createBuffer(chs, n, d.sampleRate), f = new Float32Array(n);
      for (let c = 0; c < chs; c++) { d.copyTo(f, { planeIndex: c, format: 'f32-planar' }); buf.copyToChannel(f, c); }
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this.gain); src.start(this.next);
      this.next += buf.duration; this.stats.played++;
    } finally { d.close(); }
  }
  level() {   // le niveau du son qui sort (0 à 1), pour l'indicateur et les tests
    if (!this.an) return 0;
    const a = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(a);
    let s = 0; for (const x of a) s += x * x;
    return Math.sqrt(s / a.length);
  }
}

// ---------- Le bouton et le panneau ----------
// L : les textes (déjà traduits par Brume) ; M : window.brumeMac ; info : réglages du son de ce Mac
export function createSound({ M, L, info, fmt, onOpen }) {
  const $ = (id) => document.getElementById(id);
  const btn = $('snd'), pop = $('sndpop');
  const player = new Player();
  let state = 'off', on = !!(info.audio && info.audio.on), vol = info.audio && info.audio.vol >= 0 ? info.audio.vol : 0.8;
  let retries = 0, retryTimer = 0, err = '', step = '', logLine = '', meterTimer = 0;
  player.vol = vol;
  window.__macSound = { player, get state() { return state; } };   // (pour les tests)
  M.onAudio((d) => player.push(d instanceof Uint8Array ? d : new Uint8Array(d)));

  const save = () => M.pref({ audio: { on, vol } });
  const icon = (o) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>' +
    (o ? '<path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/>') + '</svg>';
  const STEPS = { check: L.sndStepCheck, brew: L.sndStepBrew, ffmpeg: L.sndStepFfmpeg, blackhole: L.sndStepBlackhole, output: L.sndStepOutput };
  const ERR = {
    'ssh-refused': L.sndErrRefused, 'ssh-auth': L.sndErrAuth, hostkey: L.sndErrHostkey, timeout: L.sndErrReach, unreach: L.sndErrReach,
    notfound: L.sndErrReach, ssh: L.sndErrReach, sudo: L.sndErrSudo, nopass: L.sndErrNopass, net: L.sndErrBrew, brew: L.sndErrBrew,
    ffmpeg: L.sndErrFfmpeg, blackhole: L.sndErrBlackhole, output: L.sndErrOutput, gui: L.sndErrGui, open: L.sndErrOpen,
    missing: L.sndErrMissing, nosound: L.sndErrNosound, ended: L.sndErrLost, decoder: L.sndErrDecoder
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (text, fn, accent) => { const b = el('button', accent ? 'accent' : '', text); b.type = 'button'; b.addEventListener('click', fn); return b; };

  function render() {
    btn.innerHTML = icon(state === 'playing' || state === 'waiting') + '<span>' + L.snd + '</span>';
    btn.setAttribute('aria-pressed', String(state === 'playing'));
    btn.dataset.state = state;
    if (pop.hidden) return;
    pop.textContent = '';
    pop.append(el('h2', '', L.sndTitle));
    const busy = (text, sub) => { const r = el('div', 'snd-busy'); r.append(el('div', 'spin'), el('p', '', text)); pop.append(r); if (sub) pop.append(el('p', 'snd-log', sub)); };
    if (state === 'off') {
      pop.append(el('p', '', L.sndIntro));
      pop.append(el('div', 'snd-acts')); pop.lastChild.append(button(L.sndOn, () => enable(), true));
    } else if (state === 'checking') busy(L.sndChecking);
    else if (state === 'setup') {
      pop.append(el('p', '', L.sndSetup), el('p', 'snd-small', L.sndSetupTime));
      const a = el('div', 'snd-acts'); a.append(button(L.cancel, () => disable()), button(L.sndInstall, () => install(), true)); pop.append(a);
    } else if (state === 'installing') busy(STEPS[step] || L.sndStepCheck, logLine);
    else if (state === 'waiting') {
      busy(L.sndWaiting);
      pop.append(el('p', 'snd-small', L.sndPermission));
      const a = el('div', 'snd-acts'); a.append(button(L.sndOff, () => disable())); pop.append(a);
    } else if (state === 'playing') {
      const row = el('label', 'snd-vol'); row.append(el('span', '', L.sndVolume));
      const r = document.createElement('input'); r.type = 'range'; r.min = '0'; r.max = '100'; r.value = String(Math.round(vol * 100)); r.setAttribute('aria-label', L.sndVolume);
      r.addEventListener('input', () => { vol = (+r.value) / 100; player.setVolume(vol); });
      r.addEventListener('change', save);
      const meter = el('i', 'snd-meter'); row.append(r, meter); pop.append(row);
      pop.append(el('p', 'snd-small', L.sndDelay));
      const a = el('div', 'snd-acts'); a.append(button(L.sndOff, () => disable())); pop.append(a);
      clearInterval(meterTimer);
      meterTimer = setInterval(() => { if (pop.hidden || state !== 'playing') { clearInterval(meterTimer); return; } meter.style.setProperty('--l', Math.min(1, player.level() * 4).toFixed(3)); }, 120);
    } else if (state === 'error') {
      pop.append(el('p', 'snd-err', ERR[err] ? fmt(ERR[err], { port: info.sshPort || 22 }) : L.sndErrFailed));
      const a = el('div', 'snd-acts');
      a.append(button(L.sndOff, () => disable()));
      if (err === 'hostkey') a.append(button(L.sndTrust, async () => { await M.audio('trust'); enable(); }, true));
      else if (err === 'missing' || err === 'blackhole' || err === 'ffmpeg' || err === 'output') a.append(button(L.sndInstall, () => install(), true));
      else a.append(button(L.retry, () => enable(), true));
      pop.append(a);
    }
  }
  const set = (s) => { state = s; render(); };
  const fail = (code) => { err = code || 'failed'; clearTimeout(retryTimer); player.reset(); set('error'); };

  async function enable() {
    clearTimeout(retryTimer);
    if (!Player.supported()) { fail('decoder'); return; }
    on = true; save(); retries = 0;
    player.start();   // (dans le clic : le navigateur laisse jouer le son)
    set('checking');
    const r = await M.audio('status');
    if (!on) return;
    if (!r || !r.ok) { fail(r && r.error); return; }
    if (!r.ready) { set('setup'); return; }
    if (!r.info.gui) { fail('gui'); return; }
    start();
  }
  async function start() {
    player.reset(); set('waiting');
    const r = await M.audio('start');
    if (!on) return;
    if (!r || !r.ok) fail(r && r.error);
  }
  async function install() {
    on = true; save(); player.start();
    step = 'check'; logLine = ''; set('installing');
    const r = await M.audio('install');
    if (!on && state !== 'installing') return;
    if (!r || !r.ok) { fail(r && r.error); return; }
    start();
  }
  function disable() {
    on = false; save(); clearTimeout(retryTimer);
    if (state === 'playing' || state === 'waiting') M.audio('stop');
    player.stop(); set('off');
  }
  // Ce que dit le processus principal pendant l'installation et le flux
  function event(d) {
    if (!d || !on) return;
    if (d.type === 'step') { step = d.step; logLine = ''; if (state === 'installing') render(); }
    else if (d.type === 'log') { logLine = d.line; const p = pop.querySelector('.snd-log'); if (p) p.textContent = d.line; else if (state === 'installing') render(); }
    else if (d.type === 'waiting') { if (state !== 'waiting') set('waiting'); }
    else if (d.type === 'playing') { retries = 0; set('playing'); }
    else if (d.type === 'ended') {
      // Pas de son du tout : le Mac attend sans doute qu'on autorise Terminal (on réessaie un moment)
      if (d.error === 'nosound' && retries < 15) { retries++; set('waiting'); retryTimer = setTimeout(start, 4000); return; }
      // Coupé en route : on reprend
      if (d.error === 'ended' && retries < 5) { retries++; set('waiting'); retryTimer = setTimeout(start, 2000); return; }
      fail(d.error);
    }
  }
  function toggle(force) {
    const open = force != null ? force : pop.hidden;
    pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) { render(); if (onOpen) onOpen(); }
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) toggle(false); }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); toggle(false); } }, true);
  btn.title = L.sndTitle; render();
  return {
    event, toggle, isOpen: () => !pop.hidden,
    // Une fois connecté au Mac : le son reprend s'il était activé
    connected() { if (on && (state === 'off' || state === 'error')) enable(); },
    close() { clearTimeout(retryTimer); player.stop(); }
  };
}
