// Courrier, côté processus principal : les comptes de messagerie de chaque utilisateur de Brume.
// IMAP pour lire (imapflow), SMTP pour envoyer (nodemailer), lecture des messages (mailparser).
// La page de Brume ne voit jamais les mots de passe : elle demande des dossiers, des listes,
// des messages et des envois, et reçoit des réponses.
'use strict';
const fs = require('fs');
const path = require('path');

let ImapFlow, nodemailer, simpleParser, MailComposer;
function libs() {
  if (ImapFlow) return;
  ({ ImapFlow } = require('imapflow'));
  nodemailer = require('nodemailer');
  ({ simpleParser } = require('mailparser'));
  MailComposer = require('nodemailer/lib/mail-composer');
}

// Réglages connus : le reste passe par la base de Thunderbird (autoconfig), puis par une supposition.
const SSL = (host, port = 993) => ({ host, port, secure: true });
const PROVIDERS = [
  { domains: ['gmail.com', 'googlemail.com'], name: 'Gmail', imap: SSL('imap.gmail.com'), smtp: SSL('smtp.gmail.com', 465), appPassword: true, sentAuto: true },
  { domains: ['icloud.com', 'me.com', 'mac.com'], name: 'iCloud', imap: SSL('imap.mail.me.com'), smtp: { host: 'smtp.mail.me.com', port: 587, secure: false }, appPassword: true },
  { domains: ['yahoo.com', 'yahoo.fr', 'ymail.com'], name: 'Yahoo', imap: SSL('imap.mail.yahoo.com'), smtp: SSL('smtp.mail.yahoo.com', 465), appPassword: true },
  { domains: ['orange.fr', 'wanadoo.fr'], name: 'Orange', imap: SSL('imap.orange.fr'), smtp: SSL('smtp.orange.fr', 465) },
  { domains: ['free.fr'], name: 'Free', imap: SSL('imap.free.fr'), smtp: SSL('smtp.free.fr', 465) },
  { domains: ['sfr.fr', 'neuf.fr'], name: 'SFR', imap: SSL('imap.sfr.fr'), smtp: SSL('smtp.sfr.fr', 465) },
  { domains: ['laposte.net'], name: 'La Poste', imap: SSL('imap.laposte.net'), smtp: SSL('smtp.laposte.net', 465) },
  // Microsoft n'accepte plus les mots de passe pour IMAP (connexion OAuth obligatoire).
  { domains: ['outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com'], name: 'Outlook', oauthOnly: true }
];
const SPECIAL = { '\\Inbox': 'inbox', '\\Sent': 'sent', '\\Drafts': 'drafts', '\\Trash': 'trash', '\\Junk': 'junk', '\\Archive': 'archive', '\\All': 'all', '\\Flagged': 'flagged' };
const PAGE = 50;
const MAX_MESSAGE = 40 * 1024 * 1024;

function createMail({ app, safeStorage, net, sysEvent }) {
  const DIR = path.join(app.getPath('userData'), 'courrier');
  const okUser = (u) => typeof u === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(u);
  const fileOf = (u) => path.join(DIR, u + '.json');

  // ---------- Comptes enregistrés (mots de passe chiffrés quand le système le permet) ----------
  function readUser(u) {
    try { return JSON.parse(fs.readFileSync(fileOf(u), 'utf8')); } catch (e) { return { accounts: [] }; }
  }
  function writeUser(u, data) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    const tmp = fileOf(u) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, fileOf(u));
  }
  function seal(pass) {
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) return { enc: 'safe', data: safeStorage.encryptString(pass).toString('base64') };
    } catch (e) { /* on retombe sur le brouillage */ }
    return { enc: 'plain', data: Buffer.from(pass, 'utf8').toString('base64') };
  }
  function unseal(p) {
    if (!p) return '';
    if (p.enc === 'safe') return safeStorage.decryptString(Buffer.from(p.data, 'base64'));
    return Buffer.from(p.data, 'base64').toString('utf8');
  }
  const pub = (a) => ({ id: a.id, email: a.email, name: a.name, provider: a.provider || '' });
  function account(u, id) {
    if (!okUser(u)) throw err('user');
    const a = readUser(u).accounts.find((x) => x.id === id);
    if (!a) throw err('account');
    return a;
  }
  function err(code, message) { const e = new Error(message || code); e.code = code; return e; }

  // ---------- Connexions IMAP (une par compte, fermée après quelques minutes sans usage) ----------
  const conns = new Map();
  async function imap(a) {
    const c = conns.get(a.id);
    if (c && c.client.usable) { clearTimeout(c.timer); c.timer = setTimeout(() => drop(a.id), 4 * 60 * 1000); return c.client; }
    if (c) drop(a.id);
    libs();
    const client = new ImapFlow({
      host: a.imap.host, port: a.imap.port, secure: !!a.imap.secure, doSTARTTLS: a.imap.secure ? undefined : a.imap.starttls !== false,
      auth: { user: a.user || a.email, pass: unseal(a.pass) },
      logger: false, emitLogs: false, clientInfo: { name: 'Brume OS' },
      tls: a.imap.insecure ? { rejectUnauthorized: false } : undefined,
      connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 5 * 60 * 1000
    });
    client.on('error', () => drop(a.id));
    client.on('close', () => { const x = conns.get(a.id); if (x && x.client === client) conns.delete(a.id); });
    await client.connect();
    const entry = { client, timer: setTimeout(() => drop(a.id), 4 * 60 * 1000) };
    conns.set(a.id, entry);
    return client;
  }
  function drop(id) {
    const c = conns.get(id); if (!c) return;
    conns.delete(id); clearTimeout(c.timer);
    c.client.logout().catch(() => c.client.close());
  }
  async function withBox(a, box, fn) {
    const client = await imap(a);
    const lock = await client.getMailboxLock(box);
    try { return await fn(client); } finally { lock.release(); }
  }

  // ---------- Erreurs lisibles ----------
  function why(e) {
    const s = String((e && (e.responseText || e.response || e.message)) || '') + ' ' + String((e && e.code) || '');
    if (e && typeof e.code === 'string' && /^(user|account|oauth|invalid|big|nofolder|gone|auth|dns|connect|tls|other|smtp-[a-z]+)$/.test(e.code)) return e.code;
    if (e && (e.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|authentication failed|EAUTH|535|LOGIN failed|Invalid login/i.test(s))) return 'auth';
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(s)) return 'dns';
    if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|timeout|Timed out/i.test(s)) return 'connect';
    if (/certificate|CERT_|self.signed|TLS|SSL/i.test(s)) return 'tls';
    return 'other';
  }

  // ---------- Réglages d'un compte ----------
  async function autoconfig(email) {
    const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email || '').trim().toLowerCase());
    if (!m) throw err('invalid');
    const domain = m[1];
    const known = PROVIDERS.find((p) => p.domains.includes(domain));
    if (known) return { provider: known.name, imap: known.imap || null, smtp: known.smtp || null, appPassword: !!known.appPassword, oauthOnly: !!known.oauthOnly, source: 'known' };
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
      const res = await net.fetch('https://autoconfig.thunderbird.net/v1.1/' + encodeURIComponent(domain), { signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) {
        const xml = await res.text();
        const server = (tag, type) => {
          const re = new RegExp('<' + tag + '[^>]*type="' + type + '"[^>]*>([\\s\\S]*?)</' + tag + '>', 'g');
          let best = null;
          for (const mm of xml.matchAll(re)) {
            const body = mm[1], get = (k) => ((new RegExp('<' + k + '>([^<]*)</' + k + '>')).exec(body) || [])[1];
            const host = get('hostname'), port = parseInt(get('port'), 10), sock = (get('socketType') || '').toUpperCase();
            if (!host || !port) continue;
            const s = { host, port, secure: sock === 'SSL', starttls: sock === 'STARTTLS', local: /%EMAILLOCALPART%/.test(get('username') || '') };
            if (!best || (s.secure && !best.secure)) best = s;
          }
          return best;
        };
        const imapS = server('incomingServer', 'imap'), smtpS = server('outgoingServer', 'smtp');
        if (imapS && smtpS) return { provider: '', imap: imapS, smtp: smtpS, appPassword: false, oauthOnly: false, source: 'ispdb' };
      }
    } catch (e) { /* hors ligne, ou domaine inconnu */ }
    return { provider: '', imap: SSL('imap.' + domain), smtp: SSL('smtp.' + domain, 465), appPassword: false, oauthOnly: false, source: 'guess' };
  }

  function smtpTransport(a) {
    libs();
    return nodemailer.createTransport({
      host: a.smtp.host, port: a.smtp.port, secure: !!a.smtp.secure, requireTLS: !a.smtp.secure && a.smtp.starttls !== false,
      auth: { user: a.user || a.email, pass: unseal(a.pass) },
      tls: a.smtp.insecure ? { rejectUnauthorized: false } : undefined,
      connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 60000
    });
  }

  async function addAccount(u, o) {
    if (!okUser(u)) throw err('user');
    const email = String(o.email || '').trim();
    const pass = String(o.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !pass) throw err('invalid');
    const conf = o.imap && o.smtp ? { provider: o.provider || '', imap: o.imap, smtp: o.smtp } : await autoconfig(email);
    if (conf.oauthOnly) throw err('oauth');
    const clean = (s) => ({ host: String(s.host || '').trim(), port: parseInt(s.port, 10) || (s.secure ? 993 : 143), secure: !!s.secure, starttls: s.starttls !== false, insecure: !!s.insecure });
    const a = {
      id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      email, name: String(o.name || '').trim() || email.split('@')[0], provider: conf.provider || '',
      user: o.login ? String(o.login) : (conf.imap.local ? email.split('@')[0] : email),
      imap: clean(conf.imap), smtp: clean(conf.smtp), pass: seal(pass), sentAuto: !!(PROVIDERS.find((p) => p.name === conf.provider) || {}).sentAuto
    };
    // Vérifier avant d'enregistrer : connexion IMAP, puis SMTP
    libs();
    const test = new ImapFlow({ host: a.imap.host, port: a.imap.port, secure: a.imap.secure, doSTARTTLS: a.imap.secure ? undefined : a.imap.starttls, auth: { user: a.user, pass }, logger: false, connectionTimeout: 20000, greetingTimeout: 15000, tls: a.imap.insecure ? { rejectUnauthorized: false } : undefined });
    test.on('error', () => {});
    try { await test.connect(); } catch (e) { const k = why(e); throw err(k === 'auth' ? 'auth' : k, 'imap'); } finally { test.logout().catch(() => test.close()); }
    try { await smtpTransport(a).verify(); } catch (e) { const k = why(e); throw err(k === 'auth' ? 'smtp-auth' : 'smtp-' + k, 'smtp'); }
    const data = readUser(u);
    data.accounts = data.accounts.filter((x) => x.email.toLowerCase() !== email.toLowerCase());
    data.accounts.push(a);
    writeUser(u, data);
    return pub(a);
  }
  function removeAccount(u, id) {
    if (!okUser(u)) throw err('user');
    const data = readUser(u);
    data.accounts = data.accounts.filter((x) => x.id !== id);
    writeUser(u, data);
    drop(id); polled.delete(id);
    return true;
  }

  // ---------- Lecture ----------
  async function folders(u, id) {
    const a = account(u, id), client = await imap(a);
    const list = await client.list({ statusQuery: { messages: true, unseen: true } });
    return list.filter((f) => !(f.flags && f.flags.has('\\Noselect'))).map((f) => ({
      path: f.path, name: f.name, delimiter: f.delimiter,
      special: f.path.toUpperCase() === 'INBOX' ? 'inbox' : (SPECIAL[f.specialUse] || ''),
      total: f.status ? f.status.messages || 0 : 0, unseen: f.status ? f.status.unseen || 0 : 0
    }));
  }
  const addr = (x) => (x ? { name: x.name || '', address: x.address || '' } : null);
  const addrs = (l) => (l || []).map(addr).filter((x) => x && (x.address || x.name));
  function hasAtt(bs) {
    if (!bs) return false;
    if (bs.disposition === 'attachment') return true;
    return (bs.childNodes || []).some(hasAtt);
  }
  function summary(m) {
    const env = m.envelope || {};
    return {
      uid: m.uid, from: addr((env.from || [])[0]), to: addrs(env.to), subject: env.subject || '',
      date: +(env.date || m.internalDate || 0) || 0, seen: m.flags ? m.flags.has('\\Seen') : true,
      flagged: m.flags ? m.flags.has('\\Flagged') : false, att: hasAtt(m.bodyStructure), size: m.size || 0
    };
  }
  async function list(u, id, box, o = {}) {
    const a = account(u, id), count = Math.min(Math.max(parseInt(o.count, 10) || PAGE, 1), 500), q = String(o.query || '').trim();
    return withBox(a, box, async (client) => {
      const total = client.mailbox.exists || 0;
      const query = { uid: true, envelope: true, flags: true, bodyStructure: true, size: true, internalDate: true };
      const out = [];
      if (q) {
        const uids = (await client.search({ or: [{ from: q }, { to: q }, { subject: q }, { body: q }] }, { uid: true })) || [];
        const pick = uids.sort((x, y) => x - y).slice(-count);
        if (pick.length) for await (const m of client.fetch(pick.join(','), query, { uid: true })) out.push(summary(m));
        return { total: uids.length, msgs: out.sort((x, y) => y.uid - x.uid), more: uids.length > pick.length };
      }
      if (total) for await (const m of client.fetch(Math.max(1, total - count + 1) + ':*', query)) out.push(summary(m));
      return { total, msgs: out.sort((x, y) => y.uid - x.uid), more: total > count };
    });
  }
  // Les derniers messages lus restent en mémoire, pour les pièces jointes
  const parsed = new Map();
  async function parse(a, box, uid) {
    const key = a.id + '\n' + box + '\n' + uid;
    if (parsed.has(key)) return parsed.get(key);
    const p = await withBox(a, box, async (client) => {
      const meta = await client.fetchOne(String(uid), { size: true }, { uid: true });
      if (!meta) throw err('gone');
      if (meta.size > MAX_MESSAGE) throw err('big');
      const dl = await client.download(String(uid), undefined, { uid: true });
      return simpleParser(dl.content, { skipImageLinks: true });
    });
    parsed.set(key, p);
    if (parsed.size > 4) parsed.delete(parsed.keys().next().value);
    return p;
  }
  async function message(u, id, box, uid) {
    const a = account(u, id); libs();
    const p = await parse(a, box, uid);
    withBox(a, box, (client) => client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })).catch(() => {});
    const list2 = (v) => (v ? (Array.isArray(v) ? v : [v]).flatMap((x) => x.value || []) : []);
    return {
      uid, subject: p.subject || '', date: +(p.date || 0) || 0,
      from: addr(list2(p.from)[0]), to: addrs(list2(p.to)), cc: addrs(list2(p.cc)), replyTo: addrs(list2(p.replyTo)),
      html: typeof p.html === 'string' ? p.html : null, text: p.text || '',
      messageId: p.messageId || '', references: [].concat(p.references || []), inReplyTo: p.inReplyTo || '',
      attachments: (p.attachments || []).map((x, i) => {
        const cid = x.contentId ? String(x.contentId).replace(/^<|>$/g, '') : '';
        const inline = !!cid && /^image\//.test(x.contentType || '') && x.size < 3 * 1024 * 1024;
        return { id: i, filename: x.filename || '', contentType: x.contentType || 'application/octet-stream', size: x.size || 0, cid, inline, data: inline ? x.content.toString('base64') : null };
      })
    };
  }
  async function attachment(u, id, box, uid, i) {
    const a = account(u, id); libs();
    const p = await parse(a, box, uid), x = (p.attachments || [])[i];
    if (!x) throw err('gone');
    return { filename: x.filename || '', contentType: x.contentType || 'application/octet-stream', data: x.content.toString('base64') };
  }

  // ---------- Rangement ----------
  const uidList = (uids) => (Array.isArray(uids) ? uids : [uids]).map((x) => parseInt(x, 10)).filter((x) => x > 0).join(',');
  async function flags(u, id, box, uids, o) {
    const a = account(u, id), set = uidList(uids); if (!set) return false;
    return withBox(a, box, async (client) => {
      const add = [], rem = [];
      if (o.seen === true) add.push('\\Seen'); if (o.seen === false) rem.push('\\Seen');
      if (o.flagged === true) add.push('\\Flagged'); if (o.flagged === false) rem.push('\\Flagged');
      if (add.length) await client.messageFlagsAdd(set, add, { uid: true });
      if (rem.length) await client.messageFlagsRemove(set, rem, { uid: true });
      return true;
    });
  }
  async function specialPath(a, kind) {
    const client = await imap(a);
    const l = await client.list();
    const f = l.find((x) => SPECIAL[x.specialUse] === kind);
    if (f) return f.path;
    if (kind === 'archive') {
      const named = l.find((x) => /^(archives?|archive)$/i.test(x.name));
      if (named) return named.path;
      await client.mailboxCreate('Archives');
      return 'Archives';
    }
    if (kind === 'trash') { const named = l.find((x) => /^(trash|corbeille|deleted( items| messages)?|bin)$/i.test(x.name)); return named ? named.path : null; }
    if (kind === 'sent') { const named = l.find((x) => /^(sent|envoy[ée]s|sent (items|messages)|messages envoy[ée]s)$/i.test(x.name)); return named ? named.path : null; }
    return null;
  }
  async function move(u, id, box, uids, dest) {
    const a = account(u, id), set = uidList(uids); if (!set) return false;
    let target = dest;
    if (dest === 'trash' || dest === 'archive') target = await specialPath(a, dest);
    return withBox(a, box, async (client) => {
      if (dest === 'trash' && (!target || target === box)) { await client.messageDelete(set, { uid: true }); return 'deleted'; }
      if (!target) throw err('nofolder');
      await client.messageMove(set, target, { uid: true });
      return 'moved';
    });
  }

  // ---------- Envoi ----------
  async function send(u, id, m) {
    const a = account(u, id); libs();
    const list3 = (l) => (Array.isArray(l) ? l : []).map((x) => ({ name: String(x.name || ''), address: String(x.address || '').trim() })).filter((x) => /^[^@\s]+@[^@\s]+$/.test(x.address));
    const to = list3(m.to), cc = list3(m.cc), bcc = list3(m.bcc);
    if (!to.length && !cc.length && !bcc.length) throw err('invalid');
    const atts = (Array.isArray(m.attachments) ? m.attachments : []).map((x) => ({ filename: String(x.filename || 'piece-jointe'), contentType: String(x.contentType || 'application/octet-stream'), content: Buffer.from(String(x.data || ''), 'base64') }));
    if (atts.reduce((s, x) => s + x.content.length, 0) > 25 * 1024 * 1024) throw err('big');
    const msg = {
      from: { name: a.name, address: a.email }, to, cc, bcc, subject: String(m.subject || ''), text: String(m.text || ''),
      inReplyTo: m.inReplyTo || undefined, references: Array.isArray(m.references) && m.references.length ? m.references : undefined,
      attachments: atts, headers: { 'X-Mailer': 'Brume OS Courrier' }
    };
    const raw = await new MailComposer(msg).compile().build();
    await smtpTransport(a).sendMail({ envelope: { from: a.email, to: [...to, ...cc, ...bcc].map((x) => x.address) }, raw });
    // Copie dans « Envoyés » (Gmail la fait lui-même)
    if (!a.sentAuto) {
      try { const sent = await specialPath(a, 'sent'); if (sent) { const client = await imap(a); await client.append(sent, raw, ['\\Seen']); } } catch (e) { /* le message est parti quand même */ }
    }
    return true;
  }

  // ---------- Relève : nouveaux messages dans la boîte de réception ----------
  let watched = null, pollTimer = null;
  const polled = new Map();
  async function pollOnce() {
    if (!watched) return;
    const u = watched, data = readUser(u);
    for (const a of data.accounts) {
      try {
        const client = await imap(a);
        const st = await client.status('INBOX', { unseen: true, uidNext: true });
        const prev = polled.get(a.id);
        polled.set(a.id, { uidNext: st.uidNext, unseen: st.unseen });
        let fresh = [];
        if (prev && st.uidNext > prev.uidNext) {
          fresh = await withBox(a, 'INBOX', async (cl) => {
            const out = [];
            for await (const m of cl.fetch(Math.max(prev.uidNext, st.uidNext - 5) + ':*', { uid: true, envelope: true, flags: true }, { uid: true })) {
              if (m.uid >= prev.uidNext && !(m.flags && m.flags.has('\\Seen'))) out.push({ uid: m.uid, from: addr(((m.envelope || {}).from || [])[0]), subject: (m.envelope || {}).subject || '' });
            }
            return out;
          });
        }
        if (watched === u) sysEvent({ type: 'mail', user: u, account: a.id, unseen: st.unseen || 0, fresh });
      } catch (e) { /* hors ligne : on réessaie au prochain tour */ }
    }
  }
  function watch(u) {
    clearInterval(pollTimer); polled.clear();
    watched = okUser(u) ? u : null;
    if (watched) { pollOnce(); pollTimer = setInterval(pollOnce, 2 * 60 * 1000); }
    return true;
  }

  // ---------- Point d'entrée unique pour la page ----------
  async function call(op, args) {
    const x = args || {};
    try {
      switch (op) {
        case 'accounts': return { ok: true, value: okUser(x.user) ? readUser(x.user).accounts.map(pub) : [] };
        case 'autoconfig': return { ok: true, value: await autoconfig(x.email) };
        case 'add': return { ok: true, value: await addAccount(x.user, x) };
        case 'remove': return { ok: true, value: removeAccount(x.user, x.id) };
        case 'folders': return { ok: true, value: await folders(x.user, x.id) };
        case 'list': return { ok: true, value: await list(x.user, x.id, String(x.box), x) };
        case 'message': return { ok: true, value: await message(x.user, x.id, String(x.box), parseInt(x.uid, 10)) };
        case 'attachment': return { ok: true, value: await attachment(x.user, x.id, String(x.box), parseInt(x.uid, 10), parseInt(x.index, 10)) };
        case 'flags': return { ok: true, value: await flags(x.user, x.id, String(x.box), x.uids, x) };
        case 'move': return { ok: true, value: await move(x.user, x.id, String(x.box), x.uids, String(x.dest)) };
        case 'send': return { ok: true, value: await send(x.user, x.id, x.message || {}) };
        case 'watch': return { ok: true, value: watch(x.user) };
        case 'poll': pollOnce(); return { ok: true, value: true };
        default: return { ok: false, error: 'op' };
      }
    } catch (e) {
      return { ok: false, error: why(e), detail: String((e && (e.responseText || e.message)) || '').slice(0, 300) };
    }
  }
  function closeAll() { for (const id of [...conns.keys()]) drop(id); clearInterval(pollTimer); }
  // Pour le Calendrier (processus principal seulement, jamais pour la page) : l'identifiant et le mot de passe
  // d'un compte, qui servent aussi pour son calendrier (CalDAV).
  function credentials(u, id) {
    if (!okUser(u)) return null;
    const a = readUser(u).accounts.find((x) => x.id === id);
    return a ? { email: a.email, login: a.user || a.email, pass: unseal(a.pass), provider: a.provider || '', name: a.name } : null;
  }
  return { call, closeAll, credentials };
}

module.exports = { createMail };
