// Brume OS — ce que l'application de bureau fait avec le système, sans Electron :
// - un stockage sur disque (un fichier par clé), sans la limite d'environ 5 Mo des navigateurs ;
// - la détection de la clé USB (session live) et de sa partition de conservation ;
// - le Wi-Fi, par NetworkManager (commande nmcli), sur l'image Linux ;
// - le Bluetooth, par BlueZ (bus système D-Bus), sur l'image Linux.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

/* ---------- Stockage ---------- */
// Chaque clé est un fichier <clé en base64url>.json dans le dossier « donnees ».
// Écriture différée (300 ms) et atomique : fichier temporaire, synchronisation, puis renommage.
function createStore(dir, { delay = 300, onError = () => {} } = {}) {
  const fileOf = (k) => path.join(dir, Buffer.from(k, 'utf8').toString('base64url') + '.json');
  const pending = new Map();
  let timer = null;

  function load() {
    const data = {};
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return data; }
    for (const name of names) {
      const full = path.join(dir, name);
      if (name.endsWith('.tmp')) { try { fs.unlinkSync(full); } catch (e) { /* déjà parti */ } continue; }
      if (!name.endsWith('.json')) continue;
      try {
        const key = Buffer.from(name.slice(0, -5), 'base64url').toString('utf8');
        data[key] = fs.readFileSync(full, 'utf8');
      } catch (e) { onError(e); }
    }
    return data;
  }

  function writeNow(k, v) {
    const file = fileOf(k);
    if (v === null) {
      try { fs.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      return;
    }
    const tmp = file + '.' + process.pid + '.tmp';
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, v, null, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  }

  function flushSync() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!pending.size) return true;
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { onError(e); return false; }
    let ok = true;
    for (const [k, v] of [...pending]) {
      try { writeNow(k, v); pending.delete(k); } catch (e) { ok = false; onError(e); }
    }
    if (!ok && !timer) timer = setTimeout(flushSync, 5000);   // disque plein ? on réessaie plus tard
    return ok;
  }

  function set(k, v) {
    if (typeof k !== 'string' || !k || k.length > 300) return false;
    if (v !== null && typeof v !== 'string') return false;
    pending.set(k, v);
    if (!timer) timer = setTimeout(flushSync, delay);
    return true;
  }

  return { dir, load, set, flushSync, pendingCount: () => pending.size };
}

/* ---------- Clé USB, conservation et disque ---------- */
function liveInfo({ cmdline = '/proc/cmdline', medium = '/run/live/medium', persistence = '/run/live/persistence' } = {}) {
  let cmd = '';
  try { cmd = fs.readFileSync(cmdline, 'utf8'); } catch (e) { /* pas Linux */ }
  const live = /(^|\s)boot=live(\s|$)/.test(cmd) || fs.existsSync(medium);
  let persistent = false;
  if (live) {
    try { persistent = fs.readdirSync(persistence).length > 0; } catch (e) { persistent = false; }
  }
  return { live, persistent };
}

function diskInfo(dir) {
  try {
    const s = fs.statfsSync(dir);
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch (e) { return null; }
}

/* ---------- Wi-Fi (NetworkManager) ---------- */
// Sortie « nmcli -t » : champs séparés par « : », avec « \: » et « \\ » à l'intérieur des valeurs.
function splitTerse(line) {
  const out = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) cur += line[++i];
    else if (c === ':') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const rows = (out) => String(out || '').split('\n').filter((l) => l.length).map(splitTerse);

function classifyError(text) {
  const t = String(text || '');
  if (/secrets were required|no secrets|802-1x|wrong password|psk|authentication|key-mgmt/i.test(t)) return 'auth';
  if (/no network with ssid|not found|no such|could not be found/i.test(t)) return 'notfound';
  if (/timeout|timed out/i.test(t)) return 'timeout';
  if (/not authorized|permission/i.test(t)) return 'denied';
  if (/no wi-?fi device|no suitable device|device not found/i.test(t)) return 'nodevice';
  return 'failed';
}

function validSsid(s) {
  return typeof s === 'string' && s.length > 0 && Buffer.byteLength(s, 'utf8') <= 32 && !/[\0\n\r]/.test(s);
}
function validPassword(p) {
  return typeof p === 'string' && p.length <= 64 && !/[\0\n\r]/.test(p);
}

function createNetwork({ nmcli = 'nmcli', exec = execFile } = {}) {
  let chain = Promise.resolve();
  let busy = 0;
  // Une seule commande nmcli à la fois.
  const queue = (fn) => {
    busy++;
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p.finally(() => { busy--; });
  };
  const run = (args, timeout = 20000) => new Promise((resolve) => {
    exec(nmcli, args, { timeout, maxBuffer: 1 << 20, env: Object.assign({}, process.env, { LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' }) },   // messages en anglais, noms accentués intacts
      (err, stdout, stderr) => resolve({
        code: err ? (typeof err.code === 'number' ? err.code : -1) : 0,
        missing: !!(err && err.code === 'ENOENT'),
        out: String(stdout || ''),
        err: String(stderr || (err && err.message) || '')
      }));
  });

  async function readStatus() {
    const g = await run(['-t', '-f', 'STATE,CONNECTIVITY,WIFI', 'general', 'status']);
    if (g.missing) return { available: false, reason: 'missing' };
    if (g.code !== 0) return { available: false, reason: 'stopped' };
    const [state = '', connectivity = '', wifi = ''] = (rows(g.out)[0] || []);
    const d = await run(['-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'device', 'status']);
    const devs = rows(d.out).map(([device, type, st, connection]) => ({ device, type, state: st || '', connection: connection || '' }));
    const wdev = devs.find((x) => x.type === 'wifi');
    const eth = devs.filter((x) => x.type === 'ethernet' && x.state !== 'unmanaged');   // prises gérées par NetworkManager
    const res = {
      available: true,
      state,
      connectivity,
      online: connectivity === 'full',
      portal: connectivity === 'portal',
      enabled: wifi === 'enabled',
      device: wdev ? wdev.device : null,
      wifi: null,
      wired: eth.length ? { connected: eth.some((x) => x.state === 'connected') } : null
    };
    if (wdev) {
      const st = wdev.state.startsWith('connecting') ? 'connecting' : (wdev.state === 'connected' ? 'connected' : (wdev.state === 'unavailable' ? 'unavailable' : 'disconnected'));
      res.wifi = { state: st, ssid: '', signal: 0 };
      if (st === 'connected' || st === 'connecting') {
        const l = await run(['-t', '-f', 'ACTIVE,SSID,SIGNAL', 'device', 'wifi', 'list', '--rescan', 'no']);
        const act = rows(l.out).find((r) => r[0] === 'yes');
        if (act) { res.wifi.ssid = act[1] || ''; res.wifi.signal = +act[2] || 0; }
        if (!res.wifi.ssid) res.wifi.ssid = wdev.connection;
      }
    }
    return res;
  }

  // Réseaux Wi-Fi enregistrés : nom de la connexion → SSID.
  async function savedNetworks() {
    const c = await run(['-t', '-f', 'NAME,UUID,TYPE', 'connection', 'show']);
    const wifi = rows(c.out).filter((r) => r[2] === '802-11-wireless' || r[2] === 'wifi').slice(0, 30);
    const list = [];
    for (const [name, uuid] of wifi) {
      const s = await run(['-g', '802-11-wireless.ssid', 'connection', 'show', 'uuid', uuid]);
      const line = s.out.split('\n')[0];
      list.push({ name, uuid, ssid: line ? splitTerse(line).join(':') : name });
    }
    return list;
  }

  async function readScan(rescan) {
    const l = await run(['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list', '--rescan', rescan ? 'yes' : 'auto'], 30000);
    if (l.missing) return { available: false, networks: [] };
    const saved = await savedNetworks();
    const by = new Map();
    for (const [inUse, ssid, signal, security] of rows(l.out)) {
      if (!ssid) continue;   // réseau masqué
      const sec = (security === '--' ? '' : (security || '')).trim();
      const n = by.get(ssid) || { ssid, signal: 0, security: sec, inUse: false };
      if ((+signal || 0) > n.signal) { n.signal = +signal || 0; n.security = sec; }
      if (inUse === '*') n.inUse = true;
      by.set(ssid, n);
    }
    const networks = [...by.values()].map((n) => Object.assign(n, {
      secure: !!n.security,
      enterprise: /802\.1X/i.test(n.security),
      saved: saved.some((s) => s.ssid === n.ssid)
    })).sort((a, b) => (b.inUse - a.inUse) || (b.signal - a.signal) || a.ssid.localeCompare(b.ssid));
    return { available: l.code === 0, networks, error: l.code === 0 ? null : classifyError(l.err) };
  }

  async function doConnect({ ssid, password, hidden } = {}) {
    if (!validSsid(ssid)) return { ok: false, error: 'invalid' };
    if (password != null && password !== '' && !validPassword(password)) return { ok: false, error: 'invalid' };
    const st = await readStatus();
    if (!st.available) return { ok: false, error: 'unavailable' };
    if (!st.device) return { ok: false, error: 'nodevice' };
    const saved = (await savedNetworks()).filter((s) => s.ssid === ssid);
    if (saved.length && !password) {
      const r = await run(['-w', '45', 'connection', 'up', 'uuid', saved[0].uuid, 'ifname', st.device], 60000);
      return r.code === 0 ? { ok: true } : { ok: false, error: classifyError(r.err + r.out) };
    }
    // Nouveau mot de passe pour un réseau connu : on repart d'une connexion propre.
    for (const s of saved) await run(['connection', 'delete', 'uuid', s.uuid]);
    const args = ['-w', '45', 'device', 'wifi', 'connect', ssid];
    if (password) args.push('password', password);
    if (hidden) args.push('hidden', 'yes');
    args.push('ifname', st.device);
    const r = await run(args, 60000);
    if (r.code === 0) return { ok: true };
    // Échec : ne pas laisser derrière une connexion avec un mauvais mot de passe.
    for (const s of (await savedNetworks()).filter((x) => x.ssid === ssid)) await run(['connection', 'delete', 'uuid', s.uuid]);
    return { ok: false, error: classifyError(r.err + r.out) };
  }

  async function doDisconnect() {
    const st = await readStatus();
    if (!st.device) return { ok: false, error: 'nodevice' };
    const r = await run(['device', 'disconnect', st.device]);
    return r.code === 0 ? { ok: true } : { ok: false, error: classifyError(r.err) };
  }

  async function doForget(ssid) {
    if (!validSsid(ssid)) return { ok: false, error: 'invalid' };
    const saved = (await savedNetworks()).filter((s) => s.ssid === ssid);
    for (const s of saved) await run(['connection', 'delete', 'uuid', s.uuid]);
    return { ok: true };
  }

  async function doRadio(on) {
    const r = await run(['radio', 'wifi', on ? 'on' : 'off']);
    return r.code === 0 ? { ok: true } : { ok: false, error: classifyError(r.err) };
  }

  return {
    busy: () => busy > 0,
    status: () => queue(readStatus),
    scan: (rescan) => queue(() => readScan(!!rescan)),
    connect: (o) => queue(() => doConnect(o || {})),
    disconnect: () => queue(doDisconnect),
    forget: (ssid) => queue(() => doForget(ssid)),
    radio: (on) => queue(() => doRadio(!!on))
  };
}

/* ---------- Bluetooth (BlueZ, par le bus système D-Bus) ---------- */
const BLUEZ = 'org.bluez';
const ADAPTER = 'org.bluez.Adapter1';
const DEVICE = 'org.bluez.Device1';
const BATTERY = 'org.bluez.Battery1';
const PROPS = 'org.freedesktop.DBus.Properties';
const AGENT_PATH = '/org/brume/agent';
const BT_ADDR = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;

// Famille d'appareil, d'après l'icône annoncée par BlueZ.
function btKind(icon) {
  const i = String(icon || '');
  if (/^audio-|headset|headphone|speaker/.test(i)) return 'audio';
  if (i === 'input-keyboard') return 'keyboard';
  if (i === 'input-mouse' || i === 'input-tablet') return 'mouse';
  if (i === 'input-gaming') return 'gamepad';
  if (i === 'phone') return 'phone';
  if (i === 'computer') return 'computer';
  return 'other';
}

function btError(e) {
  const type = String((e && (e.type || e.name)) || '');
  const text = String((e && e.text) || (e && e.message) || '');
  if (e && e.code === 'TIMEOUT') return 'timeout';
  if (/AlreadyExists|AlreadyConnected/.test(type)) return 'already';
  if (/AuthenticationCanceled|\.Canceled$/.test(type)) return 'canceled';
  if (/Authentication|Rejected/.test(type)) return 'auth';
  if (/InProgress/.test(type)) return 'busy';
  if (/NotReady/.test(type)) return 'off';
  if (/Blocked/.test(type) || /rfkill/i.test(text)) return 'blocked';
  if (/NoReply/.test(type)) return 'timeout';
  if (/DoesNotExist|UnknownObject|UnknownMethod/.test(type)) return 'notfound';
  if (/profile-unavailable|NotSupported|NotAvailable/i.test(type + text)) return 'profile';
  if (/ConnectionAttemptFailed|Page Timeout|Host is down|timed? ?out/i.test(type + ' ' + text)) return 'unreachable';
  if (/ServiceUnknown|NameHasNoOwner/.test(type)) return 'noservice';
  return 'failed';
}

// ask(question) : pose une question à la personne (code à confirmer, code PIN…) et rend sa réponse.
// show(message) : affiche un code à taper sur l'appareil, ou ferme ce message ({ type: 'close' }).
function createBluetooth({ lib = null, busAddress = null, ask = async () => null, show = () => {},
  exec = execFile, rfkillDevice = '/dev/rfkill', timeoutScale = 1 } = {}) {
  let dbus = null;
  let bus = null;
  let connecting = null;
  let agentOwner = null;
  let pairing = null;              // adresse de l'appareil en cours d'association
  let stopTimer = null;
  let promptSeq = 0;
  let wasConnected = new Set();   // pour suivre les casques qui se reconnectent d'eux-mêmes

  function load() {
    if (!dbus) dbus = lib || require('dbus-next');
    return dbus;
  }
  function systemAddress() {
    if (busAddress) return busAddress;
    const env = process.env.DBUS_SYSTEM_BUS_ADDRESS || '';
    const m = /unix:path=([^,;]+)/.exec(env);
    // « socket= » : connexion directe par le module net de Node, sans module natif.
    return 'unix:socket=' + (m ? m[1] : '/run/dbus/system_bus_socket');
  }
  const withTimeout = (p, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => { const e = new Error('délai dépassé'); e.code = 'TIMEOUT'; reject(e); }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

  async function connect() {
    if (bus) return bus;
    if (connecting) return connecting;
    connecting = (async () => {
      const d = load();
      const b = d.sessionBus({ busAddress: systemAddress() });
      b.on('error', () => { if (bus === b) { bus = null; agentOwner = null; } });
      // Un premier appel au bus vérifie la connexion.
      await withTimeout(b.call(new d.Message({ destination: 'org.freedesktop.DBus', path: '/org/freedesktop/DBus',
        interface: 'org.freedesktop.DBus', member: 'GetId' })), 5000);
      exportAgent(b);
      bus = b;
      return b;
    })();
    try { return await connecting; } finally { connecting = null; }
  }

  async function call(dest, objPath, iface, member, signature = '', body = [], timeout = 10000) {
    const d = load();
    const b = await connect();
    const reply = await withTimeout(b.call(new d.Message({ destination: dest, path: objPath, interface: iface, member, signature, body })), timeout);
    return reply ? reply.body : [];
  }
  const bz = (objPath, iface, member, signature, body, timeout) => call(BLUEZ, objPath, iface, member, signature, body, timeout);
  const setProp = (objPath, iface, name, sig, value) => bz(objPath, PROPS, 'Set', 'ssv', [iface, name, new (load().Variant)(sig, value)]);

  const unwrap = (props) => {
    const o = {};
    for (const k of Object.keys(props || {})) { const v = props[k]; o[k] = v && typeof v === 'object' && 'value' in v ? v.value : v; }
    return o;
  };

  // L'agent répond à BlueZ pendant les associations (codes à confirmer, à taper, PIN).
  function exportAgent(b) {
    const d = load();
    const reject = (why) => new d.DBusError('org.bluez.Error.Rejected', why || 'Refusé');
    const nameOf = async (dev) => {
      try {
        const [v] = await bz(dev, PROPS, 'Get', 'ss', [DEVICE, 'Alias'], 3000);
        return String(v && v.value != null ? v.value : v);
      } catch (e) { return ''; }
    };
    const question = async (q) => {
      const id = ++promptSeq;
      const answer = await Promise.race([
        Promise.resolve(ask(Object.assign({ id }, q))),
        new Promise((r) => setTimeout(() => r(null), 60000 * timeoutScale))
      ]);
      show({ type: 'close', id });
      return answer;
    };
    const devAddr = (dev) => { const m = /dev_([0-9A-F_]{17})$/i.exec(dev || ''); return m ? m[1].replace(/_/g, ':') : ''; };
    class Agent extends d.interface.Interface {
      Release() {}
      async RequestPinCode(dev) {
        const r = await question({ type: 'pin', name: await nameOf(dev) });
        if (typeof r !== 'string' || !/^[0-9A-Za-z]{1,16}$/.test(r)) throw reject();
        return r;
      }
      async DisplayPinCode(dev, pin) { show({ type: 'display', id: ++promptSeq, name: await nameOf(dev), passkey: String(pin) }); }
      async RequestPasskey(dev) {
        const r = await question({ type: 'passkey', name: await nameOf(dev) });
        const n = Number(r);
        if (!Number.isInteger(n) || n < 0 || n > 999999) throw reject();
        return n;
      }
      async DisplayPasskey(dev, passkey) {
        show({ type: 'display', id: ++promptSeq, name: await nameOf(dev), passkey: String(passkey).padStart(6, '0') });
      }
      async RequestConfirmation(dev, passkey) {
        const r = await question({ type: 'confirm', name: await nameOf(dev), passkey: String(passkey).padStart(6, '0') });
        if (r !== true) throw reject();
      }
      async RequestAuthorization(dev) {
        if (pairing && pairing === devAddr(dev)) return;   // association lancée depuis Brume
        const r = await question({ type: 'authorize', name: await nameOf(dev) });
        if (r !== true) throw reject();
      }
      async AuthorizeService(dev) {
        try {
          const [v] = await bz(dev, PROPS, 'Get', 'ss', [DEVICE, 'Paired'], 3000);
          if (v && v.value === true) return;
        } catch (e) { /* appareil inconnu */ }
        if (pairing && pairing === devAddr(dev)) return;
        throw reject();
      }
      Cancel() { show({ type: 'close', id: 0 }); }
    }
    Agent.configureMembers({
      methods: {
        Release: {},
        RequestPinCode: { inSignature: 'o', outSignature: 's' },
        DisplayPinCode: { inSignature: 'os' },
        RequestPasskey: { inSignature: 'o', outSignature: 'u' },
        DisplayPasskey: { inSignature: 'ouq' },
        RequestConfirmation: { inSignature: 'ou' },
        RequestAuthorization: { inSignature: 'o' },
        AuthorizeService: { inSignature: 'os' },
        Cancel: {}
      }
    });
    b.export(AGENT_PATH, new Agent('org.bluez.Agent1'));
  }

  // L'agent est déclaré à BlueZ, et de nouveau si le service redémarre.
  async function ensureAgent() {
    const [owner] = await call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'GetNameOwner', 's', [BLUEZ], 4000);
    if (owner === agentOwner) return;
    try { await bz('/org/bluez', 'org.bluez.AgentManager1', 'RegisterAgent', 'os', [AGENT_PATH, 'KeyboardDisplay']); }
    catch (e) { if (btError(e) !== 'already') throw e; }
    await bz('/org/bluez', 'org.bluez.AgentManager1', 'RequestDefaultAgent', 'o', [AGENT_PATH]);
    agentOwner = owner;
  }

  async function objects() {
    const [objs] = await bz('/', 'org.freedesktop.DBus.ObjectManager', 'GetManagedObjects');
    return objs || {};
  }
  function adapterOf(objs) {
    const list = Object.keys(objs).filter((p) => objs[p][ADAPTER]).sort();
    return list.length ? list[0] : null;
  }

  async function readStatus() {
    try {
      await connect();
    } catch (e) { return { available: false, reason: 'nobus' }; }
    let objs;
    try {
      await ensureAgent();
      objs = await objects();
    } catch (e) {
      const why = btError(e);
      return { available: false, reason: why === 'noservice' ? 'noservice' : 'failed' };
    }
    const ap = adapterOf(objs);
    if (!ap) return { available: true, adapter: null, devices: [] };
    const a = unwrap(objs[ap][ADAPTER]);
    const devices = [];
    for (const p of Object.keys(objs)) {
      if (!objs[p][DEVICE] || !p.startsWith(ap + '/')) continue;
      const d = unwrap(objs[p][DEVICE]);
      const named = typeof d.Name === 'string' && d.Name.trim();
      if (!d.Paired && !named) continue;   // appareils sans nom : seulement une adresse, inutile à montrer
      const bat = objs[p][BATTERY] ? unwrap(objs[p][BATTERY]).Percentage : null;
      devices.push({
        address: String(d.Address || ''),
        name: String(d.Alias || d.Name || d.Address || ''),
        kind: btKind(d.Icon),
        paired: !!d.Paired,
        connected: !!d.Connected,
        trusted: !!d.Trusted,
        rssi: typeof d.RSSI === 'number' ? d.RSSI : null,
        battery: typeof bat === 'number' ? bat : null,
        pairing: pairing === String(d.Address || '')
      });
    }
    // Un casque ou une enceinte vient de se connecter (même tout seul) : le son passe dessus.
    const now = new Set(devices.filter((d) => d.connected).map((d) => d.address));
    for (const d of devices) if (d.connected && d.kind === 'audio' && !wasConnected.has(d.address)) audioTo(d.address);
    wasConnected = now;
    devices.sort((x, y) => (y.paired - x.paired) || (y.connected - x.connected) ||
      ((y.rssi == null ? -999 : y.rssi) - (x.rssi == null ? -999 : x.rssi)) || x.name.localeCompare(y.name));
    return {
      available: true,
      adapter: { name: String(a.Alias || a.Name || ''), address: String(a.Address || ''), powered: !!a.Powered, discovering: !!a.Discovering },
      devices
    };
  }

  async function devicePath(address) {
    if (!BT_ADDR.test(String(address || ''))) return null;
    const objs = await objects();
    const ap = adapterOf(objs);
    if (!ap) return null;
    const p = ap + '/dev_' + address.toUpperCase().replace(/:/g, '_');
    return objs[p] && objs[p][DEVICE] ? { path: p, adapter: ap, props: unwrap(objs[p][DEVICE]) } : null;
  }

  // Débloque le Bluetooth (touche « mode avion », par exemple) : événement rfkill « tout débloquer ».
  function rfkillUnblock() {
    try {
      const fd = fs.openSync(rfkillDevice, 'w');
      try { fs.writeSync(fd, Buffer.from([0, 0, 0, 0, 2, 3, 0, 0])); } finally { fs.closeSync(fd); }
      return true;
    } catch (e) { return false; }
  }

  // Le son passe sur le casque ou l'enceinte qui vient de se connecter.
  function audioTo(address) {
    const key = address.replace(/:/g, '_').toUpperCase();
    let tries = 0;
    const tryOnce = () => {
      tries++;
      exec('pactl', ['list', 'short', 'sinks'], { timeout: 4000 }, (err, out) => {
        const line = !err && String(out || '').split('\n').find((l) => l.toUpperCase().includes(key));
        if (line) exec('pactl', ['set-default-sink', line.split('\t')[1]], { timeout: 4000 }, () => {});
        else if (tries < 10) setTimeout(tryOnce, 800);
      });
    };
    tryOnce();
  }

  const ok = () => ({ ok: true });
  const fail = (e) => ({ ok: false, error: btError(e) });

  async function doPower(on) {
    let objs;
    try { objs = await objects(); } catch (e) { return fail(e); }
    const ap = adapterOf(objs);
    if (!ap) return { ok: false, error: 'noadapter' };
    try { await setProp(ap, ADAPTER, 'Powered', 'b', !!on); return ok(); }
    catch (e) {
      if (!on || !rfkillUnblock()) return fail(e);
      await new Promise((r) => setTimeout(r, 700 * timeoutScale));
      try { await setProp(ap, ADAPTER, 'Powered', 'b', true); return ok(); } catch (e2) { return fail(e2); }
    }
  }

  async function doScan(on) {
    let objs;
    try { objs = await objects(); } catch (e) { return fail(e); }
    const ap = adapterOf(objs);
    if (!ap) return { ok: false, error: 'noadapter' };
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    try {
      if (on) {
        await bz(ap, ADAPTER, 'StartDiscovery');
        stopTimer = setTimeout(() => { stopTimer = null; bz(ap, ADAPTER, 'StopDiscovery').catch(() => {}); }, 40000 * timeoutScale);
      } else {
        await bz(ap, ADAPTER, 'StopDiscovery');
      }
      return ok();
    } catch (e) {
      const why = btError(e);
      return (why === 'busy' || (!on && why === 'failed')) ? ok() : fail(e);
    }
  }

  async function doPair(address) {
    const dev = await devicePath(address).catch(() => null);
    if (!dev) return { ok: false, error: 'notfound' };
    // La recherche gêne l'association : on l'arrête d'abord.
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    await bz(dev.adapter, ADAPTER, 'StopDiscovery').catch(() => {});
    pairing = dev.props.Address;
    try {
      if (!dev.props.Paired) {
        try { await bz(dev.path, DEVICE, 'Pair', '', [], 120000); }
        catch (e) { if (btError(e) !== 'already') return fail(e); }
      }
      await setProp(dev.path, DEVICE, 'Trusted', 'b', true).catch(() => {});
      try { await bz(dev.path, DEVICE, 'Connect', '', [], 30000); }
      catch (e) {
        // Certains appareils (claviers, manettes) se connectent d'eux-mêmes juste après.
        const now = await devicePath(address).catch(() => null);
        if (!(now && now.props.Connected) && btError(e) !== 'already') return { ok: true, connected: false };
      }
      if (btKind(dev.props.Icon) === 'audio') audioTo(dev.props.Address);
      return { ok: true, connected: true };
    } finally {
      pairing = null;
      show({ type: 'close', id: 0 });
    }
  }

  async function doConnect(address) {
    const dev = await devicePath(address).catch(() => null);
    if (!dev) return { ok: false, error: 'notfound' };
    try { await bz(dev.path, DEVICE, 'Connect', '', [], 30000); }
    catch (e) { if (btError(e) !== 'already') return fail(e); }
    if (btKind(dev.props.Icon) === 'audio') audioTo(dev.props.Address);
    return ok();
  }

  async function doDisconnect(address) {
    const dev = await devicePath(address).catch(() => null);
    if (!dev) return { ok: false, error: 'notfound' };
    try { await bz(dev.path, DEVICE, 'Disconnect', '', [], 15000); return ok(); } catch (e) { return fail(e); }
  }

  async function doForget(address) {
    const dev = await devicePath(address).catch(() => null);
    if (!dev) return ok();
    try { await bz(dev.adapter, ADAPTER, 'RemoveDevice', 'o', [dev.path]); return ok(); } catch (e) { return fail(e); }
  }

  async function doCancel(address) {
    const dev = await devicePath(address).catch(() => null);
    if (dev) await bz(dev.path, DEVICE, 'CancelPairing').catch(() => {});
    return ok();
  }

  const guard = (fn) => async (...a) => {
    try { await connect(); } catch (e) { return { ok: false, error: 'unavailable' }; }
    try { return await fn(...a); } catch (e) { return fail(e); }
  };

  return {
    pairing: () => pairing,
    busName: () => (bus ? bus.name : null),   // pour les tests
    status: () => readStatus(),
    power: guard(doPower),
    scan: guard(doScan),
    pair: guard(doPair),
    connect: guard(doConnect),
    disconnect: guard(doDisconnect),
    forget: guard(doForget),
    cancel: guard(doCancel),
    close: () => { if (bus) { try { bus.disconnect(); } catch (e) { /* déjà fermé */ } bus = null; } }
  };
}

module.exports = { createStore, liveInfo, diskInfo, createNetwork, createBluetooth, btKind, btError, splitTerse, classifyError };
