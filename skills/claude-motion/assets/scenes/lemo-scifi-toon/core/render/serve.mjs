// 极简静态服务器（ES module 不能走 file://）。只监听 127.0.0.1；请求必须落在根目录（或 /@film/ 挂载的片子目录）之内。
import http from 'http'; import fs from 'fs'; import path from 'path';
// 文本类一律声明 UTF-8：页面漏写 <meta charset> 时中文也不会变成乱码
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.hdr': 'application/octet-stream', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
// 仓库外的片子工程（skill 模式下在用户自己的文件夹里）挂在 /@film/ 下；/core/…、/styles/…、/node_modules/… 仍从仓库根取
const MOUNT = '/@film/'; let filmDir = null;
export function pageURL(root, port, dir) {
  const abs = path.resolve(dir), rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { filmDir = abs; return `http://127.0.0.1:${port}${MOUNT}index.html`; }
  return `http://127.0.0.1:${port}/${rel.split(path.sep).map(encodeURIComponent).join('/')}/index.html`;
}
// URL 路径 → 磁盘文件；出了根目录 / 解码失败 / 含 NUL 返回 { status }
export function resolveRequest(root, url) {
  let u; try { u = decodeURIComponent(url.split('?')[0].split('#')[0]); } catch { return { status: 400 }; }
  if (u.includes('\0')) return { status: 400 };
  const [base, rest] = filmDir && u.startsWith(MOUNT) ? [filmDir, u.slice(MOUNT.length)] : [root, u];
  const p = path.resolve(base, '.' + path.sep + rest.replace(/^\/+/, ''));
  if (p !== base && !p.startsWith(base + path.sep)) return { status: 403 };
  return { path: p };
}
export function serve(root, port = 0) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const send = (code, body) => { r.writeHead(code, { 'Content-Type': 'text/plain' }); r.end(body); };
      try {
        if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(q.headers.host || '')) return send(403, 'bad host');   // 挡 DNS rebinding
        const x = resolveRequest(root, q.url);
        if (x.status) return send(x.status, x.status === 403 ? 'outside root' : 'bad request');
        fs.readFile(x.path, (e, d) => {
          if (e) return send(404, 'not found');
          r.writeHead(200, { 'Content-Type': T[path.extname(x.path).toLowerCase()] || 'application/octet-stream' }); r.end(d);
        });
      } catch { send(400, 'bad request'); }
    });
    s.listen(port, '127.0.0.1', () => res({ server: s, port: s.address().port }));
  });
}
