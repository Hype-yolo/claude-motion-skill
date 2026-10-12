import {world,THREE,smooth,mix} from './room-kit.js';
import {makeScore} from './score.js';
const audioWav=makeScore({duration:18});
const w=world(),{scene,mats,box,cyl,rod,asset,mesh}=w;
scene.background=new THREE.Color('#d9d5cb');
// All window parts share one aperture. Rails terminate inside the posts.
box(10,.22,7,0,-.14,0,mats.oak);box(.18,4.7,7,-5,2.32,0,mats.plaster);
const wallShape=new THREE.Shape();wallShape.moveTo(-5,-.03);wallShape.lineTo(5,-.03);wallShape.lineTo(5,4.72);wallShape.lineTo(-5,4.72);wallShape.closePath();const aperture=new THREE.Path();aperture.moveTo(-3.4,1.18);aperture.lineTo(-3.4,4.01);aperture.lineTo(.1,4.01);aperture.lineTo(.1,1.18);aperture.closePath();wallShape.holes.push(aperture);const backWall=mesh(new THREE.ExtrudeGeometry(wallShape,{depth:.18,bevelEnabled:false}),mats.plaster);backWall.position.z=-3.62;
box(10,1.18,.18,0,.55,-3.5,mats.teal);
box(10,.065,.12,0,1.15,-3.365,mats.teal);
for(let x=-4.85;x<5;x+=.62)box(.045,1.02,.055,x,.55,-3.385,mats.teal);
box(9.98,.15,.1,0,.06,-3.36,mats.ivory);box(.1,.15,6.95,-4.85,.06,0,mats.ivory);
// Rebated outer frame and a sill with rounded nosing; no decorative rods float in front.
for(const x of[-3.47,.17])box(.14,2.87,.24,x,2.59,-3.40,mats.ivory);
box(3.78,.11,.24,-1.65,4.05,-3.40,mats.ivory);
box(3.96,.12,.57,-1.65,1.115,-3.26,mats.oak);
box(3.65,.09,.20,-1.65,1.235,-3.40,mats.ivory);
for(const x of[-2.26,-1.04])box(.057,2.73,.13,x,2.63,-3.33,mats.ivory);
box(3.51,.055,.13,-1.65,2.78,-3.33,mats.ivory);
const outdoor=document.createElement('canvas');outdoor.width=512;outdoor.height=512;const og=outdoor.getContext('2d'),grad=og.createLinearGradient(0,0,0,512);grad.addColorStop(0,'#bacbd0');grad.addColorStop(.62,'#e2e4d7');grad.addColorStop(1,'#9da990');og.fillStyle=grad;og.fillRect(0,0,512,512);og.filter='blur(14px)';for(let i=0;i<14;i++){og.fillStyle=i%2?'#9aa991':'#b4bd9d';og.beginPath();og.ellipse(i*49-55,482+(i%4)*19,79,112,0,0,7);og.fill()}const ot=new THREE.CanvasTexture(outdoor);ot.colorSpace=THREE.SRGBColorSpace;
const outside=mesh(new THREE.PlaneGeometry(3.53,2.76),new THREE.MeshBasicMaterial({map:ot}));outside.position.set(-1.65,2.64,-3.49);outside.castShadow=false;
const rug=await asset('rugRectangle',.04,[.05,-.001,.95]);rug.scale.multiplyScalar(5.75/new THREE.Box3().setFromObject(rug).getSize(new THREE.Vector3()).x);
// Furniture remains Kenney CC0. Props are grounded by explicit support heights.
await asset('chairCushion',1.6,[-1.85,0,1.05],Math.PI*.22);
await asset('sideTable',.84,[-3.48,0,-.62]);await asset('lampRoundTable',.64,[-3.48,.841,-.62]);
await asset('pottedPlant',1.54,[-4.08,0,-2.60]);
await asset('benchCushion',1.12,[-4.1,0,2.02],Math.PI/2);
// A cabinet with explicit shelf surfaces, so every book sits on an actual shelf.
const shelf=new THREE.Group();shelf.position.set(2.75,0,-2.98);scene.add(shelf);
box(2.90,3.70,.10,0,1.90,-.32,mats.oak,shelf);
for(const x of[-1.40,1.40])box(.12,3.72,.70,x,1.9,0,mats.oak,shelf);
for(const y of[.08,.70,1.48,2.26,3.04,3.77])box(2.94,.10,.74,0,y,0,mats.oak,shelf);
box(3.07,.12,.85,0,3.83,0,mats.oak,shelf);
const covers=['#465955','#9c7051','#c1ad80','#647779','#aa8c76'];
for(let row=0;row<4;row++)for(let j=0;j<11;j++){
 const h=.44+((j*7+row*3)%6)*.035,bw=.14+((j+row)%3)*.021,x=-1.22+j*.23;
 const bm=mats.teal.clone();bm.color.set(covers[(j+row*2)%covers.length]);const b=new THREE.Group();b.position.set(x,[.75,1.53,2.31,3.09][row],-.02);shelf.add(b);
 box(bw,h,.41,0,h/2,0,bm,b);box(bw*.68,h-.028,.39,0,h/2,-.018,mats.paper,b);
 box(bw,.016,.425,0,.013,0,bm,b);box(bw,.016,.425,0,h-.013,0,bm,b);box(bw,.025,.012,0,h*.75,.212,mats.brass,b);
}
// The central table is round in silhouette with a turned pedestal and shaped edge.
cyl(1.45,1.45,.095,.12,1.40,.53,mats.oak,scene,96);cyl(1.40,1.45,.035,.12,1.463,.53,mats.oak,scene,96);
const profile=[[.38,0],[.42,.06],[.33,.12],[.18,.18],[.13,.32],[.15,.80],[.23,.95],[.31,1.03],[.30,1.16],[.52,1.23]].map(([x,y])=>new THREE.Vector2(x,y));const pedestal=mesh(new THREE.LatheGeometry(profile,64),mats.oak);pedestal.position.set(.12,.12,.53);
for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){const foot=box(.72,.1,.20,.12+Math.cos(a)*.33,.08,.53+Math.sin(a)*.33,mats.oak);foot.rotation.y=-a}
// Open book: two page blocks, bound spine, a curved turning leaf, woven ribbon.
const book=new THREE.Group();book.position.set(.10,1.51,.67);book.rotation.y=-.2;scene.add(book);
const burgundy=new THREE.MeshStandardMaterial({color:'#874337',roughness:.95,side:THREE.DoubleSide});
box(1.78,.040,1.22,0,0,0,mats.teal,book);box(.052,.043,1.22,0,.011,0,mats.oak,book);
for(const side of[-1,1]){
 box(.815,.073,1.13,side*.434,.058,0,mats.paper,book);
 for(let i=0;i<11;i++)box(.814,.0014,1.134,side*.434,.026+i*.0063,0,mats.ivory,book);
}
const texCanvas=document.createElement('canvas');texCanvas.width=512;texCanvas.height=768;const ink=texCanvas.getContext('2d');ink.fillStyle='#f6eedb';ink.fillRect(0,0,512,768);ink.strokeStyle='#aaa18b';ink.lineWidth=1.25;for(let j=0;j<29;j++){const y=116+j*18;ink.beginPath();ink.moveTo(62,y);ink.lineTo(450-(j%6===5?90:0),y);ink.stroke()}ink.fillStyle='#64715c';ink.font='italic 23px Georgia';ink.fillText('The quiet hours',62,77);ink.font='16px Georgia';ink.fillText('24',245,718);const printed=new THREE.CanvasTexture(texCanvas);printed.colorSpace=THREE.SRGBColorSpace;
const paperMat=new THREE.MeshStandardMaterial({map:printed,roughness:.96,side:THREE.DoubleSide,color:'#ffffff'});
for(const s of[-1,1]){const top=mesh(new THREE.PlaneGeometry(.814,1.126),paperMat,book);top.rotation.x=-Math.PI/2;top.position.set(s*.434,.096,0)}
const pageGeo=new THREE.PlaneGeometry(.815,1.126,48,20),page=mesh(pageGeo,paperMat,book),v=pageGeo.attributes.position,orig=Float32Array.from(v.array);
// Ribbon stays on the right leaf; only the free tail beyond the book edge can flex.
const ribbonGeo=new THREE.PlaneGeometry(.048,1.48,4,80),ribbon=mesh(ribbonGeo,burgundy,book),rv=ribbonGeo.attributes.position,ro=Float32Array.from(rv.array);
const curtainGeo=new THREE.PlaneGeometry(.57,2.63,24,40),curtainMat=new THREE.MeshStandardMaterial({color:'#f0e7d5',side:THREE.DoubleSide,transparent:true,opacity:.80,roughness:1});const curtain=mesh(curtainGeo,curtainMat);curtain.position.set(-3.04,2.66,-3.10);const cv=curtainGeo.attributes.position,co=Float32Array.from(cv.array);rod([-3.40,4.04,-3.08],[.06,4.04,-3.08],.022,mats.brass);
// Wall print gives the quiet wall a deliberate scale and focal hierarchy.
box(1.03,1.38,.065,-4.872,2.69,.13,mats.oak).rotation.y=Math.PI/2;
const print=mesh(new THREE.PlaneGeometry(.88,1.23),paperMat);print.position.set(-4.824,2.69,.13);print.rotation.y=Math.PI/2;
function render(t){
 const turn=smooth(t,5,10.6),ang=turn*Math.PI;
 for(let i=0;i<v.count;i++){const u=orig[i*3]+.4075,frac=u/.815;v.setXYZ(i,.018+Math.cos(ang)*u,mix(.108,.099,turn)+Math.sin(ang)*u+.11*Math.sin(Math.PI*frac)*Math.sin(ang),orig[i*3+1])}v.needsUpdate=true;pageGeo.computeVertexNormals();
 let ribbonMin=Infinity,tableClearance=Infinity;
 for(let i=0;i<rv.count;i++){const s=(ro[i*3+1]+.74)/1.48,z=-.51+s*1.48,tail=Math.max(0,(z-.592)/.378),fall=.129*smooth(tail,0,1);const y=.104-fall+.003*Math.sin(t*1.35)**2*tail*tail;const dz=.006*Math.sin(t*1.35+s*2)*tail*tail;rv.setXYZ(i,.46+ro[i*3]+.012*Math.sin(t*1.5)*tail*tail,y,z+dz);tableClearance=Math.min(tableClearance,y+1.51-1.4805);if(z<.565)ribbonMin=Math.min(ribbonMin,y-.096)}rv.needsUpdate=true;ribbonGeo.computeVertexNormals();
 const gust=smooth(t,2.3,4.5)*(1-smooth(t,10.5,13));
 for(let i=0;i<cv.count;i++){const y=co[i*3+1],q=(1.315-y)/2.63;cv.setXYZ(i,co[i*3]+.014*q*Math.sin(t*.95+y)*gust,y,.033*Math.sin(co[i*3]*48)+.065*q*q*Math.sin(t*1.15-y)*gust)}cv.needsUpdate=true;curtainGeo.computeVertexNormals();
 const close=smooth(t,1.3,4.5)*(1-smooth(t,12,17));w.draw([mix(8.6,2.75,close),mix(6.8,3.6,close),mix(11.6,4.35,close)],[mix(-.15,.1,close),mix(1.7,1.54,close),mix(-.45,.67,close)]);
 window.LIBRARY_AUDIT={revision:2,assets:w.loaded,pageTurn:turn,pageVertexCount:v.count,ribbonStaticClearance:ribbonMin,ribbonTableClearance:tableClearance,pageRestGap:mix(.108,.099,turn)-.096,windowJoin:'single aperture; rails end at posts',ribbon:'fixed on right page, free tail outside cover',newTopic:'A breeze turns a page in an empty reading room.'};
}
Object.assign(window,{READY:true,DUR:18,CAPTURE:w.canvas,render,audioWav});render(0);
