import {k,materials,solid,gear,boltPlate,screw,path} from './mechanisms.js';
export const width=1280,height=720,duration=18;
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function wind(t){return .09+.30*ease((t-1.3)/2.8)+.58*ease((t-5.2)/2.7)-.70*ease((t-10.8)/4.0)+.035*Math.sin(t*3.1)*ease((t-2)/3)*(1-ease((t-13)/3))}
const phase=[];let acc=0;for(let i=0;i<=18*240;i++){phase[i]=acc;acc+=wind(i/240)*3.9/240;}
function spin(t){const x=Math.max(0,Math.min(4319,t*240)),i=Math.floor(x);return phase[i]+(phase[i+1]-phase[i])*(x-i)}
function poly(g,pts,fill,stroke,width=1){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
let background;
function makeBackground(){const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');
 let b=g.createLinearGradient(0,0,1100,720);b.addColorStop(0,'#c4ccc5');b.addColorStop(.6,'#d6d4c6');b.addColorStop(1,'#acb2a3');g.fillStyle=b;g.fillRect(0,0,1280,720);
 // The sea is behind a real window reveal, the instrument is inside on the bench.
 g.fillStyle='#5c716d';g.fillRect(50,44,466,353);g.fillStyle='#d1d9cb';g.fillRect(61,54,442,323);
 let sky=g.createLinearGradient(0,55,0,375);sky.addColorStop(0,'#b5c7c6');sky.addColorStop(.60,'#d9decf');sky.addColorStop(.61,'#728e89');sky.addColorStop(1,'#9bafa0');g.fillStyle=sky;g.fillRect(76,66,410,294);
 g.fillStyle='#627d75';poly(g,[[76,284],[150,276],[185,263],[228,271],[270,266],[295,283],[355,286],[430,294],[486,286],[486,360],[76,360]],'#90a495');
 for(let i=0;i<27;i++){g.strokeStyle=i%3?'#c1cdc088':'#597e7855';g.lineWidth=.8;g.beginPath();let y=282+i*2.8;g.moveTo(80+(i*23)%90,y);g.lineTo(280+(i*37)%190,y-1);g.stroke()}
 g.fillStyle='#47665e';poly(g,[[76,337],[147,327],[187,337],[214,351],[250,360],[76,360]],'#55766a');
 g.fillStyle='#c5cab9';g.fillRect(274,54,11,317);g.fillRect(62,217,440,10);g.fillStyle='#edf0dc';g.fillRect(275,55,2,306);g.fillRect(62,218,440,2);
 g.fillStyle='#716a56';g.fillRect(48,369,469,17);g.fillStyle='#c5b998';g.fillRect(43,365,481,10);
 // restrained station fixtures
 g.strokeStyle='#98a699';g.lineWidth=2;g.strokeRect(1100,70,82,123);g.fillStyle='#e8e3ce';g.fillRect(1103,73,76,117);g.strokeStyle='#aaa990';for(let y=89;y<181;y+=13){g.beginPath();g.moveTo(1114,y);g.lineTo(1167,y);g.stroke()}
 g.fillStyle='#bcbfa9';g.fillRect(1212,0,11,389);g.strokeStyle='#8a9686';g.beginPath();g.moveTo(0,387);g.lineTo(1280,387);g.stroke();
 let desk=g.createLinearGradient(0,399,0,720);desk.addColorStop(0,'#8b775c');desk.addColorStop(.3,'#ab9370');desk.addColorStop(1,'#76644e');g.fillStyle=desk;g.fillRect(0,398,1280,322);
 for(let i=0;i<126;i++){g.strokeStyle=i%3?'#3f463210':'#e7cb9830';g.lineWidth=.5+((i*7)%4)*.3;g.beginPath();let y=406+i*2.5;g.moveTo(0,y);g.bezierCurveTo(400,y-5,700,y+6,1280,y+2);g.stroke()}
 // near edge trim
 g.fillStyle='#6c5b43';g.fillRect(0,693,1280,27);g.fillStyle='#c0a77b';g.fillRect(0,693,1280,2);
 let seed=447;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};
 for(let i=0;i<56000;i++){const x=rand()*1280,y=rand()*720;g.fillStyle=rand()>.5?'#fff8dd08':'#162f2908';g.fillRect(x,y,1,1)}
 return c;
}
function rod(g,a,b,P,width=3,color='#acb9ad'){path(g,k.segment(a,b,P),{stroke:'#263f3f',width:width+1.6});path(g,k.segment(a,b,P),{stroke:color,width});}
function sphere(g,p,P,r,color='#d2b367'){const q=k.iso(p,P),rr=r*k.cameraOf(P).k;let grd=g.createRadialGradient(q[0]-rr*.3,q[1]-rr*.4,rr*.05,q[0],q[1],rr);grd.addColorStop(0,'#f3e4b0');grd.addColorStop(.45,color);grd.addColorStop(1,'#605b41');g.fillStyle=grd;g.beginPath();g.arc(...q,rr,0,TAU);g.fill();g.strokeStyle='#575a44';g.lineWidth=.6;g.stroke()}
function cup(g,a,P){const center=[-63+31*Math.cos(a),8+31*Math.sin(a),151],normal=[-Math.sin(a),Math.cos(a),0],across=[Math.cos(a),Math.sin(a),0],rad=9;
 const rim=Array.from({length:40},(_,i)=>{const b=i/40*TAU;return[center[0]+across[0]*rad*Math.cos(b),center[1]+across[1]*rad*Math.cos(b),center[2]+rad*Math.sin(b)]});
 const facing=k.towardViewer(P);const front=normal[0]*facing[0]+normal[1]*facing[1]>.05;
 const point=(phi,b)=>[center[0]+across[0]*rad*Math.sin(phi)*Math.cos(b)-normal[0]*6*Math.cos(phi),center[1]+across[1]*rad*Math.sin(phi)*Math.cos(b)-normal[1]*6*Math.cos(phi),center[2]+rad*Math.sin(phi)*Math.sin(b)];
 const pieces=[];for(let j=0;j<9;j++)for(let i=0;i<48;i++){
  const ph0=j/9*Math.PI/2,ph1=(j+1)/9*Math.PI/2,b0=i/48*TAU,b1=(i+1)/48*TAU;
  const pts=[point(ph0,b0),point(ph0,b1),point(ph1,b1),point(ph1,b0)];
  const mid=(b0+b1)/2,ph=(ph0+ph1)/2;const n=[across[0]*Math.sin(ph)*Math.cos(mid)-normal[0]*Math.cos(ph),across[1]*Math.sin(ph)*Math.cos(mid)-normal[1]*Math.cos(ph),Math.sin(ph)*Math.sin(mid)];
  const light=.38+.47*Math.max(0,-n[0]*.45-n[1]*.2+n[2]*.87),c=Math.round(86+light*135);
  pieces.push({pts,depth:pts.reduce((v,p)=>v+k.depthOf(p,P),0)/4,col:`rgb(${c-10} ${c} ${c-9})`});
 }
 pieces.sort((a,b)=>a.depth-b.depth);for(const p of pieces)poly(g,p.pts.map(q=>k.iso(q,P)),p.col);
 if(front){const q=k.iso(center,P),rr=rad*k.cameraOf(P).k;const inner=g.createRadialGradient(q[0]+rr*.3,q[1]+rr*.4,rr*.12,q[0],q[1],rr);inner.addColorStop(0,'#183b3d');inner.addColorStop(.75,'#4a6761');inner.addColorStop(1,'#9daea0');poly(g,rim.map(q=>k.iso(q,P)),inner,'#d0d4bd',1.6)}
 else path(g,k.pathOf(rim.map(q=>k.iso(q,P)),true),{stroke:'#80968b',width:.75});
}
function chart(g,t,P){const x=62,y=4,r=30,z0=15,h=57;
 solid(g,k.cylinder(x,y,34,7,6,P,64,1),materials.enamel);
 solid(g,k.cylinder(x,y,r,z0,h,P,96,.5),materials.paper,{width:.8});
 // Chart grid conforms to the actual cylinder. Only visible half is drawn.
 const view=Math.atan2(k.towardViewer(P)[1],k.towardViewer(P)[0]);
 for(let z=z0+5;z<z0+h-3;z+=6){let pts=[];for(let j=0;j<=70;j++){let a=view-Math.PI/2+j*Math.PI/70;pts.push(k.iso([x+(r+.15)*Math.cos(a),y+(r+.15)*Math.sin(a),z],P))}path(g,k.pathOf(pts),{stroke:'#aaa58b',width:.52,alpha:.7})}
 const rotation=t*.085;
 for(let j=-15;j<16;j++){let a=j*.20+rotation;while(a-view>Math.PI)a-=TAU;while(a-view<-Math.PI)a+=TAU;if(Math.abs(a-view)<Math.PI/2)path(g,k.segment([x+(r+.18)*Math.cos(a),y+(r+.18)*Math.sin(a),z0+2],[x+(r+.18)*Math.cos(a),y+(r+.18)*Math.sin(a),z0+h-2],P),{stroke:'#a7a58d',width:.6,alpha:.65})}
 solid(g,k.cylinder(x,y,32.5,z0+h,3,P,64,.7),materials.enamel);solid(g,k.cylinder(x,y,5,z0+h+3,4,P,32,.6),materials.brass);
 // Stationary nib touches the rotating chart; past values move around its surface.
 const contact=view+.80;let segments=[],buf=[];
 for(let sample=-9;sample<=t;sample+=.06){let a=contact-(t-sample)*.085;let z=22+wind(Math.max(0,sample))*40;const visible=Math.abs(a-view)<Math.PI/2-.01;if(visible)buf.push(k.iso([x+(r+.4)*Math.cos(a),y+(r+.4)*Math.sin(a),z],P));else if(buf.length){segments.push(buf);buf=[]}}
 segments.push(buf);for(const pts of segments)path(g,k.pathOf(pts),{stroke:'#9c4638',width:1.7});
 return[x+(r+.55)*Math.cos(contact),y+(r+.55)*Math.sin(contact),22+wind(t)*40];
}
export function render(g,t){
 t=Math.max(0,Math.min(18,t));background??=makeBackground();g.drawImage(background,0,0);
 const w=wind(t),theta=spin(t),zoom=1+.035*ease((t-1)/6)-.012*ease((t-14)/3);
 // Outside tell-tale ribbon and small moving wave crests.
 g.save();g.beginPath();g.rect(76,66,410,294);g.clip();g.strokeStyle='#dce4d0';g.lineWidth=1;for(let i=0;i<10;i++){const y=290+i*6,xx=100+(i*44+t*(3+w*4))%300;g.beginPath();g.moveTo(xx,y);g.quadraticCurveTo(xx+17,y-2,xx+34,y);g.stroke()}
 g.strokeStyle='#677d70';g.lineWidth=2;g.beginPath();g.moveTo(424,352);g.lineTo(424,281);g.stroke();g.fillStyle='#b88862';g.beginPath();g.moveTo(424,282);g.bezierCurveTo(440,284,445+10*w,287+Math.sin(t*5)*w*3,466+5*w,292-9*w);g.lineTo(465+5*w,297-9*w);g.bezierCurveTo(443,291,436,291,424,286);g.closePath();g.fill();g.restore();
 g.save();g.translate(748,437);g.scale(zoom,zoom);g.translate(-748,-437);
 const P={origin:[735,491],scale:2.02,azimuth:40,elevation:29};
 // Contact shadow belongs beneath the whole instrument, never on its front faces.
 const sh=g.createRadialGradient(719,545,40,719,545,320);sh.addColorStop(0,'#17272558');sh.addColorStop(1,'#17272500');g.fillStyle=sh;g.save();g.translate(730,558);g.scale(1,.37);g.beginPath();g.ellipse(0,0,360,160,0,0,TAU);g.fillStyle='#24302a23';g.shadowColor='#22322b44';g.shadowBlur=25;g.fill();g.restore();
 const base={x:-108,y:-56,w:217,d:127,r:9};
 for(const [x,y]of k.corners(base,15))solid(g,k.cylinder(x,y,6,-11,8,P,32,.5),materials.enamel);
 boltPlate(g,base,-5,9,P,materials.walnut);
 path(g,k.planOutline(k.insetPlan(base,5),4.1,P),{stroke:'#c7a978',width:1});
 boltPlate(g,{x:-91,y:-18,w:113,d:63,r:6},5,5,P,materials.enamel);
 // Back mast with collars and vertical driving shaft.
 solid(g,k.cylinder(-63,8,9,10,9,P,40,1),materials.brass);
 solid(g,k.cylinder(-63,8,4.4,19,119,P,36,.6),materials.steel);
 for(const z of [49,106,136]){solid(g,k.cylinder(-63,8,6.6,z,4,P,32,.5),materials.brass);path(g,k.knurl(-63,8,6.6,z,z+4,22,P),{stroke:'#6e6646',width:.6,alpha:.6})}
 // Matching module: center distance 19+27 = 46, rotation ratio 19/27.
 gear(g,{x:-63,y:8,z:24,radius:19,teeth:19,angle:theta,projection:P});
 gear(g,{x:-17,y:8,z:24,radius:27,teeth:27,angle:-theta*19/27+Math.PI/27,projection:P});
 solid(g,k.cylinder(-17,8,3.8,10,63,P,32,.5),materials.steel);
 // Stylized centrifugal regulator links speed to pen height.
 const z=43+19*w,reach=9+13*w,gov=-theta*19/27;
 const points=[gov,gov+Math.PI].map(a=>[-17+reach*Math.cos(a),8+reach*Math.sin(a),z+5]);
 for(const pt of points.sort((a,b)=>k.depthOf(a,P)-k.depthOf(b,P))){rod(g,[-17,8,71],pt,P,2,'#c9b77f');rod(g,[-17,8,z-7],pt,P,2,'#c9b77f');sphere(g,pt,P,3.1)}
 solid(g,k.cylinder(-17,8,6,z-9,4,P,28,.5),materials.brass);
 // Wind cups retain hollow cup forms; arms always meet the hub.
 const angles=[theta,theta+TAU/3,theta+TAU*2/3];
 for(const a of angles){rod(g,[-63,8,151],[-63+31*Math.cos(a),8+31*Math.sin(a),151],P,2,'#bcc4b3')}
 angles.sort((a,b)=>k.depthOf([-63+31*Math.cos(a),8+31*Math.sin(a),151],P)-k.depthOf([-63+31*Math.cos(b),8+31*Math.sin(b),151],P)).forEach(a=>cup(g,a,P));
 solid(g,k.cylinder(-63,8,6.2,148,7,P,32,.8),materials.brass);sphere(g,[-63,8,157],P,2.5);
 // Paper drum has a separate slow clockwork feed and a fixed writing point.
 const tip=chart(g,t,P);
 boltPlate(g,{x:3,y:41,w:24,d:19,r:3},6,4,P,materials.enamel);
 solid(g,k.cylinder(15,50,3,10,20,P,24,.5),materials.brass);
 const hinge=[15,50,26];rod(g,[-17,8,z-7],[1,39,tip[2]],P,1.8,'#b6b9a4');rod(g,hinge,[12,49,tip[2]+4],P,2,'#c1b07a');
 rod(g,[12,49,tip[2]+4],[tip[0]-2,tip[1]+2,tip[2]+1],P,2.3,'#c5b481');rod(g,[tip[0]-2,tip[1]+2,tip[2]+1],tip,P,1.2,'#454b42');
 const qp=k.iso(tip,P);g.fillStyle='#843a32';g.beginPath();g.arc(qp[0],qp[1],1.5,0,TAU);g.fill();
 // A small fixed nameplate is part of the device, not a caption.
 const m=k.topMatrix([-69,54],4.6,P);g.save();g.transform(...m);g.fillStyle='#b4a77c';g.fillRect(0,0,53,7);g.fillStyle='#3b504c';g.font='3.9px Georgia';g.fillText('ANEMOGRAPH  /  08',3,4.8);g.restore();
 g.restore();
 let vign=g.createRadialGradient(645,326,280,645,326,850);vign.addColorStop(0,'#26392a00');vign.addColorStop(1,'#23332735');g.fillStyle=vign;g.fillRect(0,0,1280,720);
}
