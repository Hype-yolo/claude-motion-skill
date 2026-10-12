// 阅读时长自检：node core/render/readcheck.mjs <demo> [--q 'k=v'] [--step 0.04] [--latin-cps 15] [--cjk-cps 4.5] [--pad 1.5] [--min 1.5] [--size 1920x1080]
// 页面约定 window.TEXTS(t) → [{id, text, x0, y0, x1, y1}]：t 秒时画面上看得见的每段文字和它的屏幕框（像素，视口大小同 --size，默认 1920×1080）。
//   id 标识"这一块文字"（数字或字符串都行）；同一个 id 下文字换了，算新的一段重新计时。字幕条不用报：它的停留由 .srt 决定。
//   text 必须从这块文字第一次出现的那一帧起就是它的【完整文字】：打字机效果如果报"目前打出来的子串"，每多一个字都是新的一段，整个检查会失败——
//   打字机的文字请在 TEXTS 里一直报全文，把"哪些字已经显示"留给画面自己处理。
// 规则（同 DIRECTOR.md §7）：每段文字从第一次完整进入画框起，连续完整在画、并且还在 TEXTS 里的时长，要 ≥
//   （汉字/假名/谚文数 ÷ cjk-cps + 其它非空白字符数 ÷ latin-cps）+ pad 秒，且不低于 min。默认 4.5 字/秒（中日韩）、15 字/秒（字母数字）、pad 1.5、min 1.5。
//   从没完整进入画框的文字（被裁边、出画的滚动条）报 "never fully visible"。
// 退出码：0 全部达标；1 有不达标；2 检查没能运行（页面没有 window.TEXTS，或整片没返回过任何文字）——这不算通过。
import { openDemo, closeServer, requireDemo, takeSize } from './page.mjs';
const args = process.argv.slice(2), { w: VW, h: VH } = takeSize(args), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = args[0]; requireDemo(dir);
const Q = opt('--q', ''), STEP = +opt('--step', 0.04), LATIN = +opt('--latin-cps', 15), CJK = +opt('--cjk-cps', 4.5), PAD = +opt('--pad', 1.5), MIN = +opt('--min', 1.5);
if (![STEP, LATIN, CJK, PAD, MIN].every(Number.isFinite) || STEP <= 0 || LATIN <= 0 || CJK <= 0) { console.error('bad option value (step and the cps values must be > 0)'); process.exit(2); }
const { browser, page } = await openDemo(dir, { w: VW, h: VH, q: Q });
const res = await page.evaluate(({ STEP }) => {
  if (typeof window.TEXTS !== 'function') return { noTexts: true };
  if (!(window.DUR > 0)) return { noDur: true };
  const W = innerWidth, H = innerHeight, seen = {}, partial = {};
  for (let t = 0; t <= window.DUR; t += STEP) {
    window.render(t);
    const vis = new Set();
    for (const b of window.TEXTS(t) || []) {
      b.id = String(b.id);   // 数字 id 也行
      const key = b.id + '\u0000' + b.text;   // 同一个 id 下文字变了 = 新的一段
      if (!(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H)) { partial[key] ??= { id: b.id, text: b.text, t0: t }; continue; }
      vis.add(key);
      const s = seen[key] ??= { id: b.id, text: b.text, t0: t, run: 0, done: false };
      if (!s.done) s.run = t - s.t0 + STEP;
    }
    for (const k in seen) if (!vis.has(k)) seen[k].done = true;   // 只算第一次连续在画的时长
  }
  for (const k in partial) if (seen[k]) delete partial[k];
  return { seen: Object.values(seen), partial: Object.values(partial) };
}, { STEP });
await browser.close(); closeServer();

if (res.noTexts || res.noDur || (!res.seen.length && !res.partial.length)) {
  console.error('readcheck: NOT CHECKED — ' + (res.noTexts ? 'the page has no window.TEXTS(t) (see the header of core/render/readcheck.mjs for the contract).'
    : res.noDur ? 'window.DUR is not a positive number.' : 'window.TEXTS(t) never returned any text over the whole film.') + ' This is not a pass.');
  process.exit(2);
}
const isCJK = ch => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(ch);
const need = text => { let cjk = 0, other = 0; for (const ch of text) { if (/\s/.test(ch)) continue; isCJK(ch) ? cjk++ : other++; } return Math.max(MIN, cjk / CJK + other / LATIN + PAD); };
let bad = 0;
for (const s of res.seen) {
  const n = need(s.text), ok = s.run >= n - 1e-6; if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${s.id.padEnd(18)} at ${s.t0.toFixed(2)}s  ${String([...s.text].filter(c => !/\s/.test(c)).length).padStart(3)} chars  need ${n.toFixed(2)}s  got ${s.run.toFixed(2)}s  ${JSON.stringify(s.text.slice(0, 24))}`);
}
for (const s of res.partial) { bad++; console.log(`BAD ${s.id.padEnd(18)} at ${s.t0.toFixed(2)}s  never fully visible (its box is outside the frame)  ${JSON.stringify(s.text.slice(0, 24))}`); }
process.exit(bad ? 1 : 0);
