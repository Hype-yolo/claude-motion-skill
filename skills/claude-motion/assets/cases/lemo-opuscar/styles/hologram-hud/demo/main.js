// 页面入口：读 content.json（可用 ?content=content_alt.json 换内容）→ 模型 → 片子
import { loadModel } from './engine/holo.js';
import { makeFilm } from './film.js';
const cv = document.getElementById('c'), g = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
await Promise.all(['300', '400', '500', '600'].map(w => document.fonts.load(`${w} 40px Rajdhani`)).concat([document.fonts.load('20px ShareTechMono')]));
const get = async (u, d) => { try { const r = await fetch(u); return r.ok ? await r.json() : d; } catch { return d; } };
const C = await get(Q.get('content') || 'content.json');
const model = await loadModel(C.model);
const dur = await get(`${Q.get('voices') || 'voices'}/dur.json`, {});
const film = makeFilm(C, model, dur);
window.DUR = film.TL.DUR;
window.TL = film.TL;
window.EV = film.events();
window.SUBS = film.subs();
window.TIMELINE = film.timeline();
const scene = Q.get('scene');
if (scene) { const F = await import('./frames.js'); window.render = t => F[scene](g, t); }
else window.render = t => film.render(g, t, { nosub: Q.has('nosub') });
window.READY = true;
