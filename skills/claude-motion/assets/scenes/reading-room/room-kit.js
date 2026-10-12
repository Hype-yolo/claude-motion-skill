import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export {THREE};
export const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(t,a,b)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u)};
export const mix=(a,b,u)=>a+(b-a)*u;
export function texture(kind,seed=7){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 let s=seed;const rand=()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296};
 g.fillStyle=kind==='oak'?'#b79369':kind==='cloth'?'#9a8471':'#ebe3d5';g.fillRect(0,0,512,512);
 for(let i=0;i<14000;i++){const x=rand()*512,y=rand()*512;g.fillStyle=`rgba(${rand()>.5?'255,250,237':'48,35,22'},${rand()*.07})`;g.fillRect(x,y,kind==='oak'?12+rand()*75:1,1)}
 if(kind==='oak')for(let y=0;y<512;y+=64){g.fillStyle='rgba(65,40,20,.24)';g.fillRect(0,y,512,1);const x=rand()*512;g.fillRect(x,y,1,64)}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(kind==='oak'?2:4,kind==='oak'?2:4);return tex;
}
export function world(){
 const canvas=document.querySelector('#frame');const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,720,false);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#ded9cc');const camera=new THREE.PerspectiveCamera(34,1280/720,.1,100);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.42;
 scene.add(new THREE.HemisphereLight('#faf0de','#756954',1.0));const sun=new THREE.DirectionalLight('#ffe8c5',2.0);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:30});sun.shadow.bias=-.0004;sun.shadow.normalBias=.006;sun.shadow.radius=3;scene.add(sun);
 const mat=(color,roughness=.7,metalness=0,map=null)=>new THREE.MeshStandardMaterial({color,roughness,metalness,map});
 const mats={oak:mat('#b39b7e',.66,0,texture('oak')),plaster:mat('#ffffff',.93,0,texture('plaster')),cloth:mat('#ffffff',.98,0,texture('cloth')),teal:mat('#234b4a'),ivory:mat('#e7dfcc'),dark:mat('#293434'),brass:mat('#b99a53',.3,.78),copper:mat('#9b543c',.38,.6),paper:mat('#fff2d5'),rubber:mat('#272c2e',.92),glass:new THREE.MeshPhysicalMaterial({color:'#cbdeda',transmission:.7,opacity:.32,transparent:true,roughness:.08,thickness:.06}),glow:new THREE.MeshStandardMaterial({color:'#ffe3a4',emissive:'#ffbb50',emissiveIntensity:1.4})};
 const mesh=(geo,mat,parent=scene)=>{const o=new THREE.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};
 function box(w,h,d,x,y,z,mat=mats.oak,parent=scene){const o=mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.12),mat,parent);o.position.set(x,y,z);return o}
 function cyl(r1,r2,h,x,y,z,mat=mats.brass,parent=scene,n=48){const o=mesh(new THREE.CylinderGeometry(r1,r2,h,n),mat,parent);o.position.set(x,y,z);return o}
 function rod(a,b,r,mat=mats.brass,parent=scene){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),24),mat,parent);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return o}
 const loader=new GLTFLoader();const loaded=[];
 async function asset(id,height,pos,turn=0){const gltf=await loader.loadAsync(`./assets/${id}.glb`);const root=gltf.scene;root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const holder=new THREE.Group();holder.add(root);const scale=height/size.y;root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);holder.position.set(...pos);holder.rotation.y=turn;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const adapt=m=>{const n=m.name.toLowerCase();let a;if(n.includes('wood'))a=mats.oak.clone();else if(n.includes('carpet')||n.includes('fabric')){a=mats.cloth.clone();a.color.set(n.includes('white')?'#ebddc0':n.includes('darker')?'#4a6660':'#a9b7a1')}else if(n.includes('plant')){a=mats.teal.clone();a.color.set('#496849')}else{a=m.clone();a.roughness=Math.max(.5,a.roughness??.5)}return a};o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material)}});scene.add(holder);loaded.push(id);return holder}
 const target=new THREE.WebGLRenderTarget(1280,720,{samples:4,type:THREE.HalfFloatType});const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));const ao=new SSAOPass(scene,camera,1280,720);ao.kernelRadius=6;ao.minDistance=.003;ao.maxDistance=.16;composer.addPass(ao);composer.addPass(new OutputPass());
 const draw=(at,look)=>{camera.position.set(...at);camera.lookAt(...look);composer.render(0)};
 return {scene,camera,renderer,canvas,mats,mesh,box,cyl,rod,asset,draw,loaded,sun};
}
