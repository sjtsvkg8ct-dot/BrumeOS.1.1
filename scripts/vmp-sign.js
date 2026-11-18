// Signature VMP de castlabs (service EVS, gratuit après inscription).
// Sur Windows et macOS, Widevine ne lit les contenus des grands services (Apple Music…)
// que si l'application est signée. Sans compte EVS configuré, la construction continue
// avec la signature de développement fournie par castlabs.
// Linux n'a pas de VMP : rien à faire.
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = function vmpSign(context, label) {
  const py = process.env.EVS_PYTHON;
  if (!py) {
    console.log(`  • ${label} : EVS non configuré, Widevine garde la signature de développement`);
    return false;
  }
  execFileSync(path.resolve(py), ['-m', 'castlabs_evs.vmp', '--no-ask', 'sign-pkg', '--streaming', context.appOutDir], { stdio: 'inherit' });
  return true;
};
