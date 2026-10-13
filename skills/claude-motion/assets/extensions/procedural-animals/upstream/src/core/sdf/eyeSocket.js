// Eye geometry helpers shared by the sculpt (orbit, lids, almond aperture) and the eyeball shader.
//
// An eye spec (per species, head-local, left eye):
//   c: centre [x,y,z] relative to the head origin; r: eyeball radius; back: how far the ball sits
//   behind c; yaw: outward divergence (rad); pitch: upward tilt of the view axis (rad, optional);
//   lid: lid skin thickness; R, d: the almond aperture is the intersection of two circles of radius R
//   whose centres are offset -/+d (width = 2*sqrt(R^2-d^2), height = 2*(R-d)); off: aperture offset
//   along the eye's up axis; tilt: roll of the aperture (inner corner lower for +);
//   irisZ / irisR: iris plane depth and radius (eyeball-local).
import { add, mul, frameZY } from '../math/vec.js';

export function eyeFrameOf(E, headO, s) {
  const c = [headO[0] + E.c[0] * s, headO[1] + E.c[1], headO[2] + E.c[2] - E.back];
  const p = E.pitch || 0;
  const z = [Math.sin(E.yaw) * Math.cos(p) * s, Math.sin(p), Math.cos(E.yaw) * Math.cos(p)];
  const [x0, y0] = frameZY(z, [0, 1, 0]);
  const ph = s * E.tilt;
  const x = add(mul(x0, Math.cos(ph)), mul(y0, Math.sin(ph)));
  const y = add(mul(x0, -Math.sin(ph)), mul(y0, Math.cos(ph)));
  return { c, x, y, z };
}

// Adds an orbit hollow, a lid shell hugging the eyeball and the almond aperture cut into it.
// `bone` is usually 'head'. `orbit` (optional) = { r:[rx,ry,rz], at:[u,v,w], k } in aperture frame.
export function sculptEyeSocket(m, E, headO, s, { bone = 'head', orbit = null, zMax = null } = {}) {
  const ef = eyeFrameOf(E, headO, s);
  const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
  if (orbit) m.ell({ bone, tag: 'orbit', c: at(orbit.at[0] * s, orbit.at[1], orbit.at[2]), axis: ef.z, up: ef.y, r: orbit.r, k: orbit.k ?? E.r * 0.65, carve: true });
  m.sphere({ bone, tag: 'eyelid', c: ef.c, rad: E.r + E.lid, k: E.r * 0.4 });
  m.lens({ bone, tag: 'eyesocket', c: add(ef.c, mul(ef.y, E.off)), x: ef.x, y: ef.y, z: ef.z, R: E.R, d: E.d, zMin: -E.r * 0.16, zMax: zMax ?? E.r * 2, k: E.r * 0.18, carve: true });
  return ef;
}

// The aperture roll (E.tilt) that lays the almond's long axis along `axis` (e.g. the head axis: the eye
// slit follows the face line), with the upper lid kept up. The long axis has no direction, so the roll
// is the one within +-90 degrees of upright (the frame's y, the upper lid, stays on the upper side).
// (A search for the largest dot(x, axis) over tilt in [-1.6, 1.6] does not do this: the left eye's
// untilted x points backward, so such a search ends at the edge of its range and stands the almond on
// end, the upper lid facing the ear.) Add the species' own roll to the result: + lowers the inner corner.
export function apertureTiltAlong(E, headO, axis) {
  const f = eyeFrameOf({ ...E, tilt: 0 }, headO, 1);
  const k = axis[0] * f.z[0] + axis[1] * f.z[1] + axis[2] * f.z[2];
  const a = [axis[0] - f.z[0] * k, axis[1] - f.z[1] * k, axis[2] - f.z[2] * k];
  let ph = Math.atan2(a[0] * f.y[0] + a[1] * f.y[1] + a[2] * f.y[2], a[0] * f.x[0] + a[1] * f.x[1] + a[2] * f.x[2]);
  if (ph > Math.PI / 2) ph -= Math.PI;
  else if (ph < -Math.PI / 2) ph += Math.PI;
  return ph;
}

// Aperture size in metres (for docs and checks).
export function apertureSize(E) {
  return { width: 2 * Math.sqrt(Math.max(0, E.R * E.R - E.d * E.d)), height: 2 * (E.R - E.d) };
}
