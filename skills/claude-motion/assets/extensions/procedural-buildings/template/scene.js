import * as T from 'three';
import {createBuildingSystem} from './building-system.js';
const W=1280,H=720,DUR=18;
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const sc=document.createElement('canvas');sc.width=32;sc.height=512;const sg=sc.getContext('2d'),gr=sg.createLinearGradient(0,0,0,512);gr.addColorStop(0,'#93a9b9');gr.addColorStop(.65,'#c7c9be');gr.addColorStop(1,'#e7d8ba');sg.fillStyle=gr;sg.fillRect(0,0,32,512);const scene=new T.Scene();scene.background=new T.CanvasTexture(sc);scene.fog=new T.FogExp2(0xa2b4bd,.010);const camera=new T.PerspectiveCamera(39,W/H,.1,220);
const sky=new T.HemisphereLight(0xbacbdb,0x535a59,2.0);scene.add(sky);
const sun=new T.DirectionalLight(0xffdbc0,3.8);sun.position.set(-28,35,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:65,bottom:-45,near:1,far:130});sun.shadow.bias=-.0005;sun.shadow.normalBias=.025;scene.add(sun);scene.add(sun.target);
const smooth=(a,b,t)=>{const x=T.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x)};
const material=(c,r=.8)=>new T.MeshStandardMaterial({color:c,roughness:r});
const roadmat=material(0x6a6a63),stone=material(0xbbb4a6),iron=material(0x283638,.4),leaves=material(0x485c3f),trunk=material(0x715a42);
function box(w,h,d,mat,x,y,z,parent=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
function sphere(r,mat,x,y,z,parent){const o=new T.Mesh(new T.SphereGeometry(r,24,16),mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o}
function rod(a,b,r,mat,parent=scene){const v1=new T.Vector3(...a),v2=new T.Vector3(...b),o=new T.Mesh(new T.CylinderGeometry(r,r,v1.distanceTo(v2),12),mat);o.position.copy(v1).add(v2).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v2.sub(v1).normalize());o.castShadow=true;parent.add(o);return o}
box(160,.35,130,roadmat,0,-.3,-15);
box(78,.12,24,stone,0,-.06,-8);
// Each paving joint is geometry; shallow heights keep wheels and feet above the surface.
for(let x=-40;x<42;x+=1.4)for(let z=-19;z<4;z+=1.4){const tint=((Math.sin(x*9+z*3)+1)*.04);box(1.37,.055,1.37,material(new T.Color(0xb8b1a3).multiplyScalar(.93+tint)) ,x,-.004,z)}
box(80,.18,1.3,stone,0,.04,5.2);box(80,.18,1.3,stone,0,.04,-21.2);
const system=await createBuildingSystem();
const buildings=[];
function building(x,z,params){const b=system.build(params);b.group.position.set(x,.08,z);scene.add(b.group);buildings.push(b);return b;}
building(-31,-2,{baysX:5,baysY:3,floors:3,balcony:'exterior',detailStyle:'ornamented',detailPattern:'alternate',roomSeed:6,curtainSeed:12});
building(10,-3,{baysX:4,baysY:3,floors:2,balcony:'existing',detailStyle:'pilasters',detailSeed:7});
building(-7,-23,{baysX:4,baysY:2,floors:2,balcony:'exterior',detailStyle:'refends',detailSeed:8});
for(const [x,z] of [[-3,-14],[4,-18],[5,-8],[-8,-18]]){rod([x,0,z],[x,3,z],.1,trunk);sphere(1.5,leaves,x,3.7,z,scene);sphere(1.0,leaves,x+.75,3.7,z+.2,scene);box(1.5,.45,1.5,material(0xa08f76),x,.22,z)}
// Lamps and benches maintain a coherent stone/iron palette.
for(const x of [-8,8]){rod([x,0,-5],[x,5,-5],.06,iron);box(.48,.7,.48,iron,x,5.3,-5);const lamp=sphere(.19,new T.MeshBasicMaterial({color:0xffdfac}),x,5.3,-5,scene);const light=new T.PointLight(0xffc784,3,6);light.position.copy(lamp.position);scene.add(light)}
for(const x of [-3,4]){box(2.8,.13,.65,material(0x735b41),x,.58,-11);for(const dx of [-1,1])rod([x+dx,.05,-11],[x+dx,.58,-11],.045,iron)}
const postbox=box(.42,.58,.34,material(0x244d55),-15.12,1.45,2.83);box(.31,.045,.015,iron,-15.12,1.61,3.01);box(.28,.16,.015,material(0xd1c6ae),-15.12,1.40,3.01);rod([-15.12,.05,2.83],[-15.12,1.16,2.83],.055,iron);
// Courier: articulated physical bicycle, pedals and feet share endpoints.
const bike=new T.Group();scene.add(bike);const bikeMat=material(0x496971,.45),rubber=material(0x202a2c,.95),metal=material(0x8c9490,.33),coat=material(0x9d573f),pants=material(0x344654),skin=material(0xd8b592),paper=material(0xeee4d1);
const wheels=[];for(const x of [-.65,.65]){const w=new T.Group();w.position.set(x,.47,0);const tire=new T.Mesh(new T.TorusGeometry(.44,.036,10,56),rubber);w.add(tire);const rim=new T.Mesh(new T.TorusGeometry(.393,.018,8,48),metal);w.add(rim);for(let i=0;i<12;i++){const a=i*Math.PI/6;rod([0,0,0],[Math.cos(a)*.38,Math.sin(a)*.38,0],.006,metal,w)}bike.add(w);wheels.push(w)}
for(const [a,b] of [[[-.65,.47,0],[-.2,1.0,0]],[[-.2,1,0],[.30,1.0,0]],[[.3,1,0],[.65,.47,0]],[[-.65,.47,0],[0,.48,0]],[[0,.48,0],[.3,1,0]],[[0,.48,0],[-.2,1,0]]])rod(a,b,.026,bikeMat,bike);
rod([-.2,.75,0],[-.28,1.18,0],.023,metal,bike);box(.3,.07,.14,iron,-.28,1.2,0,bike);rod([.3,.85,0],[.42,1.33,0],.028,metal,bike);rod([.42,1.33,-.17],[.42,1.33,.17],.02,metal,bike);
box(.40,.28,.33,material(0x947957),.66,1.09,0,bike);for(let i=0;i<5;i++)box(.22,.04,.22,paper,.65,1.23+i*.028,0,bike);
const torso=new T.Group();bike.add(torso);torso.position.set(-.22,1.34,0);const body=sphere(.25,coat,0,0,0,torso);body.scale.set(.8,1.25,.72);const head=sphere(.13,skin,.04,.40,0,torso);sphere(.14,iron,.04,.48,0,torso).scale.set(1,.35,1.08);sphere(.027,skin,.145,.40,0,torso);
const armL=rod([.08,.12,.13],[.64,-.01,.15],.044,coat,torso),armR=rod([.08,.12,-.13],[.64,-.01,-.15],.044,coat,torso);
const joints=[];for(const z of [-.095,.095]){joints.push({z,thigh:rod([-.22,1.20,z],[.1,.85,z],.055,pants,bike),calf:rod([.1,.85,z],[0,.50,z],.05,pants,bike),foot:box(.18,.07,.09,iron,0,.5,z,bike)})}
const letter=box(.2,.02,.13,paper,.68,1.36,.06,bike);const route=()=>{};
function setRod(mesh,a,b){const p=new T.Vector3(...a),q=new T.Vector3(...b);mesh.position.copy(p).add(q).multiplyScalar(.5);mesh.scale.y=p.distanceTo(q)/mesh.geometry.parameters.height;mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize())}
const positions=[[-31,0.17,2.6],[-15.7,.17,2.6],[-15.7,.17,2.6],[-7,.17,2.6],[1,.17,-4]];
function motion(t){if(t<6)return {x:T.MathUtils.lerp(-31,-15.7,smooth(0,6,t)),z:2.6,a:0,d:15.3*smooth(0,6,t)};if(t<11)return {x:-15.7,z:2.6,a:0,d:15.3};if(t<14)return {x:T.MathUtils.lerp(-15.7,-7,smooth(11,14,t)),z:2.6,a:0,d:15.3+8.7*smooth(11,14,t)};const u=smooth(14,17,t);return{x:-7+8*u,z:2.6-6.6*u,a:Math.atan2(6.6,8)*u,d:24+10.3*u}}
function draw(t){const m=motion(t);bike.position.set(m.x,.07,m.z);bike.rotation.y=m.a;wheels.forEach(w=>w.rotation.z=-m.d/.44);const phase=m.d/.20;const paused=t>=6&&t<11;for(let i=0;i<2;i++){const j=joints[i],ang=phase+i*Math.PI;const foot=[Math.cos(ang)*.13,.53+Math.sin(ang)*.13,j.z];if(i===0){const support=smooth(5.7,6.4,t)*(1-smooth(10.5,11.2,t));foot[0]=T.MathUtils.lerp(foot[0],-.1,support);foot[1]=T.MathUtils.lerp(foot[1],.018,support);foot[2]=T.MathUtils.lerp(foot[2],.22,support);}const knee=[.12+Math.cos(ang)*.08,.88+Math.sin(ang)*.045,j.z];setRod(j.thigh,[-.24,1.18,j.z],knee);setRod(j.calf,knee,foot);j.foot.position.set(...foot)}
 // Stop, lift an envelope, hold at slot, release and withdraw; no hand teleport.
 const pick=smooth(6.5,7.6,t),reach=smooth(7.6,8.9,t),withdraw=smooth(9.3,10.6,t);const hand=[.46+pick*.18-reach*.06+withdraw*.06,1.36+pick*.24-reach*.06,.15+reach*.26-withdraw*.26];setRod(armL,[.08,.12,.13],[hand[0]+.22,hand[1]-1.34,hand[2]]);letter.visible=t<9.2;if(t<6.5){letter.position.set(.68,1.36,.06);letter.rotation.set(0,0,0)}else{letter.position.set(...hand);letter.rotation.x=-reach*Math.PI/2;letter.rotation.z=reach*.2}
 if(t>=10.6)setRod(armL,[.08,.12,.13],[.64,-.01,.15]);
 for(let bi=0;bi<buildings.length;bi++)for(const w of buildings[bi].windows){const on=smooth(1+(w.seed%12)*.6+bi*.8,2+(w.seed%12)*.6+bi*.8,t);w.mesh.material.color.setRGB(.04+on*.60,.055+on*.40,.08+on*.17)}
 const dawn=smooth(0,17,t);sun.intensity=2.0+dawn*2.7;sky.intensity=1.5+dawn*.6;renderer.toneMappingExposure=.98+dawn*.12;
 if(t<6){const u=smooth(0,6,t);camera.position.set(-30+8*u,7+2*u,23-6*u);camera.lookAt(-21+5*u,4.0,0)}else if(t<11){const u=smooth(6,10.8,t);camera.position.set(-22+5*u,9-6*u,17-10*u);camera.lookAt(-15.4,2.1,1.8)}else{const u=smooth(11,18,t);camera.position.set(-18+20*u,6.5+8*u,15+14*u);camera.lookAt(-12+12*u,3.8+1.6*u,-.5-8*u)}
 renderer.render(scene,camera);
}
window.CAPTURE=renderer.domElement;window.DUR=DUR;window.render=draw;window.READY=true;draw(0);
