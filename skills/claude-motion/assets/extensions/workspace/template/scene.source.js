import {T,setup,box,cyl,link,ease,clamp} from './common.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {woodTexture,carpetTexture} from './upstream/textures.ts';
import {withLampLight,setLampPools,lampUniforms} from './upstream/lampLight.ts';
const {scene,renderer,cam,sun}=setup({background:'#202d38',camera:[5.3,4.2,5.6],look:[0,.8,0]});
sun.intensity=.5;scene.children.find(x=>x.isHemisphereLight).intensity=.75;
const library=await new GLTFLoader().loadAsync('./props.glb');
library.scene.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of [].concat(o.material)){m.vertexColors=true;if(m.name==='class_emissive'){m.emissive=new T.Color('#fff1d6');m.emissiveIntensity=1.6;}if(m.name==='class_glass'){m.transparent=true;m.opacity=.35;m.depthWrite=false;}}}});
function prop(name,x,y,z,rot=0,scale=1){const original=library.scene.getObjectByName(name);if(!original)throw Error('Missing upstream prop '+name);const g=new T.Group();const model=original.clone(true);g.add(model);g.position.set(x,y,z);g.rotation.y=rot;g.scale.setScalar(scale);scene.add(g);return g;}
const floor=box(scene,[9,.12,7],[0,-.08,0],'#8d6954');floor.material=new T.MeshStandardMaterial({map:woodTexture('#a17b5f'),roughness:.78});
const wall=box(scene,[9,3.3,.16],[0,1.57,-3.45],'#c2c0b4');box(scene,[.16,3.3,7],[-4.45,1.57,0],'#ceccb9');
for(let i=0;i<3;i++){box(scene,[1.6,1.5,.06],[-2.8+i*2.2,2.05,-3.32],'#172d3b');for(const p of [[-2.8+i*2.2,2.05,-3.28]]){box(scene,[.04,1.5,.03],p,'#c2c8bb');box(scene,[1.6,.04,.03],p,'#c2c8bb');}}
prop('desk',0,0,0);prop('office_chair',0,0,1.1,Math.PI);prop('desk_lamp',-.58,.74,-.25);prop('mug',.6,.74,-.18);prop('pen_holder',.55,.74,.2);prop('notebook',-.5,.74,.18);
prop('desk',-2.5,0,-1.5);prop('office_chair',-2.5,0,-.4,Math.PI);prop('laptop',-2.5,.74,-1.7);prop('bookshelf',3,0,-2.9,Math.PI/2);prop('plant_tall',-3.8,0,-2.4);prop('wall_clock',2.8,2.5,-3.25);
const paper=box(scene,[.78,.006,.56],[.05,.751,.02],'#f4eee1');paper.material=withLampLight(paper.material);setLampPools([{x:-.35,z:-.15,radius:1.3}]);
const lamp=new T.PointLight('#ffc676',0,4,2);lamp.position.set(-.5,1.21,-.16);scene.add(lamp);
const armRoot=new T.Group();scene.add(armRoot);const base=cyl(armRoot,.115,.13,.08,[-.48,.8,-.14],'#244b54');
const arm1=link(armRoot,[-.48,.89,-.14],[-.1,.9,0],.035,'#326772'),arm2=link(armRoot,[-.1,.9,0],[.22,.78,.12],.026,'#a8b9b7');const joint=cyl(armRoot,.068,.068,.065,[-.1,.9,0],'#d0a457');const nib=cyl(armRoot,.013,.022,.14,[.22,.82,.12],'#323537');
const lineMaterial=new T.LineBasicMaterial({color:'#245768'});const geo=new T.BufferGeometry();const pts=[];for(let i=0;i<=700;i++){let u=i/700,a=u*Math.PI*8,r=.018+u*.235;pts.push(new T.Vector3(.05+Math.cos(a)*r,.757,.02+Math.sin(a)*r*.8));}geo.setFromPoints(pts);const drawing=new T.Line(geo,lineMaterial);scene.add(drawing);
function setLink(m,a,b){const p=new T.Vector3(...a),q=new T.Vector3(...b);m.position.copy(p).add(q).multiplyScalar(.5);m.scale.y=p.distanceTo(q)/m.geometry.parameters.height;m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());}
window.render=t=>{const light=ease((t-1.5)/.7);lamp.intensity=5*light;lampUniforms.lampStrength.value=light*.4;const u=ease((t-4)/9),idx=Math.floor(u*700),p=pts[idx];geo.setDrawRange(0,idx+1);let end=[p.x,.86+(t>13?.2*ease((t-13)/2):0),p.z];const start=[-.48,.89,-.14],delta=new T.Vector2(end[0]-start[0],end[2]-start[2]),d=delta.length(),L=.43,l=.38;const a=Math.atan2(delta.y,delta.x)+Math.acos(clamp((d*d+L*L-l*l)/(2*d*L),-1,1));let elbow=[start[0]+Math.cos(a)*L,1.05,start[2]+Math.sin(a)*L];setLink(arm1,start,elbow);setLink(arm2,elbow,end);joint.position.set(...elbow);nib.position.set(end[0],end[1]-.045,end[2]);let close=ease((t-2)/3);cam.position.set(4.7-3.1*close,3.6-1.65*close,4.8-2.5*close);cam.lookAt(0,.85,-.1);renderer.render(scene,cam);};window.READY=true;window.render(0);
