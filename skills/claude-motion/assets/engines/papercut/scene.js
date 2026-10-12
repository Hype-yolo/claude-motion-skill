import {piece,fill,cut,cutLine,fillPaper,trace,P,Pl,within,inset,ellipsePoly} from './engine/upstream/paper.js';
import {crescentRows,crescent,swirl,cloudCut} from './engine/upstream/motifs.js';
import {put,mul,T,R,S} from './engine/upstream/rig.js';
export {audioWav} from './score.js';
export const width=1280,height=720,duration=18;
const PI=Math.PI,clamp=x=>Math.max(0,Math.min(1,x)),smooth=(t,a,b)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u)},lerp=(a,b,u)=>a+(b-a)*u;
const red='#b93236',deep='#8d2635',pale='#d35d50',gold='#c99c52';
const bodyPath=P([[-110,0],[-70,-57],[7,-70],[83,-35],[119,-5],[108,24],[41,58],[-45,58],[-97,26]],true, .38,8);
function fishBody(c=red){return piece([-118,-78,127,70],g=>{fill(g,q=>trace(q,bodyPath),c);inset(g,bodyPath,4,1.5,c);within(g,bodyPath,()=>{crescentRows(g,-87,-52,43,56,14,3.5,PI/2,.72);cutLine(g,3,q=>{q.moveTo(63,-39);q.quadraticCurveTo(37,2,72,33)});crescent(g,85,-18,10,PI*.05,PI*.92,4);cutLine(g,2.5,q=>{q.moveTo(101,9);q.quadraticCurveTo(113,14,119,11)})});},{col:c,seed:4,ss:2});}
const body=fishBody();
const tailPath=P([[0,0],[-39,-36],[-85,-62],[- 70,-5],[-94,55],[-40,34]],true,.4,2);

const tail=piece([-103,-70,8,65],g=>{fill(g,q=>trace(q,tailPath),deep);inset(g,tailPath,4,1.5,deep);for(let i=0;i<6;i++)cutLine(g,2,q=>{q.moveTo(-14,0);q.quadraticCurveTo(-45,(i-2.5)*7,- 70,(i-2.5)*17)})},{seed:9,ss:2});
const finPath=P([[0,0],[-25,-43],[12,-35],[45,-8],[30,7]]),fin=piece([-35,-50,55,18],g=>{fill(g,q=>trace(q,finPath),pale);for(let i=0;i<4;i++)cutLine(g,2,q=>{q.moveTo(6,1);q.lineTo(-14+i*12,-30)})},{seed:7,ss:2});
const petalPath=P([[0,0],[-35,-32],[-26,-83],[0,-120],[26,-83],[35,-32]]),petal=piece([-43,-129,43,10],g=>{fill(g,q=>trace(q,petalPath),red);inset(g,petalPath,4,2,red);cutLine(g,2.5,q=>{q.moveTo(0,-15);q.quadraticCurveTo(-9,-48,0,-96)});for(let j=0;j<3;j++)crescent(g,0,-37-j*18,14,-PI*.9,-PI*.1,3);},{seed:12,ss:2});
const leafPath=P([[-90,0],[-70,-45],[-17,- 60], [47,-53],[89,-4],[65,40],[10,52],[-65,35]],true,.3,11);

const leaf=piece([-98,-68,100, 60],g=>{fill(g,q=>trace(q,leafPath),deep);inset(g,leafPath,4,2,deep);for(let j=0;j<7;j++){const a=j*PI*2/7;cutLine(g,2,q=>{q.moveTo(0,0);q.lineTo(Math.cos(a)*66,Math.sin(a)*34)})}swirl(g,0,0,12,1.3,2)},{seed:19,ss:2});
const cloudPath=P([[-160,30],[-160,0],[-90,-7],[-110,-42],[-50,-53],[-19,-21],[14,-63],[70,-65],[106,-29],[170,-18],[190,24]],true,.3,12);
const cloud=piece([-177,-80,205,44],g=>{fill(g,q=>trace(q,cloudPath),'#d6a494');for(let j=0;j<4;j++)cloudCut(g,-90+j*66,-3,21,3)},{seed:3,ss:2});
const moon=piece([-96,-96,96,96],g=>fill(g,q=>q.arc(0,0,88,0,PI*2),gold),{col:gold,seed:23,ss:2});
const water=piece([-750,-35,750,160],g=>{const p=Pl([[-740,25],[-620,6],[-500,17],[-340,0],[-180,18],[0,6],[170,29],[350,8],[530,23],[730,3],[740,150],[-740,150]],true,.7);fill(g,q=>trace(q,p),deep);for(let j=0;j<24;j++)cutLine(g,2,q=>{const x=-700+j*60;q.moveTo(x,52+(j%3)*21);q.quadraticCurveTo(x+18,46+(j%3)*21,x+ 40,52+(j%3)*21)})},{seed:31,ss:2});
let shadows=true;window.setFeature=(name,on)=>{if(name==='shadows')shadows=on;};
const draw=(g,p,M,z=1)=>put(g,p,M,{shadow:shadows?z:0,shadowCol:'rgba(75,36,39,.28)'});
function koi(g,x,y,angle,scale,t){const base=mul(T(x,y),mul(R(angle),S(scale)));draw(g,tail,mul(base,mul(T(- 90,0),R(Math.sin(t*8)*.19))),1.7);draw(g,fin,mul(base,mul(T(-20,-42),R(-.25+Math.sin(t*8)*.09))),1.2);draw(g,body,base,1.4);draw(g,fin,mul(base,mul(T(0, 30),R(PI*.95+Math.sin(t*8)*.13))),1.7);}
export function render(g,t){g.reset();fillPaper(g,'rice',0,0,width,height);const stepped=Math.floor(t*12)/12;
 // Native paper layers and cut-outs, with slow continuous camera drift.
 const drift=Math.sin(t*.15)*7;draw(g,moon,mul(T(974-drift,168),S(.9)),.9);
 draw(g,cloud,mul(T(255+drift*1.8,179),S(.73)),.7);draw(g,cloud,mul(T(1040-drift,289),S(.55)),.8);
 draw(g,leaf,mul(T(266+drift,553),mul(R(-.25),S(1.5))),1.3);draw(g,leaf,mul(T(976-drift,566),mul(R(.2),S(1.25))),1.2);
 const jump=smooth(stepped,4.5,11.3);const x=lerp(235,1000,smooth(stepped,0,13.5)),y=jump>0&&jump<1?495-Math.sin(jump*PI)*270:495;
 const angle=jump>0&&jump<1?lerp(-.62,.78,jump):-.08;const fishScale=1;
 if(t<13.5)koi(g,x,y+170*smooth(stepped,11.3,13.5),angle,fishScale,stepped);
 draw(g,water,mul(T(640,550),S(1)),1.3);
 // The wake becomes an opening paper lotus, each petal turning about its base.
 const bloom=smooth(stepped,11.8,16.4);if(bloom>0){for(let i=0;i<7;i++){const a=(i-3)*.39*bloom;const scale=.1+1.45*bloom;draw(g,petal,mul(T(1000,563),mul(R(a),S(scale))),1+(i%2)*.4)}draw(g,leaf,mul(T(1000,578),S(.85)),1.4)}
 // A few negative-space ripple pieces remain after the fish disappears beneath the front paper layer.
 for(let i=0;i<4;i++){const u=smooth(t,11.3+i*.16,13.3+i*.16)*(1-smooth(t,15,17));if(u>0){g.save();g.strokeStyle='#c6a277';g.lineWidth=1.2;g.globalAlpha=.7*u;g.beginPath();g.ellipse(1008,572,18+i*21+u*13,4+i*4,0,0,PI*2);g.stroke();g.restore()}}
 g.fillStyle='#8b2834';g.font='italic 25px Georgia';g.fillText('A pond, a moon, a leap.',72,76);g.font='11px system-ui';g.fillStyle='#8b6a58';g.fillText('P A P E R   /   N O C T U R N E',74,102);
}
export const evidence={upstream:['paper.js: piece/finishPaper/cut/paperGrain','motifs.js: crescentRows/cloudCut','rig.js: put/mul'],body};
