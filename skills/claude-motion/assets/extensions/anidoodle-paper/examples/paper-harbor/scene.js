import {rng,path,scissor,fibres,gouache,shadeSide,wavePrint,newsPrint,woodPrint,stonePrint,cutPath,mix} from './lib/paper-materials.js';
export const width=1280,height=720,duration=18;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
const phase=(t,a,b)=>ease((t-a)/(b-a));
const lerp=(a,b,u)=>a+(b-a)*u;
const poly=(g,p,c)=>{g.fillStyle=c;path(g,p);g.fill()};
const line=(g,p,c,w=1)=>{g.strokeStyle=c;g.lineWidth=w;path(g,p,false);g.stroke()};
const ellipse=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()};
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const oval=(x,y,rx,ry,n=48)=>Array.from({length:n},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*rx,y+Math.sin(i/n*Math.PI*2)*ry]);
const card=(g,shape,color,seed,{depth=3,paint=true,grain=true,border=0}={})=>{
 const s=scissor(shape,seed,.42),pc={cut:[s],border};
 g.save();g.fillStyle='#100f1a';g.shadowColor='#07091388';g.shadowBlur=depth*1.7;cutPath(g,pc,depth*.55,depth);g.shadowBlur=0;
 g.fillStyle=mix(color,'#201822',.4);cutPath(g,pc,1.1,1.8);
 if(border){g.fillStyle='#f1e8d4';cutPath(g,pc)}
 if(paint)gouache(g,s,color,seed,{dir:-.18,len:34,w:9,vary:.055,dens:.8});else poly(g,s,color);
 if(grain)fibres(g,s,color,seed+70,.55,.15);g.restore();return s;
};
const pageL=[[190,368],[602,351],[622,599],[140,597]];
const pageR=[[602,351],[1080,344],[1161,591],[622,599]];
let backdrop,book;
function makeLayer(fn){const c=document.createElement('canvas');c.width=1280;c.height=720;fn(c.getContext('2d'));return c}
function background(g){
 g.fillStyle='#18252e';g.fillRect(0,0,1280,720);
 gouache(g,rect(0,0,1280,720),'#202c34',101,{len:160,w:32,vary:.045,dens:.5});
 // Shop shelves, individual paper book spines, faded gilt bands. No textual labels.
 for(let shelf=0;shelf<2;shelf++){
  const sy=95+shelf*158;
  for(const [x0,x1] of [[43,430],[873,1237]]){
   card(g,rect(x0-9,sy-18,x1-x0+18,144),'#17242c',19+shelf,{depth:4,paint:false});
   const r=rng(812+x0+shelf*20);let x=x0;
   while(x<x1-13){const w=13+r()*19,h=62+r()*61,col=['#555b54','#776047','#6e4544','#41565a','#927b59'][Math.floor(r()*5)];
    g.save();g.translate(x,sy+121);g.rotate((r()-.5)*.07);
    card(g,rect(0,-h,w,h),col,Math.round(x),{depth:1,grain:false});
    g.fillStyle='#d4b67865';g.fillRect(2,-h+9,w-4,2);g.fillRect(2,-10,w-4,2);
    g.fillStyle='#0c162c55';g.fillRect(2,-h+2,2,h-4);g.restore();x+=w+3;
   }
   card(g,rect(x0-15,sy+122,x1-x0+30,12),'#66523e',shelf+40,{depth:4});
  }
 }
 // Night window and moon.
 card(g,[[468,28],[808,28],[808,293],[468,293]],'#3d403e',190,{depth:7});
 card(g,rect(482,42,312,236),'#182331',191,{depth:2,paint:false});
 let sky=g.createLinearGradient(0,40,0,278);sky.addColorStop(0,'#101a2b');sky.addColorStop(1,'#304656');g.fillStyle=sky;g.fillRect(489,49,298,222);
 const rr=rng(44);for(let i=0;i<32;i++)ellipse(g,501+rr()*271,56+rr()*162,.5+rr()*.7,.5+rr()*.7,'#d4dcd887');
 ellipse(g,721,100,23,23,'#e7dfb4');ellipse(g,730,92,23,23,'#152031');
 // Quiet city silhouettes beneath the window.
 for(let i=0;i<12;i++){const x=489+i*26,h=28+rr()*42;g.fillStyle='#192835';g.fillRect(x,271-h,25,h)}
 card(g,rect(632,40,8,238),'#54564f',92,{depth:2,paint:false});card(g,rect(480,175,315,7),'#54564f',93,{depth:2,paint:false});
 card(g,rect(456,289,362,17),'#777363',94,{depth:5});
 // Reading table, grain remains actual upstream woodPrint.
 const desk=rect(0,339,1280,381);card(g,desk,'#72533e',21,{depth:2,paint:false});woodPrint(g,desk,'#392e2c',38);
 let light=g.createRadialGradient(820,485,25,700,490,690);light.addColorStop(0,'#ffce7730');light.addColorStop(1,'#080e2318');g.fillStyle=light;g.fillRect(0,339,1280,381);
 // Stacked closed books at the edges establish the bookstore scale.
 g.save();g.translate(5,441);g.rotate(-.09);card(g,rect(-75,-30,206,33),'#7e4b43',201,{depth:6});card(g,rect(-69,-24,190,19),'#bbac88',202,{depth:1});card(g,rect(-77,-34,210,6),'#974c40',203,{depth:2});g.restore();
 g.save();g.translate(1174,385);g.rotate(.13);card(g,rect(-43,-25,140,39),'#344d48',204,{depth:7});card(g,rect(-39,-18,130,23),'#bba888',205,{depth:1});card(g,rect(-46,-28,146,6),'#49665b',206,{depth:2});g.restore();
}
function riverY(x){return 496+18*Math.sin((x-255)/125)-9*Math.sin((x-255)/52)}
const river=[];for(let x=244;x<=1036;x+=8)river.push([x,riverY(x)-25]);for(let x=1036;x>=244;x-=8)river.push([x,riverY(x)+33]);
function bookLayer(g){
 ellipse(g,650,623,515,45,'#16132370');
 card(g,[[171,375],[607,358],[1096,350],[1180,625],[625,658],[124,631]],'#583c43',25,{depth:10});
 for(let i=8;i>=0;i--){
  const yy=i*3.0;
  poly(g,pageL.map(([x,y])=>[x-yy*.15,y+yy]),i%2?'#b4a38c':'#d9cdb1');poly(g,pageR.map(([x,y])=>[x+yy*.25,y+yy]),i%2?'#c2b396':'#e5d8b9');
  line(g,[[140-yy*.15,597+yy],[622,599+yy],[1161+yy*.25,591+yy]],'#948873',.6);
 }
 card(g,pageL,'#e8dcbf',31,{depth:2});card(g,pageR,'#f0e3c5',32,{depth:2});
 // Page columns represented by ink marks, never actual subtitles.
 const ink=makeLayer(c=>{c.save();path(c,pageL);c.clip();newsPrint(c,rect(177,380,398,199),301);c.restore();c.save();path(c,pageR);c.clip();newsPrint(c,rect(673,371,408,207),302);c.restore()});g.save();g.globalAlpha=.23;g.drawImage(ink,0,0);g.restore();
 const crease=g.createLinearGradient(576,0,654,0);crease.addColorStop(0,'#57432a00');crease.addColorStop(.54,'#70553a50');crease.addColorStop(.69,'#ffefd455');crease.addColorStop(1,'#e3d4a500');g.fillStyle=crease;g.fillRect(575,354,80,246);
 line(g,[[603,354],[611,423],[619,524],[622,599]],'#826c4955',1.5);
 // River cut from blue paper between page banks, source wave print visible in the channel.
 card(g,river,'#296786',60,{depth:2});
 gouache(g,river,'#417f9b',61,{dir:.12,len:76,w:11,vary:.075,dens:.9});
 wavePrint(g,river,'#b0d6d0',19,1.2);
 line(g,river.slice(0,100),'#f6e9c8',3);
 // Folded right-bank landing / narrow paper quay.
 card(g,[[904,447],[1050,456],[1059,490],[923,480]],'#b29b72',64,{depth:4});woodPrint(g,[[904,447],[1050,456],[1059,490],[923,480]],'#685640',73);
 for(let x=924;x<1050;x+=24)line(g,[[x,451],[x+8,482]],'#ead7ae55',1);
 // Bookmarks lying at the front edge.
 card(g,[[781,603],[803,602],[820,675],[805,666],[793,678]],'#9b4b42',71,{depth:3});
}
function bridge(g){
 // Actual negative-space arch. Painter order puts the boat behind both piers and arch face.
 const outer=[[581,541],[581,419],[587,390],[606,367],[633,350],[668,343],[704,347],[738,360],[767,381],[781,410],[785,535]];
 const inner=[[630,540],[630,432],[638,412],[655,398],[675,393],[694,396],[714,405],[731,422],[738,442],[739,538]];
 const pc={cut:[outer,inner],hole:true};
 g.save();g.fillStyle='#322d3680';g.shadowColor='#10142470';g.shadowBlur=12;cutPath(g,pc,10,14);g.shadowBlur=0;
 g.fillStyle='#7f786b';cutPath(g,pc,7,5);g.fillStyle='#c5b797';cutPath(g,pc);
 g.save();g.beginPath();for(const s of [outer,inner]){s.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}g.clip('evenodd');
 gouache(g,outer,'#c4b697',450,{len:29,w:8,vary:.07});stonePrint(g,outer,'#c4b697',451);fibres(g,outer,'#c4b697',452,.9,.18);g.restore();
 line(g,outer.slice(0,11),'#f6e5bd',3);line(g,inner,'#6c706466',2);
 // Scored radial fold lines emphasize this is a card arch rising from a book.
 for(let i=0;i<8;i++){const a=Math.PI+i/7*Math.PI;line(g,[[680+Math.cos(a)*94,426+Math.sin(a)*79],[680+Math.cos(a)*57,434+Math.sin(a)*43]],'#6d6b5977',1.4)}
 card(g,[[564,542],[628,539],[639,552],[577,557]],'#d2c3a2',462,{depth:2});
 card(g,[[737,536],[798,531],[811,544],[745,550]],'#d2c3a2',463,{depth:2});g.restore();
}
function lamp(g,t){
 const x=1016,y=431;
 let gl=g.createRadialGradient(x,y-64,0,x,y-38,120);gl.addColorStop(0,'#ffe6a866');gl.addColorStop(.35,'#ffd98628');gl.addColorStop(1,'#ffca6500');g.fillStyle=gl;g.fillRect(x-125,y-164,250,254);
 ellipse(g,x,y+13,26,8,'#15232760');card(g,oval(x,y+9,20,6),'#766443',510,{depth:3});
 card(g,[[x-3,y+8],[x+4,y+8],[x+1,y-50],[x-3,y-50]],'#977e49',511,{depth:2});
 card(g,[[x-18,y-52],[x+20,y-52],[x+13,y-94],[x-13,y-94]],'#eed497',512,{depth:3});
 gouache(g,[[x-15,y-55],[x+16,y-55],[x+10,y-90],[x-10,y-90]],'#ffe9b2',513,{len:15,w:6,vary:.04});
 line(g,[[x-18,y-52],[x+20,y-52]],'#aa7547',3);ellipse(g,x,y-95,14,4,'#ac7b4e');ellipse(g,x,y-96,4,3,'#c59a5b');
 // Light pool on paper dock, fixed and calm.
 g.save();g.globalCompositeOperation='screen';ellipse(g,994,466,51,11,'#ffdc741d');g.restore();
}
const finalFaces=[ [[-86,-2],[0,-2],[0,40],[-56,40]], [[0,-2],[86,-2],[56,40],[0,40]], [[-50,-2],[0,-94],[0,-2]], [[0,-94],[50,-2],[0,-2]] ];
function foldedBoat(g,t,x,y){
 const unfold=phase(t,.75,4.55),rise=phase(t,2.55,5.0),hull=phase(t,1.0,3.6);
 const bob=t>5&&t<15.8?Math.sin((t-5)*2.7)*1.8*Math.sin(Math.PI*clamp((t-5)/11)):0;
 g.save();g.translate(x,y+bob);g.scale(.78,.78);g.rotate(t>5?Math.sin(t*2.3)*.013*(1-phase(t,14.5,16.5)):0);
 ellipse(g,0,38,82,11,'#17394344');
 // The opening state is one connected sheet. Its back corners hinge inward on two successive folds.
 if(unfold<1){
  const sheet=[[-86,-55],[86,-55],[86,50],[-86,50]];
  const panel=(p,col,seed)=>{card(g,p,col,seed,{depth:2,paint:false});newsPrint(g,p,seed)};
  const f1=phase(t,.8,2.25),f2=phase(t,1.65,3.15);
  panel([[-86,0],[86,0],[lerp(86,56,hull),lerp(50,40,hull)],[lerp(-86,-56,hull),lerp(50,40,hull)]],'#e9dcc0',620);
  const yy=lerp(-55,-2,unfold),lx=lerp(-86,0,f1),rx=lerp(86,0,f2);
  panel([[-86,0],[0,0],[0,-55*(1-f1)],[lx,yy]],mix('#f3e8cc','#c7b99c',f1*.5),621);
  panel([[0,0],[86,0],[rx,yy],[0,-55*(1-f2)]],mix('#f2e4c6','#b9aa8b',f2*.5),622);
  line(g,[[-86,0],[86,0]],'#82745e88',1);line(g,[[0,-55],[0,50]],'#82745e55',.8);
 }
 // Fold facets retain paperCraft boat geometry, now driven by actual changing hinge elevation.
 if(t>2.45){
  const a=rise*Math.PI/2,apexY=35*Math.cos(a)-94*Math.sin(a),span=lerp(70,50,rise);
  const faces=[finalFaces[0],finalFaces[1],[[-span,-2],[0,apexY],[0,-2]],[[0,apexY],[span,-2],[0,-2]]];
  const colors=['#eee2c1','#c9b998','#f7efd6','#d6c6a7'];
  // A connected central sail lifts, it does not dissolve into view.
  for(const i of [2,3,0,1]){const s=faces[i];card(g,s,colors[i],630+i,{depth:i<2?2:1,paint:false});newsPrint(g,s,100+i);fibres(g,s,colors[i],200+i,1,.1)}
  line(g,[[0,apexY],[0,40]],'#7e715570',1.2);line(g,[[-86,-2],[86,-2]],'#fff4d288',1.4);
 }
 g.restore();
}
function wake(g,t,x,y){if(t<5.0||t>16.2)return;const op=.5*(1-phase(t,14.4,16.2));g.save();g.globalAlpha=op;for(let i=0;i<3;i++){const q=(t*.7+i*.35)%1;g.strokeStyle='#d2e4d0';g.lineWidth=1.6;g.beginPath();g.ellipse(x-52-q*27,y+29,13+q*16,3+q*3,0,.08,Math.PI*1.88);g.stroke()}g.restore()}
export function render(g,t){
 if(!backdrop)backdrop=makeLayer(background);if(!book)book=makeLayer(bookLayer);
 g.fillStyle='#16212b';g.fillRect(0,0,1280,720);
 // A very gentle continuous push, all scene elements keep the same camera.
 const pull=phase(t,4.4,7.6),z=lerp(1.32,1.02,pull),cx=lerp(490,640,pull),cy=lerp(430,410,pull);g.save();g.translate(640,410);g.scale(z,z);g.translate(-cx,-cy);
 g.drawImage(backdrop,0,0);g.drawImage(book,0,0);
 // Travel with ease-out arrival; first 5.2 seconds are reserved for the full fold.
 const u=phase(t,5.35,15.4),x=lerp(293,956,u),y=riverY(x)-12;
 wake(g,t,x,y);foldedBoat(g,t,x,y);
 bridge(g);lamp(g,t);
 // The lamplight gradually warms the sail as it arrives at the quay.
 if(t>14){g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=phase(t,14,16)*.2;ellipse(g,964,450,70,75,'#ffeab0');g.restore()}
 g.restore();
 let vign=g.createRadialGradient(664,444,245,655,393,790);vign.addColorStop(0,'#080b1700');vign.addColorStop(1,'#05091488');g.fillStyle=vign;g.fillRect(0,0,1280,720);
}
