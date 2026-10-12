import {world,THREE,smooth,mix} from './room-kit.js';
import {solveTwoLink,pickPlace} from './contact-motion.js';
import {makeScore} from './score.js';
const audioWav=makeScore({duration:18});
const w=world(),{scene,mats,box,cyl,rod,mesh}=w;
scene.background=new THREE.Color('#bcbcae');w.sun.position.set(-3,7,5);
box(10,.18,6,0,-.15,0,mats.oak);box(10,4,.14,0,1.8,-2.9,mats.teal);box(10,.1,.18,0,3.7,-2.8,mats.brass);
// A machined assembly bench, with separate surfaces and legible hardware.
box(6.8,.13,3.7,.0,.06,0,mats.ivory);box(6.5,.05,3.4,0,.15,0,mats.cloth);
for(const x of[-3.1,3.1])for(const z of[-1.5,1.5]){cyl(.04,.04,.05,x,.195,z,mats.brass)}
for(let i=0;i<8;i++){box(.18,.06,.72,2.4+i*.16,.2,-1.1,mats.dark);rod([2.4+i*.16,.28,-1.4],[2.4+i*.16,.28,-.95],.018,mats.brass)}
const base=[-2.1,1.1],L1=2.5,L2=2.3,pick=[.1,.383],place=[2.0,.816],home=[-.6,2.2];
cyl(.66,.72,.2,base[0],.29,0,mats.dark);cyl(.43,.5,.53,base[0],.62,0,mats.teal);cyl(.46,.46,.07,base[0],.92,0,mats.brass);
for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(.035,.035,.04,base[0]+.56*Math.cos(a),.41,.56*Math.sin(a),mats.brass)}
const shoulder=new THREE.Group();shoulder.position.set(base[0],base[1],0);scene.add(shoulder);
const elbow=new THREE.Group();elbow.position.x=L1;shoulder.add(elbow);
const wrist=new THREE.Group();elbow.add(wrist);wrist.position.x=L2;
function joint(parent,r){const o=cyl(r,r,.40,0,0,0,mats.dark,parent);o.rotation.x=Math.PI/2;for(const z of[-.24,.24]){const p=cyl(r*.79,r*.79,.055,0,0,z,mats.brass,parent);p.rotation.x=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3;const s=mesh(new THREE.SphereGeometry(.023,8,5),mats.dark,parent);s.position.set(Math.cos(a)*r*.59,Math.sin(a)*r*.59,z)}}}
function segment(parent,len,thick){box(len,thick,.31,len/2,0,0,mats.teal,parent);box(len*.76,thick*.56,.34,len/2,0,0,mats.ivory,parent);for(const z of[-.185,.185])rod([.12,-thick*.4,z],[len-.12,-thick*.4,z],.025,mats.copper,parent);for(let i=0;i<5;i++)box(.14,.025,.35,.3+i*(len-.6)/4,thick*.31,0,mats.dark,parent)}
segment(shoulder,L1,.38);joint(shoulder,.30);segment(elbow,L2,.30);joint(elbow,.25);joint(wrist,.17);
const gripper=new THREE.Group();gripper.rotation.y=Math.PI/2;wrist.add(gripper);box(1.19,.16,.28,0,-.19,0,mats.dark,gripper);rod([0,0,0],[0,-.18,0],.07,mats.brass,gripper);
const fingers=[];for(const s of[-1,1]){const f=new THREE.Group();gripper.add(f);box(.055,.25,.16,0,-.31,0,mats.brass,f);box(.095,.075,.17,-s*.022,-.40,0,mats.rubber,f);fingers.push(f)}
for(const z of[-.155,.155])rod([-.55,-.19,z],[.55,-.19,z],.015,mats.brass,gripper);
function gear(radius,teeth,thick,parent,material=mats.brass){
 const module=.04,pitch=teeth*module/2,baseR=pitch*Math.cos(Math.PI/9),rootR=pitch-module*1.25,outer=pitch+module;
 const involute=r=>{const a=Math.acos(Math.min(1,baseR/r));return Math.tan(a)-a},ip=involute(pitch),half=r=>Math.PI/(2*teeth)+ip-involute(Math.max(baseR,r))-.014;
 const points=[];for(let tooth=0;tooth<teeth;tooth++){const c=tooth*Math.PI*2/teeth;const point=(r,a)=>points.push([Math.cos(a)*r,Math.sin(a)*r]);point(rootR,c-half(baseR));for(let j=0;j<=8;j++){const r=baseR+(outer-baseR)*j/8;point(r,c-half(r))}for(let j=0;j<=4;j++)point(outer,c-half(outer)+2*half(outer)*j/4);for(let j=8;j>=0;j--){const r=baseR+(outer-baseR)*j/8;point(r,c+half(r))}point(rootR,c+half(baseR));}
 const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));shape.closePath();const hole=new THREE.Path();hole.absarc(0,0,.071,0,Math.PI*2,true);shape.holes.push(hole);
 const o=mesh(new THREE.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:3,steps:1}),material,parent);o.rotation.x=-Math.PI/2;return o;
}
// The loose gear is one persistent object: carried with the target, then seated on its axle.
const moving=new THREE.Group();scene.add(moving);gear(.35,16,.075,moving);const hub=mesh(new THREE.TorusGeometry(.092,.020,12,48),mats.copper,moving);hub.rotation.x=Math.PI/2;hub.position.y=.068;
for(let i=0;i<5;i++){const a=i*Math.PI*.4;cyl(.028,.028,.08,Math.cos(a)*.23,.05,Math.sin(a)*.23,mats.dark,moving)}
cyl(.48,.5,.15,pick[0],.28,0,mats.dark);cyl(.39,.39,.025,pick[0],.367,0,mats.copper);
// Open music box, with the empty center visibly awaiting the gear.
box(1.7,.52,1.55,2,.48,0,mats.oak);box(1.5,.065,1.35,2,.78,0,mats.dark);box(1.7,.08,.07,2,.78,-.76,mats.brass);
const lid=new THREE.Group();lid.position.set(2,.8,-.75);lid.rotation.x=1.05;scene.add(lid);box(1.7,.075,1.5,0,0,-.75,mats.oak,lid);box(1.47,.04,1.26,0,.05,-.75,mats.teal,lid);
cyl(.047,.047,.15,2,.888,0,mats.brass);
for(const x of[1.27,2.73])for(const z of[-.62,.62])cyl(.023,.023,.018,x,.825,z,mats.brass);
const otherGears=[];for(const [x,z,r,teeth]of[[1.44,0,.27,12],[2.56,0,.27,12]]){const g=new THREE.Group();g.position.set(x,.816,z);scene.add(g);gear(r,teeth,.08,g,mats.copper);otherGears.push(g)}
box(1.35,.07,.045,2,.86,-.715,mats.copper);for(let i=0;i<12;i++)box(.038,.014,.067+i*.002,1.4+i*.108,.902,-.695,mats.brass);
const notes=[];for(let i=0;i<5;i++){const g=new THREE.Group();scene.add(g);const head=mesh(new THREE.SphereGeometry(.045,12,8),mats.brass,g);head.scale.set(1.5,.6,1);rod([.055,0,0],[.055,.22,0],.012,mats.brass,g);notes.push(g)}
function render(t){const state=pickPlace(t,{home,pick,place,lift:1.20});
 // IK targets describe the held object's center; the wrist sits 0.40 above it.
 const goal=[state.target[0],state.target[1]+.44],ik=solveTwoLink(base,goal,L1,L2);
 shoulder.rotation.z=ik.shoulder;elbow.rotation.z=ik.elbow;wrist.rotation.z=-ik.shoulder-ik.elbow;
 fingers.forEach((f,i)=>f.position.x=(i?1:-1)*mix(.57,.433,state.grip));
 moving.position.set(state.object[0],state.object[1],0);const qspin=Math.max(0,t-12.4);const spin=qspin<1.4?.72*(qspin**3/(1.4**2)-qspin**4/(2*1.4**3)):.72*(qspin-.7);moving.rotation.y=-spin;otherGears.forEach((g,i)=>g.rotation.y=Math.PI/12+spin*16/12);
 notes.forEach(n=>n.visible=false);
 const q=smooth(t,1,4)*(1-smooth(t,14,18));w.draw([mix(7,5.1,q),mix(5.8,4.2,q),mix(10,7.2,q)],[.1,1.45,0]);
 window.LIBRARY_AUDIT={revision:2,padClearance:mix(.57,.433,state.grip)-.022-.0475-.363,axleClearance:.071-.003-.047,tip:ik.tip,target:goal,contactError:ik.error,reachable:ik.reachable,grip:state.grip,phase:state.phase,object:state.object,carryError:state.phase==='carry'?Math.hypot(moving.position.x-ik.tip[0],moving.position.y-(ik.tip[1]-.44)):0};
}
Object.assign(window,{READY:true,DUR:18,CAPTURE:w.canvas,render,audioWav});render(0);
