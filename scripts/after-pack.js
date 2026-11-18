// electron-builder, après l'assemblage : sur macOS, la signature VMP se fait avant la signature du code.
const { execFileSync } = require('child_process');
const path = require('path');
const vmpSign = require('./vmp-sign');

exports.default = async function afterPack(context) {
  // Windows : sans signature du code (cas de Brume), electron-builder n'appelle pas afterSign ;
  // la signature VMP se fait donc ici. Avec une signature du code, after-sign.js la refait ensuite.
  if (context.electronPlatformName === 'win32') { vmpSign(context, 'Windows'); return; }
  if (context.electronPlatformName !== 'darwin') return;
  if (!vmpSign(context, 'macOS')) return;
  // Brume n'est pas signé avec un certificat Apple : on refait la signature ad hoc,
  // sans laquelle un Mac à puce Apple refuse de lancer l'application modifiée.
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' && !process.env.CSC_LINK) {
    const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  }
};
