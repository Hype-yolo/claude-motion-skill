// Turns packed build data into renderable three.js objects: the skinned base surface, instanced
// coat shells, silhouette fins and the eyes, all skinned with dual quaternions (dqs.js).
//
// Draw calls per animal (main pass):
//   hero / high    base + shells + fins + eyes      (5 for two eyes)
//   medium / low   base + shells + eyes             (4)
//   crowd          base only, eyes painted in       (1)
// plus one shadow draw (the base) per shadow-casting light. Order: base (opaque), shells (blended, writing
// depth), fins (blended, tested against the shells' depth from 0.6 hair lengths nearer the camera).
import * as THREE from 'three';
import { createSkeleton } from './skeleton.js';
import { createCoatMaterials, createShadowMaterials, makeCoatUniforms, setMaterialsDebug, MAX_PAINTED_EYES } from './coatMaterial.js';
import { DQSkin } from './dqs.js';
import { createEyes, EyeRig, setEyeLook } from './eyes.js';
import { QUALITY } from '../build/pipeline.js';
import { createMembranes, hasHair } from './membranes.js';

const DEBUG_MODES = { albedo: 1, weights: 2, material: 3, holes: 4 };

export function createAnimalObject(data, species = {}, opts = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(data.skinWeight, 4));
  g.setAttribute('aComb', new THREE.BufferAttribute(data.comb, 3));
  g.setAttribute('aTint', new THREE.BufferAttribute(data.tint, 4));
  g.setAttribute('aCoat', new THREE.BufferAttribute(data.coat, 4));
  g.setAttribute('aPat', new THREE.BufferAttribute(data.pat, 4));
  g.setAttribute('aSurf', new THREE.BufferAttribute(data.surf, 4));
  g.setIndex(new THREE.BufferAttribute(data.index, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  // shells: one instanced draw sharing every buffer of the base
  const sg = new THREE.InstancedBufferGeometry();
  for (const k of Object.keys(g.attributes)) sg.setAttribute(k, g.attributes[k]);
  sg.setIndex(g.index);
  sg.boundingSphere = g.boundingSphere;

  const sk = createSkeleton(data);
  const dqs = new DQSkin(sk);
  // species.render may be a function of the individual (e.g. a mark colour that follows the morph)
  const hints = (typeof species.render === 'function' ? species.render(data.params) : species.render) || {};
  const uniforms = makeCoatUniforms(hints);
  uniforms.uDQ.value = dqs.tex;
  // cross-fade seams: the handed-over half of each overlap band sinks under the other surface
  // (build/seams.js) instead of ending at a step the eye can see into
  if (Number.isFinite(data.seamSink)) uniforms.uSeam.value.set(data.seamSink, 0.1);
  const mats = createCoatMaterials(uniforms);
  const shadowMats = createShadowMaterials(uniforms);

  const base = new THREE.Mesh(g, mats.base);
  base.name = 'base';
  base.frustumCulled = false;
  base.castShadow = opts.castShadow ?? true;
  base.receiveShadow = opts.receiveShadow ?? true;
  base.customDepthMaterial = shadowMats.depth;
  base.customDistanceMaterial = shadowMats.distance;

  const shells = new THREE.Mesh(sg, mats.shells);
  shells.name = 'shells';
  shells.frustumCulled = false;
  shells.renderOrder = 10;
  shells.receiveShadow = base.receiveShadow;

  // silhouette fins: a 2-segment strand card instanced once per skin vertex; per-vertex data as
  // instanced attributes (the same typed arrays as the base); most cards collapse in the vertex shader
  const fg = new THREE.InstancedBufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  fg.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4]);
  const inst = (name, arr, size) => fg.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
  inst('iPos', data.pos, 3);
  inst('iNrm', data.nrm, 3);
  inst('iComb', data.comb, 3);
  inst('iTint', data.tint, 4);
  inst('iCoat', data.coat, 4);
  inst('iPat', data.pat, 4);
  inst('iSurf', data.surf, 4);
  inst('iSkinIndex', new Float32Array(data.skinIndex), 4);
  inst('iSkinWeight', data.skinWeight, 4);
  fg.instanceCount = data.nV;
  fg.boundingSphere = g.boundingSphere;
  const fins = new THREE.Mesh(fg, mats.fins);
  fins.name = 'fins';
  fins.frustumCulled = false;
  fins.renderOrder = 11;
  fins.receiveShadow = base.receiveShadow;

  const eyeData = data.eyes || [];
  const { eyes, uniforms: eyeUniforms, look, geometries: eyeGeos } = createEyes(eyeData);
  const eyeRig = new EyeRig(eyes, eyeUniforms, sk, look);
  // crowd tier: the eyes painted into the base
  const paintEyes = (lk) => {
    for (let i = 0; i < MAX_PAINTED_EYES; i++) {
      const ed = eyeData[i];
      if (!ed) { uniforms.uEyes.value[i].set(0, 0, 0, 0); continue; }
      uniforms.uEyes.value[i].set(ed.c[0], ed.c[1], ed.c[2], ed.spec.r * (ed.scale || 1));
      const m = lk.lids === 'simple' ? [0.01, 0.01, 0.01] : lk.iris.mid;
      uniforms.uEyeTint.value[i].setRGB(m[0] * 0.6, m[1] * 0.6, m[2] * 0.6);
    }
  };
  paintEyes(look);

  // translucent fin membranes (material 11) in their own draw; no shells / hair fins without hair
  const membranes = createMembranes(data, g, mats.membrane, shadowMats, { castShadow: base.castShadow, receiveShadow: base.receiveShadow });
  const hairy = hasHair(data);

  const group = new THREE.Group();
  group.name = data.species;
  group.add(base, shells, fins, ...eyes);
  if (membranes) group.add(membranes.mesh);

  const furForce = new THREE.Vector3(), accS = new THREE.Vector3(), lastV = new THREE.Vector3(), acc = new THREE.Vector3();
  let debugMode = null, coverings = true, disposed = false, firstVel = true;
  const obj = {
    group, base, shells, fins, eyes, eyeRig, eyeUniforms, skeleton: sk, dqs, uniforms, membranes: membranes?.mesh || null,
    materials: { ...mats, eyes: eyes.map((e) => e.material), depth: shadowMats.depth, distance: shadowMats.distance },
    geometry: g, shellGeometry: sg, finGeometry: fg,
    tier: QUALITY[opts.quality] ? opts.quality : QUALITY[data.quality] ? data.quality : 'high',
  };
  obj.quality = QUALITY[obj.tier];

  // tier transitions (setQuality(q, { transition })): the shell count and the silhouette fins ease to the
  // new tier over time instead of switching in one frame (an adaptive quality controller stepping a
  // tier down and up again showed the coat appearing and disappearing). shellsNow is fractional: the
  // layers keep their spacing 1 / shellsNow and the topmost partial layer fades in by the fraction.
  let shellsNow = -1, finsNow = -1, ease = 0;
  const shellTarget = () => Math.max(0, obj.quality.shells);
  const finTarget = () => (obj.quality.fins ? 1 : 0);
  const syncVis = () => {
    const Q = obj.quality;
    const crowd = Q.shells <= 0;
    const fur = coverings;
    // (into or out of the crowd tier, or no transition asked: jump; the crowd base has its own tone)
    if (ease <= 0 || crowd || shellsNow <= 0) { shellsNow = shellTarget(); finsNow = finTarget(); }
    const nS = Math.max(shellsNow, shellTarget() > 0 ? 1 : 0);
    shells.visible = fur && nS > 0 && hairy;
    sg.instanceCount = Math.max(0, Math.ceil(nS - 1e-3));
    uniforms.uShells.value = Math.max(1, nS);
    uniforms.uShellsOn.value = shells.visible ? 1 : 0;
    // (render hint fins: false: a very long coat, whose base-mesh silhouette lies deep inside the fur,
    // drew the fins as dark contour lines across the coat)
    uniforms.uFinFade.value = finsNow;
    fins.visible = fur && finsNow > 0.002 && hairy && hints.fins !== false;
    membranes?.setCrowd(crowd);
    for (const e of eyes) e.visible = !crowd;
    uniforms.uPaintEyes.value = crowd ? 1 : 0;
    // the shell-less base is brighter and a little more orange than the same coat under its shells:
    // matched to the hero tier's mean colour (silhouette-masked side view)
    const tone = hints.baseTone || [0.9, 0.915, 0.935];
    uniforms.uBaseTone.value.set(...(uniforms.uShellsOn.value > 0.5 ? [1, 1, 1] : tone));
    const dm = DEBUG_MODES[debugMode] || 0;
    uniforms.uDebug.value = dm;
    setMaterialsDebug(mats, dm > 0);
    // 'holes': the base is drawn two-sided and its back faces solid red, so any gap in the skin (a
    // clipped region, a seam that opens, a carve cut through) shows red where the inside is seen
    const side = dm === 4 ? THREE.DoubleSide : THREE.FrontSide;
    if (mats.base.side !== side) { mats.base.side = side; mats.base.needsUpdate = true; }
  };
  // one step of a tier transition (obj.update), on the wall clock: a paused or slowed animal still eases
  let lastWall = 0;
  const wall = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const stepTransition = () => {
    if (ease <= 0) return;
    const t = wall(), dt = Math.min(0.1, Math.max(0, t - lastWall));
    lastWall = t;
    if (!(dt > 0)) return;
    const sT = shellTarget(), fT = finTarget();
    if (shellsNow === sT && finsNow === fT) { ease = 0; return; }
    // shells: the whole difference in `ease` seconds (at least 6 layers a second); fins: their opacity
    const ds = Math.max(6, Math.abs(sT - shellsNow) / ease) * dt;
    shellsNow = Math.abs(sT - shellsNow) <= ds ? sT : shellsNow + Math.sign(sT - shellsNow) * ds;
    const df = dt / ease;
    finsNow = Math.abs(fT - finsNow) <= df ? fT : finsNow + Math.sign(fT - finsNow) * df;
    syncVis();
  };
  /** Switch tier at runtime ('hero' | 'high' | 'medium' | 'low' | 'crowd'): shells, fins, eyes. The mesh
   *  resolution stays the one it was built with. opts.transition (seconds, default 0): ease the shell count
   *  and the fins' opacity to the new tier over that time (update() advances it) instead of switching at
   *  once; transitions into or out of the crowd tier are immediate. */
  obj.setQuality = (q, opts = {}) => {
    if (!QUALITY[q]) return obj;
    obj.tier = q; obj.quality = QUALITY[q];
    ease = Math.max(0, +opts.transition || 0);
    lastWall = wall();
    syncVis(); return obj;
  };
  /** Show / hide the coverings (shells + fins); the base alone still reads as fur. */
  obj.setCoverings = (on) => { coverings = !!on; syncVis(); return obj; };
  /** Debug views: 'albedo' | 'weights' (skin weights) | 'material' (material id colours) | 'holes' (back faces
   *  of the base in red: gaps in the skin) | 'bare' (coverings off). */
  obj.setDebug = (mode, on = true) => {
    if (mode === 'bare' || mode === 'coverings') { coverings = !on; syncVis(); return obj; }
    debugMode = on ? mode : null; syncVis(); return obj;
  };
  /** Light the coat with a scene's image-based environment too (three.js applies scene.environment to its
   *  own standard materials only): sh = the environment's diffuse light as 9 world-space SH coefficients
   *  (a THREE.SphericalHarmonics3, a LightProbe's .sh, or an array of 9 Vector3), times intensity (pass
   *  scene.environmentIntensity, as three.js does for the ground and props). null = none (the default). */
  obj.setEnvironmentLight = (sh, intensity = 1) => {
    const co = sh?.coefficients || sh;
    const u = uniforms.uEnvSH.value;
    if (!co || co.length < 9 || !(intensity > 0)) { uniforms.uEnvOn.value = 0; return obj; }
    for (let i = 0; i < 9; i++) u[i].copy(co[i]).multiplyScalar(intensity);
    uniforms.uEnvOn.value = 1;
    return obj;
  };
  /** Preview any material id (0..9) on the whole body; -1 = off. */
  obj.setForceMaterial = (id) => { uniforms.uForceMat.value = id === null || id === undefined ? -1 : id; return obj; };
  /** Override eye look params (pupil, lids, iris, sclera, pupilSize, lidColor) at runtime. */
  obj.setEyeLook = (look) => {
    const L = setEyeLook(eyes, eyeUniforms, { ...(eyeData[0]?.look || {}), ...look });
    eyeRig.setLook(L); paintEyes(L); return obj;
  };

  obj.update = ({ dt = 0, time = 0, motion = null } = {}) => {
    if (disposed) return;
    stepTransition();
    // (a crowd-LOD motion frame that only carried the skeleton rigidly: carry the packed dual
    // quaternions too, when the previous motion frame was packed)
    const mf = motion?.frame;
    if (motion?.rigidCarry && mf !== undefined && dqs.frame === mf - 1) dqs.carry(motion.rigidCarry); else dqs.update();
    dqs.frame = mf;
    const state = motion?.state || {};
    eyeRig.update(dt, { root: rootOf(group), state, look: motion?.input?.look || null });
    // coat dynamics: gravity + inertia + drag
    const vel = state.velocity;
    if (dt > 1e-4 && vel) {
      if (firstVel) { lastV.copy(vel); firstVel = false; }
      acc.copy(vel).sub(lastV).divideScalar(dt);
      lastV.copy(vel);
      if (Number.isFinite(acc.x + acc.y + acc.z)) accS.lerp(acc, 1 - Math.exp(-dt * 10));
      furForce.set(0, -0.22, 0).addScaledVector(accS, -0.02).addScaledVector(vel, -0.012);
      furForce.x += Math.sin(time * 1.3) * 0.05;
      furForce.clampLength(0, 0.9);
      if (Number.isFinite(furForce.x + furForce.y + furForce.z)) uniforms.uFurForce.value.copy(furForce);
    }
    // piloerection (hackles) from the motion state, eased
    const fr = Number.isFinite(state.furRaise) ? state.furRaise : 0;
    uniforms.uFurRaise.value += (fr - uniforms.uFurRaise.value) * (dt > 0 ? 1 - Math.exp(-dt * 8) : 1);
    uniforms.uTime.value = time;
  };

  /** Frees every GPU resource this animal owns (geometries, materials, programs' uniforms, textures). */
  obj.dispose = () => {
    if (disposed) return;
    disposed = true;
    g.dispose(); sg.dispose(); fg.dispose(); dqs.tex.dispose(); membranes?.dispose();
    for (const m of Object.values(mats)) m.dispose();
    shadowMats.depth.dispose(); shadowMats.distance.dispose();
    for (const e of eyes) e.material.dispose();
    for (const eg of eyeGeos) eg.dispose();
    group.removeFromParent();
  };
  syncVis();
  return obj;
}

function rootOf(o) {
  while (o.parent) o = o.parent;
  return o;
}
