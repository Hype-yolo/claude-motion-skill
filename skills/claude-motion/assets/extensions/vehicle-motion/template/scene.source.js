import {T,setup,box,cyl,link,ease,clamp} from './common.js';
import {Vehicle} from './upstream/car/vehicle.ts';
import {RAPIER,initPhysics,createWorld,GROUPS_ARENA,GROUPS_CAR} from './upstream/physics/world.ts';
await initPhysics();
const {scene,renderer,cam,sun}=setup({background:'#d4ddd9',camera:[18,13,16],look:[0,0,0]});
scene.fog=new T.Fog('#d4ddd9',45,120);
const water=box(scene,[40,.15,38],[0,-1.1,0],'#6d9eab',.2);box(scene,[22,.6,12],[0,-.2,-14],'#779367');box(scene,[22,.6,15],[0,-.2,16],'#779367');
for(const z of [-15,15]){box(scene,[3.4,.12,19],[0,.14,z],'#81847e');for(let j=-4;j<5;j++)box(scene,[.07,.015,.9],[0,.208,z+j*2],'#e7e1c8');}
box(scene,[2.9,.28,12],[0,.03,0],'#8e9690');for(let i=-5;i<=5;i++){box(scene,[2.84,.04,.035],[0,.19,i],'#4e5654');for(const side of [-1,1]){box(scene,[.085,1.1,.085],[side*1.38,.7,i],'#6d7f76');}}
for(const side of [-1,1]){box(scene,[.065,.065,12],[side*1.38,1.24,0],'#dae0d4');box(scene,[.065,.055,12],[side*1.38,.75,0],'#8b9c8e');}
for(const z of [-4,4])box(scene,[2.3,2.2,.8],[0,-1.2,z],'#828d83');
for(const side of [-1,1])for(let j=0;j<6;j++){let x=side*(5+j%2*3),z=-17+j*6;let trunk=cyl(scene,.15,.22,2,[x,1,z],'#685f4b');let tree=new T.Mesh(new T.IcosahedronGeometry(1.5,1),new T.MeshStandardMaterial({color:j%2?'#6e8d5e':'#92a278',roughness:1}));tree.position.set(x,2.5,z);tree.castShadow=true;scene.add(tree);}
const world=createWorld();world.createCollider(RAPIER.ColliderDesc.cuboid(40,.15,70).setTranslation(0,-.1,15).setCollisionGroups(GROUPS_ARENA));
const spec={mass:300,power:10500,maxDriveForce:1700,topSpeed:4.8,reverseSpeed:2,brakeForce:4500,grip:1.1,longGrip:1.1,steerMax:.45,steerFade:15,drive:'AWD',comForward:0,comHeight:.4,suspFreq:2.4,suspDamping:.6,gears:[2.4,1.5,1],finalDrive:3.5,redline:6000};
const vehicles=[],models=[],wheels=[],lights=[];
for(let i=0;i<3;i++){
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.58,-13-i*4.4).setLinearDamping(.07).setAngularDamping(2.0));world.createCollider(RAPIER.ColliderDesc.cuboid(.56,.27,1.05).setMass(300).setCollisionGroups(GROUPS_CAR),body);
 const defs=[];for(const front of [true,false])for(const left of [true,false])defs.push({name:(front?'F':'R')+(left?'L':'R'),mount:new T.Vector3(left?.63:-.63,-.24,front?.72:-.72),radius:.3,width:.18,front,left});
 const vehicle=new Vehicle(world,body,{...spec},defs);vehicles.push(vehicle);
 const g=new T.Group();scene.add(g);models.push(g);let color=['#eec154','#8abfc0','#d48966'][i];box(g,[1.15,.52,2.1],[0,0,0],color);box(g,[1.06,.7,1.12],[0,.58,-.36],'#dfddcb');box(g,[1.04,.6,.68],[0,.53,.57],color);box(g,[.86,.34,.035],[0,.57,.93],'#3c6875',.2);box(g,[1.02,.08,.06],[0,-.15,1.09],'#63716c');for(const x of [-.39,.39]){box(g,[.15,.12,.055],[x,.05,1.075],'#fff8db');const brake=box(g,[.14,.1,.06],[x,.07,-1.075],'#7e3b30');lights.push(brake);}
 box(g,[.58,.012,.42],[0,.94,-.4],color);for(const x of [-.35,.35])box(g,[.025,.63,.05],[x,.57,-.935],'#748176');
 const ws=[];for(const d of defs){const wheel=cyl(g,.3,.3,.18,[d.mount.x,-.24,d.mount.z],'#323d3e');wheel.rotation.z=Math.PI/2;ws.push(wheel);let hub=cyl(wheel,.13,.13,.185,[0,0,0],'#adb5ac');}wheels.push(ws);
}
const tracks=[[],[],[]],dt=1/120;let minGap=Infinity,minGround=4,collisionCount=0;
for(let k=0;k<=2160;k++){
 let t=k*dt;
 for(let i=0;i<3;i++){
  let v=vehicles[i],z=v.body.translation().z,release=4+i*3.8,stop=-7-i*4.4,target=t<release?Math.min(3.9,Math.sqrt(Math.max(0,2*2.5*(stop-z)))):4.7;
  if(i>0){let gap=vehicles[i-1].body.translation().z-z;minGap=Math.min(minGap,gap);if(gap<4.0)target=Math.min(target,Math.max(0,(gap-3.2)*1.4));}
  let throttle=clamp((target-v.speed)*.9),brake=clamp((v.speed-target)*.8);if(target<.08 && v.speed<.1){throttle=0;brake=0;v.body.setLinvel({x:0,y:v.body.linvel().y,z:0},true);}
  v.step(dt,{throttle,brake,steer:clamp(-v.body.translation().x*.2)});
 }
 world.step();
 if(k%5===0)for(let i=0;i<3;i++){const v=vehicles[i],p=v.body.translation(),q=v.body.rotation();tracks[i].push({p:[p.x,p.y,p.z],q:[q.x,q.y,q.z,q.w],s:v.speed,brake:v.brakeOut,w:v.wheels.map(w=>[w.length,w.spin,w.steer])});minGround=Math.min(minGround,v.groundedCount);}
}
window.PHYSICS_REPORT={steps:2161,hz:120,minLongitudinalGap:minGap,samples:tracks.map(tr=>[0,72,144,216,288,360,432].map(k=>({z:tr[Math.min(k,tr.length-1)].p[2],speed:tr[Math.min(k,tr.length-1)].s}))),retained:'Vehicle.step ray springs, friction ellipse, braking, steering, engine, wheel spin',endZ:tracks.map(tr=>tr.at(-1).p[2])};
window.render=t=>{let f=clamp(t/18)*(tracks[0].length-1),k=Math.min(tracks[0].length-2,Math.floor(f)),u=f-k;for(let i=0;i<3;i++){let a=tracks[i][k],b=tracks[i][k+1];models[i].position.fromArray(a.p).lerp(new T.Vector3(...b.p),u);models[i].quaternion.fromArray(a.q).slerp(new T.Quaternion(...b.q),u);for(let w=0;w<4;w++){wheels[i][w].position.y=-.24+(.2-a.w[w][0]);wheels[i][w].rotation.set(a.w[w][1],a.w[w][2],Math.PI/2);}for(let l=0;l<2;l++){lights[i*2+l].material.emissive.set(a.brake>.1?'#ff3522':'#000000');lights[i*2+l].material.emissiveIntensity=.9;}}
 cam.position.set(17-3*ease(t/18),12,15-6*ease(t/18));cam.lookAt(0,.5,-1+3*ease(t/18));renderer.render(scene,cam);};window.READY=true;window.render(0);
