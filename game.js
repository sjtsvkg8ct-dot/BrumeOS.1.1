// GeForce NOW, le jeu en nuage de NVIDIA : une fenêtre à part, hors de Vigie.
// Dans un onglet de Vigie (balise <webview>), Chromium refuse le verrouillage du clavier : en plein écran,
// Échap ferait sortir du plein écran au lieu d'ouvrir le menu du jeu. Dans une vue de premier niveau
// (WebContentsView), le site verrouille le clavier comme dans Chrome : Échap va au jeu, et un appui long
// sur Échap quitte le plein écran. La souris (verrouillage du pointeur) et les manettes marchent aussi.
// Sur le système Linux (plein écran, sans gestionnaire de fenêtres), une fine barre en haut permet de
// revenir à Brume ou de quitter ; elle disparaît pendant le jeu en plein écran.
'use strict';

const HOME = 'https://play.geforcenow.com/mall/';
const BAR_H = 44;

function createGame({ BaseWindow, WebContentsView, kiosk, sysEvent, webWindowRules, getMain }) {
  let win = null, view = null, bar = null, htmlFs = false, ping = null;
  const alive = () => !!win && !win.isDestroyed();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (v, def) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : def);

  function layout() {
    if (!alive()) return;
    const b = win.getContentBounds();
    const withBar = !!bar && !htmlFs;
    if (bar) { bar.setVisible(withBar); bar.setBounds({ x: 0, y: 0, width: b.width, height: BAR_H }); }
    view.setBounds(withBar ? { x: 0, y: BAR_H, width: b.width, height: Math.max(0, b.height - BAR_H) } : { x: 0, y: 0, width: b.width, height: b.height });
  }

  // La barre : une petite page locale, sans accès à rien. Un clic change son titre (« back:3 »), que Brume lit.
  function barPage(l) {
    const html = '<!doctype html><meta charset="utf-8"><style>'
      + 'html,body{margin:0;height:100%;overflow:hidden;background:#15171c;color:#e9ecf1;font:600 13px system-ui,"Segoe UI",sans-serif;user-select:none}'
      + 'body{display:flex;align-items:center;gap:10px;padding:0 10px;box-sizing:border-box;border-bottom:1px solid #262a31}'
      + 'button{font:inherit;color:inherit;background:#252a32;border:0;border-radius:8px;padding:7px 13px;cursor:pointer}'
      + 'button:hover{background:#313741}button:focus-visible{outline:2px solid #76c043;outline-offset:1px}'
      + 'span{flex:1}b{font-weight:600;color:#9aa3af}'
      + '</style><button id="b">‹ ' + esc(l.back) + '</button><span></span><b>GeForce NOW</b><span></span><button id="q">' + esc(l.quit) + '</button>'
      + '<script>let n=0;const go=a=>{document.title=a+":"+(++n);};'
      + 'document.getElementById("b").onclick=()=>go("back");document.getElementById("q").onclick=()=>go("quit");</script>';
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  }

  function hide() {
    if (!alive()) return;
    if (kiosk) win.hide(); else win.minimize();
    const m = getMain();
    if (m) m.focus();
  }
  function close() { if (alive()) win.close(); }

  function open(args) {
    if (alive()) {
      if (win.isMinimized()) win.restore();
      win.show(); win.focus(); view.webContents.focus();
      return { ok: true };
    }
    win = new BaseWindow({
      width: 1280, height: 800, minWidth: 800, minHeight: 500,
      title: 'GeForce NOW', backgroundColor: '#0f1013',
      fullscreen: kiosk, frame: !kiosk, autoHideMenuBar: true, show: false
    });
    if (typeof win.setMenu === 'function') win.setMenu(null);
    view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    view.setBackgroundColor('#0f1013');
    win.contentView.addChildView(view);
    if (kiosk) {
      bar = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      bar.setBackgroundColor('#15171c');
      win.contentView.addChildView(bar);
      const bc = bar.webContents;
      bc.setWindowOpenHandler(() => ({ action: 'deny' }));
      bc.on('will-navigate', (e) => e.preventDefault());
      bc.on('page-title-updated', (_e, t) => {
        const a = String(t).split(':')[0];
        if (a === 'back') hide();
        else if (a === 'quit') close();
      });
      // Le clavier reste au jeu : la barre ne garde jamais le focus (ses boutons marchent à la souris)
      bc.on('focus', () => setImmediate(() => { if (view && !view.webContents.isDestroyed()) view.webContents.focus(); }));
      bc.loadURL(barPage({ back: label(args.back, 'Brume'), quit: label(args.quit, 'Quitter') }));
    }
    const wc = view.webContents;
    webWindowRules(wc, () => (alive() ? win : null));
    // Plein écran du jeu : la barre s'efface, le jeu prend tout l'écran
    wc.on('enter-html-full-screen', () => { htmlFs = true; layout(); });
    wc.on('leave-html-full-screen', () => { htmlFs = false; layout(); });
    wc.on('page-title-updated', (_e, t) => { if (alive()) win.setTitle(t && t.trim() ? t : 'GeForce NOW'); });
    // Jouer compte comme une activité : Brume ne se verrouille pas pendant une partie (manette comprise)
    let last = 0;
    wc.on('input-event', () => { const now = Date.now(); if (now - last > 4000) { last = now; sysEvent({ type: 'activity' }); } });
    ping = setInterval(() => { if (alive() && win.isVisible() && !win.isMinimized()) sysEvent({ type: 'activity' }); }, 30000);
    win.on('focus', () => { if (view && !view.webContents.isDestroyed()) view.webContents.focus(); });
    win.on('resize', layout);
    win.on('enter-full-screen', layout);
    win.on('leave-full-screen', layout);
    win.on('closed', () => {
      clearInterval(ping); ping = null;
      if (view && !view.webContents.isDestroyed()) view.webContents.close();
      if (bar && !bar.webContents.isDestroyed()) bar.webContents.close();
      win = null; view = null; bar = null; htmlFs = false;
      const m = getMain();
      if (m) m.focus();
    });
    layout();
    wc.loadURL(HOME);
    win.show(); win.focus();
    wc.focus();
    return { ok: true };
  }

  function call(op, args) {
    const a = args && typeof args === 'object' ? args : {};
    if (op === 'open') return open(a);
    if (op === 'hide') { hide(); return { ok: true }; }
    if (op === 'close') { close(); return { ok: true }; }
    if (op === 'state') return { ok: true, open: alive(), visible: alive() && win.isVisible() && !win.isMinimized() };
    return { ok: false, error: 'op' };
  }
  return { call, hide, close };
}

module.exports = { createGame };
