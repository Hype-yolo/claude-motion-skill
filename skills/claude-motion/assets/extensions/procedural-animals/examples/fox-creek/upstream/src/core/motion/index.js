// Motion engine factory: picks the engine for a species' body plan.
import { createQuadrupedMotion } from './quadruped.js';
import { createSnakeMotion } from './snake.js';
import { createSpiderMotion } from './spider.js';
import { createSwimmerMotion } from './swimmer.js';
import { createBirdMotion } from './bird.js';

const PLANS = {
  quadruped: createQuadrupedMotion,
  snake: createSnakeMotion,
  spider: createSpiderMotion,
  swimmer: createSwimmerMotion,
  bird: createBirdMotion,
};

export function registerPlan(name, factory) { PLANS[name] = factory; }

export function createMotion(plan, ctx) {
  const f = PLANS[plan];
  if (!f) throw new Error(`procedural-animals: no motion engine for body plan "${plan}"`);
  return f(ctx);
}
