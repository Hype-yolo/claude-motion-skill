import * as THREE from 'three';
import {makePost} from './engine/upstream/post_ts.js';
import {sky} from './engine/upstream/fx.js';
import {glow} from './engine/upstream/px.js';
export {THREE};
export const clamp=(x)=>Math.max(0,Math.min(1,x));
export const smooth=(t,a,b)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x)};
export const lerp=(a,b,t)=>a+(b-a)*t;
export function createWorld(width=1280,height=720){
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height,false);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#23384c',.015);scene.background=new THREE.Color('#23384c');
 const camera=new THREE.PerspectiveCamera(35,width/height,.15,160);
 const sk=sky({top:'#0f1c32',mid:'#2b4960',hor:'#657b86',moonI:.3});/* Indoor cutaway uses a studio backdrop, not the outdoor sky. */
 scene.background=new THREE.Color("#cbc3b2"); scene.fog=new THREE.FogExp2("#cbc3b2",0);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:"#bcb19d",roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.72;floor.receiveShadow=true;scene.add(floor);
 const moon=new THREE.DirectionalLight('#afc9e2',1.7);moon.position.set(-8,18,9);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-22,right:22,top:20,bottom:-20,near:.5,far:70});moon.shadow.bias=-.0002;moon.shadow.normalBias=.025;scene.add(moon);
 const fill=new THREE.HemisphereLight('#9bbdd2','#303238',1.3);scene.add(fill);
 const post=makePost(renderer,scene,camera,width,height,{ssaa:1,ao:false});post.bloom.strength=.32;post.bloom.radius=.55;post.bloom.threshold=.95;post.vig.uniforms.amt.value=.34;post.vig.uniforms.contrast.value=.13;post.vig.uniforms.sat.value=1.08;
 const practicals=[];
 function lamp(parent,pos,{color='#ffc376',power=12,radius=8,shadow=false,size=.7}={}){const l=new THREE.PointLight(color,power,radius,2);l.position.set(...pos);l.castShadow=shadow;if(shadow){l.shadow.mapSize.set(512,512);l.shadow.bias=-.002;l.shadow.normalBias=.02;}const g=glow(color,size,1);g.position.copy(l.position);parent.add(l,g);practicals.push({l,g,power});return {l,g,power};}
 function render(t,{at,look,focus,disable={}}){camera.position.set(...at);camera.lookAt(...look);camera.updateMatrixWorld();moon.castShadow=!disable.shadows;renderer.shadowMap.enabled=!disable.shadows;for(const p of practicals){p.l.visible=!disable.lights;p.g.visible=!disable.lights;p.l.castShadow=!disable.shadows&&p.l.userData.wantsShadow;}
 const distance=camera.position.distanceTo(new THREE.Vector3(...focus));post.dof.focus=distance;post.dof.aper=disable.dof?0:100;post.dof.maxCoc=disable.dof?0:11;post.dof.tiltAmt=disable.dof?0:4;post.dof.tiltC=.51;post.dof.tiltW=.18;post.dof.tiltF=.33;post.composer.render(0);return renderer.domElement;}
 function finish(){for(const p of practicals)p.l.userData.wantsShadow=p.l.castShadow;}
 return {renderer,scene,camera,post,lamp,render,finish,practicals};
}
