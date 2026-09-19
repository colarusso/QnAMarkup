// Tiny static server for local development.
//   node test/serve.js [port]      one origin (default 8000): editor at http://localhost:8000/, viewer at /i/
//   node test/serve.js --split     two origins, 8000 (editor) and 8001 (viewer), as config.js expects,
//                                  to rehearse the production split between qnamarkup.org and .net
//   node test/serve.js --site      serve site/org on 8000 and site/net on 8001 (after `node build.js --site`)
const http = require('http'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };

function serve(dir, port, label) {
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(dir, p));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(label + ': http://localhost:' + port + '/'));
}

if (args.includes('--site')) {
  serve(path.join(root, 'site', 'org'), 8000, 'site/org (editor)');
  serve(path.join(root, 'site', 'net'), 8001, 'site/net (viewer)');
} else if (args.includes('--split')) {
  serve(root, 8000, 'editor origin');
  serve(root, 8001, 'viewer origin');
} else {
  serve(root, Number(args[0]) || 8000, 'QnA Markup dev server');
}
console.log('(Ctrl-C to stop)');
