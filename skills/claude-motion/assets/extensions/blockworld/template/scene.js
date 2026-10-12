// Host adaptation drives the original seeded world, atlas, AO chunk meshes and daylight deterministically.
const T=window.THREE,canvas=document.getElementById('c'),g=Blockworld.create(canvas,{w:1280,h:720,dpr:1,seed:94721,chunks:4});
g.showHeld=false;g.hideSel=true;g.setTime(.37);const B=Blockworld.BLOCK,x0=32,z0=32,y0=30;
// Sculpt a new small hillside using the original voxel mesher. The wider seeded world remains untouched.
for(let z=20;z<=44;z++)for(let x=19;x<=45;x++){
 let h=y0+Math.max(0,Math.floor((x-27)*.17+(z-31)*.09));if(x>=23&&x<=35&&z>=30&&z<=35)h=y0;
 for(let y=24;y<72;y++)g.rawSet(x,y,z,y<=h?(y===h?B.GRASS:y<h-2?B.STONE:B.DIRT):B.AIR);
}
for(let z=30;z<=34;z++)for(let x=31;x<=35;x++)g.rawSet(x,y0,z,B.DIRT);
g.makeOak(33,y0+1,32,.32);
const tree=new T.Group();g.scene.add(tree);
for(let y=y0+1;y<y0+11;y++)for(let z=29;z<36;z++)for(let x=30;x<37;x++){let b=g.get(x,y,z);if(b===B.LOG||b===B.LEAVES){let m=g.blockMesh(b);m.position.set(x-33,y-y0-.5,z-32);tree.add(m);g.rawSet(x,y,z,B.AIR);}}
tree.position.set(33.5,y0+.5,32.5);g.rebuildAll();
const robot=new T.Group();g.scene.add(robot);
function box(size,p,color){const m=new T.Mesh(new T.BoxGeometry(...size),new T.MeshLambertMaterial({color}));m.position.set(...p);m.castShadow=m.receiveShadow=true;robot.add(m);return m;}
box([1.1,.85,.9],[0,.9,0],'#d9d6ab');box([.86,.47,.72],[0,1.54,0],'#719079');box([.64,.23,.025],[0,1.53,.38],'#233a43');for(let x of [-.21,.21])box([.13,.08,.03],[x,1.55,.402],'#9be2c7');const wheels=[];for(let x of [-.57,.57])for(let z of [-.32,.32]){let m=new T.Mesh(new T.CylinderGeometry(.28,.28,.15,12),new T.MeshLambertMaterial({color:'#3c4c43'}));m.rotation.z=Math.PI/2;m.position.set(x,.33,z);robot.add(m);wheels.push(m);}const arm=box([.13,.55,.13],[.66,.83,.23],'#889f86'),grip=box([.28,.12,.28],[.68,.55,.3],'#547561');let seed=g.blockMesh(B.LOG);seed.scale.setScalar(.13);robot.add(seed);const eye=box([.08,.28,.08],[0,1.94,0],'#a2b393');
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
window.CAPTURE=canvas;window.DUR=18;
window.render=t=>{const walk=ease(t/6),plant=ease((t-6)/2),grow=ease((t-9)/5);robot.position.set(24+8.1*walk,y0+1.05,32.5);robot.rotation.y=Math.PI/2;for(let i=0;i<4;i++)wheels[i].rotation.x=t<6?-t*5:0;robot.position.y+=t<6?.06*Math.sin(t*8):0;arm.rotation.x=plant*1.05*(1-ease((t-8)/1));grip.position.y=.55-.48*plant*(1-ease((t-8)/1));seed.visible=t<8;seed.position.set(.7,.6-.5*plant,.33);tree.visible=t>=9;tree.scale.set(.05+.95*grow,.02+.98*grow,.05+.95*grow);const c=ease(t/18);g.time=t;g.cam(37.5-.6*c,y0+7.8,37-.6*c,.62,-.36);g.update(0);g.camera.lookAt(31.8,y0+2.2,32);g.renderer.render(g.scene,g.camera);};window.READY=true;window.render(0);
