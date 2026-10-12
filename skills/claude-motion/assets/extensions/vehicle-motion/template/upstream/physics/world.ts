import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };

export const PHYS_HZ = 120;
export const PHYS_DT = 1 / PHYS_HZ;
export const GRAVITY = -9.81 * 1.25; // a touch heavier than real: cars feel planted, jumps don't float

// Collision groups (membership bits)
export const G_ARENA = 1 << 0;
export const G_CAR = 1 << 1;
export const G_DEBRIS = 1 << 2;
/** barriers and walls: solid to cars, but wheel rays pass through, so tyres can't climb onto them */
export const G_WALL = 1 << 3;
export const G_ALL = 0xffff;

/** Rapier packs membership in the high 16 bits and the filter in the low 16 bits. */
export const groups = (membership: number, filter: number) => ((membership & 0xffff) << 16) | (filter & 0xffff);

export const GROUPS_ARENA = groups(G_ARENA, G_ALL);
export const GROUPS_WALL = groups(G_WALL, G_ALL);
export const GROUPS_CAR = groups(G_CAR, G_ARENA | G_WALL | G_CAR | G_DEBRIS);
export const GROUPS_DEBRIS = groups(G_DEBRIS, G_ARENA | G_WALL | G_CAR | G_DEBRIS);
/** Wheel rays and AI probes: hit the arena and cars, never debris. */
export const GROUPS_WHEEL_RAY = groups(G_ALL, G_ARENA | G_CAR);
export const GROUPS_ARENA_RAY = groups(G_ALL, G_ARENA);

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export function createWorld(): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = PHYS_DT;
  world.integrationParameters.numSolverIterations = 6;
  return world;
}

/** What a collider belongs to, stored in collider userData-like maps. */
export type ColliderTag =
  | { kind: 'arena'; part: 'floor' | 'bank' | 'wall' | 'fence'; /** damage multiplier for hits (tyre walls absorb) */ soft?: number }
  | { kind: 'car'; carIndex: number }
  | { kind: 'debris'; id: number };
