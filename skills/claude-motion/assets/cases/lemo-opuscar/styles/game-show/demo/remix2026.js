  // ================= REMIX：2026 年热点，全堆上来 =================
  scene(at(SECT.rmx), at(SECT.rmx + 1), (g) => {
    bg(g, K.ol); const rays = raysEl(g, 24, '#333');
    const tt = chars(g, 'REMIX 2026!', { x: 960, y: 540, size: 230, family: F.round, weight: 700, fill: K.yellow, anchor: 'middle', stroke: K.red, sw: 26, ls: 8 });
    const sub = chars(g, '今年的热点，全堆上来！', { x: 960, y: 720, size: 70, family: F.sans, fill: K.white, anchor: 'middle' });
    ev(at(SECT.rmx), 'v:remix'); ev(at(SECT.rmx), 'slam'); punch(at(SECT.rmx), 0.04);
    return (t) => { rays.setAttribute('transform', `translate(960 560) rotate(${t * 40})`); charsPop(tt, t, at(SECT.rmx), 0.03, 0.2, 120); charsPop(sub, t, at(SECT.rmx, 1), 0.03, 0.2, 40); };
  });
  { const r0 = SECT.rmx + 1, R = (bar, bt = 0) => at(r0 + bar, bt);
  // 人形机器人（原点=脚底）
  function humanoid(parent, col = '#E8ECF4') {
    const g = el('g', {}, parent);
    const body = el('g', {}, g);
    const mkLimb = (len, w) => { const l = el('g', {}, body); el('rect', { x: -w / 2, y: -6, width: w, height: len, rx: w / 2, fill: col, ...SO, 'stroke-width': 6 }, l); el('circle', { cx: 0, cy: len, r: w / 2 + 2, fill: K.ol }, l); return l; };
    const legL = mkLimb(150, 34), legR = mkLimb(150, 34);
    el('rect', { x: -52, y: -300, width: 104, height: 160, rx: 30, fill: col, ...SO }, body);
    el('rect', { x: -30, y: -270, width: 60, height: 40, rx: 10, fill: '#5CF2FF', ...SO, 'stroke-width': 5 }, body);
    const armL = mkLimb(125, 28), armR = mkLimb(125, 28);
    const head = el('g', {}, body);
    el('rect', { x: -44, y: -396, width: 88, height: 86, rx: 32, fill: col, ...SO }, head);
    el('rect', { x: -34, y: -378, width: 68, height: 40, rx: 18, fill: K.ol }, head);
    for (const x of [-14, 14]) el('circle', { cx: x, cy: -358, r: 7, fill: '#5CF2FF' }, head);
    return { g, body, armL, armR, legL, legR };
  }
  function hpose(h, { aL = 10, aR = 10, lL = 0, lR = 0, rot = 0 }) {
    h.legL.setAttribute('transform', `translate(-24 -150) rotate(${lL})`);
    h.legR.setAttribute('transform', `translate(24 -150) rotate(${-lR})`);
    h.armL.setAttribute('transform', `translate(-62 -280) rotate(${aL})`);
    h.armR.setAttribute('transform', `translate(62 -280) rotate(${-aR})`);
    h.body.setAttribute('transform', `rotate(${rot} 0 -200)`);
  }
  scene(R(0), R(16), (g, s) => {
    const bgR = bg(g, '#7FD8FF');
    const rays = raysEl(g, 32, 'rgba(255,255,255,0.28)');
    dots(g, 'rgba(255,255,255,0.18)', 90, 10);
    el('rect', { x: 0, y: 880, width: 1920, height: 200, fill: 'rgba(0,0,0,0.16)' }, g);
    const BGC = ['#7FD8FF', '#FF8FB1', '#FFB870', '#9B8CFF', '#F3A27E', '#5BD68A', '#FF7A7A', K.yellow];
    // 顶部 2026 月份时间轴
    const ribbon = el('g', {}, g);
    el('rect', { x: 300, y: 36, width: 1320, height: 64, rx: 32, fill: K.ol }, ribbon);
    const MX = (m) => 360 + (m - 1) * 109;
    for (let m = 1; m <= 12; m++) txt(ribbon, `${m}月`, { x: MX(m), y: 79, 'font-size': 26, 'font-family': F.sans, 'font-weight': 900, fill: m <= 9 ? K.white : '#666', 'text-anchor': 'middle' });
    const fillBar = el('rect', { x: 318, y: 46, width: 0, height: 44, rx: 22, fill: K.yellow, opacity: 0.35 }, ribbon);
    const marker = el('g', {}, ribbon);
    el('circle', { cx: 0, cy: 0, r: 30, fill: K.yellow, ...SO, 'stroke-width': 6 }, marker);
    txt(marker, '26', { x: 0, y: 11, 'font-size': 30, 'font-family': F.round, 'font-weight': 700, fill: K.ol, 'text-anchor': 'middle' });
    // 标题条
    const lbl = el('g', {}, g);
    const lblBg = el('rect', { x: 0, y: -44, height: 88, rx: 44, fill: K.white, ...SO }, lbl);
    const lblT = txt(lbl, '', { x: 0, y: 18, 'font-size': 52, 'font-family': F.sans, 'font-weight': 900, fill: K.ol, 'text-anchor': 'middle' });
    const items = [];
    const item = (i, m0, m1, label, build) => { const g2 = el('g', {}, g); const t0 = R(i * 2); items.push({ g: g2, i, m0, m1, label, t0, upd: build(g2, t0) }); };
    const plate = (p, text, col = K.ol) => { const w = measure(text, 60, F.sans, 900) + 60; el('rect', { x: -w / 2, y: 200, width: w, height: 90, rx: 45, fill: col, stroke: K.white, 'stroke-width': 6 }, p); txt(p, text, { x: 0, y: 265, 'font-size': 60, 'font-family': F.sans, 'font-weight': 900, fill: K.white, 'text-anchor': 'middle' }); };

    // 1. 1月 CES：物理 AI —— 机械臂在“模拟世界”里逐拍叠方块
    item(0, 1, 1, '1月 · CES：「物理 AI」登场', (p, t0) => {
      const grid = el('g', { stroke: '#2BB5C9', 'stroke-width': 3, opacity: 0.8 }, p);
      for (let i = -6; i <= 6; i++) el('line', { x1: i * 40, y1: 60, x2: i * 90, y2: 190 }, grid);
      for (let j = 0; j < 5; j++) { const y = 60 + j * 32, k = 240 + j * 70; el('line', { x1: -k, y1: y, x2: k, y2: y }, grid); }
      const cubes = []; const cols = [K.red, K.yellow, K.green, K.blue, K.pink, K.orange, K.lime, K.purple];
      for (let k = 0; k < 8; k++) { const c = el('rect', { x: -40, y: -40, width: 80, height: 80, rx: 10, fill: cols[k], ...SO, 'stroke-width': 6 }, p); cubes.push({ c, t0: t0 + k * B }); ev(t0 + k * B, 'drop', { f: 600 + k * 80 }); punch(t0 + k * B, 0.012); }
      const arm = el('g', {}, p);
      el('rect', { x: -330, y: 120, width: 120, height: 60, rx: 12, fill: K.gray, ...SO }, arm);
      const a1 = el('line', { stroke: K.ol, 'stroke-width': 44, 'stroke-linecap': 'round' }, arm), a1i = el('line', { stroke: K.orange, 'stroke-width': 30, 'stroke-linecap': 'round' }, arm);
      const a2 = el('line', { stroke: K.ol, 'stroke-width': 36, 'stroke-linecap': 'round' }, arm), a2i = el('line', { stroke: K.orange, 'stroke-width': 22, 'stroke-linecap': 'round' }, arm);
      const grip = el('path', { d: 'M -30 0 L -30 34 M 30 0 L 30 34 M -30 0 L 30 0', stroke: K.ol, 'stroke-width': 12, 'stroke-linecap': 'round', fill: 'none' }, arm);
      gtext(p, 'Cosmos', 260, -180, 56, { family: F.round, weight: 700, fill: K.white, sw: 10 });
      plate(p, '物理 AI');
      ev(t0, 'v:physical');
      return (t) => {
        const n = cubes.filter(c => t >= c.t0).length;
        cubes.forEach((c, k) => { show(c.c, t >= c.t0 - B * 0.5); const stackY = 150 - k * 76; const pk = seg(t, c.t0 - B * 0.5, c.t0); const x = t < c.t0 ? lerp(-150, 120, E.io(pk)) : 120; const y = t < c.t0 ? lerp(-60, stackY, E.in(pk)) - 60 : stackY; tf(c.c, x + (k % 2) * 6, y, hitSq(t, c.t0, 0.25)); });
        const cur = cubes.find(c => t >= c.t0 - B * 0.5 && t < c.t0 + 0.05) || cubes[Math.min(7, n)] || cubes[7];
        const gx = t < cur.t0 ? lerp(-150, 120, E.io(seg(t, cur.t0 - B * 0.5, cur.t0))) : lerp(120, -150, E.io(seg(t, cur.t0 + 0.05, cur.t0 + B * 0.5)));
        const gy = -110 - 76 * Math.min(n, 7) * 0.6;
        const ex = -200, ey = -60;
        for (const [l, x1, y1, x2, y2] of [[a1, -270, 120, ex, ey], [a1i, -270, 120, ex, ey], [a2, ex, ey, gx, gy], [a2i, ex, ey, gx, gy]]) { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); }
        grip.setAttribute('transform', `translate(${gx} ${gy})`);
      };
    });

    // 2. 2月 马年春晚：四家人形机器人同台
    item(1, 2, 2, '2月 · 马年春晚：四家人形机器人同台', (p, t0) => {
      for (const sx of [-1, 1]) { const l = el('g', { transform: `translate(${sx * 400} -230)` }, p); el('line', { x1: 0, y1: -80, x2: 0, y2: -40, stroke: K.ol, 'stroke-width': 6 }, l); el('ellipse', { cx: 0, cy: 0, rx: 50, ry: 44, fill: K.red, ...SO }, l); el('rect', { x: -20, y: 40, width: 40, height: 14, fill: K.yellow, ...SO, 'stroke-width': 4 }, l); txt(l, '福', { x: 0, y: 16, 'font-size': 44, 'font-family': F.sans, 'font-weight': 900, fill: K.yellow, 'text-anchor': 'middle' }); }
      const bots = [-315, -105, 105, 315].map((x, i) => { const w = el('g', {}, p); return { w, h: humanoid(w, ['#E8ECF4', '#FFD6A5', '#CDE7FF', '#FFC8DD'][i]), x }; });
      for (let k = 0; k < 8; k++) { ev(t0 + k * B, 'servo'); punch(t0 + k * B, 0.015); }
      ev(t0, 'v:robots'); ev(t0 + 7 * B, 'boing');
      plate(p, '机器人上春晚', K.red);
      return (t) => {
        const k = Math.floor((t - t0) / B), f = frac(t);
        bots.forEach((b, i) => {
          const flip = k === 7 ? -360 * E.io(clamp(f * 1.4)) : 0;
          const up = (k + i) % 2 === 0;
          tf(b.w, b.x, 180 + (k === 7 ? -120 * Math.sin(Math.PI * clamp(f * 1.4)) : hopY(t, 16)), 0.62);
          hpose(b.h, { aL: up ? 150 : 40, aR: up ? 40 : 150, lL: up ? 20 : -5, lR: up ? -5 : 20, rot: flip });
        });
      };
    });

    // 3. 2月 国产模型周调用量首超美国
    item(2, 2, 2, '2月 · 国产模型周调用量首超美国', (p, t0) => {
      el('line', { x1: -360, y1: 160, x2: 360, y2: 160, stroke: K.ol, 'stroke-width': 8 }, p);
      const bars = [[-120, K.red, '中国', 4.12], [120, K.blue, '美国', 2.94]].map(([x, col, name, v]) => { const bg2 = el('g', { transform: `translate(${x} 160)` }, p); const r = el('rect', { x: -80, y: 0, width: 160, height: 0, rx: 16, fill: col, ...SO }, bg2); txt(bg2, name, { x: 0, y: 60, 'font-size': 50, 'font-family': F.sans, 'font-weight': 900, fill: K.ol, 'text-anchor': 'middle' }); const val = gtext(bg2, '', 0, 0, 58, { family: F.round, weight: 700, fill: K.white, sw: 10 }); return { r, val, v }; });
      txt(p, '单周 Token 调用量', { x: 0, y: -250, 'font-size': 44, 'font-family': F.sans, 'font-weight': 900, fill: K.ol, 'text-anchor': 'middle' });
      const kw = el('g', {}, p), dw = el('g', {}, p); const kc = CAST.kimi(kw), dc = CAST.deepseek(dw);
      const first = el('g', {}, p); gtext(first, '首超！', 0, 0, 100, { fill: K.yellow, sw: 18 });
      for (let k = 0; k < 7; k++) { ev(t0 + k * B, 'blip', { f: 700 + k * 90 }); punch(t0 + k * B, 0.01); }
      ev(t0 + 7 * B, 'slam'); punch(t0 + 7 * B, 0.03); ev(t0, 'v:tokens');
      plate(p, '4.12 万亿 > 2.94 万亿');
      return (t) => {
        const step = clamp(Math.floor((t - t0) / B) + 1, 0, 8) / 8;
        bars.forEach(b => { const h = b.v / 4.12 * 360 * lerp(step - 0.125, step, E.back(clamp(frac(t) * 3))); b.r.setAttribute('y', -h); b.r.setAttribute('height', h); b.val.textContent = step >= 1 ? `${b.v} 万亿` : ''; b.val.setAttribute('y', -h - 20); });
        tf(kw, -330, 150 + hopY(t, 14), 0.5); tf(dw, 330, 150 + hopY(t + B / 2, 14), 0.5);
        poseAny(kc, { hey: step >= 1 ? 1 : 0.3, open: step >= 1 }); poseAny(dc, { hey: step >= 1 ? 1 : 0.3, open: step >= 1 });
        op(first, t >= t0 + 7 * B ? 1 : 0); tf(first, 0, -330, E.back(seg(t, t0 + 7 * B, t0 + 7 * B + 0.2)), -6);
      };
    });

    // 4. Gemini：3.1 → 3.8
    item(3, 2, 9, 'Gemini：从 3.1 一路升到 3.8', (p, t0) => {
      const w = el('g', {}, p); const gm = CAST.gemini(w);
      const disp = el('g', {}, p);
      el('rect', { x: -300, y: -110, width: 600, height: 170, rx: 30, fill: K.ol, stroke: K.white, 'stroke-width': 6 }, disp);
      const vT = txt(disp, '', { x: 0, y: -10, 'font-size': 84, 'font-family': F.round, 'font-weight': 700, fill: '#8FB4FF', 'text-anchor': 'middle' });
      const mT = txt(disp, '', { x: 0, y: 42, 'font-size': 40, 'font-family': F.sans, 'font-weight': 900, fill: K.white, 'text-anchor': 'middle' });
      const V = [['3.1 Pro', '2 月'], ['3.5 Flash-Lite', '7 月'], ['3.6 Flash', '7 月'], ['3.8 Flash', '9 月']];
      const speed = el('g', { stroke: K.white, 'stroke-width': 8, 'stroke-linecap': 'round' }, p);
      for (let i = 0; i < 5; i++) el('line', { x1: -380, y1: 20 + i * 36, x2: -250, y2: 20 + i * 36 }, speed);
      for (let k = 0; k < 4; k++) { ev(t0 + k * 2 * B, 'pop', { f: 900 + k * 150 }); punch(t0 + k * 2 * B, 0.02); }
      for (let k = 0; k < 4; k++) ev(t0 + (k * 2 + 1) * B, 'tick');
      ev(t0, 'v:gemini');
      plate(p, 'Gemini 连续升级');
      return (t) => {
        const k = clamp(Math.floor((t - t0) / (2 * B)), 0, 3);
        vT.textContent = V[k][0]; mT.textContent = `2026 · ${V[k][1]}`;
        tf(disp, 0, -170, 1 + 0.12 * Math.exp(-(t - (t0 + k * 2 * B)) * 10));
        tf(w, 0, 190 + hopY(t, 34), 1.0);
        poseAny(gm, { hey: frac(t) < 0.4 ? 1 : 0.3, open: frac(t) < 0.4, lean: Math.sin(t / B * Math.PI) * 8 });
        speed.setAttribute('transform', `translate(${-((t * 900) % 120)} 0)`);
      };
    });

    // 5. 6月 Claude Sonnet 5：默认模型，自己规划、自己用工具
    item(4, 6, 6, '6月 · Claude Sonnet 5：成为默认模型', (p, t0) => {
      const w = el('g', {}, p); const cl = CAST.claude(w, 'Sonnet 5');
      const tools = ['browser', 'term', 'check', 'gear'].map((k, i) => {
        const tg = el('g', {}, p);
        el('rect', { x: -70, y: -60, width: 140, height: 120, rx: 22, fill: [K.sky, K.ol, K.lime, K.yellow][i], ...SO }, tg);
        if (k === 'browser') { el('rect', { x: -56, y: -46, width: 112, height: 22, rx: 6, fill: K.white }, tg); for (let j = 0; j < 3; j++) el('rect', { x: -50, y: -12 + j * 18, width: 100 - j * 20, height: 10, rx: 5, fill: K.ol }, tg); }
        if (k === 'term') txt(tg, '>_', { x: 0, y: 22, 'font-size': 60, 'font-family': F.round, 'font-weight': 700, fill: K.lime, 'text-anchor': 'middle' });
        if (k === 'check') for (let j = 0; j < 3; j++) { el('rect', { x: -48, y: -40 + j * 30, width: 20, height: 20, rx: 4, fill: K.white, ...SO, 'stroke-width': 3 }, tg); el('rect', { x: -18, y: -34 + j * 30, width: 64, height: 10, rx: 5, fill: K.ol }, tg); }
        if (k === 'gear') el('path', { d: starPath(8, 40, 30), fill: K.ol }, tg);
        const ck = el('g', {}, tg); el('circle', { cx: 52, cy: -48, r: 26, fill: K.green, ...SO, 'stroke-width': 5 }, ck); el('path', { d: 'M 40 -48 L 50 -38 L 66 -58', fill: 'none', stroke: K.white, 'stroke-width': 7, 'stroke-linecap': 'round' }, ck);
        return { tg, ck, i };
      });
      const badge = el('g', {}, p); el('rect', { x: -130, y: -36, width: 260, height: 72, rx: 36, fill: K.claude, ...SO }, badge); txt(badge, '默认模型', { x: 0, y: 16, 'font-size': 44, 'font-family': F.sans, 'font-weight': 900, fill: K.white, 'text-anchor': 'middle' });
      for (let k = 0; k < 8; k++) { ev(t0 + k * B, k % 2 ? 'stamp' : 'ding'); punch(t0 + k * B, 0.014); }
      ev(t0, 'v:sonnet');
      plate(p, '自己规划，自己动手');
      return (t) => {
        tf(w, 0, 170 + hopY(t, 20), 1.1);
        const k = Math.floor((t - t0) / B);
        poseAny(cl, { hey: frac(t) < 0.35 ? 1 : 0.4, open: frac(t) < 0.35 });
        tools.forEach(o => {
          const a = (t - t0) * 1.2 + o.i * Math.PI / 2;
          tf(o.tg, Math.cos(a) * 330, -40 + Math.sin(a) * 120, (k % 4 === o.i ? 1 + 0.2 * Math.exp(-frac(t) * 8) : 0.85));
          show(o.ck, k >= o.i + (k >= 4 ? 0 : 0) && (k >= 4 || k >= o.i));
        });
        tf(badge, 0, -250, E.back(seg(t, t0, t0 + 0.25)), -4);
      };
    });

    // 6. 7月 WAIC：超 200 家具身智能企业
    item(5, 7, 7, '7月 · WAIC：超 200 家具身智能企业', (p, t0) => {
      const sign = el('g', {}, p); el('rect', { x: -260, y: -60, width: 520, height: 120, rx: 20, fill: K.ol, stroke: K.white, 'stroke-width': 6 }, sign); txt(sign, 'WAIC 2026', { x: 0, y: 24, 'font-size': 70, 'font-family': F.round, 'font-weight': 700, fill: K.yellow, 'text-anchor': 'middle' });
      const walkers = []; const cols = ['#E8ECF4', '#FFD6A5', '#CDE7FF', '#FFC8DD', '#D8F8B7', '#E4D4FF'];
      for (let k = 0; k < 12; k++) { const w = el('g', {}, p); walkers.push({ w, h: humanoid(w, cols[k % 6]), t0: t0 + k * B / 2 }); ev(t0 + k * B / 2, 'step'); }
      const pct = el('g', {}, p); el('circle', { cx: 0, cy: 0, r: 110, fill: K.red, ...SO }, pct); gtext(pct, '88.7%', 0, 10, 62, { family: F.round, weight: 700, fill: K.white, sw: 8 }); txt(pct, '出货占全球', { x: 0, y: 56, 'font-size': 28, 'font-family': F.sans, 'font-weight': 900, fill: K.white, 'text-anchor': 'middle' });
      ev(t0, 'v:march'); ev(t0 + 6 * B, 'slam'); punch(t0 + 6 * B, 0.03);
      plate(p, '人形机器人大游行');
      return (t) => {
        tf(sign, 0, -230);
        walkers.forEach((wk, k) => {
          const tt2 = t - wk.t0;
          if (tt2 < 0) { op(wk.w, 0); return; }
          op(wk.w, 1);
          const x = 520 - Math.min(tt2, 3) * 260 - (k % 2) * 30;
          const ph = Math.sin((t / B) * Math.PI);
          tf(wk.w, clamp(x, -470 + k * 70, 600), 175 + (k % 2) * 20, 0.42);
          hpose(wk.h, { aL: 30 + ph * 30, aR: 30 - ph * 30, lL: ph * 20, lR: -ph * 20 });
        });
        op(pct, t >= t0 + 6 * B ? 1 : 0); tf(pct, 330, -60, E.back(seg(t, t0 + 6 * B, t0 + 6 * B + 0.2)), 8);
      };
    });

    // 7. 8月 DeepSeek V4-Pro · 9月 GPT-6 Astra
    item(6, 8, 9, '8月 DeepSeek V4-Pro · 9月 GPT-6 Astra', (p, t0) => {
      const ww = el('g', {}, p); const wh = CAST.deepseek(ww);
      const v4 = el('g', {}, p); gtext(v4, 'V4', 0, 0, 120, { family: F.round, weight: 700, fill: K.whale, stroke: K.white, sw: 14 });
      const rocket = el('g', {}, p);
      const flame = el('path', { d: 'M -40 120 Q 0 260 40 120 Z', fill: K.orange, ...SO, 'stroke-width': 6 }, rocket);
      el('path', { d: 'M -80 120 L -120 150 L -80 40 Z M 80 120 L 120 150 L 80 40 Z', fill: K.red, ...SO }, rocket);
      el('path', { d: 'M -80 120 L -80 -60 Q 0 -230 80 -60 L 80 120 Z', fill: K.white, ...SO }, rocket);
      el('circle', { cx: 0, cy: -30, r: 46, fill: K.gpt, ...SO }, rocket);
      for (const x of [-15, 15]) el('ellipse', { cx: x, cy: -34, rx: 6, ry: 9, fill: K.ol }, rocket);
      txt(rocket, 'GPT-6', { x: 0, y: 80, 'font-size': 40, 'font-family': F.round, 'font-weight': 700, fill: K.ol, 'text-anchor': 'middle' });
      const cnt = el('g', {}, p); const cntT = gtext(cnt, '', 0, 0, 150, { family: F.round, weight: 700, fill: K.yellow, sw: 20 });
      ev(t0, 'v:v4'); ev(t0, 'stamp'); ev(t0 + 2 * B, 'stamp'); punch(t0, 0.02); punch(t0 + 2 * B, 0.02);
      ev(t0 + 4 * B, 'v:count3'); ev(t0 + 5 * B, 'v:count2'); ev(t0 + 6 * B, 'v:count1'); ev(t0 + 7 * B, 'liftoff'); ev(t0 + 7 * B, 'v:liftoff'); punch(t0 + 7 * B, 0.04);
      plate(p, '新模型，接着发');
      return (t) => {
        const k = Math.floor((t - t0) / B);
        tf(ww, -260, 190 + hopY(t, 16), 0.9);
        pose(wh, { hey: k < 4 && frac(t) < 0.4 ? 1 : 0.3, open: k < 4 && frac(t) < 0.4 });
        tf(v4, -260, -170, (k < 4 ? 1 : 0.8) * (1 + 0.25 * Math.exp(-(t - (t0 + (k >= 2 ? 2 : 0) * B)) * 10)), -8);
        const lift = t >= t0 + 7 * B ? E.in(seg(t, t0 + 7 * B, t0 + 8 * B)) : 0;
        tf(rocket, 250 + Math.sin(t * 40) * (k >= 4 && lift === 0 ? 3 : 0), 60 - lift * 700, 0.9);
        flame.setAttribute('transform', `scale(1 ${k >= 7 ? 1.4 + 0.3 * Math.sin(t * 50) : 0.4})`);
        const c = k >= 4 && k <= 6 ? ['3', '2', '1'][k - 4] : '';
        cntT.textContent = c; tf(cnt, 250, -200, 1 + 0.3 * Math.exp(-frac(t) * 10));
      };
    });

    // 终场
    const big = el('g', {}, g);
    gtext(big, '2026', 0, 0, 300, { family: F.round, weight: 700, fill: K.white, sw: 34 });
    const cont = el('g', {}, g); gtext(cont, '还没唱完 →', 0, 0, 100, { fill: K.yellow, sw: 18 });
    for (let k = 0; k < 4; k++) { ev(R(14, k), 'kickhit'); punch(R(14, k), 0.03); }
    for (let k = 0; k < 3; k++) { ev(R(15, k), 'v:heyAll'); punch(R(15, k), 0.025); }
    ev(R(15, 3), 'v:next'); ev(R(15, 3), 'slam'); punch(R(15, 3), 0.05);
    for (let i = 1; i < 7; i++) ev(R(i * 2) - 0.1, 'swish');
    const slotX = (i) => 175 + i * 262, SLOT_Y = 975;
    return (t) => {
      const idx = clamp(Math.floor((t - R(0)) / (2 * BARL)), 0, 7);
      bgR.setAttribute('fill', BGC[idx]);
      rays.setAttribute('transform', `translate(960 560) rotate(${t * 18})`);
      const finale = t >= R(14);
      // 时间轴
      const it = items[Math.min(idx, 6)];
      const pm = finale ? 9 : lerp(it.m0, it.m1, E.io(seg(t, it.t0, it.t0 + 2 * BARL)));
      marker.setAttribute('transform', `translate(${MX(pm)} 68) scale(${1 + 0.15 * Math.exp(-frac(t) * 8)})`);
      fillBar.setAttribute('width', MX(pm) - 318);
      // 标题
      const text = finale ? '2026 · 未完待续' : it.label;
      lblT.textContent = text; const lw = measure(text, 52, F.sans, 900) + 80;
      lblBg.setAttribute('x', -lw / 2); lblBg.setAttribute('width', lw);
      tf(lbl, 960, 185, E.back(seg(t, finale ? R(14) : it.t0, (finale ? R(14) : it.t0) + 0.22)), idx % 2 ? 1.5 : -1.5);
      // 各条目：主舞台 2 小节 → 缩小停到底部
      items.forEach(o => {
        const t1 = o.t0 + 2 * BARL;
        if (t < o.t0 - 0.2) { op(o.g, 0); return; }
        op(o.g, 1);
        let x = 960, y = 600, sc = 1;
        if (t < o.t0) sc = E.back(seg(t, o.t0 - 0.2, o.t0));
        else if (t >= t1 - 0.2 && t < t1) { const q = E.io(seg(t, t1 - 0.2, t1)); x = lerp(960, slotX(o.i), q); y = lerp(600, SLOT_Y, q); sc = lerp(1, 0.27, q); }
        if (t >= t1) { x = slotX(o.i); y = SLOT_Y + hopY(t + o.i * 0.06, finale ? 30 : 12); sc = finale ? 0.3 : 0.27; }
        tf(o.g, x, y, sc);
        if (t < t1 + 0.01 || finale) o.upd(Math.min(t, t1 - 0.001) === t ? t : (finale ? o.t0 + ((t - R(14)) % (2 * BARL)) : t1 - 0.001));
      });
      op(big, finale ? 1 : 0); tf(big, 960, 560, E.back(seg(t, R(14), R(14) + 0.2)) * (1 + 0.12 * Math.exp(-frac(t) * 8)), Math.floor(t / B) % 2 ? 3 : -3);
      op(cont, t >= R(15) ? 1 : 0); tf(cont, 960, 760, E.back(seg(t, R(15), R(15) + 0.2)), -3);
      s.fx.forEach(f => f(t));
    };
  }); }

