// Art Deco engine · tiny pinhole camera for 2D sets drawn in true one/two-point perspective (Cassandre's steep angles).
// World: x right, y up, z forward (metres). Camera at (cx,cy,cz) looking +z, optional yaw (turn) / pitch (tilt up +) / roll.
export function makeCam({ x = 0, y = 1.4, z = 0, f = 1000, yaw = 0, pitch = 0, roll = 0, W = 1920, H = 1080, ox = null, oy = null } = {}) {
  const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const OX = ox ?? W / 2, OY = oy ?? H / 2;
  const view = (X, Y, Z) => {
    let dx = X - x, dy = Y - y, dz = Z - z;
    let ax = dx * cy_ - dz * sy_, az = dx * sy_ + dz * cy_;          // yaw
    let by = dy * cp - az * sp, bz = dy * sp + az * cp;               // pitch (up positive)
    return [ax, by, bz];
  };
  const P = (X, Y, Z) => {
    const [a, b, c] = view(X, Y, Z); const zz = Math.max(c, .05);
    let u = a * f / zz, v = -b * f / zz;
    return [OX + u * cr - v * sr, OY + u * sr + v * cr, zz];
  };
  // pixels per metre at a given world point (for sizing sprites standing there)
  const scaleAt = (X, Y, Z) => f / Math.max(view(X, Y, Z)[2], .05);
  return { P, view, scaleAt, f, x, y, z, yaw, pitch, roll };
}
// Affine that maps a local rectangle (0..w, 0..h) onto a 3D quad given by its top-left, top-right, bottom-left corners.
// Good approximation of the projective map for small cards (letters, doors, plaques).
export function cardTransform(g, cam, TL, TR, BL, w, h) {
  const a = cam.P(...TL), b = cam.P(...TR), c = cam.P(...BL);
  g.transform((b[0] - a[0]) / w, (b[1] - a[1]) / w, (c[0] - a[0]) / h, (c[1] - a[1]) / h, a[0], a[1]);
  return [a, b, c];
}
