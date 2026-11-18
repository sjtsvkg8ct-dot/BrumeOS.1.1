// Avant de construire : le moteur web de Brume (Electron de castlabs, donc Chromium) prend la dernière version
// corrective de la même version majeure (ex. 45.2.1 → 45.4.0). C'est ce qui apporte les correctifs de sécurité de
// Chromium à chaque release de Brume. Changer de version majeure (45 → 46) reste un choix fait à la main dans
// package.json, car il peut demander des retouches. Si GitHub ne répond pas, la version de package.json est gardée.
// Usage : node scripts/moteur.js   (lancé par les workflows ; GH_TOKEN facultatif, évite les limites de GitHub)
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'package.json');
const TAG = /^v(\d+)\.(\d+)\.(\d+)\+wvcus$/;

// La plus récente des étiquettes de la même version majeure (null si aucune)
function pick(tags, major) {
  let best = null;
  for (const t of tags) {
    const m = TAG.exec(t);
    if (!m || Number(m[1]) !== major) continue;
    const v = [1, 2, 3].map((i) => Number(m[i]));
    if (!best || v[1] > best.v[1] || (v[1] === best.v[1] && v[2] > best.v[2])) best = { tag: t, v };
  }
  return best && best.tag;
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cur = String((pkg.devDependencies || {}).electron || '');
  const m = /#(v\d+\.\d+\.\d+\+wvcus)$/.exec(cur);
  if (!m) { console.log(`Moteur web : « ${cur} » n'est pas une version de castlabs, rien à faire.`); return; }
  const major = Number(TAG.exec(m[1])[1]);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'brume-build' };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const tags = [];
  try {
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`https://api.github.com/repos/castlabs/electron-releases/releases?per_page=100&page=${page}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = await r.json();
      for (const rel of list) if (!rel.prerelease && !rel.draft) tags.push(String(rel.tag_name));
      if (list.length < 100) break;
    }
  } catch (e) {
    console.log(`::warning::Moteur web : GitHub n'a pas répondu (${e.message}), on garde ${m[1]}.`);
    return;
  }
  const best = pick(tags.concat(m[1]), major);
  if (best === m[1]) { console.log(`Moteur web : ${m[1]}, déjà la dernière version ${major}.x.`); return; }
  pkg.devDependencies.electron = `github:castlabs/electron-releases#${best}`;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Moteur web : ${m[1]} → ${best} (correctifs de sécurité de Chromium).`);
}

if (require.main === module) main().catch((e) => { console.log(`::warning::Moteur web : ${e.message}`); });
module.exports = { pick };
