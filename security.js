// Sécurité (Réglages › Sécurité) : mises à jour de Brume, pare-feu, chiffrement du disque.
// - Système Linux : brume-maj (service du système, voir linux/…/usr/local/sbin/brume-maj) installe tout seul les
//   nouvelles versions de Brume ; on lit son état dans /var/lib/brume-maj/etat.json et « Rechercher » démarre le
//   service (polkit ne permet que ça). Le pare-feu est nftables.service ; le chiffrement se lit sur le disque.
// - Application (Mac, Windows, Linux) : on demande à GitHub la dernière release ; si elle est plus récente, Brume le
//   signale et « Télécharger » ouvre la page de la release dans le navigateur de l'ordinateur.
const { execFile } = require('child_process');
const fs = require('fs');

const ETAT = process.env.BRUME_MAJ_ETAT || '/var/lib/brume-maj/etat.json';
const API = (process.env.BRUME_MAJ_API || 'https://api.github.com').replace(/\/+$/, '');
const DAY = 24 * 3600 * 1000;

function run(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (e, out, err) =>
      resolve({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(out || ''), err: String(err || '') }));
  });
}

// 1.2.3 → [1,2,3] ; compare deux versions simples (celles de Brume : d'après l'étiquette de la release)
const parts = (v) => String(v || '').replace(/^v/i, '').split(/[.+~-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
function newer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

function createSecurity({ app, net, shell, kiosk, live, sysEvent, repo }) {
  const version = app.getVersion();
  const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(String(repo || '')) ? String(repo) : '';
  let appState = REPO ? { etat: 'jamais' } : { etat: 'non-configure' };
  let told = '';        // version déjà signalée par un avis (une fois par lancement)

  // ---------- Système Linux ----------
  function readEtat() {
    try { const j = JSON.parse(fs.readFileSync(ETAT, 'utf8')); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
  }
  // Une version plus récente que celle qui tourne est installée : à utiliser au prochain démarrage de Brume
  function pending(st) {
    const v = st && (st.actuelle || st.installee);
    return v && v !== version && newer(v, version) ? v : '';
  }
  function watch() {
    const v = pending(readEtat());
    if (v && v !== told) { told = v; sysEvent({ type: 'maj', state: 'installee', version: v }); }
  }
  async function firewall() {
    const r = await run('systemctl', ['is-active', 'nftables.service']);
    return r.out.trim() === 'active' ? 'actif' : 'inactif';
  }
  async function encryption() {
    if (live) return 'live';
    const src = (await run('findmnt', ['-n', '-o', 'SOURCE', '/'])).out.trim().split('\n')[0].replace(/\[.*$/, '');
    if (!src) return 'inconnu';
    const r = await run('lsblk', ['-s', '-n', '-o', 'TYPE', src]);
    if (r.code !== 0) return 'inconnu';
    return r.out.split('\n').some((t) => t.trim() === 'crypt') ? 'chiffre' : 'non';
  }

  // ---------- Application ----------
  async function appCheck(manual) {
    if (!REPO) return appState;
    appState = Object.assign({}, appState, { etat: 'verification' });
    try {
      const res = await net.fetch(`${API}/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Brume' }, cache: 'no-store'
      });
      if (res.status === 404) throw Object.assign(new Error('introuvable'), { code: 'introuvable' });
      if (!res.ok) throw Object.assign(new Error('reseau'), { code: 'reseau' });
      const rel = await res.json();
      const tag = String(rel.tag_name || '');
      const m = tag.match(/^v?(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,6}))?$/i);
      const latest = m ? [m[1], m[2] || 0, m[3] || 0].map(Number).join('.') : '';
      const url = String(rel.html_url || '');
      const okUrl = url.startsWith(`https://github.com/${REPO}/releases/`);
      if (latest && newer(latest, version) && okUrl) {
        appState = { etat: 'disponible', derniere: latest, url, quand: Date.now() };
        if (told !== latest && !manual) { told = latest; sysEvent({ type: 'maj', state: 'disponible', version: latest }); }
      } else appState = { etat: latest ? 'a-jour' : 'aucune', derniere: latest || null, quand: Date.now() };
    } catch (e) {
      appState = { etat: 'erreur', erreur: e.code === 'introuvable' ? 'introuvable' : 'reseau', quand: Date.now() };
    }
    return appState;
  }

  if (kiosk) {
    setTimeout(watch, Number(process.env.BRUME_MAJ_DELAI) || 20 * 1000);
    setInterval(watch, 60 * 1000);
  } else if (REPO) {
    setTimeout(() => appCheck(false), Number(process.env.BRUME_MAJ_DELAI) || 90 * 1000);
    setInterval(() => appCheck(false), DAY);
  }

  async function call(op) {
    switch (op) {
      case 'state': {
        if (!kiosk) return { ok: true, kiosk: false, version, repo: REPO, maj: appState };
        const st = readEtat();
        const [parefeu, chiffre] = await Promise.all([firewall(), encryption()]);
        return { ok: true, kiosk: true, live: !!live, version, repo: REPO, maj: st, attente: pending(st), parefeu, chiffre };
      }
      case 'check': {
        if (!kiosk) return Object.assign({ ok: true }, { maj: await appCheck(true) });
        if (live) return { ok: false, error: 'live' };
        const r = await run('systemctl', ['start', '--no-block', 'brume-maj.service']);
        return r.code === 0 ? { ok: true } : { ok: false, error: (r.err || r.out).trim().slice(0, 200) || 'systemctl' };
      }
      case 'download': {
        if (kiosk || appState.etat !== 'disponible') return { ok: false };
        await shell.openExternal(appState.url);
        return { ok: true };
      }
      default: return { ok: false, error: 'op' };
    }
  }
  return { call };
}

module.exports = { createSecurity, newer };
