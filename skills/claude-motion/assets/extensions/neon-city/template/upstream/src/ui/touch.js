// Touch: a stick for throttle and steering on the left, climb/descend and boost on the right, menu buttons top right.
export function isTouch() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export function createTouch(root, input) {
  root.insertAdjacentHTML('beforeend', `
    <div id="touch" class="hidden">
      <div class="stick"><i></i></div>
      <div class="tbtns">
        <div class="tbtn" data-k="up">UP</div><div class="tbtn" data-k="boost">BOOST</div>
        <div class="tbtn" data-k="down">DOWN</div><div class="tbtn" data-k="cam">CAM</div>
      </div>
      <div class="tmenu"><div class="tbtn" data-k="map">MAP</div><div class="tbtn" data-k="menu">☰</div></div>
    </div>`);
  const el = root.querySelector('#touch');
  const stick = el.querySelector('.stick'), knob = stick.querySelector('i');
  const t = input.touch;
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => {
    sid = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    stick.setPointerCapture(sid);
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = (e.clientX - cx) / 60, dy = (e.clientY - cy) / 60;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    knob.style.transform = `translate(${dx * 48}px, ${dy * 48}px)`;
    t.steer = Math.abs(dx) < 0.12 ? 0 : dx;
    t.throttle = Math.abs(dy) < 0.12 ? 0 : -dy;
  };
  const end = (e) => {
    if (e.pointerId !== sid) return;
    sid = null;
    knob.style.transform = '';
    t.steer = 0; t.throttle = 0;
  };
  stick.addEventListener('pointermove', move);
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  for (const b of el.querySelectorAll('.tbtn')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('on');
      if (k === 'up') t.lift = 1;
      else if (k === 'down') t.lift = -1;
      else if (k === 'boost') t.boost = true;
      else if (k === 'cam') input.queue.push('camera');
      else if (k === 'map') input.queue.push('map');
      else if (k === 'menu') input.queue.push('pause');
    });
    const up = () => {
      b.classList.remove('on');
      if (k === 'up' || k === 'down') t.lift = 0;
      else if (k === 'boost') t.boost = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
  return { show: (on) => el.classList.toggle('hidden', !on) };
}
