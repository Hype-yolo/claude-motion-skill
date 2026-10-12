// Adaptation of mohamedachrefelouafi's French Building system; MIT.
import * as T from 'three';
import {Kit} from './system/kit.js';
import {generateBuilding} from './system/generator.js';
import {defaultParams} from './system/params.js';
import {triplanar,SPECS,glass,voile} from './system/materials.js';
import {generateCurtains} from './system/interiors.js';
export async function createBuildingSystem(base='./assets/'){
 const mats=await Promise.all(Object.entries(SPECS).map(([n,s])=>triplanar(n,s,base)));
 const byName=new Map(mats.map(m=>[m.name,m]));const glazing=glass();byName.set(glazing.name,glazing);
 const kit=new Kit(byName);await kit.load(base+'kit.glb');
 function build(overrides={}){
  const p={...defaultParams(),...overrides},data=generateBuilding(p);const group=kit.buildGroup(data.instances);
  const capgeo=new T.BufferGeometry();capgeo.setAttribute('position',new T.Float32BufferAttribute(data.cap.flat(),3));capgeo.setIndex([0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);capgeo.computeVertexNormals();const cap=new T.Mesh(capgeo,byName.get('FR_Zinc')||mats[2]);cap.castShadow=true;group.add(cap);
  const cur=generateCurtains(data.instances,p);const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(cur.position,3));cg.setIndex(cur.index);cg.computeVertexNormals();const curtains=new T.Mesh(cg,voile());curtains.renderOrder=1;group.add(curtains);
  // Procedural interior lights replace the upstream photographic atlas (license not verified).
  const windows=[];
  for(const inst of data.instances){if(!inst.room||inst.room.type>2.5||inst.key==='G1_Ground_Door')continue;
   const m=new T.Matrix4().fromArray(inst.m),mat=new T.MeshBasicMaterial({color:0x181b22,side:T.DoubleSide});
   const plate=new T.Mesh(new T.PlaneGeometry(2.25,2.65),mat);plate.rotation.x=Math.PI/2;plate.position.set(0,.30,1.60);plate.updateMatrix();plate.applyMatrix4(m);group.add(plate);windows.push({mesh:plate,seed:windows.length});
  }
  group.rotation.x=-Math.PI/2;
  return {group,windows,data,params:p};
 }
 return {build,materials:byName};
}
