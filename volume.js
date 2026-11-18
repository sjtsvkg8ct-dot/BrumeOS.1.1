// Volume du système Linux de Brume (PipeWire) : lire, régler, couper le son, et suivre ce qui change ailleurs
// (casque branché, enceinte Bluetooth qui prend la main). Par pactl (pipewire-pulse), ou wpctl à défaut.
// Les touches de volume du clavier passent par ici (main.js), où que soit le clavier : 16 crans, comme sur un Mac,
// et 64 avec Alt+Maj. Monter ou baisser le volume remet le son s'il était coupé.
const { execFile, spawn } = require('child_process');
const fs = require('fs');

const STEPS = 16, FINE = 64;
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function createVolume({ onChange, run = execFile, spawnFn = spawn, bin = { pactl: 'pactl', wpctl: 'wpctl' }, log = () => {} } = {}) {
  // Sorties en anglais, quelle que soit la langue du système (« Mute: yes », pas « Muet : oui »)
  const env = Object.assign({}, process.env, { LC_ALL: 'C', LANG: 'C' });
  const exec = (cmd, args) => new Promise((res) => {
    try { run(cmd, args, { timeout: 4000, env }, (err, out) => res(err ? null : String(out || ''))); } catch (e) { res(null); }
  });
  let tool = null, st = { ok: false, level: 0.5, muted: false, device: '' }, chain = Promise.resolve(), mine = 0;

  async function detect() {
    if (tool) return tool;
    if (await exec(bin.pactl, ['get-sink-volume', '@DEFAULT_SINK@']) != null) tool = 'pactl';
    else if (await exec(bin.wpctl, ['get-volume', '@DEFAULT_AUDIO_SINK@']) != null) tool = 'wpctl';
    return tool;
  }
  async function device() {
    if (tool === 'pactl') {
      const name = String(await exec(bin.pactl, ['get-default-sink']) || '').trim();
      const list = name ? await exec(bin.pactl, ['list', 'sinks']) : null;
      if (!list) return '';
      const block = list.split(/^Sink #/m).find((b) => b.includes('Name: ' + name + '\n'));
      const m = block && /^\s*Description:\s*(.+)$/m.exec(block);
      return m ? m[1].trim() : '';
    }
    const out = await exec(bin.wpctl, ['inspect', '@DEFAULT_AUDIO_SINK@']);
    const m = out && /node\.description\s*=\s*"([^"]*)"/.exec(out);
    return m ? m[1] : '';
  }
  async function read() {
    const t = await detect();
    if (t === 'pactl') {
      const v = await exec(bin.pactl, ['get-sink-volume', '@DEFAULT_SINK@']);
      const m = await exec(bin.pactl, ['get-sink-mute', '@DEFAULT_SINK@']);
      const pct = v && /(\d+)%/.exec(v);
      st = { ok: !!pct, level: pct ? clamp(+pct[1] / 100) : st.level, muted: /:\s*yes/i.test(m || ''), device: await device() };
    } else if (t === 'wpctl') {
      const v = await exec(bin.wpctl, ['get-volume', '@DEFAULT_AUDIO_SINK@']);
      const m = v && /Volume:\s*([\d.]+)/.exec(v);
      st = { ok: !!m, level: m ? clamp(+m[1]) : st.level, muted: /\[MUTED\]/.test(v || ''), device: await device() };
    } else {
      st = Object.assign({}, st, { ok: false });
    }
    return Object.assign({}, st);
  }
  async function setLevel(level) {
    const t = await detect(); if (!t) return read();
    level = clamp(level); mine = Date.now();
    if (t === 'pactl') {
      await exec(bin.pactl, ['set-sink-volume', '@DEFAULT_SINK@', Math.round(level * 100) + '%']);
      if (st.muted) await exec(bin.pactl, ['set-sink-mute', '@DEFAULT_SINK@', '0']);
    } else {
      await exec(bin.wpctl, ['set-volume', '-l', '1', '@DEFAULT_AUDIO_SINK@', level.toFixed(3)]);
      if (st.muted) await exec(bin.wpctl, ['set-mute', '@DEFAULT_AUDIO_SINK@', '0']);
    }
    return read();
  }
  async function setMute(on) {
    const t = await detect(); if (!t) return read();
    if (on == null) on = !(await read()).muted;
    mine = Date.now();
    if (t === 'pactl') await exec(bin.pactl, ['set-sink-mute', '@DEFAULT_SINK@', on ? '1' : '0']);
    else await exec(bin.wpctl, ['set-mute', '@DEFAULT_AUDIO_SINK@', on ? '1' : '0']);
    return read();
  }
  async function step(dir, fine) {
    const cur = await read(), n = fine ? FINE : STEPS;
    const next = Math.round(cur.level * n + (dir > 0 ? 1 : -1)) / n;
    return setLevel(next);
  }
  // Une opération à la fois : une touche gardée enfoncée ne mélange pas les réglages
  function call(op, a = {}) {
    const job = chain.then(() => {
      if (op === 'state') return read();
      if (op === 'set') return setLevel(a.level);
      if (op === 'mute') return setMute(typeof a.on === 'boolean' ? a.on : null);
      if (op === 'step') return step(Number(a.dir) || 0, !!a.fine);
      return Object.assign({}, st, { ok: false, error: 'op' });
    });
    chain = job.catch(() => {});
    return job;
  }
  // Ce qui change sans Brume (un casque, une enceinte Bluetooth) : « pactl subscribe ».
  // Il est lancé par bash, qui ferme d'abord ce que Brume a hérité de la session (au-delà de 0, 1 et 2) :
  // si Brume s'arrête brutalement, ce pactl qui reste ne doit pas garder la session ouverte (écran noir).
  // (bash et pas sh : sh ne sait fermer que les descripteurs 0 à 9.)
  const BASH = ['/bin/bash', '/usr/bin/bash'].find((f) => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } });
  const CLEAN_EXEC = 'for f in /proc/$$/fd/*; do n=${f##*/}; case $n in 0|1|2|*[!0-9]*) ;; *) eval "exec $n>&-" 2>/dev/null ;; esac; done; exec "$0" "$@"';
  let proc = null, timer = null, stopped = false, fails = 0;
  function watch() {
    if (stopped || proc) return;
    detect().then((t) => {
      if (t !== 'pactl' || stopped) return;
      try { proc = BASH ? spawnFn(BASH, ['-c', CLEAN_EXEC, bin.pactl, 'subscribe'], { env }) : spawnFn(bin.pactl, ['subscribe'], { env }); } catch (e) { proc = null; return; }
      let buf = '';
      proc.stdout.on('data', (d) => {
        buf += d; const lines = buf.split('\n'); buf = lines.pop();
        if (!lines.some((l) => /on (sink|server) /i.test(l))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (Date.now() - mine < 800) return;   // nos propres réglages : déjà connus
          const before = JSON.stringify(st);
          call('state').then((now) => { if (JSON.stringify(now) !== before && onChange) onChange(now); }).catch(() => {});
        }, 250);
      });
      proc.on('error', () => {});
      proc.on('exit', () => {
        proc = null;
        if (!stopped && ++fails < 20) setTimeout(watch, Math.min(60000, 2000 * fails));
      });
    }).catch((e) => log(String(e)));
  }
  function stop() { stopped = true; clearTimeout(timer); if (proc) try { proc.kill(); } catch (e) { /* déjà parti */ } }
  return { call, watch, stop };
}

module.exports = { createVolume };
