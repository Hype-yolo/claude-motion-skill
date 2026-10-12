import {piece,fill,cutLine,fillPaper,P,Pl,trace,shape,disk,crescentRows,draw,smooth,lerp} from './art.js';import {makeScore} from './score-base.js';export const width=1280,height=720,duration=18;
const red='#b3303a',blue='#345b61',gold='#bc9457';
const leg=shape([[-9,0],[10,0],[12,66],[25,72],[24,81],[-10,80]],blue,3),arm=shape([[-8,-2],[9,-2],[11,60],[4,68],[-8,61]],red,4);
function person(col){return {body:shape([[-23,-128],[20,-128],[37,-28],[-35,-28]],col,5,(g)=>crescentRows(g,-18,-107,19,70,10,2.4,Math.PI/2,.7)),head:piece([-27,-31,28,31],g=>{fill(g,q=>q.arc(0,0,24,0,7),col);cutLine(g,3,q=>{q.moveTo(9,-4);q.lineTo(12,-4)});cutLine(g,2,q=>{q.moveTo(11,7);q.quadraticCurveTo(18,10,20,5)})},{col,seed:4,ss:2}),hat:shape([[-30,-7],[30,-7],[30,0],[-30,0],[-18,-31],[17,-31],[24,-7]],col,7)}}
const people=[person(red),person(blue)];const roof=shape([[-196,0],[-165,-61],[-91,-109],[0,-129],[91,-109],[165,-61],[196,0],[131,-17],[64,1],[0,-16],[-65,0],[-130,-17]],red,19,(g)=>{for(let i=-2;i<=2;i++)cutLine(g,2.5,q=>{q.moveTo(0,-112);q.quadraticCurveTo(i*50,-80,i*63,-10)})});
const handle=shape([[-3,-115],[5,-115],[5,27],[12,32],[20,25],[24,28],[21,39],[10,43],[-3,35]],gold,12);
const canopy=shape([[-230,0],[-150,-35],[-70,-27],[0,-46],[130,-22],[218,-5],[230,39],[-230,40]],'#c7b9a0',13,(g)=>{for(let i=0;i<7;i++)cutLine(g,2,q=>{q.moveTo(-190+i*60,9);q.lineTo(-163+i*60,8)})});
const ground=shape([[-20,0],[1300,-2],[1300,150],[-20,150]],'#cab795',14);const puddle=shape([[-140,0],[-100,-13],[40,-17],[149,0],[90,14],[-85,18]],'#9ba9a0',2);const drop=shape([[0,-9],[-3,3],[1,6],[4,2]],'#527c7d',2);
function human(g,i,x,y,t,walk){const p=people[i],step=walk?Math.sin(t*7)*.35:0;draw(g,leg,x-12,y-76,step,1,.7);draw(g,leg,x+10,y-76,-step,1,.7);draw(g,p.body,x,y-42,0,1,1.4);draw(g,p.head,x,y-189,0,1,1.2);draw(g,p.hat,x,y-197,0,1,1.4);draw(g,arm,x+20,y-166,i===0?-.75:0,1,1.2)}
export function render(g,t){g.reset();fillPaper(g,'rice',0,0,1280,720);const s=Math.floor(t*12)/12,join=smooth(s,4,9),walk=smooth(s,11.5,17),x1=lerp(340,560,join)+walk*290,x2=700+walk*290;
// A shelter on the right establishes why the second traveller is waiting.
draw(g,canopy,998,288,0,.72,.7);g.fillStyle='#aa987b';g.fillRect(845,304,9,229);g.fillRect(1140,304,9,229);draw(g,ground,0,554,0,1,.7);draw(g,puddle,592,584,0,1.2,.2);draw(g,puddle,970,568,0,.6,.2);
for(let i=0;i<64;i++){const x=(i*91.7+s*31)%1270,y=160+(i*77+s*240)%386;const ux=x1+65,uy=327;if(y>uy&&Math.abs(x-ux)<185)continue;draw(g,drop,x,y,.23,.72,0)}
human(g,1,x2,555,s,t>11.5&&t<17);human(g,0,x1,555,s,(t>4&&t<9)||(t>11.5&&t<17));draw(g,handle,x1+43,448,0,1,1.4);draw(g,roof,x1+43,335,-.08*(1-join),1,1.9);
g.fillStyle='#834a45';g.font='italic 25px Georgia';g.fillText('Room for two.',72,77);g.font='11px system-ui';g.fillStyle='#8c7864';g.fillText('A   S M A L L   A C T   O F   S H E L T E R',74,103)}
export const audioWav=makeScore({notes:[65,72,74,77,76,72,69,65],root:41,step:1.7,cues:[9,11.5,16.5],seed:8});export const evidence={body:roof};
