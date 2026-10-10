// 总控：时间线（按配音时长排）、镜头调度（懒加载/释放）、转场、字幕
import * as THREE from 'three';
import { Pipe } from './post.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { dispose } from './stage.js';
import { ss, seg, clamp } from './lib.js';
import { SHOTS } from './shots/index.js';

const Q = new URLSearchParams(location.search), SSAA = +(Q.get('ssaa') || 2);
const script = await (await fetch('script.json')).json();
const dur = await (await fetch('vo/dur.json')).json();
const WORDS = await (await fetch('vo/words.json')).json();

// —— 时间线：每句 = 开始时间 at；GAP = 该句结束后的停顿 ——
const GAP = { L01: .6, L02: 4.2, L03: .35, L04: .15, L05: 1.0, L06: 1.4, L07: .5, L08: 1.0, L09: .35, L10: 1.6, L11: .5, L12: .9, L13: .8, L14: 1.3,
  L15: .8, L16: .25, L17: 1.2, L18: 1.6, L19: .45, L20: 1.4, L21: 1.6, L22: .35, L23: 2.0, L24: 1.0, L25: 5.0 };
const C = {}; let cur = 2.6;
for (const L of script) { C[L.id] = { at: cur, dur: dur[L.id], end: cur + dur[L.id], text: L.text, sub: L.sub ?? true }; cur += dur[L.id] + GAP[L.id]; }
const DUR = cur;
window.CUES = C; window.DUR = DUR;

// —— 镜头表 ——（开始时间用台词定位）
const plan = SHOTS(C, DUR);
plan.forEach((s, i) => { s.end = i + 1 < plan.length ? plan[i + 1].start : DUR; s.dur = s.end - s.start; });
window.PLAN = plan.map(s => [s.id, +s.start.toFixed(2), +s.end.toFixed(2)]);
window.EV = plan.flatMap(s => (s.sfx || []).map(e => ({ ...e, t: e.t })));

// —— 渲染器 ——
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(SSAA); renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const pipe = new Pipe(renderer, 1920, 1080, SSAA);
const pmrem = new THREE.PMREMGenerator(renderer); const ENV = pmrem.fromScene(new RoomEnvironment(), .04).texture;
await Promise.all(['MaShanZheng', 'ZhiMangXing', 'LongCang', 'NotoSerifSC'].map(f => document.fonts.load(`40px ${f}`, '一个月饼的相思中秋外婆圆')));

const live = new Map();
async function get(i) {
  const p = plan[i];
  if (!live.has(i)) { const t0 = performance.now(); live.set(i, await p.build({ dur: p.dur, T0: p.start, C, env: ENV, W: WORDS, cue: id => C[id].at - p.start, cueEnd: id => C[id].end - p.start, word: (id, k) => C[id].at - p.start + (WORDS[id]?.[k] ? WORDS[id][k][1] : C[id].dur * k / [...C[id].text].length) })); console.log('built', p.id, Math.round(performance.now() - t0) + 'ms'); }
  return live.get(i);
}
function gc(keep) { for (const [i, s] of live) if (!keep.includes(i)) { dispose(s.S.scene); live.delete(i); } }

async function drawShot(i, t, target) {
  const s = await get(i), tl = t - plan[i].start;
  s.update(tl);
  if (Q.get('nolit')) { s.S.U.uLit.value = 0; s.S.amb.intensity = .02; s.S.key.intensity *= 2; }
  pipe.shot(s.S.scene, s.S.cam, s.post(tl), target);
  return s.grade(tl);
}

const sub = document.getElementById('sub'), credit = document.getElementById('credit');
credit.textContent = '配乐　Kevin MacLeod《Ripples》《Nu Flute》incompetech.com · CC BY 4.0\n茶具与木纹　Poly Haven · CC0　　字体　马善政楷书 · 志莽行书 · 龙藏体 · 思源宋体 · OFL';
window.render = async (t) => {
  let i = plan.findIndex(p => t >= p.start && t < p.end); if (i < 0) i = plan.length - 1;
  const p = plan[i], tl = t - p.start, tr = p.in || { type: 'cut', dur: 0 };
  let mixB = 0, g;
  if (i > 0 && tr.type !== 'cut' && tl < tr.dur) {
    await drawShot(i - 1, t, pipe.rtA);
    g = await drawShot(i, t, pipe.rtB);
    mixB = (tr.ease || ss)(tl / tr.dur);
    gc([i - 1, i]);
  } else {
    g = await drawShot(i, t, pipe.rtA); gc([i]);
  }
  pipe.final({ ...g, mixB, mode: tr.type === 'iris' ? 1 : 0, center: tr.center, time: t, fade: (g.fade ?? 1) * ss(clamp((DUR - t) / 1.2)) });
  // 字幕
  let txt = '', a = 0;
  for (const L of Object.values(C)) if (L.sub && t > L.at - .15 && t < L.end + .3) { txt = L.text.replace(/[“”]/g, m => m); a = Math.min(ss(seg(t, L.at - .15, L.at + .05)), 1 - ss(seg(t, L.end + .1, L.end + .3))); }
  let st = txt.replace(/[，。：—]+$/, '');
  if (st.length > 21) {   // 长句按最靠近中间的逗号断成两行
    const cs = [...st.matchAll(/[，。：]/g)].map(m => m.index); const mid = st.length / 2;
    const k = cs.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    if (k !== undefined) st = st.slice(0, k) + '\n' + st.slice(k + 1);
  }
  credit.style.opacity = Math.min(ss(seg(t, C.L25.end + .6, C.L25.end + 1.4)), 1 - ss(seg(t, DUR - 1.0, DUR - .1)));
  sub.textContent = st.replace(/[，。：]/g, '\u3000'); sub.style.opacity = a;
};
window.READY = true;
