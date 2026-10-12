/**
 * Ports of the FR_Interior_Rooms and FR_Interior_Curtains geometry-nodes graphs
 * (modifiers on FR_Rooms / FR_Curtains, both reading FR_Building's instances).
 * Output is plain vertex/index arrays in Blender Z-up space.
 *
 * Rooms: behind every ground / upper window (and every dormer) sits an open box
 * 2.9 m wide whose depth runs to the building middle (clamped to Max Depth and
 * to the distance from the neighbouring facade, so corner rooms never poke
 * through). Its attributes drive the FR_Interior shader, a flat-perspective
 * lookup into a 2×5 atlas of apartment photos (see materials.ts). Dormers also
 * get a short tunnel from the window to their room.
 *
 * Curtains: ground windows (not the door) and upper windows get a pair of
 * voile panels: none / closed / open picked per window, open panels pulled
 * back to random widths; a 40-segment strip with an 8-fold sine drape.
 *
 * Both graphs seed their randomness with Hash Value(instance position), so the
 * instance positions from generator.ts must be bit-identical to Blender's.
 */
import type { Instance } from "./generator";
import { hashValueVec3, randomBool, randomFloat } from "./rng";
import type { BuildingParams } from "./params";

export interface RoomMesh {
  position: number[];
  roomLocal: number[];
  p1: number[];
  p2: number[];
  p3: number[];
  index: number[];
}

export interface CurtainMesh {
  position: number[];
  index: number[];
}

// atlas rows (Index Switch / Index Switch.001): v offset and height per row
const ATLAS_V = [0.017, 0.225, 0.421, 0.62, 0.811];
const ATLAS_H = [0.195, 0.181, 0.182, 0.179, 0.18];

// unit cube (Mesh Cube 1³ translated by (0, 0.5, 0.5)): 8 shared corners
// (bit 0 → x, bit 1 → y, bit 2 → z) and its quads keyed by outward normal
const CUBE_CORNERS: [number, number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [
  i & 1 ? 0.5 : -0.5, i & 2 ? 1 : 0, i & 4 ? 1 : 0,
]);
const CUBE_FACES: { n: [number, number, number]; q: [number, number, number, number] }[] = [
  { n: [0, 1, 0], q: [3, 2, 6, 7] },
  { n: [0, -1, 0], q: [0, 1, 5, 4] },
  { n: [1, 0, 0], q: [1, 3, 7, 5] },
  { n: [-1, 0, 0], q: [2, 0, 4, 6] },
  { n: [0, 0, 1], q: [4, 5, 7, 6] },
  { n: [0, 0, -1], q: [2, 3, 1, 0] },
];

/** Rotate Vector by the instance rotation, then + instance position */
function place(m: number[], x: number, y: number, z: number): [number, number, number] {
  // the columns hold rotation (scale is 1 on every room/curtain module)
  return [
    m[12] + m[0] * x + m[4] * y + m[8] * z,
    m[13] + m[1] * x + m[5] * y + m[9] * z,
    m[14] + m[2] * x + m[6] * y + m[10] * z,
  ];
}

export function generateRooms(instances: Instance[], p: BuildingParams): RoomMesh {
  // Separate Geometry: all tagged instances except the plain mansard (roof, pick 1)
  const pts = instances.filter(
    i => i.room && i.room.type > 0.5 && !(i.room.type > 2.5 && i.room.pick > 0.5),
  );
  const mesh: RoomMesh = { position: [], roomLocal: [], p1: [], p2: [], p3: [], index: [] };
  if (!pts.length) return mesh;

  // Attribute Statistic range of the room points' positions (xy)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const i of pts) {
    minX = Math.min(minX, i.m[12]); maxX = Math.max(maxX, i.m[12]);
    minY = Math.min(minY, i.m[13]); maxY = Math.max(maxY, i.m[13]);
  }
  const rangeX = maxX - minX, rangeY = maxY - minY;

  /** one cube instance: its 8 corners through `vertex`, then the kept quads */
  const addCube = (
    faces: typeof CUBE_FACES,
    vertex: (t: [number, number, number]) => { pos: [number, number, number]; local: [number, number, number] },
    p1: number[], p2: number[], p3: number[],
  ) => {
    const base = mesh.position.length / 3;
    for (const t of CUBE_CORNERS) {
      const { pos, local } = vertex(t);
      mesh.position.push(...pos);
      mesh.roomLocal.push(...local);
      mesh.p1.push(...p1);
      mesh.p2.push(...p2);
      mesh.p3.push(...p3);
    }
    for (const { q } of faces) {
      mesh.index.push(base + q[0], base + q[1], base + q[2], base + q[0], base + q[2], base + q[3]);
    }
  };

  for (const inst of pts) {
    const tag = inst.room!;
    const m = inst.m;
    const ground = tag.type < 1.5 ? 1 : 0;
    const roof = tag.type > 2.5 ? 1 : 0;

    // depth: half the building across the facade normal, minus the wall
    const across = Math.abs(m[4]) * rangeX + Math.abs(m[5]) * rangeY;
    const depth = Math.max(Math.min(across * 0.5 - 0.91, p.maxDepth), 1);

    // fr_A = (room height, floor offset, wall inset); fr_B = (max depth, back offset, is roof)
    const A = [ground * 0.97 + 3.12 + roof * -0.32, roof * 0.02 + 0.03, roof * 0.72 + 0.41];
    const B = [(depth + 0.41) * (1 - roof) + roof * 3.88, (1 - roof) * 0.41, roof];

    // per-window atlas pick + variation, hashed from the instance position
    const h = hashValueVec3(m[12], m[13], m[14], p.roomSeed);
    const photo = Math.floor(randomFloat(0, 9.999, h, 11));
    const col = photo % 2;
    const row = Math.floor(photo / 2);
    const u0 = col * 0.5 + 0.008;
    const uw = col * -0.001 + 0.486;
    const vh = ATLAS_H[row];
    const aspect = (uw / vh) * (4 / 3); // atlas cell aspect in pixels (1448×1086 image)
    const p1 = [A[0], randomFloat(-3.7, 3.8, h, 12), aspect];
    const p2 = [u0, ATLAS_V[row], uw];
    const p3 = [vh, randomBool(0.5, h, 13) ? 1 : 0, randomFloat(0.05, 1.5, h, 14)];

    // the room box, minus its window-side face
    addCube(
      CUBE_FACES.filter(f => !(f.n[1] < -0.5)),
      t => {
        const X = t[0] * 2.9;
        const along = tag.x + X; // facade-local position of this vertex
        const edge = Math.min(along - 0.1, tag.length - along - 0.1);
        const span = Math.max(Math.min(B[0], edge), A[2] + 0.3) - A[2];
        const Y = t[1] * span + A[2];
        const Z = t[2] * A[0] + A[1];
        return { pos: place(m, X, Y, Z), local: [X, Y - B[1], Z - A[1]] };
      },
      p1, p2, p3,
    );

    // dormer tunnel: the cube's ±X / ±Z faces, from the window back to the room
    if (B[2] > 0.5) {
      addCube(
        CUBE_FACES.filter(f => !(Math.abs(f.n[1]) > 0.5)),
        t => {
          const X = t[0] * 0.88;
          const Y = t[1] * 1.13;
          const Z = t[2] * 1.43 + 0.51;
          return { pos: place(m, X, Y, Z), local: [X, Y, Z - 0.05] };
        },
        p1, p2, p3,
      );
    }
  }
  return mesh;
}

const CURTAIN_SEGMENTS = 40;

export function generateCurtains(instances: Instance[], p: BuildingParams): CurtainMesh {
  const mesh: CurtainMesh = { position: [], index: [] };
  for (const inst of instances) {
    const tag = inst.room;
    if (!tag) continue;
    const groundWindow = tag.type > 0.5 && tag.type < 1.5 && !(tag.pick > 0.5);
    const upper = tag.type > 1.5 && tag.type < 2.5;
    if (!groundWindow && !upper) continue;

    const m = inst.m;
    const h = hashValueVec3(m[12], m[13], m[14], p.curtainSeed);
    const r = randomFloat(0, 1, h, 21);
    const pullL = randomFloat(0.25, 0.6, h, 22);
    const pullR = randomFloat(0.25, 0.6, h, 23);
    const none = r < p.noCurtainChance;
    const open = r > p.noCurtainChance + p.closedChance;
    if (none) continue;

    const ground = tag.type < 1.5 ? 1 : 0;
    const halfW = ground * 0.16 + 0.61;
    const zBottom = ground * 0.62 + (1 - ground) * (tag.pick > 0.5 ? 0.25 : 0.34);
    const zTop = ground * 2.74 + (1 - ground) * 2.6;

    // closed: one full-width panel; open: two panels pulled to the sides
    const panels: [number, number][] = open
      ? [[-halfW, -halfW + pullL], [halfW - pullR, halfW]]
      : [[-halfW, halfW]];
    for (const [x0, x1] of panels) {
      const base = mesh.position.length / 3;
      for (let k = 0; k <= CURTAIN_SEGMENTS; k++) {
        const u = k / CURTAIN_SEGMENTS;
        const X = u * (x1 - x0) + x0;
        const Y = Math.sin(u * 16 * Math.PI) * 0.0175 + 0.355; // 8 folds
        mesh.position.push(...place(m, X, Y, zBottom), ...place(m, X, Y, zTop));
      }
      for (let k = 0; k < CURTAIN_SEGMENTS; k++) {
        const a = base + k * 2;
        mesh.index.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
  }
  return mesh;
}
