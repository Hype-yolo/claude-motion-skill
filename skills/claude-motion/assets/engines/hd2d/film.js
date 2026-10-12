import {THREE,createWorld,smooth,lerp} from './engine.js';
import {PX,ramp,texOf,billboard,woodPlanks,cobbles,ground,glow,hex} from './engine/upstream/px.js';
import {box,mesh,mat,mats,house,barrel,crate,ridge} from './engine/upstream/kit.js';
import {atlas} from './engine/upstream/chars.js';
import {audioWav} from './score.js';
const W=1280,H=720,DUR=24,world=createWorld(W,H),{scene,camera,lamp}=world;
const canvas=document.querySelector('#frame'),ctx=canvas.getContext('2d');
const MM=mats(),coolStone=mat(cobbles(96,96,{seed:31,cols:['#202c35','#394651','#54616a','#76828a','#9a9fa4']}));
function put(obj,x,y,z,parent=scene){obj.position.set(x,y,z);parent.add(obj);return obj}
function solid(w,h,d,color,roughness=.8){return box(w,h,d,new THREE.MeshStandardMaterial({color,roughness,metalness:roughness<.5?.35:0}));}
// An actual diorama: all surfaces participate in depth, light and occlusion.
put(box(90,.8,70,mat(ground(96,96,{seed:22}))),0,-.88,-2);
put(box(37,.12,4.4,coolStone),0,-.05,0);
put(box(29,.42,3.1,coolStone),-1,0,3.3);
for(let i=-31;i<=31;i++){put(box(.18,.10,2.9,MM.plankDark),i*.6,.035,0)}
for(const z of [-.68,.68])put(solid(39,.12,.09,'#9ca9a6',.3),0,.13,z);
for(let x=-15;x<14;x+=.7){put(solid(.12,.03,.2,'#d2b77c'),x,.431,1.84)}
// Far houses: original procedural builders, with their pixel-textured roofs and windows.
for(const [x,z,w,h,style] of [[-11,-6,4,4,'wall2'],[-5.5,-7.2,4.1,5.3,'wall'],[0,-7.8,3.9,4,'wall3'],[5,-7,4.2,4.7,'wall2'],[10.5,-7.8,4.9,5.5,'wall']]){
 const building=house({x,z,w,d:3.4,h,wall:style,roof:style==='wall2'?'roof2':'roof',door:.6,upper:h>4?[[0,h-.6]]:[]});scene.add(building);
 for(const win of building.userData.windows){win.material=win.material.clone();win.material.emissiveIntensity=.75;}
 lamp(scene,[x,h*.55,z+2.05],{power:4,radius:6,size:.5});
}
for(let j=0;j<3;j++){const r=ridge(65,8+j*3,['#304756','#34485d','#2c4054'][j],10+j);put(r,-9+j*9,0,-20-j*7)}
// Station house and shallow canopy offset from the boarding point.
scene.add(house({x:-7.3,z:5.2,w:4.5,d:2.7,h:2.7,wall:'wall3',roof:'roof2',door:.3,chimney:false}));
for(const x of [-5.1,-.6])put(box(.14,3,.14,MM.beam),x,.42,4.7);
put(box(5.1,.17,1.4,MM.roof2),-2.85,3.45,4.65);
for(const x of [-5.1,-.6]){put(solid(.25,.36,.25,'#2b383e'),x,3.12,4.5);lamp(scene,[x,3.21,4.45],{power:7,radius:7,shadow:x===-.6,size:1});}
// Bench, timetable board, crates, flower tubs, overhead tram wires.
put(box(2.5,.13,.55,MM.plank),-2,.98,3.8);put(box(2.5,.55,.10,MM.plank),-2,1.02,4.04);
for(const x of [-2.9,-1.1])put(solid(.13,.6,.45,'#38424a'),x,.42,3.83);
for(let i=0;i<3;i++){put(crate(.48+i*.12),-5.1+i*.65,.43,3.6)}
put(barrel(.35,.8),4.1,.42,3.7);
function plaque(text,w=1.8,h=.42){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#263945';g.fillRect(0,0,512,128);g.strokeStyle='#bdae85';g.lineWidth=4;g.strokeRect(6,6,500,116);g.fillStyle='#f1dfad';g.font='600 42px serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,65);const q=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texOf(c),emissive:'#a88650',emissiveIntensity:.18,side:THREE.DoubleSide}));return q;}
put(plaque('MOSSWICK',2.8,.7),-7.3,2.45,6.59);
put(plaque('LAST TRAM  /  23:48',2.5,.58),-2.85,2.55,4.65);
for(const x of [-12,10]){put(solid(.12,7,.12,'#263f49'),x,0,-2.1);put(solid(.14,.12,4.2,'#263f49'),x,6.8,-.2);}
for(const z of [-.2,.2]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-25,6.65,z),new THREE.Vector3(-12,6.8,z),new THREE.Vector3(0,6.2,z),new THREE.Vector3(10,6.8,z),new THREE.Vector3(25,6.5,z)]);scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),new THREE.LineBasicMaterial({color:'#24383f'})));}
// Pixel foliage also uses the upstream lit, cut-out-shadow billboard material.
const foliage=new PX(48,64),leaf=ramp(['#233f43','#355550','#4c6c57','#75866a'],.3);
for(let j=0;j<7;j++)foliage.ellipse(24+Math.sin(j*4)*9,14+j*5,13-j*.4,12,(x,y,dx,dy)=>leaf(.65-dx*.2-dy*.23,x,y));
foliage.rect(22,39,4,25,'#524739');foliage.outline(.4);
const leaves=texOf(foliage.done()),trees=[];
for(const [x,z,s]of[[-13,4.7,1.15],[13,5,1],[13,-4,1.4],[-15,-5,1.6],[3,-11,1.4]]){const tr=billboard(leaves,3.5*s,4.8*s,{receive:true});put(tr,x,0,z);trees.push(tr)}
// New tram model. Window bays and a working sliding doorway retain real depth.
const tram=new THREE.Group();scene.add(tram);const trainMat=mat(woodPlanks(96,96,{seed:13,cols:['#20383e','#305159','#46717a','#61939a','#9ab9ab']}));
put(box(6.4,.42,2.1,MM.beam),0,.33,0,tram);
put(box(6.1,1.0,2.02,trainMat),0,.75,0,tram);
const winMat=new THREE.MeshStandardMaterial({color:'#e8bf78',emissive:'#ffc879',emissiveIntensity:.45,roughness:.28});
for(const side of [-1,1]){
 for(const x of [-2.45,-1.48,1.55,2.48]){put(box(.78,.95,.055,winMat),x,1.81,side*1.03,tram);for(const dx of [-.44,.44])put(box(.08,1.15,.10,MM.beam),x+dx,1.73,side*1.05,tram);}
 put(box(6.2,.14,.13,MM.beam),0,2.85,side*1.05,tram);
 put(box(6.2,.065,.04,new THREE.MeshStandardMaterial({color:'#cfb479',metalness:.6,roughness:.4})),0,1.3,side*1.06,tram);
}
// Remove the central front body visually with the full-height dark doorway and moving panels.
put(solid(1.45,2.19,.04,'#172f38'),.05,.70,1.071,tram);
put(box(1.43,.10,.65,MM.plank),.05,.55,1.15,tram);
const doors=[];for(const side of [-1,1]){const d=new THREE.Group();put(box(.68,2.04,.09,trainMat),0,0,0,d);put(box(.49,.82,.03,winMat),0,1.02,.061,d);put(solid(.05,.27,.04,'#e0c684'),-side*.2,.8,.07,d);put(d,.05+side*.35,.72,1.11,tram);doors.push({d,side});}
const roof=put(solid(6.6,.28,2.35,'#304c57'),0,2.99,0,tram);put(box(5.4,.17,1.23,MM.roof2),0,3.27,0,tram);
for(const x of [-2.2,2.2])for(const z of [-.78,.78]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.17,16),new THREE.MeshStandardMaterial({color:'#172933',roughness:.48,metalness:.6}));wheel.rotation.x=Math.PI/2;put(wheel,x,.34,z,tram);}
for(const x of [-3.13,3.13]){const q=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.9),winMat);q.rotation.y=Math.PI/2;put(q,x,2.23,0,tram);const front=lamp(tram,[x+.07,1.06,0],{power:9,radius:7,shadow:true,size:.5});}
put(plaque('07  /  HOME',1.8,.34),0,2.93,1.23,tram);
const cabin=lamp(tram,[.05,1.4,1.70],{power:3,radius:4,shadow:true,size:.25});
const poleGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1,3.4,0),new THREE.Vector3(.4,4.6,0),new THREE.Vector3(-.1,5.5,0)]);tram.add(new THREE.Line(poleGeom,new THREE.LineBasicMaterial({color:'#44545e'})));
// New pixel passenger, drawn through the original PX + atlas + lit-billboard system.
const raincoat=ramp(['#63392b','#a65a37','#d98749','#efb870'],.25),skin=ramp(['#9b6453','#d79574','#f0bc93'],.22);
function drawPassenger(P,E,p){const st=p.step??-1,feet=st<0?[13,19]:[[10,22],[14,18],[21,12],[15,18]][st];
 for(const x of feet){P.rect(x,37,4,11,'#273c46');P.rect(x,47,6,2,'#1c2934')}
 P.poly([[10,20],[22,20],[25,40],[8,40]],(x,y)=>raincoat(.72-(x-10)*.029+(y%6===0?-.13:0),x,y));
 P.rect(18,22,1,17,'#5b4437');P.rect(11,23,3,9,'#e2a05c');P.rect(22,24,3,10,'#bc783e');P.rect(23,33,3,3,skin(.7,0,0));
 P.ellipse(17,12,6,7,(x,y,dx,dy)=>skin(.8-dx*.15-dy*.12,x,y));P.rect(11,8,12,3,'#293f49');P.rect(12,5,10,5,'#395e69');P.rect(11,9,15,2,'#577b81');P.rect(12,13,2,6,'#654533');P.set(21,13,'#2b2e37');P.set(21,12,'#2b2e37');P.rect(22,16,2,1,'#ce876c');
 P.rect(12,20,10,2,'#e4c996');P.rect(12,22,3,6,'#bd9564');P.rect(8,31,6,7,'#754c36');P.rect(8,31,6,1,'#b58c58');P.line(8,31,19,22,'#5b4434');
 if(p.wave){P.rect(24,21,3,7,'#d48a49');P.rect(25,19,3,3,skin(.8,0,0));}
}
const poses={idle:{},wave:{wave:true},w0:{step:0},w1:{step:1},w2:{step:2},w3:{step:3}},A=atlas(poses,drawPassenger);const passenger=billboard(A.tex,34/26,50/26,{receive:true});scene.add(passenger);
passenger.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = min(outgoingLight, diffuseColor.rgb * 1.45);\n#include <opaque_fragment>');};
// Floating dust visible in lit air, deterministic positions.
const dustG=new THREE.BufferGeometry(),dustP=new Float32Array(150*3);for(let i=0;i<150;i++){dustP[i*3]=Math.sin(i*71.37)*15;dustP[i*3+1]=.5+(Math.sin(i*9.33)*.5+.5)*6;dustP[i*3+2]=Math.cos(i*28.11)*9;}dustG.setAttribute('position',new THREE.BufferAttribute(dustP,3));const dust=new THREE.Points(dustG,new THREE.PointsMaterial({size:.035,color:'#c4ccac',transparent:true,opacity:.35,depthWrite:false}));scene.add(dust);
const frontFill=lamp(scene,[1,2,5],{color:'#c0d4e3',power:3.3,radius:6,size:.01});frontFill.g.material.opacity=0;
world.finish();
const disabled={};window.setFeature=(name,on)=>{disabled[name]=!on;};
function frame(t){t=Math.max(0,Math.min(DUR,t));
 const arrival=smooth(t,2,8),departure=smooth(t,16,22.5),trainX=lerp(-23,0,arrival)+23*departure;
 tram.position.x=trainX;const open=smooth(t,8.1,9.1)*(1-smooth(t,14.4,15.2));for(const {d,side}of doors)d.position.x=.05+side*(.35+open*.67);
 const board=smooth(t,10,13.2);passenger.position.set(lerp(1.15,.05,smooth(t,9.2,10.4)),lerp(.43,.64,board),lerp(3.35,.76,board));passenger.visible=t<13.2;
 const pose=t>=10&&t<13.2?'w'+(Math.floor(t*8)%4):t>=8.5&&t<9.4?'wave':'idle';A.tex.offset.x=A.names.indexOf(pose)/A.n;
 let at,look,focus;
 if(t<7.7){const p=smooth(t,0,7.7);at=[lerp(16,13,p),lerp(13,10.5,p),lerp(23,19,p)];look=[-1,1,-.1];focus=[0,1,2];}
 else if(t<15.7){const p=smooth(t,7.7,15.7);at=[lerp(7,5,p),lerp(6.3,5.3,p),lerp(11,9.5,p)];look=[.2,1.35,1.7];focus=t<13.2?[passenger.position.x,1.35,passenger.position.z]:[.1,1.2,1.3];}
 else {const p=smooth(t,15.7,24);at=[lerp(12,19,p),lerp(10,17,p),lerp(19,27,p)];look=[lerp(1,5,p),1,0];focus=[Math.min(trainX,11),1.6,0];}
 camera.position.set(...at);camera.lookAt(...look);const toward=camera.position.clone().sub(passenger.position).normalize();frontFill.l.position.copy(passenger.position).addScaledVector(toward,2.5);frontFill.l.position.y+=1.1;passenger.rotation.y=Math.atan2(camera.position.x-passenger.position.x,camera.position.z-passenger.position.z);for(const tr of trees)tr.rotation.y=Math.atan2(camera.position.x-tr.position.x,camera.position.z-tr.position.z);
 dust.rotation.y=t*.007;cabin.l.intensity=3*(.4+.6*open);cabin.g.material.opacity=.08+.12*open;
 const gl=world.render(t,{at,look,focus,disable:disabled});ctx.clearRect(0,0,W,H);ctx.drawImage(gl,0,0,W,H);
 // Restrained in-frame title, no narration or explanatory subtitles.
 if(!new URLSearchParams(location.search).has('notitles')){const a=(1-smooth(t,3.5,5.2));if(a>0){ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#f4e9cd';ctx.font='italic 25px Georgia';ctx.fillText('The last tram',70,72);ctx.fillStyle='#bbc8c7';ctx.font='11px system-ui';ctx.letterSpacing='3px';ctx.fillText('M O S S W I C K   /   2 3 : 4 8',72,98);ctx.restore();}if(t>22){ctx.save();ctx.globalAlpha=smooth(t,22,23);ctx.fillStyle='#f4e9cd';ctx.textAlign='center';ctx.font='italic 23px Georgia';ctx.fillText('Someone always waits.',W/2,650);ctx.restore();}}
 document.querySelector('#seek').value=t;document.querySelector('#time').value=t.toFixed(1)+'s';
}
window.DUR=DUR;window.CAPTURE=canvas;window.render=frame;window.audioWav=audioWav;
window.engineEvidence=()=>({renderer:world.renderer.getContext().getParameter(world.renderer.getContext().RENDERER),topLevelSceneObjects:scene.children.length,shadowMap:world.renderer.shadowMap.enabled,practicals:world.practicals.length,shadowLights:world.practicals.filter(p=>p.l.castShadow).length,post:['upstream signed-depth DOF','upstream tilt-shift','UnrealBloom','upstream grade'],passenger:'new drawing via upstream atlas and lit billboard',camera:camera.position.toArray(),disabled:{...disabled}});
let playing=false,start=0,offset=0,raf=0;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Pause':'Play preview';if(playing){start=performance.now();offset=Number(document.querySelector('#seek').value);if(offset>=DUR)offset=0;tick()}else cancelAnimationFrame(raf)};
function tick(){if(!playing)return;const t=offset+(performance.now()-start)/1000;frame(Math.min(t,DUR));if(t<DUR)raf=requestAnimationFrame(tick);else{playing=false;document.querySelector('#play').textContent='Replay'}}
document.querySelector('#seek').oninput=e=>{playing=false;cancelAnimationFrame(raf);frame(Number(e.target.value));};
frame(0);window.READY=true;
