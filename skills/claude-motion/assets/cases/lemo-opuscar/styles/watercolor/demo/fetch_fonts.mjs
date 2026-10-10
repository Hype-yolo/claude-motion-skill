import fs from 'fs';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const src = fs.readFileSync('scene.js', 'utf8') + fs.readFileSync('main.js', 'utf8');
const chars = [...new Set([...src].filter(c => c.charCodeAt(0) > 0x2e80))].join('') + '·—，。、：（）';
const fams = [
  `family=Noto+Serif+SC:wght@400&text=${encodeURIComponent(chars)}`,
  `family=Cormorant+Garamond:ital,wght@0,500;1,400;1,500`,
  `family=Caveat:wght@500;600`,
  `family=IBM+Plex+Mono:wght@400`,
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
