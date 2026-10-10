// Claude 应用（Code 页）与终端的纯 2D 重绘。所有函数：状态 → HTML 字符串（确定性）
import { grid, CLAY } from './clawd.js';
export const WIN = { x: 110, y: 74, w: 1700, h: 950 };
export const TERM = { x: 580, y: 380, w: 760, h: 320 };
// 终端 logo 的象限网格几何（JetBrains Mono 19px：字宽 0.6em，行高 30）
export const LOGO = { x: TERM.x + 22, y: TERM.y + 34 + 18 + 2 * 30, qw: 19 * .6 / 2, qh: 15 };

const st = (o = {}) => { let s = ''; if (o.op !== undefined && o.op < 1) s += `opacity:${Math.max(0, o.op).toFixed(3)};`;
  if (o.tf) s += `transform:${o.tf};`; if (o.blur) s += `filter:blur(${o.blur.toFixed(2)}px);`; return s; };

// ───────── 桌面
export function desk(D) {
  let h = `<div id="wall"></div><div id="menubar"><b>Claude</b><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Help</span><span class="r"><span>Fri 9:41</span></span></div>`;
  if (D.term && D.term.op > 0) h += terminal(D.term);
  return h;
}
function terminal(T) {
  const { typed = '', caret = false, logo = 0, info = 0, gone = false, blink = false, jit = 0, hint = 0 } = T;
  const lines = [`<span class="dim">~/tomato-timer</span> $ ${typed}${caret ? '<span class="tcaret"></span>' : ''}`, ''];
  const inf = ['Claude Code', 'Opus 5.5', '~/tomato-timer'];
  for (let i = 0; i < 3; i++) lines.push(`<span style="display:inline-block;width:${9 * 11.4 + 26}px"></span>${logo > i / 3 ? `<span style="opacity:${Math.min(1, info * 3 - i)}">${i === 0 ? '<b>' + inf[i] + '</b>' : '<span class="dim">' + inf[i] + '</span>'}</span>` : ''}`);
  lines.push('', hint > 0 ? `<span class="dim" style="opacity:${hint}">&gt; Try "add a dark mode toggle"</span>` : '');
  let lg = '';
  if (logo > 0 && !gone) {   // logo = 象限像素矩形（与 Clawd 精灵共用网格，便于"化身"）
    const G = grid({}); const rows = Math.ceil(logo * 3);
    for (const [c, r, v] of G) { const q = r >> 1, line = q >> 1; if (line >= rows) continue;
      const eye = v === 2 && !blink; if (eye || (r & 1)) continue;   // 每个象限只画一次（取偶数行）
      const jx = jit ? Math.round(Math.sin(c * 7.1 + q * 3.3 + jit * 40) * jit) : 0;
      lg += `<rect x="${c * LOGO.qw + jx}" y="${q * LOGO.qh}" width="${LOGO.qw + .3}" height="${LOGO.qh + .3}" fill="${CLAY}"/>`; }
  }
  if (gone) lg = `<rect x="${3 * LOGO.qw}" y="0" width="${12 * LOGO.qw}" height="${4 * LOGO.qh}" fill="none" stroke="rgba(217,119,87,.5)" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  return `<div class="twin" style="left:${TERM.x}px;top:${TERM.y}px;width:${TERM.w}px;height:${TERM.h}px;${st(T)}">
    <div class="tb2"><div class="lights"><i></i><i></i><i></i></div><span>tomato-timer — zsh</span></div>
    <pre>${lines.join('\n')}</pre>
    <svg style="position:absolute;left:${LOGO.x - TERM.x}px;top:${LOGO.y - TERM.y}px;overflow:visible" width="${18 * LOGO.qw}" height="${5 * LOGO.qh}" shape-rendering="crispEdges">${lg}</svg></div>`;
}

// ───────── 应用窗口
const ICON = {
  read: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1.5h5l3 3v6H2z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  search: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 7.5 11 11" stroke="currentColor" stroke-width="1.4"/></svg>',
  edit: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 10l1-3 5.5-5.5 2 2L5 9z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  run: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 2l7 4-7 4z" fill="currentColor"/></svg>',
  click: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 2v8l2.2-2 1.6 3 1.3-.6-1.5-3H9.5z" fill="currentColor"/></svg>',
  shot: '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="3" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="6.5" r="1.8" fill="currentColor"/></svg>',
  pr: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="3" cy="2.5" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="3" cy="9.5" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="9.5" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 4v4M9 8V5.5A2 2 0 0 0 7 3.5H5.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
};
const spinner = a => `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${a}deg)"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--line2)" stroke-width="2"/><path d="M7 2a5 5 0 0 1 5 5" fill="none" stroke="var(--clay)" stroke-width="2" stroke-linecap="round"/></svg>`;
const tick = `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="var(--addI)"/><path d="M4 7.2l2 2 4-4.2" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function msg(m, t) {
  const s = st(m);
  if (m.k === 'u') return `<div class="u" data-a="${m.id || ''}" style="${s}">${m.html}</div>`;
  if (m.k === 'tool') return `<div class="tool" data-a="${m.id || ''}" style="${s}"><span class="g" style="color:var(--mute)">${m.done ? tick : m.spin ? spinner(t * 360) : ICON[m.icon]}</span><b>${m.verb}</b><code>${m.arg}</code>${m.extra || ''}</div>`;
  if (m.k === 't') { const w = m.html.split(' '), n = Math.round(w.length * Math.min(1, m.p ?? 1));
    return `<div class="a" data-a="${m.id || ''}" style="${s}">${w.map((x, i) => i < n ? x : `<span style="opacity:0">${x}</span>`).join(' ')}</div>`; }
  if (m.k === 'stat') return `<div style="${s}"><span data-a="${m.id || ''}" class="stat ${m.hot ? 'hot' : ''}">${m.files} files <span class="p">+${m.add}</span><span class="m">−${m.del}</span> <span class="rv">Review ›</span></span></div>`;
  if (m.k === 'gap') return `<div style="height:${m.h}px;flex:none"></div>`;
  return '';
}
function sidebar(A) {
  const ss = (A.sessions || []).map((s, i) => `<div class="sess ${s.on ? 'on' : ''}" data-a="s-${i}" style="${s.p !== undefined && s.p < 1 ? `height:${34 * s.p}px;opacity:${s.p};` : ''}"><span class="dot ${s.run ? 'run' : ''}"></span>${s.name}</div>`).join('');
  return `<div class="side"><div class="newbtn ${A.newHot ? 'hot' : ''}"><span style="font-size:18px;color:var(--clay)">＋</span> New session <span class="k">⌘N</span></div>
    <div class="sect">SESSIONS</div>${ss}
    <div class="proj"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 3h4l1.5 1.5H13v7.5H1z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg><b>tomato-timer</b> · main</div></div>`;
}
const MODES = [['Manual', 'Ask before every edit'], ['Accept edits', 'Edit files, ask before commands'], ['Plan', 'Explore and propose. No edits.'], ['Auto', 'Run with background safety checks']];
function prompt(P) {
  const cls = P.mode === 'Plan' ? 'plan' : P.mode === 'Accept edits' ? 'acc' : '';
  let pop = '';
  if (P.menu && P.menu.p > 0) pop = `<div class="pop" data-a="menu" style="left:44px;bottom:66px;width:370px;${st({ op: Math.min(1, P.menu.p * 1.5), tf: `scale(${.92 + .08 * P.menu.p})` })}">${MODES.map(([n, d], i) =>
    `<div class="it ${i === P.menu.hl ? 'hl' : ''}" data-a="mi-${i}"><div${i === 2 && P.menu.hl === 2 ? ' style="color:var(--planI);font-weight:600"' : ''}>${n}<small>${d}</small></div>${i === P.menu.sel ? '<span class="kb">✓</span>' : ''}</div>`).join('')}</div>`;
  if (P.at && P.at.p > 0) pop += `<div class="pop" data-a="atpop" style="left:${P.at.x}px;bottom:${P.at.y}px;width:360px;${st({ op: Math.min(1, P.at.p * 1.5), tf: `scale(${.9 + .1 * P.at.p})` })}">
    ${[['Header.tsx', 'src/components'], ['HeaderMenu.tsx', 'src/components'], ['theme.ts', 'src/styles']].slice(0, P.at.n ?? 3).map(([n, d], i) =>
    `<div class="it ${i === P.at.hl ? 'hl' : ''}"><span style="font-family:Mono;color:${i === P.at.hl ? 'var(--clay2)' : 'var(--mute)'}">⌗</span><div>${n}<small>${d}</small></div></div>`).join('')}</div>`;
  return `<div class="pb ${P.focus ? 'focus' : ''}" data-a="pb"><div class="txt">${P.text || `<span class="ph">Describe a task, or type / for commands</span>`}${P.caret ? '<span class="caret" data-a="caret"></span>' : ''}</div>
    <div class="row"><span class="plus">＋</span><span class="pill ${cls}" data-a="mode">${P.mode || 'Manual'} ▾</span><span class="pill">Opus 5.5 ▾</span>
    <span class="send ${P.sendDim ? 'dim' : ''}" data-a="send"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg></span></div>${pop}</div>`;
}
const TABS = ['Files', 'Plan', 'Diff', 'Preview'];
function pane(P, t) {
  let body = '';
  if (P.type === 'Files') body = `<div class="tree">${[['▾ src', ''], ['  ▾ components', ''], ['      App.tsx', 'App'], ['      Header.tsx', 'Header'], ['      Timer.tsx', 'Timer'], ['  ▾ styles', ''], ['      theme.ts', 'theme'], ['      reset.css', 'reset'], ['  main.tsx', 'main'], ['package.json', 'pkg']]
    .map(([n, k]) => `<div class="${P.lit && P.lit[k] ? 'lit' : ''}" data-a="f-${k}">${n}${P.lit && P.lit[k] > 1 ? '<span class="rd">read</span>' : ''}</div>`).join('')}</div>`;
  if (P.type === 'Plan') {
    const items = ['Add a <code>dark</code> palette next to <code>light</code> in <code>theme.ts</code>', 'Remember the choice in <code>localStorage</code>', 'Add a sun / moon button to <code>Header.tsx</code>', 'Open the preview and click it to verify'];
    body = `<div class="plan"><h3>Dark mode toggle</h3><div class="meta" style="${st({ op: P.meta ?? 1 })}"><span class="badge">PLAN MODE</span><span class="nfc" data-a="nfc">No files changed</span></div><ol>
      ${items.map((x, i) => { const p = P.items[i] || 0; return `<li style="${st({ op: p > 0 ? 1 : 0 })}"><span class="n">${i + 1}</span><div class="tx" data-a="pl-${i}" style="max-width:${p >= 1 ? 9999 : 20 + p * 520}px">${x}</div></li>`; }).join('')}</ol></div>`;
  }
  if (P.type === 'Diff') body = diff(P);
  if (P.type === 'Preview') {
    const lp = P.load ?? 1;
    body = `<div class="url" data-a="url"><span>⟳</span>localhost:5173<span class="bar" style="width:${Math.min(1, lp) * 100}%;opacity:${lp >= 1 ? 0 : 1}"></span></div>
      ${lp < 1.5 ? `<div class="skel" style="${st({ op: Math.min(1, (1.5 - lp) * 3) })}"><i style="width:360px;height:120px;opacity:${.5 + .5 * Math.sin(t * 9)}"></i><i style="width:200px;height:18px"></i><i style="width:260px;height:48px"></i></div>` : ''}
      <div class="app" style="${st({ op: Math.max(0, Math.min(1, (lp - 1) * 3)) })}"><div class="hd"><span class="tm"></span>tomato<span class="tg" data-a="toggle">${P.sun
        ? '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4" fill="#F2C14E"/><g stroke="#F2C14E" stroke-width="2" stroke-linecap="round"><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4"/></g></svg>'
        : '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M15.5 12.5A7 7 0 0 1 7.5 4.5a7 7 0 1 0 8 8z" fill="currentColor"/></svg>'}</span></div>
      <div class="big">25:00</div><div class="sub">Focus · round 1 of 4</div><div class="btns"><span class="b1">Start</span><span class="b2">Reset</span></div></div>`;
  }
  return `<div class="pane" data-a="pane" style="width:${P.w}px;${st({ blur: P.blur })}"><div class="ph2">${TABS.map(x => `<span class="${x === P.type ? 'on' : ''}">${x}</span>`).join('')}</div><div class="pc">${body}</div></div>`;
}
// theme.ts 的 diff；rev = 0..1 改写进度（第 6 行删、3 行新写入）
const K = s => s.replace(/\b(export|const|function|return)\b/g, '<span class="k">$1</span>').replace(/('[^']*')/g, '<span class="s">$1</span>').replace(/\b(useTheme|getItem|useState|matchMedia)\b/g, '<span class="f">$1</span>');
const BASE = [[' ', "export const light = { bg: '#FFF8F0', ink: '#2B2320' };"], ['+', "export const dark  = { bg: '#1E1A18', ink: '#F4EDE4' };"], [' ', ''],
  ['+', 'export function useTheme() {'], ['+', "  const saved = localStorage.getItem('theme');"], ['+', "  const initial = saved ?? 'light';"], ['+', '  return useState(initial);'], ['+', '}']];
const NEW = ["  const system = matchMedia('(prefers-color-scheme: dark)');", '  const initial = saved ??', "    (system.matches ? 'dark' : 'light');"];
function diff(P) {
  const L = [], vis = P.vis ?? 99, rev = P.rev || 0;
  const line = (sg, tx, no, cls = '', id = '') => `<div class="l ${sg === '+' ? 'add' : sg === '-' ? 'del' : ''} ${cls}" data-a="${id}"><span class="no">${no}</span><span class="sg">${sg.trim()}</span><span class="tx">${tx}</span></div>`;
  BASE.forEach(([sg, tx], i) => {
    if (i >= vis) return;
    const no = i + 1;
    if (i === 5 && rev > 0) {
      L.push(line('-', K(tx), 6, '', 'l6'));
      const chars = NEW.map(x => x.length), tot = chars.reduce((a, b) => a + b); let left = rev * tot;
      NEW.forEach((x, j) => { const n = Math.max(0, Math.min(x.length, Math.round(left))); left -= x.length;
        if (n > 0 || j === 0) L.push(line('+', K(x.slice(0, n)) + (n < x.length && n > 0 ? '<span class="caret" style="height:17px;vertical-align:-3px"></span>' : ''), 6 + j, j === 1 ? 'sel' : '', 'n' + j)); });
    } else L.push(line(sg, K(tx), rev > 0 && i > 5 ? no + 2 : no, (i === 5 && P.sel) ? 'sel' : (i === 5 && P.hov ? 'hov' : ''), 'l' + no));
    if (i === 5 && P.cm && P.cm.h > 0 && rev <= 0) {
      const c = P.cm;
      L.push(`<div class="cm ${c.sent ? 'sent' : ''}" data-a="cm" style="height:${c.h * 118}px;${st({ op: Math.min(1, c.h * 2) })}"><div class="who">${c.sent ? 'Comment sent to Claude' : 'Your comment · line 6'}</div>${c.text}${c.caret ? '<span class="caret" style="height:18px"></span>' : ''}<div class="hint" data-a="hint"><span class="kbd">⌘</span><span class="kbd">↵</span> ${c.sent ? 'sent' : 'submit'}</div></div>`);
    }
  });
  const f = P.files || [['theme.ts', 12, 1], ['Header.tsx', 10, 2], ['App.tsx', 2, 0]];
  return `<div class="diff"><div class="files">${f.map(([n, a, d], i) => `<div class="${i === 0 ? 'on' : ''}" data-a="df-${i}">${n}<span class="p">+${a}</span>${d ? `<span class="m">−${d}</span>` : ''}</div>`).join('')}</div><div class="code">${L.join('')}</div></div>`;
}
// 第二个会话列（分屏）
function column(C, t) {
  let tail = '';
  if (C.ci) tail = `<div class="ci" data-a="ci-${C.id}"><span class="chk">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < C.ci.n ? 'ok' : ''}"></i>`).join('')}</span><span class="${C.ci.n >= 6 ? 'ok' : ''}">${C.ci.n >= 6 ? '6 checks passed' : `Checks running · ${C.ci.n}/6`}</span>
    ${C.ci.merged ? '<span class="merged" style="margin-left:auto">Merged</span>' : '<span style="margin-left:auto">Auto-merge</span>'}<span class="tog" style="background:${C.ci.auto ? 'var(--clay)' : 'var(--line2)'}"><i style="left:${C.ci.auto ? 14 : 2}px"></i></span></div>`;
  if (C.term) { const n = C.term.n; tail = `<div class="term" data-a="term-${C.id}">$ npm test -- --repeat 50
<span class="ok">✓</span> timer › counts down <span class="dim">(${Math.min(50, n)}/50)</span>
<span class="ok">✓</span> timer › pauses and resumes <span class="dim">(${Math.min(50, Math.max(0, n - 4))}/50)</span>
${n >= 54 ? '<span class="ok">42 passed</span> <span class="dim">· 0 flaky</span>' : '<span class="dim">running…</span>'}<div class="pbar"><i style="width:${Math.min(100, n / 54 * 100)}%"></i></div></div>`; }
  return `<div class="chat" data-a="col-${C.id}" style="${C.w !== undefined ? `flex:none;width:${C.w}px;` : ''}${C.border ? 'border-left:1px solid var(--line);' : ''}"><div class="chd">${C.title}${C.badge || ''}</div>
    <div class="msgs">${C.msgs.map(m => msg(m, t)).join('')}</div>${tail}</div>`;
}
export function appWin(A, t) {
  const W = A.box || WIN;
  let main = '';
  if (A.cols) main = A.cols.map(c => column(c, t)).join('');
  else {
    const title = A.title && A.title.p > 0 ? `<div class="ktitle"><div class="big"><span data-a="title" style="display:inline-block">${'Claude Code'.split('').map((ch, i) => { const p = Math.max(0, Math.min(1, A.title.p * 1.6 - i * .06)); const e = 1 - Math.pow(1 - p, 3);
      return `<span style="opacity:${p};transform:translateY(${(1 - e) * 40}px)">${ch === ' ' ? '&nbsp;' : ch}</span>`; }).join('')}</span></div><div class="sub" style="opacity:${A.title.sub || 0}">now right inside the Claude app</div></div>` : '';
    main = `<div class="chat" style="${st({ blur: A.blurChat })}">${title}<div class="msgs">${(A.msgs || []).map(m => msg(m, t)).join('')}</div>${prompt(A.prompt || {})}</div>${A.pane && A.pane.w > 1 ? pane(A.pane, t) : ''}`;
  }
  return `<div class="win" data-a="win" style="left:${W.x}px;top:${W.y}px;width:${W.w}px;height:${W.h}px;${st(A.winSt || {})}">
    <div class="tbar"><div class="lights"><i></i><i></i><i></i></div><div class="seg"><span>Chat</span><span>Cowork</span><span class="on">Code</span></div></div>
    <div class="body">${sidebar(A)}<div class="main">${main}</div></div></div>`;
}
