// Avant de construire : la version de Brume vient de l'étiquette de la release (v1.2.3, 1.2 ou v2 → 1.2.3, 1.2.0,
// 2.0.0), et le dépôt GitHub est noté dans package.json (« brumeRepo ») : c'est là que Brume cherche ses mises à jour.
// Usage : node scripts/version.js <étiquette> <propriétaire/dépôt>   (lancé par les workflows de .github/workflows)
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'package.json');
const tag = String(process.argv[2] || '').trim();
const repo = String(process.argv[3] || '').trim();
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const m = tag.match(/^v?(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,6}))?$/i);
if (m) pkg.version = [m[1], m[2] || 0, m[3] || 0].map(Number).join('.');
else if (tag) console.log(`Étiquette « ${tag} » : pas un numéro de version (comme v1.0.1), la version reste ${pkg.version}.`);
if (/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo)) pkg.brumeRepo = repo;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Brume ${pkg.version}${pkg.brumeRepo ? ' · mises à jour : github.com/' + pkg.brumeRepo : ''}`);
