import * as THREE from 'three';
import {Reflector} from './vendor/Reflector.js';
import {createTimelineAnimal} from './procedural-animals.js';
export const width=1280,height=720,duration=18;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a9b5a5');scene.fog=new THREE.FogExp2('#a9b5a5',.105);
const camera=new THREE.PerspectiveCamera(37,width/height,.025,60);
const sun=new THREE.DirectionalLight('#ffdda0',3.0);sun.position.set(-3,3.5,1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});sun.shadow.bias=-.0002;sun.shadow.normalBias=.007;scene.add(sun,new THREE.HemisphereLight('#d9ebdf','#473923',1.25));
let seed=87391;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const mix=(a,b,t)=>a+(b-a)*t;const clamp=x=>Math.min(1,Math.max(0,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const mat=(c,r=1)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
const moss=mat('#606c3d'),mud=mat('#6b5941'),stoneM=[mat('#858b7c'),mat('#6c766b'),mat('#9b9d87')];
function mesh(g,m,x,y,z){let o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);return o;}
// Shore is a quiet continuous strip; the fox walks on an exactly flat contact band.
function grainTexture(base){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,512,512);for(let i=0;i<32000;i++){let v=Math.floor(rand()*90+60);g.fillStyle=`rgba(${v},${v*.92},${v*.65},${.06+rand()*.12})`;let r=.5+rand()*2;g.fillRect(rand()*512,rand()*512,r,r);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,3);t.colorSpace=THREE.SRGBColorSpace;return t;}
mud.map=grainTexture('#83745a');mud.color.set('#b6a68b');
const bankG=new THREE.PlaneGeometry(24,5,140,4);bankG.rotateX(-Math.PI/2);const bp=bankG.attributes.position;for(let i=0;i<bp.count;i++){let x=bp.getX(i),z=bp.getZ(i)-2.55;let edge=.05*Math.sin(x*1.7)+.018*Math.sin(x*8);bp.setZ(i,z+edge*(z+5.05)/5);bp.setY(i,.006);}bankG.computeVertexNormals();mesh(bankG,mud,0,0,0);
mesh(new THREE.BoxGeometry(24,.35,8),moss,0,-.09,-7.05);
mesh(new THREE.BoxGeometry(24,.32,8),moss,0,-.08,6.9);
const waterUniforms={time:{value:0}};
const waterMat=new THREE.MeshStandardMaterial({color:'#507f79',roughness:.19,metalness:.14,transparent:true,opacity:.32,depthWrite:false});
waterMat.onBeforeCompile=shader=>{shader.uniforms.uTime=waterUniforms.time;shader.vertexShader='uniform float uTime; varying vec3 wp;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n wp=position;');shader.fragmentShader='uniform float uTime;varying vec3 wp;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float v=sin(wp.z*85.+sin(wp.x*7.+uTime)*2.+sin(wp.x*2.-uTime*.4)*3.);float s=smoothstep(.96,1.,v)*smoothstep(.7,1.,sin(wp.x*3.+sin(wp.z*3.)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.77,.66),s*.2);`);};
const mirror=new Reflector(new THREE.PlaneGeometry(28,3.4),{color:'#849a8d',clipBias:.002,textureWidth:1280,textureHeight:720});mirror.rotation.x=-Math.PI/2;mirror.position.set(0,.002,1.48);scene.add(mirror);
mesh(new THREE.PlaneGeometry(28,3.4).rotateX(-Math.PI/2),waterMat,0,.004,1.48).receiveShadow=true;
// Riverbed pebbles plus irregular stones at the lip.
for(let i=0;i<125;i++){const x=rand()*19-9.5,z=-.08+rand()*.17,y=-.015;const s=.018+rand()*.065;if(Math.abs(x+.26)<.42)continue;let o=mesh(new THREE.IcosahedronGeometry(s,1),stoneM[i%3],x,y,z);o.scale.set(1+rand(),.35+rand()*.35,.8+rand());o.rotation.set(rand(),rand(),rand());}
for(let i=0;i<22;i++){let x=rand()*17-8.5,z=-1.1-rand()*4;if(Math.abs(x)<3.5&&z> -1.7)continue;let o=mesh(new THREE.IcosahedronGeometry(.1+rand()*.3,1),stoneM[i%3],x,.02,z);o.scale.set(1.4,.6,1);}
// Grass clumps: actual thin tapered blades, united into one mesh with vertex colours.
const gp=[],gc=[];for(let i=0;i<6500;i++){let x=rand()*20-10,z=rand()<.85?-0.23-rand()*6:3.05+rand()*5;if(z>-.9&&Math.abs(x)<3.4)continue;let h=.025+rand()*.12,w=.0015+rand()*.004,a=rand()*Math.PI;let dx=Math.cos(a)*w,dz=Math.sin(a)*w;gp.push(x-dx,.006,z-dz,x+dx,.006,z+dz,x+.03*Math.sin(a),h,z+.03*Math.cos(a));let c=new THREE.Color().setHSL(.19+rand()*.035,.25,.16+rand()*.14);for(let q=0;q<3;q++)gc.push(c.r,c.g,c.b);}
let gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));gg.computeVertexNormals();mesh(gg,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),0,0,0);
// Receding trunks and soft crowns give the landscape a forest scale.
const bark=mat('#5b5745'),leaf=[mat('#526a4c'),mat('#73825a'),mat('#87916b')];
for(let i=0;i<45;i++){const x=rand()*25-12.5,z=i<32?-3-rand()*10:4.5+rand()*10;const h=2+rand()*5,r=.045+rand()*.1;mesh(new THREE.CylinderGeometry(r*.65,r,h,7),bark,x,h/2-.05,z);for(let j=0;j<9;j++){let o=mesh(new THREE.IcosahedronGeometry(.4+rand()*.7,1),leaf[(i+j)%3],x+(rand()-.5)*1.7,h*.68+j*.14,z+(rand()-.5)*1.6);o.scale.set(1,.65,1);}}
// Fern silhouettes frame, without covering the fox's face or feet.
function fern(x,z,k){for(let i=0;i<9;i++){let a=i/9*Math.PI*2,l=k*(.5+rand()*.5);let pts=[];for(let n=0;n<12;n++){let u=n/11;pts.push(new THREE.Vector3(x+Math.cos(a)*l*u,.03+Math.sin(u*Math.PI)*l*.5,z+Math.sin(a)*l*u));}let curve=new THREE.CatmullRomCurve3(pts);mesh(new THREE.TubeGeometry(curve,16,.003,3,false),moss,0,0,0);for(let n=2;n<10;n++){let p=pts[n],s=.10*l*(1-n/13);let o=mesh(new THREE.SphereGeometry(s,5,3),moss,p.x,p.y,p.z);o.scale.set(2.7,.15,1);o.rotation.y=-a;}}}
fern(-2.8,-1.4,.5);fern(2.4,-1.5,.5);fern(-3.2,.1,.6);
const ripples=[];for(let i=0;i<4;i++){let m=new THREE.MeshBasicMaterial({color:'#cfddbd',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});let o=mesh(new THREE.RingGeometry(.96,1,80).rotateX(-Math.PI/2),m,0,.013,.1);o.castShadow=false;ripples.push(o);}
const foxTimeline=await createTimelineAnimal('fox',{scene,seed:3,quality:'high',variant:'red',sex:'female',age:'adult',duration,position:new THREE.Vector3(-1.9,0,-.80),heading:1.22,ground:()=>.006,water:()=>.004,
control(a,t,dt,i){
  let x=-1.9,z=-.80,heading=1.22,vel=new THREE.Vector3();
  if(t<4.6){let u=t/4.6;const f=u<.85?u/.925:1-Math.pow((1-u)/.15,2)*.081081; x=mix(-1.9,-.26,f);z=mix(-.80,-.38,f);const v=u<.85?1/.925:2*(1-u)/(.15*.15)*.081081;vel.set(1.64*v/4.6,0,.42*v/4.6);heading=Math.atan2(1.64,.42);}
  else if(t<13.25){x=-.26;z=-.38;heading=t<5.55?mix(1.32,0,ease((t-4.6)/.95)):0;}
  else {let u=clamp((t-13.25)/4.75);let f=u*u*(2-u);x=-.26+3.3*f;z=-.38-.55*ease(u);vel.set(3.3*(4*u-3*u*u)/4.75,0,-.55*6*u*(1-u)/4.75);heading=mix(0,1.85,ease((t-13.25)/1.1));}
  if(t>=5.55&&t<13.25)a.move({speed:0,heading:0});else a.follow(new THREE.Vector3(x,0,z),vel,{heading});
  if(i===Math.round(5.65*120))a.play('drink',{duration:4.5});
  if(t>10.9&&t<13.25)a.lookAt(new THREE.Vector3(.65,.5,4));else a.lookAt(null);
}});
window.FOX_STATS=foxTimeline.animal.stats;
function render(t){t=Math.min(duration,Math.max(0,t));const s=foxTimeline.seek(t);waterUniforms.time.value=t;
  const close=ease((t-3.8)/2)*(1-ease((t-13.1)/2.6));const cx=mix(-.68,.10,ease(t/4))+mix(0,.60,ease((t-13.4)/4));camera.position.set(mix(-2.1,-1.4,close)+cx,mix(1.03,.63,close),mix(3.35,1.80,close));camera.lookAt(cx,.20,-.34);camera.fov=mix(37,35,close);camera.updateProjectionMatrix();
  ripples.forEach((r,i)=>{let u=((t-6.8)*.9+i*.25)%1;if(u<0)u+=1;let active=ease((t-6.4)/.5)*(1-ease((t-10.1)/.5));r.position.x=-.26;r.position.z=.022;r.scale.setScalar(.015+u*.24);r.material.opacity=(1-u)*.28*active;});
  renderer.render(scene,camera);
}
window.render=render;window.CAPTURE=renderer.domElement;window.DUR=duration;window.READY=true;render(0);
if(!new URLSearchParams(location.search).has('capture')){let start=performance.now();const loop=now=>{if(!window.film)render(((now-start)/1000)%duration);requestAnimationFrame(loop)};requestAnimationFrame(loop);}
