// Écran : résolution, fréquence et taille des éléments.
// - Système Linux : Brume tourne dans « cage », qui accepte les réglages d'écran du protocole
//   wlr-output-management ; on les envoie avec l'outil wlr-randr. Un nouveau réglage doit être
//   confirmé : sans réponse (écran noir, moniteur qui refuse le mode…), l'ancien revient tout seul.
//   Le réglage gardé est réappliqué au démarrage de Brume.
// - Application sur Windows et macOS : la résolution se règle dans le système ; on ouvre ses réglages.
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');

const SCALES = [1, 1.25, 1.5, 1.75, 2];

function createDisplay({ kiosk, file, openSettings = () => false, platform = process.platform,
  exec = execFile, bin = 'wlr-randr', confirmMs = 20000, log = () => {} } = {}) {
  let pending = null;   // { previous, timer } : réglage en attente de confirmation

  const run = (args) => new Promise((resolve) => {
    exec(bin, args, { timeout: 10000, env: process.env }, (err, out, errOut) => {
      resolve({ ok: !err, missing: !!(err && err.code === 'ENOENT'), out: String(out || ''), err: String(errOut || '') });
    });
  });
  const errOf = (code, detail) => { const e = new Error(code); e.code = code; if (detail) e.detail = String(detail).slice(0, 300); return e; };

  // Lecture de « wlr-randr --json » (0.4 et plus récent) ou de son affichage en texte (versions plus anciennes)
  function fromJson(arr) {
    return (Array.isArray(arr) ? arr : []).map((o) => ({
      name: String(o.name || ''),
      description: String(o.description || ''),
      make: o.make || '', model: o.model || '',
      enabled: o.enabled !== false,
      scale: Number(o.scale) || 1,
      modes: (Array.isArray(o.modes) ? o.modes : []).map((m) => ({
        width: m.width | 0, height: m.height | 0,
        refresh: Math.round((Number(m.refresh) || 0) * 1000) / 1000,
        preferred: !!m.preferred, current: !!m.current
      }))
    }));
  }
  function fromText(text) {
    const outs = []; let cur = null, inModes = false;
    for (const line of String(text).split('\n')) {
      const head = /^(\S+)\s+"(.*)"\s*$/.exec(line);
      if (head) { cur = { name: head[1], description: head[2], make: '', model: '', enabled: true, scale: 1, modes: [] }; outs.push(cur); inModes = false; continue; }
      if (!cur) continue;
      let m;
      if ((m = /^\s+Modes:\s*$/.exec(line))) { inModes = true; continue; }
      if (inModes && (m = /^\s+(\d+)x(\d+) px(?:, ([\d.]+) Hz)?(?: \(([^)]*)\))?\s*$/.exec(line))) {
        const flags = (m[4] || '').split(/,\s*/);
        cur.modes.push({ width: +m[1], height: +m[2], refresh: m[3] ? Math.round(parseFloat(m[3]) * 1000) / 1000 : 0,
          preferred: flags.includes('preferred'), current: flags.includes('current') });
        continue;
      }
      inModes = false;
      if ((m = /^\s+Enabled:\s+(yes|no)/.exec(line))) cur.enabled = m[1] === 'yes';
      else if ((m = /^\s+Scale:\s+([\d.]+)/.exec(line))) cur.scale = parseFloat(m[1]) || 1;
      else if ((m = /^\s+Make:\s+(.*)$/.exec(line))) cur.make = m[1] === '(null)' ? '' : m[1];
      else if ((m = /^\s+Model:\s+(.*)$/.exec(line))) cur.model = m[1] === '(null)' ? '' : m[1];
    }
    return outs;
  }
  async function outputs() {
    let r = await run(['--json']);
    if (r.missing) throw errOf('missing');
    if (r.ok) { try { return fromJson(JSON.parse(r.out)); } catch (e) { /* ancien format */ } }
    r = await run([]);
    if (r.missing) throw errOf('missing');
    if (!r.ok) throw errOf('failed', r.err);
    return fromText(r.out);
  }
  const keyOf = (o) => o.name + '|' + o.description;
  const modeStr = (m) => m.width + 'x' + m.height + (m.refresh ? '@' + m.refresh.toFixed(3) + 'Hz' : '');
  const current = (o) => o.modes.find((m) => m.current) || null;

  // Réglages gardés : { "<sortie>|<description>": { width, height, refresh, scale } }
  function readSaved() { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } }
  function writeSaved(all) {
    try { fs.writeFileSync(file + '.tmp', JSON.stringify(all, null, 1)); fs.renameSync(file + '.tmp', file); } catch (e) { log('display: ' + e.message); }
  }

  async function apply(o, mode, scale) {
    const args = ['--output', o.name];
    if (mode) args.push('--mode', modeStr(mode));
    if (scale) args.push('--scale', String(scale));
    const r = await run(args);
    if (r.missing) throw errOf('missing');
    if (!r.ok) throw errOf('refused', r.err);
  }

  async function list() {
    if (!kiosk) return { ok: true, manage: false, osSettings: platform === 'win32' || platform === 'darwin' };
    const outs = (await outputs()).filter((o) => o.enabled);
    return {
      ok: true, manage: true, scales: SCALES, pending: !!pending,
      outputs: outs.map((o) => ({
        id: keyOf(o), name: o.name, description: o.description, make: o.make, model: o.model,
        builtin: /^(eDP|LVDS|DSI)-/i.test(o.name), scale: o.scale,
        modes: o.modes.map((m) => ({ width: m.width, height: m.height, refresh: m.refresh, preferred: m.preferred, current: m.current }))
      }))
    };
  }

  // Nouveau réglage : appliqué tout de suite, gardé seulement s'il est confirmé (« keep »)
  async function set(args) {
    if (!kiosk) throw errOf('unsupported');
    const outs = await outputs();
    const o = outs.find((x) => keyOf(x) === args.id);
    if (!o) throw errOf('output');
    const w = args.width | 0, h = args.height | 0, rr = Math.round((Number(args.refresh) || 0) * 1000) / 1000;
    const mode = o.modes.find((m) => m.width === w && m.height === h && (!rr || m.refresh === rr));
    if (!mode) throw errOf('mode');
    const scale = SCALES.includes(Number(args.scale)) ? Number(args.scale) : o.scale;
    if (pending) await revert();
    const was = current(o);
    await apply(o, mode, scale);
    pending = {
      id: keyOf(o), name: o.name,
      previous: { mode: was, scale: o.scale },
      next: { width: mode.width, height: mode.height, refresh: mode.refresh, scale },
      timer: setTimeout(() => { revert().catch(() => {}); }, confirmMs)
    };
    return { ok: true, seconds: Math.round(confirmMs / 1000) };
  }
  async function keep() {
    if (!pending) return { ok: false };
    clearTimeout(pending.timer);
    const all = readSaved(); all[pending.id] = pending.next; writeSaved(all);
    pending = null;
    return { ok: true };
  }
  async function revert() {
    if (!pending) return { ok: false };
    const p = pending; pending = null; clearTimeout(p.timer);
    await apply({ name: p.name }, p.previous.mode, p.previous.scale);
    return { ok: true };
  }
  // Retour aux réglages de l'écran (mode recommandé, taille 100 %), sans confirmation : c'est sûr
  async function reset(args) {
    if (!kiosk) throw errOf('unsupported');
    const o = (await outputs()).find((x) => keyOf(x) === args.id);
    if (!o) throw errOf('output');
    const mode = o.modes.find((m) => m.preferred) || o.modes[0];
    if (pending) { clearTimeout(pending.timer); pending = null; }
    await apply(o, mode, 1);
    const all = readSaved(); delete all[keyOf(o)]; writeSaved(all);
    return { ok: true };
  }

  // Au démarrage : les réglages gardés, pour les écrans encore branchés qui proposent toujours ce mode
  async function restore() {
    if (!kiosk) return;
    const all = readSaved(); if (!Object.keys(all).length) return;
    let outs; try { outs = await outputs(); } catch (e) { log('display: ' + e.message); return; }
    for (const o of outs) {
      const s = all[keyOf(o)]; if (!s || !o.enabled) continue;
      const mode = o.modes.find((m) => m.width === s.width && m.height === s.height && (!s.refresh || m.refresh === s.refresh));
      const cur = current(o);
      if (!mode || (cur === mode && o.scale === s.scale)) continue;
      try { await apply(o, mode, SCALES.includes(s.scale) ? s.scale : 1); } catch (e) { log('display: ' + (e.detail || e.message)); }
    }
  }

  async function call(op, args) {
    try {
      if (op === 'list') return await list();
      if (op === 'set') return await set(args);
      if (op === 'keep') return await keep();
      if (op === 'revert') return await revert();
      if (op === 'reset') return await reset(args);
      if (op === 'os-settings') return { ok: !kiosk && !!openSettings() };
      return { ok: false, error: 'op' };
    } catch (e) {
      return { ok: false, error: e.code || 'failed', detail: e.detail || '' };
    }
  }
  return { call, restore, _fromText: fromText, _fromJson: fromJson };
}

module.exports = { createDisplay, SCALES };
