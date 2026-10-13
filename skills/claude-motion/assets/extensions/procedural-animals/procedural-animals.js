// Adapter for Majid Manzarpour's MIT procedural-animals, fixed commit in SOURCE.json.
// Upstream sculpture, rig, IK, skinning and coat code are used unchanged.
import {createAnimal} from './upstream/src/index.js';
export {createAnimal};
const copyUniforms=u=>Object.fromEntries(Object.entries(u).filter(([,o])=>!o.value?.isTexture).map(([k,o])=>[k, o.value?.clone ? o.value.clone() : Array.isArray(o.value)?o.value.map(v=>v?.clone?v.clone():v):o.value]));
const restoreUniforms=(u,v)=>{for(const[k,x]of Object.entries(v)){if(u[k].value?.copy)u[k].value.copy(x);else if(Array.isArray(x))x.forEach((q,i)=>u[k].value[i]?.copy?u[k].value[i].copy(q):u[k].value[i]=q);else u[k].value=x;}};
export async function createTimelineAnimal(species, {duration=18,hz=120,seed=3,scene,control,...opts}={}) {
  // Upstream eyes use Math.random for blinks; isolate and seed initialization + pre-roll.
  const oldRandom=Math.random;let state=seed>>>0;
  Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  let animal;const samples=[];
  try {
    animal=await createAnimal(species,{seed,worker:false,...opts});scene?.add(animal.object);
    for(let i=0;i<=duration*hz;i++){
      control?.(animal,i/hz,1/hz,i);animal.update(i?1/hz:0);
      const r=animal.render;
      samples.push({dq:r.dqs.data.slice(),fur:r.uniforms.uFurForce.value.clone(),raise:r.uniforms.uFurRaise.value,
        eyes:r.eyes.map(e=>({m:e.matrix.clone(),own:copyUniforms(e.userData.own)})),eyeU:copyUniforms(r.eyeUniforms),
        position:animal.position.clone(),mouth:animal.attachments.mouth?.matrix.clone(),head:animal.attachments.head?.matrix.clone()});
    }
  } finally {Math.random=oldRandom;}
  function seek(t){const k=Math.max(0,Math.min(samples.length-1,Math.round(t*hz))),s=samples[k],r=animal.render;
    r.dqs.data.set(s.dq);r.dqs.tex.needsUpdate=true;r.uniforms.uFurForce.value.copy(s.fur);r.uniforms.uFurRaise.value=s.raise;r.uniforms.uTime.value=k/hz;
    restoreUniforms(r.eyeUniforms,s.eyeU);r.eyes.forEach((e,i)=>{e.matrix.copy(s.eyes[i].m);e.matrixWorldNeedsUpdate=true;restoreUniforms(e.userData.own,s.eyes[i].own);});return s;
  }
  return {animal,samples,seek,hz,duration};
}
