// electron-builder, après la signature du code (si elle a lieu) : sur Windows, la signature VMP vient après.
const vmpSign = require('./vmp-sign');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'win32') return;
  vmpSign(context, 'Windows');
};
