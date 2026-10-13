// Type declarations for procedural-animals (three.js Procedural Animals).
import type { Object3D, Vector3 } from 'three';

export type SpeciesId =
  | 'wolf' | 'dog' | 'fox' | 'cat' | 'lion' | 'cheetah' | 'bear' | 'rat'
  | 'horse' | 'deer' | 'cow' | 'pig' | 'sheep' | 'goat' | 'boar'
  | 'chicken' | 'crow' | 'eagle' | 'fish' | 'shark'
  | 'rabbit' | 'frog' | 'snake' | 'spider';

export type Quality = 'hero' | 'high' | 'medium' | 'low' | 'crowd';

export type ActionName =
  | 'idle' | 'jump' | 'sit' | 'lie' | 'sleep' | 'eat' | 'drink' | 'attack' | 'hit' | 'death' | 'stand'
  | 'takeoff' | 'land' | 'perch' | 'glide' | 'flap' | 'burst' | 'coil' | 'strike' | 'hop'
  | (string & {});

export interface CreateAnimalOptions {
  seed?: number;
  quality?: Quality;
  variant?: string;
  sex?: 'male' | 'female' | string;
  age?: 'adult' | 'juvenile' | string;
  /** Terrain height in the space of animal.object.parent. Default: flat y = 0. */
  ground?: (x: number, z: number) => number;
  /** Water surface height, or null where dry (swimmers, drinking). */
  water?: (x: number, z: number) => number | null;
  /** Perch points for birds. */
  perches?: Vector3[];
  position?: Vector3;
  heading?: number;
  /** A .animal file (from `procedural-animals-bake`) instead of building procedurally. */
  baked?: ArrayBuffer | Promise<ArrayBuffer>;
  /** false: build on the calling thread; a function: returns a Worker running the library's worker (procedural-animals/worker). */
  worker?: boolean | (() => Worker);
  castShadow?: boolean;
  receiveShadow?: boolean;
  onProgress?: (message: string) => void;
  overrides?: Record<string, unknown>;
}

export interface FootstepEvent { type: 'footstep'; animal: Animal; foot: string; position: Vector3; speed: number; strength: number; }
export interface AttackHitEvent { type: 'attackHit'; animal: Animal; position: Vector3; direction?: Vector3; style?: string; }
export interface ActionEvent { type: 'actionStart' | 'actionEnd'; animal: Animal; name: string; reason?: string; }
export type AnimalEvent = FootstepEvent | AttackHitEvent | ActionEvent | { type: string; animal: Animal; [k: string]: unknown };

export type PlayResult = 'done' | 'interrupted' | 'stopped' | 'refused';

export interface PlayOptions { target?: Vector3; direction?: Vector3; loop?: boolean; speed?: number; [k: string]: unknown; }

export declare class Animal {
  readonly id: string;
  readonly seed: number;
  readonly params: Record<string, unknown>;
  /** Add this to your scene; keep its own transform at identity. */
  readonly object: Object3D;
  /** Attachment points such as mouth, head, back (horse: seat, stirrupL/R, bitL/R). */
  readonly attachments: Record<string, Object3D>;
  readonly stats: { vertices: number; triangles: number; bones: number; buildMs: number; updateMs: number };
  readonly actions: string[];
  readonly gaits: string[];
  /** Named speeds (m/s) for this individual, e.g. { walk: 1.2, trot: 3 }. */
  readonly gears: Record<string, number>;
  readonly position: Vector3;
  readonly heading: number;
  readonly speed: number;
  readonly velocity: Vector3;
  readonly state: Record<string, any>;

  move(opts?: { speed?: number; heading?: number; climb?: number; gait?: string }): this;
  stop(): this;
  moveTo(point: Vector3 | null, opts?: { speed?: number }): this;
  follow(position: Vector3, velocity?: Vector3, opts?: { heading?: number }): this;
  lookAt(target: Vector3 | null): this;
  play(name: ActionName, opts?: PlayOptions): Promise<PlayResult>;
  stopAction(name?: string): this;
  on(type: 'footstep', fn: (e: FootstepEvent) => void): () => void;
  on(type: 'attackHit', fn: (e: AttackHitEvent) => void): () => void;
  on(type: string, fn: (e: AnimalEvent) => void): () => void;
  off(type: string, fn: (e: AnimalEvent) => void): this;
  update(dt: number): this;
  setQuality(q: Quality): this;
  setLod(level: 0 | 1 | 2): this;
  setDebug(mode: 'albedo' | 'weights' | 'material' | 'bare', on: boolean): this;
  setCoverings(on: boolean): this;
  dispose(): void;
}

export declare function createAnimal(species: SpeciesId | string | object, opts?: CreateAnimalOptions): Promise<Animal>;
export declare function registerSpecies(mod: object): object;
export declare function listSpecies(): string[];
export declare function loadSpecies(id: string | object): Promise<any>;
export declare function addLoader(id: string, loader: () => Promise<any>): void;
export declare function buildAnimalData(species: string | object, opts?: CreateAnimalOptions, onProgress?: (m: string) => void): Promise<any>;
export declare function setWorkerFactory(fn: (() => Worker) | null): void;
export declare function clearBuildCache(): void;
export declare function writeBake(data: any): ArrayBuffer;
export declare function readBake(buf: ArrayBuffer): any;
export declare const QUALITY: Record<Quality, { res: number; shells: number; fins: boolean; eyePatches: boolean }>;
