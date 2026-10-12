// In-flight HUD: compass with district, altitude tape (the signature: lanes, cloud deck and the Zenith pad
// are marked on it), heading-up minimap, speed cluster, run panel, toasts and radio chatter.
import { MAP, toMap } from './citymap.js';
import { SKY_ALT } from '../life/skytraffic.js';
import { CITY } from '../city/layout.js';

const DPR = Math.min(2, window.devicePixelRatio || 1);
const CYAN = '#3be8ff', MAG = '#ff3df2', AMBER = '#ffb547', INK = 'rgba(232,240,255,0.92)', DIM = 'rgba(190,205,235,0.55)', FAINT = 'rgba(190,205,235,0.22)';

function canvas(el, w, h) {
  const c = el.querySelector('canvas');
  c.width = w * DPR; c.height = h * DPR;
  const g = c.getContext('2d');
  g.scale(DPR, DPR);
  return g;
}

export class Hud {
  constructor(root, mapImage) {
    this.root = root;
    this.mapImage = mapImage;
    root.insertAdjacentHTML('beforeend', `
      <div id="hud" class="off">
        <div class="h-hit"></div>
        <div class="h-compass"><canvas></canvas><div class="h-district"><span class="zh"></span><span class="en"></span></div></div>
        <div class="h-alt"><canvas></canvas></div>
        <div class="h-map"><canvas></canvas></div>
        <div class="h-speed">
          <svg width="230" height="150" viewBox="0 0 230 150">
            <path class="arc-bg" d="" fill="none" stroke="rgba(190,205,235,0.18)" stroke-width="1.5"/>
            <path class="arc-v" d="" fill="none" stroke="${CYAN}" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${CYAN})"/>
            <path class="arc-b" d="" fill="none" stroke="${MAG}" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${MAG})"/>
          </svg>
          <div class="h-mode"><span class="zh"></span><span class="en"></span></div>
          <div class="h-spd">0</div>
          <div class="h-unit">KM/H</div>
        </div>
        <div class="h-shards"><span class="gem"></span>SHARDS <span class="zh">晶片</span><b>0/0</b></div>
        <div class="h-run hidden"><div class="rn"><span class="zh"></span><span class="en"></span></div><div class="rt">00:00.00</div><div class="rg">GATE <b>0/0</b></div><div class="rd"></div></div>
        <div class="h-toast"></div>
        <div class="h-count hidden"></div>
        <div class="h-radio"></div>
        <div class="h-hints"></div>
        <div class="h-prompt hidden"></div>
      </div>`);
    this.el = root.querySelector('#hud');
    const q = (s) => this.el.querySelector(s);
    this.gCompass = canvas(q('.h-compass'), 440, 34);
    this.gAlt = canvas(q('.h-alt'), 118, 400);
    this.gMap = canvas(q('.h-map'), 210, 210);
    this.dZh = q('.h-district .zh'); this.dEn = q('.h-district .en');
    this.spd = q('.h-spd'); this.modeZh = q('.h-mode .zh'); this.modeEn = q('.h-mode .en');
    this.arcV = q('.arc-v'); this.arcB = q('.arc-b');
    q('.arc-bg').setAttribute('d', this.arcPath(1, 66));
    // a tick every 50 km/h up to 450, longer every 100
    let ticks = '';
    for (let v = 0; v <= 450; v += 50) {
      const a = ((150 + (240 * v) / 450) * Math.PI) / 180, major = v % 100 === 0;
      const r0 = 71, r1 = major ? 77 : 74;
      ticks += `<line x1="${(148 + Math.cos(a) * r0).toFixed(1)}" y1="${(82 + Math.sin(a) * r0).toFixed(1)}" x2="${(148 + Math.cos(a) * r1).toFixed(1)}" y2="${(82 + Math.sin(a) * r1).toFixed(1)}" stroke="rgba(190,205,235,${major ? 0.55 : 0.3})" stroke-width="1"/>`;
    }
    q('.h-speed svg').insertAdjacentHTML('afterbegin', ticks);
    this.shards = q('.h-shards b');
    this.run = q('.h-run'); this.runZh = q('.h-run .rn .zh'); this.runEn = q('.h-run .rn .en'); this.runT = q('.h-run .rt'); this.runG = q('.h-run .rg b'); this.runD = q('.h-run .rd');
    this.toasts = q('.h-toast');
    this.count = q('.h-count');
    this.radioEl = q('.h-radio');
    this.hitEl = q('.h-hit');
    this.hints = q('.h-hints');
    this.promptEl = q('.h-prompt');
    // on a phone there is no Enter key: the prompt itself is the button
    this.promptEl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onPrompt?.(); });
    this.last = {};
    this.hitT = 0;
  }

  show(on) { this.el.classList.toggle('off', !on); }

  setHints(touch) {
    const items = touch ? [] : [['W S', '油門 THRUST'], ['A D', '轉向 STEER'], ['SPACE C', '升降 LIFT'], ['SHIFT', '加速 BOOST'], ['V', '鏡頭 CAMERA'], ['M', '地圖 MAP'], ['ESC', '選單 MENU']];
    this.hints.innerHTML = items.map(([k, t]) => `<span><span class="key">${k}</span>${t}</span>`).join('');
    this.hints.classList.remove('fade');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hints.classList.add('fade'), 14000);
  }

  arcPath(f, r) {
    // a 240 degree arc opening at the bottom-left, centred in the cluster
    const cx = 148, cy = 82, a0 = (150 * Math.PI) / 180, a1 = a0 + ((240 * Math.PI) / 180) * Math.max(0.0001, Math.min(1, f));
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  toast(zh, en, cls = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.innerHTML = `${zh ? `<span class="zh">${zh}</span>` : ''}${en}`;
    this.toasts.appendChild(d);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2900);
  }

  radio(who, en, zh) {
    const d = document.createElement('div');
    d.className = 'radio-line';
    d.innerHTML = `<span class="who">${who}</span>${en}${zh ? `<span class="zh">${zh}</span>` : ''}`;
    this.radioEl.appendChild(d);
    while (this.radioEl.children.length > 3) this.radioEl.firstChild.remove();
    setTimeout(() => d.remove(), 7100);
  }

  prompt(html) {
    if (html === this.last.prompt) return;
    this.last.prompt = html;
    this.promptEl.classList.toggle('hidden', !html);
    if (html) this.promptEl.innerHTML = html;
  }

  countdown(n) {
    if (n === null) { this.count.classList.add('hidden'); return; }
    this.count.classList.remove('hidden');
    this.count.textContent = n;
  }

  hit(strength) {
    this.hitT = Math.min(1, Math.max(this.hitT, strength));
  }

  setRun(run) {
    this.run.classList.toggle('hidden', !run);
    if (!run) return;
    this.runZh.textContent = run.zh;
    this.runEn.textContent = run.en;
  }

  updateRun(time, gate, total, delta) {
    this.runT.textContent = fmtTime(time);
    this.runG.textContent = `${gate}/${total}`;
    if (delta === null || delta === undefined) { this.runD.textContent = ''; this.runD.className = 'rd'; }
    else { this.runD.textContent = (delta < 0 ? '−' : '+') + Math.abs(delta).toFixed(2); this.runD.className = 'rd ' + (delta < 0 ? 'ahead' : 'behind'); }
  }

  setShards(n, total) {
    this.shards.textContent = `${n}/${total}`;
  }

  update(s, dt) {
    // speed cluster
    const kmh = Math.round(s.speed * 3.6);
    if (kmh !== this.last.kmh) { this.spd.textContent = kmh; this.last.kmh = kmh; }
    const fv = Math.min(1, s.speed / 125);
    if (Math.abs(fv - (this.last.fv ?? -1)) > 0.003) { this.arcV.setAttribute('d', this.arcPath(fv, 66)); this.arcV.style.opacity = fv > 0.004 ? 1 : 0; this.last.fv = fv; }
    const fb = s.boost;
    if (Math.abs(fb - (this.last.fb ?? -1)) > 0.01) { this.arcB.setAttribute('d', this.arcPath(fb, 58)); this.arcB.style.opacity = fb > 0.01 ? 1 : 0; this.last.fb = fb; }
    const mode = s.mode === 'air' ? (s.lane ? ['航道', `SKY LANE ${s.lane}`] : ['空中', 'AIRBORNE']) : ['地面', 'STREET'];
    if (mode[1] !== this.last.mode) { this.modeZh.textContent = mode[0]; this.modeEn.textContent = mode[1]; this.last.mode = mode[1]; }
    if (s.district && s.district.en !== this.last.district) {
      this.dZh.textContent = s.district.zh; this.dEn.textContent = s.district.en; this.last.district = s.district.en;
    }
    this.drawCompass(s);
    this.drawAlt(s);
    this.drawMap(s);
    // hit vignette
    this.hitT = Math.max(0, this.hitT - dt * 2.5);
    const hv = (this.hitT * 0.6).toFixed(3);
    if (hv !== this.last.hv) { this.hitEl.style.boxShadow = `inset 0 0 160px rgba(255,40,80,${hv})`; this.last.hv = hv; }
  }

  drawCompass(s) {
    const g = this.gCompass, W = 440, H = 34;
    g.clearRect(0, 0, W, H);
    const pxPerDeg = W / 120;
    const b = s.bearing;
    g.font = '500 10px "Oxanium Variable", sans-serif';
    g.textAlign = 'center';
    const names = { 0: '北 N', 45: 'NE', 90: '東 E', 135: 'SE', 180: '南 S', 225: 'SW', 270: '西 W', 315: 'NW' };
    for (let d = Math.ceil((b - 62) / 5) * 5; d <= b + 62; d += 5) {
      const x = W / 2 + (d - b) * pxPerDeg;
      const n = ((d % 360) + 360) % 360;
      const fade = 1 - Math.abs(d - b) / 62;
      g.globalAlpha = Math.max(0, fade);
      g.fillStyle = n % 45 === 0 ? INK : FAINT;
      g.fillRect(x - 0.5, n % 45 === 0 ? 4 : 8, 1, n % 45 === 0 ? 10 : 5);
      if (n % 45 === 0) { g.fillStyle = n % 90 === 0 ? INK : DIM; g.fillText(names[n], x, 28); }
      else if (n % 15 === 0) { g.fillStyle = FAINT; g.fillText(String(n).padStart(3, '0'), x, 28); }
    }
    g.globalAlpha = 1;
    // objective bearings
    for (const m of s.markers || []) {
      let d = m.bearing - b;
      d = ((d + 540) % 360) - 180;
      const x = W / 2 + Math.max(-60, Math.min(60, d)) * pxPerDeg;
      g.fillStyle = m.color;
      g.save(); g.translate(x, 5); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore();
    }
    g.fillStyle = CYAN;
    g.beginPath(); g.moveTo(W / 2 - 4, 0); g.lineTo(W / 2 + 4, 0); g.lineTo(W / 2, 4); g.fill();
  }

  drawAlt(s) {
    const g = this.gAlt, W = 118, H = 400, cy = H / 2, ppm = 1.25;
    g.clearRect(0, 0, W, H);
    const alt = s.alt;
    const yOf = (a) => cy - (a - alt) * ppm;
    g.save();
    g.beginPath(); g.rect(0, 0, 90, H); g.clip();
    const bg = g.createLinearGradient(0, 0, 90, 0);
    bg.addColorStop(0, 'rgba(3,4,10,0.5)'); bg.addColorStop(1, 'rgba(3,4,10,0)');
    g.fillStyle = bg; g.fillRect(0, 0, 90, H);
    // cloud deck
    const c0 = yOf(CITY.cloudTop), c1 = yOf(CITY.cloudBase);
    if (c1 > 0 && c0 < H) {
      g.fillStyle = 'rgba(180,190,230,0.08)';
      g.fillRect(40, c0, 44, c1 - c0);
      g.strokeStyle = 'rgba(180,190,230,0.18)';
      g.beginPath();
      for (let y = Math.floor(c0 / 7) * 7; y < c1; y += 7) { g.moveTo(40, y); g.lineTo(52, y + 8); }
      g.stroke();
      g.fillStyle = DIM; g.font = '9px "Oxanium Variable"'; g.textAlign = 'left';
      g.fillText('雲層 CLOUD', 46, Math.max(14, Math.min(H - 6, c1 - 4)));
    }
    // ground under the craft: a line with a short hatched band beneath
    const gy = yOf(s.groundY);
    if (gy < H + 2) {
      g.strokeStyle = 'rgba(255,90,110,0.45)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = 22; x < 84; x += 6) { g.moveTo(x, gy + 1); g.lineTo(x - 6, gy + 9); }
      g.stroke();
      g.fillStyle = 'rgba(255,90,110,0.8)'; g.fillRect(20, gy, 64, 1);
    }
    // ticks
    g.fillStyle = FAINT;
    for (let a = Math.floor((alt - 170) / 10) * 10; a <= alt + 170; a += 10) {
      if (a < -10) continue;
      const y = yOf(a);
      const major = a % 50 === 0;
      g.fillStyle = major ? DIM : FAINT;
      g.fillRect(major ? 22 : 30, y, major ? 16 : 8, 1);
      if (major) { g.font = '9px "JetBrains Mono Variable"'; g.textAlign = 'right'; g.fillText(a, 19, y + 3); }
    }
    // sky lanes and the pad
    const marks = [...SKY_ALT.z.map((a) => [a, CYAN, 'N–S']), ...SKY_ALT.x.map((a) => [a, AMBER, 'E–W']), [CITY.zenith.pad, MAG, 'PAD']];
    g.font = '9px "Oxanium Variable"'; g.textAlign = 'left';
    for (const [a, col, lab] of marks) {
      const y = yOf(a);
      if (y < -4 || y > H + 4) continue;
      g.fillStyle = col;
      g.fillRect(38, y - 0.5, 30, 2);
      g.fillText(`${lab} ${a}`, 46, y - 4);
    }
    // fade the ends of the tape
    g.globalCompositeOperation = 'destination-in';
    const vm = g.createLinearGradient(0, 0, 0, H);
    vm.addColorStop(0, 'rgba(0,0,0,0)'); vm.addColorStop(0.16, '#000'); vm.addColorStop(0.84, '#000'); vm.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vm; g.fillRect(0, 0, 90, H);
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // readout
    g.fillStyle = 'rgba(6,8,18,0.85)';
    g.strokeStyle = CYAN;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, cy - 12); g.lineTo(60, cy - 12); g.lineTo(68, cy); g.lineTo(60, cy + 12); g.lineTo(0, cy + 12); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = INK; g.font = '500 15px "JetBrains Mono Variable"'; g.textAlign = 'right';
    g.fillText(String(Math.max(0, Math.round(alt))).padStart(4, '0'), 56, cy + 5);
    g.fillStyle = DIM; g.font = '9px "Oxanium Variable"'; g.textAlign = 'left';
    g.fillText('高度 ALT M', 0, cy - 18);
    g.fillText(`AGL ${Math.max(0, Math.round(s.alt - s.groundY))}`, 0, cy + 26);
    // vertical speed caret
    const vy = Math.max(-60, Math.min(60, s.vy * 2));
    if (Math.abs(vy) > 1) {
      g.fillStyle = vy > 0 ? CYAN : AMBER;
      g.fillRect(72, Math.min(cy, cy - vy), 2, Math.abs(vy));
    }
    // overview strip 0..1700
    const ox = 104, oTop = 10, oBot = H - 10;
    const oy = (a) => oBot - (a / 1700) * (oBot - oTop);
    g.fillStyle = FAINT; g.fillRect(ox, oTop, 1, oBot - oTop);
    g.fillStyle = 'rgba(180,190,230,0.2)'; g.fillRect(ox - 3, oy(CITY.cloudTop), 7, oy(CITY.cloudBase) - oy(CITY.cloudTop));
    for (const [a, col] of marks) { g.fillStyle = col; g.fillRect(ox - 3, oy(a), 7, 1); }
    g.fillStyle = INK;
    const cyO = oy(Math.max(0, Math.min(1700, alt)));
    g.beginPath(); g.moveTo(ox - 9, cyO - 4); g.lineTo(ox - 3, cyO); g.lineTo(ox - 9, cyO + 4); g.fill();
  }

  drawMap(s) {
    const g = this.gMap, W = 210, R = W / 2 - 4;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(W / 2, W / 2, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(4,6,12,0.75)'; g.fillRect(0, 0, W, W);
    const range = 220 + Math.min(700, s.speed * 3 + Math.max(0, s.alt - 40) * 0.7);
    const scale = R / range; // css px per metre
    const k = MAP.size / (MAP.extent * 2); // map px per metre
    g.translate(W / 2, W / 2);
    g.rotate(s.heading);
    g.globalAlpha = 0.95;
    g.drawImage(this.mapImage, -toMap(s.x) * (scale / k), -toMap(s.z) * (scale / k), MAP.size * (scale / k), MAP.size * (scale / k));
    g.globalAlpha = 1;
    // markers in world space
    for (const m of s.mapMarkers || []) {
      let dx = (m.x - s.x) * scale, dz = (m.z - s.z) * scale;
      const d = Math.hypot(dx, dz);
      const edge = d > R - 8;
      if (edge) { dx *= (R - 8) / d; dz *= (R - 8) / d; }
      if (edge && !m.pin) continue;
      g.save();
      g.translate(dx, dz);
      g.rotate(-s.heading);
      g.fillStyle = m.color;
      if (m.shape === 'ring') { g.strokeStyle = m.color; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.stroke(); }
      else { g.rotate(Math.PI / 4); g.fillRect(-3.5, -3.5, 7, 7); }
      g.restore();
    }
    g.restore();
    // rim, north, player
    g.strokeStyle = 'rgba(150,225,255,0.3)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(W / 2, W / 2, R, 0, Math.PI * 2); g.stroke();
    const na = -Math.PI / 2 + s.heading;
    g.fillStyle = INK; g.font = '600 10px "Oxanium Variable"'; g.textAlign = 'center';
    g.fillText('N', W / 2 + Math.cos(na) * (R - 10), W / 2 + Math.sin(na) * (R - 10) + 3);
    g.fillStyle = CYAN;
    g.beginPath(); g.moveTo(W / 2, W / 2 - 8); g.lineTo(W / 2 + 5, W / 2 + 6); g.lineTo(W / 2, W / 2 + 3); g.lineTo(W / 2 - 5, W / 2 + 6); g.closePath(); g.fill();
    g.fillStyle = DIM; g.font = '9px "JetBrains Mono Variable"'; g.textAlign = 'right';
    g.fillText(`${Math.round(range)}M`, W - 8, W - 6);
  }
}

export function fmtTime(t) {
  const m = Math.floor(t / 60), sec = t - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}
