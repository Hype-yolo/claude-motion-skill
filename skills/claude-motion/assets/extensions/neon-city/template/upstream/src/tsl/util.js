import { Fn, vec2, vec3, fract, dot, float, floor, mix, smoothstep } from 'three/tsl';

// sine-free hashes (Dave Hoskins); stable for cell ids in the tens of thousands
export const hash12 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
});

export const hash13 = Fn(([p]) => {
  const p3 = fract(p.mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.zyx.add(31.32)));
  return fract(p3.x.add(p3.y).mul(p3.z));
});

export const hash22 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.103, 0.0973))).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.xx.add(p3.yz).mul(p3.zy));
});

export const hash32 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.103, 0.0973))).toVar();
  p3.addAssign(dot(p3, p3.yxz.add(33.33)));
  return fract(p3.xxy.add(p3.yzz).mul(p3.zyx));
});

// box-filtered pulse: 1 inside [a,b] of a repeating unit cell, antialiased by the cell's screen footprint w
export const filteredPulse = Fn(([x, a, b, w]) => {
  const ww = w.max(1e-4);
  const integ = (t) => floor(t).mul(b.sub(a)).add(t.fract().sub(a).max(0).min(b.sub(a)));
  return integ(x.add(ww.mul(0.5))).sub(integ(x.sub(ww.mul(0.5)))).div(ww);
});

export const remap01 = (x, a, b) => smoothstep(float(a), float(b), x);
export const lerp = mix;
export { vec2 };
