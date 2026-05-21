const functions = require('firebase-functions');
const next = require('next');

const dev = false; // production build
const app = next({ dev, conf: { distDir: '.next' } });
const handle = app.getRequestHandler();

exports.nextjsServer = functions.runWith({
  memory: '1GB',
  timeoutSeconds: 60
}).https.onRequest((req, res) => {
  // Ensure the Next app is prepared before handling the request
  return app.prepare().then(() => handle(req, res));
});
