// 极简静态服务器（ES module 不能走 file://）
import http from 'http'; import fs from 'fs'; import path from 'path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
export function serve(root, port = 0) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
    });
    s.listen(port, '127.0.0.1', () => res({ server: s, port: s.address().port }));
  });
}
