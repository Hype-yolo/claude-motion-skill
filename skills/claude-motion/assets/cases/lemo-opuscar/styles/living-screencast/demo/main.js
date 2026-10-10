import { clamp, seg, eo, eio, back, hash } from '../../../core/lib.js';
import * as UI from './ui.js';
import * as CW from './clawd.js';
import * as FM from './film.js';

const Q = new URLSearchParams(location.search), NOSUBS = Q.has('nosubs');
const wL = document.getElementById('wL'), wD = document.getElementById('wD'), spr = document.getElementById('spr'), hudEl = document.getElementById('hud');
const mbg = document.getElementById('mbg'), mbw = document.getElementById('mbw');

const words = await (await fetch('voices/words.json')).json();
words.__dur = await (await fetch('voices/dur.json')).json();
FM.build(words);
window.DUR = FM.DUR;
window.EV = FM.EV.slice().sort((a, b) => a.t - b.t);
window.SUBS = FM.SUBS.map(s => ({ t0: s.t0, t1: s.t1, text: s.text.replace(/[{}]/g, '') }))    // 片尾两句画面上已有大字，不烧录，但进 .srt
  .concat([['v16', 'Claude Code.'], ['v17', 'Say it. Plan it. Review it. Ship it.']].map(([id, text]) => ({ t0: FM.VO[id] - .05, t1: FM.VO[id] + words.__dur[id] + .3, text })));
window.T = FM.T;

const tf = ([cx, cy, z]) => `translate(960px,540px) scale(${z}) translate(${-cx}px,${-cy}px)`;
function render(t) {
  const F = FM.frame(t), [cx, cy, z] = F.cam;
  const html = UI.desk(F.desk) + (F.app ? UI.appWin(F.app, t) : '') + (F.extra || '');
  const D = F.dark, base = D.base === 'L' ? wL : wD, over = D.over ? (D.over === 'L' ? wL : wD) : null;
  base.innerHTML = html; base.style.display = ''; base.style.clipPath = ''; base.style.zIndex = 1;
  if (over) { over.innerHTML = html; over.style.display = ''; over.style.zIndex = 2; } else (base === wL ? wD : wL).style.display = 'none';
  for (const el of [wL, wD, spr]) el.style.transform = tf(F.cam);
  // 锚点：元素上一点的世界坐标
  const cache = {};
  const A = (key, fx = .5, fy = 0) => { const el = cache[key] !== undefined ? cache[key] : (cache[key] = base.querySelector(`[data-a="${key}"]`));
    if (!el) return null; const r = el.getBoundingClientRect(); return { x: (r.left + r.width * fx - 960) / z + cx, y: (r.top + r.height * fy - 540) / z + cy, w: r.width / z, h: r.height / z }; };
  if (over) { const c = A(D.at, .5, D.at === 'toggle' ? .5 : .6) || { x: 960, y: 540 }; over.style.clipPath = `circle(${D.r}px at ${c.x}px ${c.y}px)`; }
  // 动态模糊：镜头速度 → 各向异性高斯（录屏软件的甩镜感）
  const [px, py, pz] = FM.camAt(t - 1 / 24), vx = (cx - px) * z, vy = (cy - py) * z, vz = Math.abs(Math.log(z / pz)) * 900;
  const bx = Math.min(36, Math.max(0, Math.abs(vx) - 30) * .3), by = Math.min(36, Math.max(0, Math.abs(vy) - 30) * .3);   // 慢推保持清晰，只有甩镜才拖影
  const mb = bx > .6 || by > .6; mbg.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
  mbw.style.filter = mb ? 'url(#mb)' : ''; window.DBG = { bx, by, vx, vy, vz, cam: F.cam };
  // 精灵层
  spr.innerHTML = sprites(F, t, A, z) + F.fx.map(f => f(A)).join('');
  hud(F, t, A, z, cx, cy);
}
function sprites(F, t, A, z) {
  const T = FM.T; let h = '';
  const draw = (act, tag) => {
    const c = act.eval(t, A, F); if (!c) return null;
    h += CW.sprite(c);
    const s = act.seg(t);
    if (s && s.pencil) h += CW.PENCIL(c.flip ? c.x - 9 * c.px - 6 * c.px : c.x + 6 * c.px, c.y - 7 * c.px, c.px);
    if (s && s.dash) h += CW.speedlines(c.x, c.y, 1, seg(t, s.t0, s.t1) * .8 + .1, 4);
    // 落地尘土
    for (const j of act.jumps) if (t >= j.t1 && t < j.t1 + .4) { const L = act.eval(j.t1 + .001, A, F); if (L) h += CW.dust(L.x, L.y, seg(t, j.t1, j.t1 + .4), Math.max(3, L.px * .7), 6, j.t1 * 10); }
    return c;
  };
  const c1 = draw(F.actors[0]), c2 = draw(F.actors[1]);
  // 表演附件
  if (c1) {
    const top = c1.y - c1.px * 10;
    if (t > T.land0 && t < T.land0 + .7) h += CW.BANG(c1.x - 3 * c1.px + 60, top - 70, 5, 1 - seg(t, T.land0 + .5, T.land0 + .7));
    if (t > T.land1 && t < T.land1 + .5) { const k = seg(t, T.land1, T.land1 + .5); h += CW.SPARK(c1.x - 90 - k * 30, top - 10 - k * 20, 6, '#F2C14E', 1 - k) + CW.SPARK(c1.x + 90 + k * 30, top - 20 - k * 20, 5, '#F2C14E', 1 - k); }
    if (t > T.planSel + .35 && t < T.plan) h += CW.DOTS(c1.x + 60, top - 20, 5, 1 + Math.floor((t - T.planSel) * 5) % 3);
    if (t > T.readEnd && t < T.readEnd + .9) h += CW.CHECK(c1.x + 50, top - 34, 5, 1 - seg(t, T.readEnd + .6, T.readEnd + .9));
    if (t > T.cmSend + .1 && t < T.rev - .2) h += CW.BANG(c1.x + 30, top - 64, 5);
    if (t > T.pet && t < T.pet + .9) { const k = seg(t, T.pet, T.pet + .9); h += CW.HEART(c1.x + 40 + k * 16, top - 20 - k * 50, 5, 1 - k * k); }
    if (t > T.stomp && t < T.stomp + .6) { const k = seg(t, T.stomp, T.stomp + .6); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; h += CW.SPARK(c1.x + Math.cos(a) * (30 + k * 60), c1.y - 20 + Math.sin(a) * (20 + k * 40), 4, '#F2C14E', 1 - k); } }
    if (t > T.merged && t < T.merged + .8) h += CW.SPARK(c1.x + 50, top - 30 - seg(t, T.merged, T.merged + .8) * 30, 5, '#F2C14E', 1 - seg(t, T.merged + .4, T.merged + .8));
    if (t > T.light && t < T.light + .8) { const k = seg(t, T.light, T.light + .8); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; h += CW.SPARK(c1.x + Math.cos(a) * (40 + k * 110), c1.y - 30 + Math.sin(a) * (30 + k * 80), 6, i % 2 ? '#F2C14E' : CW.CLAY, 1 - k); } }
  }
  // 分裂 / 合体的像素爆散
  const burst = (x, y, k, n = 14) => { let s = ''; for (let i = 0; i < n; i++) { const a = hash(i * 2.3) * Math.PI * 2, r = (20 + hash(i * 7.7) * 70) * eo(k), sz = 7 * (1 - k * .6);
    s += `<div style="position:absolute;left:${x + Math.cos(a) * r}px;top:${y + Math.sin(a) * r * .7}px;width:${sz}px;height:${sz}px;background:${i % 3 ? CW.CLAY : '#F2C14E'};opacity:${1 - k}"></div>`; } return s; };
  if (t > T.split + .15 && t < T.split + .6 && c1) h += burst(c1.x, c1.y - 30, seg(t, T.split + .15, T.split + .6));
  if (t > T.meet && t < T.meet + .6) h += burst(960, 440, seg(t, T.meet, T.meet + .6), 22);
  // 光标（带运动残影）
  const cu = F.cursor.eval(t, A);
  if (cu) {
    if (cu.sp > 900) for (let i = 1; i <= 4; i++) { const g = F.cursor.eval(t - i * .012, A); if (g) h += cursorSvg(g.x, g.y, 1, cu.op * .16 * (5 - i) / 4, z); }
    if (cu.ring > 0) h += `<div class="ring" style="left:${cu.x - 26 * cu.ring - 4}px;top:${cu.y - 26 * cu.ring - 4}px;width:${52 * cu.ring + 8}px;height:${52 * cu.ring + 8}px;opacity:${(1 - cu.ring) * .8};border-width:${3 / z}px"></div>`;
    h += cursorSvg(cu.x, cu.y, cu.sc, cu.op, z);
  }
  return h;
}
// 光标按屏幕尺寸恒定（1.6 倍系统大小，录屏软件常用）
const cursorSvg = (x, y, sc, op, z) => { const s = 1.6 * sc / z;
  return `<svg style="position:absolute;left:${x - 2 * s}px;top:${y - 2 * s}px;opacity:${op};filter:drop-shadow(0 ${2 / z}px ${3 / z}px rgba(0,0,0,.3))" width="${22 * s}" height="${30 * s}" viewBox="0 0 22 30"><path d="M2 2 L2 24 L7.5 18.5 L11 27 L15 25.2 L11.6 17 L19 17 Z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`; };

function hud(F, t, A, z, cx, cy) {
  const H = F.hud; let h = '';
  const scr = p => ({ x: (p.x - cx) * z + 960, y: (p.y - cy) * z + 540 });
  if (H.spot) { const p = A(H.spot.key, .5, .5); if (p) { const s = scr(p), r = Math.max(p.w, p.h) * z * .75 + 40;
    h += `<div class="spot" style="opacity:${H.spot.op};background:radial-gradient(ellipse ${r * 1.6}px ${r}px at ${s.x}px ${s.y}px, transparent 60%, rgba(25,22,18,.55) 100%)"></div>`; } }
  if (H.toast) { const p = A(H.toast.key, .5, .72); if (p) { const s = scr(p); h += `<div class="toast" style="left:${s.x - 150}px;top:${s.y}px;opacity:${H.toast.op}">${H.toast.text}</div>`; } }
  if (H.flash) h += `<div class="flash" style="opacity:${H.flash}"></div>`;
  if (H.chap && !H.wipe) h += `<div class="chap ${H.dark ? 'dk' : ''}" style="opacity:${H.chap.op}"><b>${H.chap.no}</b>${H.chap.nm}</div>`;
  if (H.ramp) h += `<div class="ramp" style="opacity:${H.ramp.op}">${H.ramp.blink ? '▶▶' : '▷▷'} 4×</div>`;
  if (H.keys) h += `<div class="keys" style="opacity:${H.keys.op};transform:translateY(${H.keys.y}px)">${H.keys.keys.map(k => `<i class="${H.keys.dn ? 'dn' : ''}">${k}</i>`).join('')}<span>${H.keys.label}</span></div>`;
  if (H.cap && !NOSUBS) h += `<div class="cap ${H.dark ? 'dk' : ''}" style="opacity:${H.cap.op};transform:translate(-50%,${H.cap.y}px)">${H.cap.text.replace(/\{([^}]*)\}/g, '<em>$1</em>')}</div>`;
  if (H.wipe) h += wipe(H.wipe, t);
  if (H.fade) h += `<div class="fade" style="opacity:${H.fade}"></div>`;
  if (t < .5) h += `<div class="fade" style="opacity:${1 - eo(t / .5)}"></div>`;
  hudEl.innerHTML = h;
}
// 章节转场：像素块从左下扫到右上盖满 → 标题 → 同向揭开；中间一只奶油色小 Clawd 跑过
function wipe(W, t) {
  const S = 60, cols = 32, rows = 18, p = W.p; let s = '<div class="wipe">';
  const pal = ['#D97757', '#CF6E4E', '#E08A6B'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = (c / cols) * .55 + ((rows - r) / rows) * .2 + hash(c * 13.1 + r * 7.7) * .12;
    const a = clamp((p / .42 - d) / .18), b = clamp(((p - .55) / .42 - d) / .18), k = a * (1 - b);
    if (k <= 0) continue; const sz = S * k;
    s += `<b style="left:${c * S + (S - sz) / 2}px;top:${r * S + (S - sz) / 2}px;width:${sz + .5}px;height:${sz + .5}px;background:${pal[Math.floor(hash(c * 3.7 + r * 11.3) * 3)]}"></b>`;
  }
  const lo = clamp(Math.min((p - .3) / .12, (.82 - p) / .1));
  if (lo > 0) {
    s += `<div class="wlabel" style="opacity:${lo};transform:translateY(calc(-50% + ${(1 - lo) * 16}px))"><div class="no">${W.no}</div><div class="nm">${W.nm}</div></div>`;
    const x = 300 + p * 1320; s += CW.sprite({ x, y: 790, px: 6, legs: Math.floor(t * 12) % 2 ? 'walkA' : 'walkB', op: lo }).replace(/fill="#D97757"/g, 'fill="#FFF8F0"').replace(/fill="#B85F40"/g, 'fill="#F3DCCD"');
  }
  return s + '</div>';
}
window.render = render;
await document.fonts.load('16px Inter'); await document.fonts.load('40px News'); await document.fonts.load('italic 40px News'); await document.fonts.load('14px Mono');
render(+(Q.get('t') || 0));
window.READY = true;
