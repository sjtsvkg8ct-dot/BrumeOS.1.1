// Cet appareil : ce que Brume sait du matériel sur lequel il tourne.
// - Linux (le système Brume) : /proc et /sys pour le processeur, la mémoire, le modèle de la machine
//   (et s'il s'agit d'une machine virtuelle), la batterie, les cartes réseau, le Bluetooth et le son ;
//   lsblk pour les disques.
// - macOS et Windows (l'application) : le système est interrogé (sysctl, system_profiler, PowerShell).
// - Partout : la carte graphique vue par Chromium et les écrans vus par Electron.
// Rien ne quitte l'ordinateur : ces informations ne servent qu'à la fiche « Cet appareil ».
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const VENDORS = { 0x8086: 'Intel', 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x1022: 'AMD', 0x15ad: 'VMware', 0x80ee: 'VirtualBox',
  0x106b: 'Apple', 0x1af4: 'Red Hat (virtio)', 0x1234: 'QEMU', 0x5143: 'Qualcomm', 0x13b5: 'ARM', 0x1414: 'Microsoft' };
const SOFT = /llvmpipe|softpipe|swiftshader|software|basic render/i;
const VIRT = [[/virtualbox|innotek/i, 'VirtualBox'], [/vmware/i, 'VMware'], [/qemu|bochs/i, 'QEMU'], [/kvm/i, 'KVM'],
  [/parallels/i, 'Parallels'], [/xen/i, 'Xen'], [/microsoft corporation.*virtual|hyper-v|virtual machine/i, 'Hyper-V'], [/utm/i, 'UTM']];

function createHardware({ app, screen, kiosk, root = '/', exec = execFile, platform = process.platform, live = null, diskInfo = null } = {}) {
  const P = (p) => path.join(root, p);
  const read = (p) => { try { return fs.readFileSync(P(p), 'utf8').replace(/\u0000/g, '').trim(); } catch (e) { return ''; } };
  const list = (p) => { try { return fs.readdirSync(P(p)); } catch (e) { return []; } };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const run = (cmd, args, ms = 6000) => new Promise((res) => {
    try { exec(cmd, args, { timeout: ms, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, out) => res(err ? '' : String(out || ''))); }
    catch (e) { res(''); }
  });
  const clean = (s) => String(s || '').replace(/\((R|TM|tm|r)\)/g, '').replace(/(\s+CPU)?\s+@\s+[\d.]+\s*GHz/i, '').replace(/\s{2,}/g, ' ').trim();
  const bad = (s) => !s || /^(to be filled|default string|system product name|system manufacturer|not specified|none|o\.e\.m\.?|123456789|x\.x)$/i.test(s.trim());
  const virtOf = (...s) => { const t = s.join(' '); const v = VIRT.find(([re]) => re.test(t)); return v ? v[1] : ''; };

  // ---------- Linux ----------
  function linuxMachine() {
    const d = (k) => read('sys/class/dmi/id/' + k);
    let vendor = d('sys_vendor'), model = d('product_name'), version = d('product_version');
    const board = [d('board_vendor'), d('board_name')].filter((x) => !bad(x)).join(' ');
    if (bad(model)) { model = board || read('proc/device-tree/model') || ''; if (bad(vendor)) vendor = ''; }
    if (bad(vendor)) vendor = '';
    if (bad(version) || /^[\d.\s]+$/.test(version)) version = '';
    const chassis = num(d('chassis_type'));
    const kind = [8, 9, 10, 14, 31, 32].includes(chassis) ? 'laptop' : [30].includes(chassis) ? 'tablet' : [3, 4, 5, 6, 7, 13, 15, 16, 35, 36].includes(chassis) ? 'desktop' : '';
    const flags = /\bhypervisor\b/.test(read('proc/cpuinfo'));
    const virt = virtOf(vendor, model, d('bios_vendor'), d('board_vendor')) || (flags ? 'virtuelle' : '');
    return { vendor, model: model.replace(/\s{2,}/g, ' '), version, kind, virtual: virt, bios: [d('bios_vendor'), d('bios_version')].filter((x) => !bad(x)).join(' ') };
  }
  function linuxCpu() {
    const txt = read('proc/cpuinfo');
    const blocks = txt.split(/\n\s*\n/).map((b) => Object.fromEntries(b.split('\n').map((l) => { const i = l.indexOf(':'); return i < 0 ? null : [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; }).filter(Boolean)));
    const procs = blocks.filter((b) => 'processor' in b);
    const f = procs[0] || {};
    let model = f['model name'] || f['hardware'] || f['cpu model'] || '';
    if (!model) { const c = os.cpus(); model = c.length ? c[0].model : ''; }
    if (!model || /^\d+$/.test(model)) model = read('proc/device-tree/model') || model;
    const cores = new Set(procs.map((b) => (b['physical id'] || '0') + ':' + (b['core id'] || b.processor))).size;
    const threads = procs.length || os.cpus().length;
    let mhz = num(read('sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq')) / 1000;
    if (!mhz) mhz = Math.max(0, ...procs.map((b) => num(b['cpu mhz'])));
    return { model: clean(model), vendor: { GenuineIntel: 'Intel', AuthenticAMD: 'AMD' }[f.vendor_id] || '', cores: cores || threads, threads, mhz: Math.round(mhz),
      cache: f['cache size'] || '', arch: os.arch(), flags: /\bavx2\b/.test(f.flags || '') ? ['AVX2'] : [] };
  }
  function linuxMemory() {
    const m = read('proc/meminfo'), g = (k) => { const r = new RegExp('^' + k + ':\\s+(\\d+)', 'm').exec(m); return r ? +r[1] * 1024 : 0; };
    return { total: g('MemTotal') || os.totalmem(), free: g('MemAvailable') || os.freemem(), swap: g('SwapTotal') };
  }
  async function linuxDisks() {
    const out = await run('lsblk', ['-J', '-b', '-d', '-o', 'NAME,SIZE,MODEL,ROTA,TRAN,RM,TYPE,VENDOR']);
    let j; try { j = JSON.parse(out); } catch (e) { return []; }
    const yes = (v) => v === true || v === '1' || v === 1;
    return (j.blockdevices || []).filter((b) => b.type === 'disk' && num(b.size) > 0 && !/^(zram|loop|ram|sr|fd)/.test(b.name))
      .map((b) => {
        const tran = String(b.tran || '').toLowerCase(), model = [b.vendor, b.model].filter(Boolean).map((s) => String(s).trim()).filter((s) => !/^0x[0-9a-f]+$/i.test(s)).join(' ').trim();
        const kind = tran === 'virtio' || /^x?vd[a-z]/.test(b.name) || /vbox|vmware|qemu|virtual/i.test(model) ? 'virt' : tran === 'nvme' || /^nvme/.test(b.name) ? 'nvme' : tran === 'usb' || yes(b.rm) ? 'usb' : /^mmcblk/.test(b.name) ? 'sd' : yes(b.rota) ? 'hdd' : 'ssd';
        return { name: b.name, model, size: num(b.size), kind, removable: yes(b.rm) };
      });
  }
  function linuxBattery() {
    for (const n of list('sys/class/power_supply')) {
      const b = (k) => read(`sys/class/power_supply/${n}/${k}`);
      if (b('type') !== 'Battery' || b('present') === '0' || b('scope') === 'Device') continue;
      const full = num(b('energy_full')) || num(b('charge_full')), design = num(b('energy_full_design')) || num(b('charge_full_design'));
      return { present: true, level: num(b('capacity')), status: b('status').toLowerCase(), health: full && design ? Math.min(100, Math.round(100 * full / design)) : 0,
        cycles: num(b('cycle_count')), model: [b('manufacturer'), b('model_name')].filter((x) => !bad(x)).join(' ') };
    }
    const ac = list('sys/class/power_supply').some((n) => read(`sys/class/power_supply/${n}/type`) === 'Mains');
    return { present: false, mains: ac };
  }
  function linuxNet() {
    const ifs = os.networkInterfaces();
    return list('sys/class/net').filter((n) => n !== 'lo' && fs.existsSync(P(`sys/class/net/${n}/device`))).map((n) => {
      const wifi = fs.existsSync(P(`sys/class/net/${n}/wireless`)) || fs.existsSync(P(`sys/class/net/${n}/phy80211`));
      let driver = ''; try { driver = path.basename(fs.readlinkSync(P(`sys/class/net/${n}/device/driver`))); } catch (e) { const u = /DRIVER=(\S+)/.exec(read(`sys/class/net/${n}/device/uevent`)); if (u) driver = u[1]; }
      const ip = (ifs[n] || []).filter((a) => a.family === 'IPv4' || a.family === 4).map((a) => a.address)[0] || '';
      return { name: n, kind: wifi ? 'wifi' : 'ethernet', driver, mac: read(`sys/class/net/${n}/address`), up: read(`sys/class/net/${n}/operstate`) === 'up', ip };
    });
  }
  function linuxBluetooth() { return list('sys/class/bluetooth').filter((n) => /^hci\d+$/.test(n)); }
  function linuxAudio() {
    return read('proc/asound/cards').split('\n').map((l) => /^\s*\d+\s+\[[^\]]*\]:\s*(.*?)\s+-\s+(.*)$/.exec(l)).filter(Boolean)
      .map((m) => m[2].trim()).filter((x, i, a) => x && a.indexOf(x) === i);
  }
  function linuxGpuSys() {
    return list('sys/class/drm').filter((n) => /^card\d+$/.test(n)).map((n) => {
      const vend = parseInt(read(`sys/class/drm/${n}/device/vendor`), 16), u = /DRIVER=(\S+)/.exec(read(`sys/class/drm/${n}/device/uevent`));
      return { vendorId: vend || 0, driver: u ? u[1] : '' };
    }).filter((x) => x.vendorId || x.driver);
  }
  function linuxOs() {
    const r = read('etc/os-release'), g = (k) => { const m = new RegExp('^' + k + '="?([^"\\n]*)"?', 'm').exec(r); return m ? m[1] : ''; };
    return { name: g('PRETTY_NAME') || 'Linux', kernel: os.release() };
  }

  // ---------- macOS ----------
  async function macInfo() {
    const sc = async (k) => (await run('sysctl', ['-n', k], 3000)).trim();
    let hw = {};
    try { const j = JSON.parse(await run('system_profiler', ['SPHardwareDataType', '-json'], 8000)); hw = (j.SPHardwareDataType || [])[0] || {}; } catch (e) { /* trop lent ou absent */ }
    const model = hw.machine_name || await sc('hw.model');
    const brand = await sc('machdep.cpu.brand_string') || hw.chip_type || '';
    const ver = (await run('sw_vers', ['-productVersion'], 3000)).trim();
    return {
      machine: { vendor: 'Apple', model, version: '', id: hw.machine_model || '', kind: /book/i.test(model) ? 'laptop' : /imac|mac ?mini|mac ?studio|mac ?pro/i.test(model) ? 'desktop' : '', virtual: virtOf(model) },
      cpu: { model: clean(brand), vendor: /apple/i.test(brand) ? 'Apple' : 'Intel', cores: num(await sc('hw.physicalcpu')) || os.cpus().length, threads: num(await sc('hw.logicalcpu')) || os.cpus().length,
        mhz: Math.round(num(await sc('hw.cpufrequency_max')) / 1e6) || 0, arch: os.arch() },
      memory: { total: num(await sc('hw.memsize')) || os.totalmem(), free: os.freemem() },
      os: { name: 'macOS ' + ver, kernel: os.release() }
    };
  }
  // ---------- Windows ----------
  async function winInfo() {
    const ps = '$c=Get-CimInstance Win32_ComputerSystem;$p=Get-CimInstance Win32_Processor|Select-Object -First 1;$o=Get-CimInstance Win32_OperatingSystem;'
      + '$d=@(Get-CimInstance Win32_DiskDrive|ForEach-Object{@{m=$_.Model;s=[double]$_.Size;t=$_.MediaType;i=$_.InterfaceType}});'
      + '$b=Get-CimInstance Win32_Battery|Select-Object -First 1;$e=Get-CimInstance Win32_SystemEnclosure|Select-Object -First 1;'
      + '@{v=$c.Manufacturer;m=$c.Model;pn=$p.Name;co=$p.NumberOfCores;th=$p.NumberOfLogicalProcessors;mh=$p.MaxClockSpeed;os=$o.Caption;ov=$o.Version;'
      + 'disks=$d;bl=$b.EstimatedChargeRemaining;bs=$b.BatteryStatus;ch=@($e.ChassisTypes)}|ConvertTo-Json -Compress -Depth 4';
    let j = {}; try { j = JSON.parse(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 12000)) || {}; } catch (e) { /* PowerShell absent */ }
    const ch = (j.ch || []).map(Number);
    return {
      machine: { vendor: bad(j.v) ? '' : String(j.v || ''), model: bad(j.m) ? '' : String(j.m || ''), kind: ch.some((x) => [8, 9, 10, 14, 31, 32].includes(x)) ? 'laptop' : ch.length ? 'desktop' : '', virtual: virtOf(j.v, j.m) },
      cpu: { model: clean(j.pn || (os.cpus()[0] || {}).model), cores: num(j.co) || os.cpus().length, threads: num(j.th) || os.cpus().length, mhz: num(j.mh), arch: os.arch() },
      memory: { total: os.totalmem(), free: os.freemem() },
      disks: (Array.isArray(j.disks) ? j.disks : j.disks ? [j.disks] : []).map((d, i) => ({ name: 'disk' + i, model: String(d.m || '').trim(), size: num(d.s),
        kind: /nvme/i.test(d.m || '') ? 'nvme' : /usb/i.test(d.i || '') || /removable|external/i.test(d.t || '') ? 'usb' : /ssd/i.test(d.m || '') ? 'ssd' : '', removable: /usb/i.test(d.i || '') })),
      battery: j.bl != null ? { present: true, level: num(j.bl), status: [6, 7, 8, 9].includes(num(j.bs)) ? 'charging' : num(j.bs) === 3 ? 'full' : num(j.bs) === 2 ? 'not charging' : 'discharging' } : { present: false },
      os: { name: String(j.os || 'Windows').replace(/^Microsoft\s+/, ''), kernel: String(j.ov || os.release()) }
    };
  }

  // ---------- Partout ----------
  async function gpus(sysList) {
    let info = {};
    try { info = await app.getGPUInfo('complete'); } catch (e) { try { info = await app.getGPUInfo('basic'); } catch (x) { info = {}; } }
    const aux = info.auxAttributes || {}, renderer = String(aux.glRenderer || '').trim();
    const devs = (info.gpuDevice || []).filter((d) => d.vendorId || d.deviceString);
    const out = devs.map((d) => {
      const sys = (sysList || []).find((s) => s.vendorId === d.vendorId) || {};
      const vend = d.vendorString || VENDORS[d.vendorId] || '';
      let name = String(d.deviceString || '').trim();
      if (!name && d.active && renderer && !SOFT.test(renderer)) name = renderer;   // un rendu logiciel n'est pas le nom de la carte
      return { name: name || (vend ? vend : ''), vendor: vend, driver: sys.driver || d.driverVendor || '', driverVersion: d.driverVersion || '', active: !!d.active };
    }).filter((g) => g.name || g.vendor);
    if (!out.length && renderer) out.push({ name: renderer, vendor: String(aux.glVendor || ''), driver: '', active: true });
    (sysList || []).forEach((s) => { if (!out.some((g) => VENDORS[s.vendorId] && g.vendor === VENDORS[s.vendorId])) out.push({ name: VENDORS[s.vendorId] || '', vendor: VENDORS[s.vendorId] || '', driver: s.driver, active: false }); });
    const st = info.featureStatus || (typeof app.getGPUFeatureStatus === 'function' ? app.getGPUFeatureStatus() : {}) || {};
    const software = SOFT.test(renderer) || /disabled|unavailable_software|software/.test(String(st.gpu_compositing || ''));
    return { list: out.filter((g) => g.name), renderer, software };
  }
  function displays() {
    try {
      return screen.getAllDisplays().map((d) => ({
        w: Math.round(d.size.width * d.scaleFactor), h: Math.round(d.size.height * d.scaleFactor), scale: d.scaleFactor,
        hz: Math.round(d.displayFrequency || 0), internal: !!d.internal, label: d.label || '', primary: d.id === screen.getPrimaryDisplay().id }));
    } catch (e) { return []; }
  }

  let cache = null, busy = null;
  async function collect() {
    const base = { source: 'app', platform, kiosk: !!kiosk, live: live || null };
    let r;
    if (platform === 'linux') {
      const sys = linuxGpuSys();
      r = Object.assign(base, { machine: linuxMachine(), cpu: linuxCpu(), memory: linuxMemory(), disks: await linuxDisks(), battery: linuxBattery(),
        net: linuxNet(), bluetooth: linuxBluetooth(), audio: linuxAudio(), os: linuxOs(), gpu: await gpus(sys) });
    } else if (platform === 'darwin') {
      r = Object.assign(base, await macInfo(), { gpu: await gpus([]), disks: [], battery: null, net: [], bluetooth: null, audio: [] });
    } else {
      r = Object.assign(base, await winInfo(), { gpu: await gpus([]), net: [], bluetooth: null, audio: [] });
    }
    if (platform !== 'linux') {
      const ifs = os.networkInterfaces();
      r.net = Object.entries(ifs).filter(([n, a]) => !/^(lo|Loopback|vEthernet|utun|awdl|llw|bridge|veth|docker)/i.test(n) && a.some((x) => !x.internal))
        .map(([n, a]) => ({ name: n, kind: /wi-?fi|wlan|wireless|^en0$/i.test(n) ? 'wifi' : 'ethernet', mac: (a[0] || {}).mac || '', ip: (a.find((x) => x.family === 'IPv4' || x.family === 4) || {}).address || '', up: true }));
    }
    r.displays = displays();
    r.storage = diskInfo ? diskInfo() : null;
    r.os = Object.assign({ arch: os.arch(), host: os.hostname(), uptime: os.uptime(), brume: app.getVersion(), chrome: process.versions.chrome, electron: process.versions.electron }, r.os || {});
    return r;
  }
  async function info(fresh) {
    if (cache && !fresh) {   // le reste ne change pas : seulement la mémoire libre, la batterie, le réseau, l'allumage
      if (platform === 'linux') { cache.memory = linuxMemory(); cache.battery = linuxBattery(); cache.net = linuxNet(); }
      else cache.memory = Object.assign({}, cache.memory, { free: os.freemem() });
      cache.os.uptime = os.uptime(); cache.displays = displays(); cache.storage = diskInfo ? diskInfo() : cache.storage;
      return cache;
    }
    if (!busy) busy = collect().then((r) => { cache = r; busy = null; return r; }, (e) => { busy = null; throw e; });
    return busy;
  }
  return { info, _linux: { machine: linuxMachine, cpu: linuxCpu, memory: linuxMemory, disks: linuxDisks, battery: linuxBattery, net: linuxNet, bluetooth: linuxBluetooth, audio: linuxAudio, os: linuxOs, gpuSys: linuxGpuSys } };
}

module.exports = { createHardware };
