/**
 * TypeScript port of the FR_Procedural_Building geometry-nodes graph
 * (FrenchBuilding.blend, modifier "French Building" on FR_Building) and its
 * FR_Facade_Side subgroup. All coordinates are Blender Z-up; the building
 * occupies x ∈ [0, W], y ∈ [0, L] with W = 3·BaysX + 2, L = 3·BaysY + 2.
 *
 * FR_Facade_Side (one side, local frame, facade plane y = 0, outward = −Y):
 *  - ground floor:  Bays points at x = 3i + 2.5, z = 0 → FR_Ground
 *                   (G1_Ground_Door on the middle bay of the front side only)
 *  - upper floors:  Bays × Floors points, z = 3.2·row + 4.2 → FR_Upper
 *                   (row 1 and the top row carry the continuous balcony U1; other
 *                   rows U0, or U2 when Balcony Type = Exterior)
 *  - wall detail:   same points → FR_WallDetail, Y scaled by Detail Depth,
 *                   variant per Detail Pattern (same / alternate / random per floor)
 *  - corner pier:   Floors + 1 points at x = 0 → FR_Corner (ground / upper / balcony)
 *  - cornice:       T0_Cornice per bay + T1_Cornice_Corner, z = top
 *  - mansard:       R0 (dormer) or R1 (plain) per bay + T2_Mansard_Corner, z = top + 0.55
 * FR_Procedural_Building places four sides (rot Z 0/90/180/270°) around the
 * footprint and adds the zinc roof cap (a 4-sided Cone frustum).
 *
 * Points that later get interiors carry the facade's `fr_room` attribute
 * (type 1 ground / 2 upper / 3 roof, facade-local x, facade length) and
 * `fr_room_pick` (the picked module index) — see interiors.ts.
 *
 * Blender evaluates in float32 and the interior graphs hash instance positions,
 * so matrices here are built exactly like Blender builds them (see blenderMatrix).
 */
import { randomInt } from "./rng";
import type { BuildingParams, DetailPattern, DetailStyle } from "./params";

const f32 = Math.fround;

export const GROUND = ["G0_Ground_Window", "G1_Ground_Door"];
export const UPPER = ["U0_Upper_Window", "U1_Upper_Balcony", "U2_Upper_ExtBalcony"];
export const CORNER = ["C0_Corner_Ground", "C1_Corner_Upper", "C2_Corner_Balcony"];
export const ROOF = ["R0_Mansard_Dormer", "R1_Mansard_Plain"];
export const DETAIL = ["D0_Detail_Refends", "D1_Detail_Pilasters", "D2_Detail_Ornamented"];

export interface RoomTag {
  type: number; // 1 ground, 2 upper, 3 roof
  x: number; // facade-local x of the bay
  length: number; // facade length (3·Bays + 2)
  pick: number; // fr_room_pick
}

export interface Instance {
  key: string;
  /** 4×4 column-major (three.js Matrix4.elements order), Blender space */
  m: number[];
  room?: RoomTag;
}

const PATTERN_ID: Record<DetailPattern, number> = { off: 0, same: 1, alternate: 2, random: 3 };
const STYLE_ID: Record<DetailStyle, number> = { refends: 0, pilasters: 1, ornamented: 2 };

/**
 * Transform Geometry's matrix for a Z rotation: the Rotation socket is a
 * quaternion, so the Euler input goes Euler → float quaternion → matrix
 * (math::from_rotation, double precision internally).
 */
function rotZ(angle: number): { c: number; s: number } {
  const h = f32(f32(angle) * 0.5);
  const w = f32(Math.cos(h));
  const z = f32(Math.sin(h));
  const q0 = Math.SQRT2 * w;
  const q3 = Math.SQRT2 * z;
  return { c: f32(1 - q3 * q3), s: f32(q0 * q3) };
}

/** from_loc_rot_scale(T, rotZ, (1, sy, 1)) — column-major */
function blenderMatrix(tx: number, ty: number, tz: number, r: { c: number; s: number }, sy = 1): number[] {
  const { c, s } = r;
  return [c, s, 0, 0, f32(-s * sy), f32(c * sy), 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

/**
 * float4x4 product A·B as BLI's SSE mul_m4_m4m4 evaluates it:
 * R[i] = (B[i][0]·A0 + B[i][1]·A1) + (B[i][2]·A2 + B[i][3]·A3), in float32.
 */
function mul(a: number[], b: number[]): number[] {
  const r = new Array<number>(16);
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    for (let k = 0; k < 4; k++) {
      const p = f32(f32(b0 * a[k]) + f32(b1 * a[4 + k]));
      const q = f32(f32(b2 * a[8 + k]) + f32(b3 * a[12 + k]));
      r[i * 4 + k] = f32(p + q);
    }
  }
  return r;
}

const IDENT = { c: 1, s: 0 };

/** Math node MULTIPLY_ADD in float32 */
function madd(a: number, b: number, c: number): number {
  return f32(f32(a * f32(b)) + f32(c));
}

/** Math COMPARE with epsilon */
function cmp(a: number, b: number, eps = 0.1): number {
  return Math.abs(a - b) <= eps ? 1 : 0;
}

interface SideInputs {
  bays: number;
  floors: number;
  front: boolean;
  dormers: boolean;
  detailMode: number;
  detailStyle: number;
  detailSeed: number;
  detailDepth: number;
  balconyType: number;
}

/** FR_Facade_Side — instances in the side's local frame */
function facadeSide(p: SideInputs): Instance[] {
  const out: Instance[] = [];
  const { bays, floors } = p;
  const length = f32(bays * 3 + 2);
  const top = madd(floors, 3.2, 4.2);
  const bayX = (i: number) => madd(i, 3, 2.5);
  /** balcony floor: row 1 (the étage noble) and the top row */
  const balconyRow = (row: number) => Math.max(cmp(row, 1), cmp(row, floors - 1));

  // ground floor — door on the middle bay of the front side
  const doorBay = Math.floor(bays / 2);
  for (let i = 0; i < bays; i++) {
    const door = cmp(i, doorBay) * (p.front ? 1 : 0);
    const x = bayX(i);
    out.push({
      key: GROUND[door],
      m: blenderMatrix(x, 0, 0, IDENT),
      room: { type: 1, x, length, pick: door },
    });
  }

  // upper floors + wall detail on the same points
  for (let i = 0; i < bays * floors; i++) {
    const col = i % bays;
    const row = Math.floor(f32(i / bays));
    const x = bayX(col);
    const z = madd(row, 3.2, 4.2);
    const balcony = balconyRow(row);
    const pick = (1 - balcony) * p.balconyType * 2 + balcony;
    out.push({
      key: UPPER[pick],
      m: blenderMatrix(x, 0, z, IDENT),
      room: { type: 2, x, length, pick },
    });

    if (p.detailMode > 0.5) {
      // "Detail Mode" 1: same style everywhere, 2: style + floor (mod 3),
      // 3: Random Value INT(0..2, id = floor, seed) — +0.5 then float→int
      const alt = (p.detailStyle + row) % 3;
      const rnd = randomInt(0, 2, row, p.detailSeed) + 0.5;
      const idx =
        cmp(p.detailMode, 1) * p.detailStyle + cmp(p.detailMode, 2) * alt + cmp(p.detailMode, 3) * rnd;
      out.push({
        key: DETAIL[Math.trunc(idx) % DETAIL.length],
        m: blenderMatrix(x, 0, z, IDENT, f32(p.detailDepth)),
      });
    }
  }

  // corner pier — ground piece, then one per upper floor
  for (let i = 0; i <= floors; i++) {
    const above = i > 0.5 ? 1 : 0;
    const z = f32(madd(i - 1, 3.2, 4.2) * above);
    const pick = above * (balconyRow(i - 1) + 1);
    out.push({ key: CORNER[pick], m: blenderMatrix(0, 0, z, IDENT) });
  }

  // cornice
  for (let i = 0; i < bays; i++) out.push({ key: "T0_Cornice", m: blenderMatrix(bayX(i), 0, top, IDENT) });
  out.push({ key: "T1_Cornice_Corner", m: blenderMatrix(0, 0, top, IDENT) });

  // mansard roof — rooms behind the dormers only (pick 0)
  const roofZ = f32(top + 0.55);
  const roofPick = 1 - (p.dormers ? 1 : 0);
  for (let i = 0; i < bays; i++) {
    const x = bayX(i);
    out.push({
      key: ROOF[roofPick],
      m: blenderMatrix(x, 0, roofZ, IDENT),
      room: { type: 3, x, length, pick: roofPick },
    });
  }
  out.push({ key: "T2_Mansard_Corner", m: blenderMatrix(0, 0, roofZ, IDENT) });
  return out;
}

export interface Building {
  instances: Instance[];
  /** zinc roof cap: 4 bottom + 4 top vertices (Blender space) */
  cap: number[][];
  width: number;
  length: number;
}

export function generateBuilding(p: BuildingParams): Building {
  const W = f32(p.baysX * 3 + 2);
  const L = f32(p.baysY * 3 + 2);
  const common = {
    floors: p.floors,
    dormers: p.dormers,
    detailMode: PATTERN_ID[p.detailPattern],
    detailStyle: STYLE_ID[p.detailStyle],
    detailSeed: p.detailSeed,
    detailDepth: p.detailDepth,
    balconyType: p.balcony === "exterior" ? 1 : 0,
  };
  // Transform Geometry … .003 of the main graph
  const sides = [
    { bays: p.baysX, front: true, t: [0, 0], rot: IDENT },
    { bays: p.baysY, front: false, t: [W, 0], rot: rotZ(1.5707963705062866) },
    { bays: p.baysX, front: false, t: [W, L], rot: rotZ(3.1415927410125732) },
    { bays: p.baysY, front: false, t: [0, L], rot: rotZ(4.71238899230957) },
  ];
  const instances: Instance[] = [];
  for (const s of sides) {
    const sideM = blenderMatrix(s.t[0], s.t[1], 0, s.rot);
    for (const inst of facadeSide({ ...common, bays: s.bays, front: s.front })) {
      instances.push({ ...inst, m: mul(sideM, inst.m) });
    }
  }

  // roof cap: Cone(4 verts, r 0.7071 → 0.3889, depth 0.9 — base at z = 0)
  // rotated 45°, then scaled by (W−2, L−2, 1) and lifted to top + 3.55
  const top = madd(p.floors, 3.2, 4.2);
  const cz = f32(top + 3.55);
  const sx = W - 2, sy = L - 2;
  const cap: number[][] = [];
  for (const [r, z] of [[0.3889087438583374, 0.9], [0.7071067690849304, 0]]) {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      cap.push([W / 2 + r * Math.cos(a) * sx, L / 2 + r * Math.sin(a) * sy, cz + z]);
    }
  }
  return { instances, cap, width: W, length: L };
}
