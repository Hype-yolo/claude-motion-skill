// 下载字体到本地；中文只取 story.js / hud.js 里用到的字
import fs from 'fs';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const src = ['story.js', 'hud.js', 'main.js', 'art.js'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('');
const chars = [...new Set([...src].filter(c => c.charCodeAt(0) > 0x2e80))].join('') + '·—，。、：（）！？…“”';
const fams = [
  `family=ZCOOL+KuaiLe&text=${encodeURIComponent(chars)}`,
  `family=Fredoka:wght@500;600;700`,
  `family=Lilita+One`,
  `family=IM+Fell+English:ital@0;1`,
];
let out = '', n = 0; fs.mkdirSync('fonts', { recursive: true });
for (const f of fams) {
  let css = await (await fetch(`https://fonts.googleapis.com/css2?${f}&display=block`, { headers: { 'User-Agent': UA } })).text();
  for (const u of [...new Set(css.match(/https:\/\/[^)]+/g) || [])]) {
    const name = `f${n++}.woff2`;
    fs.writeFileSync('fonts/' + name, Buffer.from(await (await fetch(u)).arrayBuffer()));
    css = css.split(u).join('fonts/' + name);
  }
  out += css;
}
fs.writeFileSync('fonts.css', out); console.log('font files', n, 'cjk chars', chars.length);
