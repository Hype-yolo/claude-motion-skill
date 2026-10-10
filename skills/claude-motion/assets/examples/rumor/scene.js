import { PAL, REG, setClock, shape, ink, ellipse, spline, rect, rrect, plane, paperFinish, text, star, sparkle, lerp, ss, seg, twos, TAU } from './styles/midcentury-toon/demo/engine/toon.js';
import { drawOwner } from './styles/midcentury-toon/demo/engine/chars.js';
export const width=1280,height=720,duration=18;
const C={paper:'#F4EAD5',ink:'#2B2420',orange:'#E89039',red:'#D75E40',teal:'#3FA7A0',navy:'#3B4766'};
const xs=[170,480,790,1100];
const clothes=['#E4613F','#3FA7A0','#7F9CC0','#6E4A6B'];
const darks=['#B8452B','#257A74','#5B789E','#50334D'];
const hairs=['#3A2621','#794A30','#252C38','#82725C'];
function line(g,p,w=3,col=C.ink){ink(g,spline(p,false,8),w,{color:col,seed:17,breaks:.14});}
function field(g,t){
 g.fillStyle=C.paper;g.fillRect(0,0,width,height);
 plane(g,[[0,110],[1280,55],[1280,590],[0,620]],'#DFE5D5',{grain:.23});
 plane(g,[[0,588],[1280,575],[1280,720],[0,720]],'#D8C59E',{grain:.3});
 line(g,[[0,590],[300,588],[590,583],[930,580],[1280,578]],2.5,'#8E8F73');
 for(let i=0;i<6;i++) sparkle(g,88+i*218,115+(i%2)*34,8,{fill:'#CEC9AB'});
}
function person(g,id,x,y,s,t,face='neutral',dir=1,act=0){
 const save={coral:PAL.coral,coralD:PAL.coralD,hair:PAL.hair};
 PAL.coral=clothes[id];PAL.coralD=darks[id];PAL.hair=hairs[id];
 const p={x,y,s,dir,view:'q',face,blink:(Math.sin(t*2.1+id*2)> .995)?1:0,
 armF:{a1:lerp(1.3,-.13,act),a2:lerp(1.52,-2.69,act)},handF:act>.6?'flat':'open',
 armB:{a1:1.86,a2:1.7}};
 drawOwner(g,p,twos(t));Object.assign(PAL,save);
}
function fish(g,x,y,s,level,t){
 g.save();g.translate(x,y);g.scale(s,s);
 const nasty=ss(seg(level,1,2)),monster=ss(seg(level,2,3));
 const len=55+level*8, tall=26+level*7;
 const tail=spline([[-len+5,0],[-len-37,-32-Math.sin(t*6)*5],[-len-29,0],[-len-37,32],[-len+5,0]],true,5);
 shape(g,tail,{fill:C.orange,line:3,grain:.5,seed:108});
 shape(g,[[-16,-tall+4],[-30,-tall-30*nasty-7],[19,-tall+5]],{fill:C.red,line:3,seed:109});
 shape(g,ellipse(0,0,len,tall,56),{fill:monster>.3?C.red:C.orange,line:3.2,grain:.5,seed:110,shade:[{pts:rect(-90,8,180,50),color:'#BD6331',alpha:.25}]});
 line(g,[[-25,0],[-9,14],[-25,19]],2.5);
 shape(g,ellipse(len-19,-10,10+2*nasty,11+4*nasty,24),{fill:PAL.white,line:2,seed:111,grain:0});
 shape(g,ellipse(len-15,-10,3,4,12),{fill:C.ink,off:[0,0],grain:0});
 if(nasty>.05){
  line(g,[[len-35,-26],[len-8,-18]],3.8);
  shape(g,[[len-24,8],[len+2,5],[len-8,28],[-2,23]],{fill:C.ink,line:1,grain:0,seed:112});
  for(let i=0;i<4;i++)shape(g,[[len-26+i*7,8],[len-22+i*7,19],[len-19+i*7,8]],{fill:PAL.white,line:0,off:[0,0],grain:0});
 }else{line(g,[[len-4,8],[len+2,10],[len-4,14]],2);}
 if(monster>0){
  g.globalAlpha=monster;
  for(let i=0;i<4;i++) shape(g,[[-42+i*20,-tall+4],[-38+i*20,-tall-24],[ -25+i*20,-tall+3]],{fill:'#A83F31',line:2,seed:120+i});
  shape(g,[[28,-tall+2],[31,-tall-32],[43,-tall-8]],{fill:PAL.white,line:2,seed:125});
  for(let i=0;i<3;i++)line(g,[[-35+i*23,26],[-20+i*23,43],[ -32+i*23,58]],4,'#A83F31');
  g.globalAlpha=1;
 }
 g.restore();
}
function bowl(g,x,y,s,t){
 g.save();g.translate(x,y);g.scale(s,s);
 shape(g,spline([[-67,-98],[-87,-65],[-93,-16],[-65,13],[64,13],[92,-16],[85,-65],[64,-98]],true,7),{fill:'#F7F1DB',line:3.5,grain:.1,seed:220});
 shape(g,spline([[-87,-60],[-45,-57],[15,-63],[86,-58],[89,-17],[61,9],[-61,9],[-89,-16]],true,6),{fill:'#AADBD2',line:0,grain:.2,seed:221});
 fish(g,Math.sin(t*1.1)*12,-37,.34,0,t);
 shape(g,ellipse(0,-97,67,8,50),{fill:'#E3ECE1',line:3.5,seed:222,grain:0});
 line(g,[[-70,-71],[-78,-43],[-73,-18]],5,'#FFFFFF');
 for(let i=0;i<3;i++){const yy=-40-((t*13+i*19)%46);shape(g,ellipse(40+i*5,yy,3,4,12),{line:1.3,lineColor:'#5DA9A0',fill:null});}
 g.restore();
}
function table(g,x,y,s=1){
 line(g,[[x-58*s,y],[x-79*s,y+100*s]],7);line(g,[[x+58*s,y],[x+80*s,y+100*s]],7);
 shape(g,ellipse(x,y,133*s,17*s,56),{fill:'#C08D52',line:3,seed:201});
}
function bubble(g,x,y,r,level,label,t,tailX,tailY){
 shape(g,[[x-24,y+r*.64],[tailX,tailY],[x+23,y+r*.64]],{fill:PAL.white,line:2.5,seed:300,grain:.25});
 shape(g,ellipse(x,y,r,r*.76,64),{fill:PAL.white,line:3,seed:301,grain:.25});
 fish(g,x,y-17,.52+level*.24,level,t);
 text(g,label,x,y+r*.50,{font:'bold 25px Georgia',align:'center',fill:C.ink,maxW:r*1.72});
}
function whisper(g,x0,y0,x1,y1,u){
 const pts=[];for(let j=0;j<35;j++){let v=j/34;pts.push([lerp(x0,x1,v),lerp(y0,y1,v)-Math.sin(v*Math.PI)*18]);}
 ink(g,pts,3,{color:C.red,upto:u,breaks:.7,seed:741});
}
function opening(g,t){
 person(g,0,386,648,.82,t,'happy',1,ss(seg(t,.7,1.2)));
 table(g,770,575,1.23);bowl(g,770,557,1.30,t);
 const pop=ss(seg(t,.8,1.3));
 if(pop>0){g.save();g.globalAlpha=pop;bubble(g,690,218,141,0,'a fish',t,425,298);g.restore();}
 text(g,'A LITTLE FISH STORY',70,72,{font:'bold 26px Georgia',track:3,fill:C.ink});
}
function chain(g,t){
 // Local handoff phases: hold, lean/whisper, arrival and embellishment.
 const a=t-3.2,stage=Math.min(2,Math.floor(a/2.8)),q=(a-stage*2.8)/2.8;
 const transit=ss(seg(q,.25,.65));
 const idx=a>=8.4?3:stage;
 const x=a>=8.4?xs[3]:lerp(xs[stage],xs[stage+1],transit);
 const level=a>=8.4?3:stage+ss(seg(q,.64,.92));
 for(let i=0;i<4;i++){
  const active=i===idx,receiver=i===idx+1;
  const dir=receiver&&q<.72?-1:1;
  const act=active?ss(seg(q,.12,.29))*(1-ss(seg(q,.79,.97))):receiver?.3:0;
  person(g,i,xs[i],641,.53,t,i<idx?'happy':receiver&&q>.5?'wow':active?'focus':'neutral',dir,act);
 }
 if(a<8.4&&q>.2&&q<.79)whisper(g,xs[stage]+42,407,xs[stage+1]-44,397,ss(seg(q,.2,.5)));
 const labels=['a fish','a BIG fish','a SHARK','a MONSTER'];
 const current=Math.min(3,Math.floor(level+.08));
 const br=lerp(113,155,level/3);
 const bx=Math.min(1090,Math.max(160,x));
 bubble(g,bx,202,br,level,labels[current],t,x,350);
 // Previous accounts remain as small witnesses, with no arrows or diagram labels.
 for(let i=0;i<Math.floor(level);i++){
  g.save();g.globalAlpha=.38;fish(g,xs[i],276,.22+i*.065,i,t);g.restore();
 }
 if(a>=8.4){
  const p=ss(seg(a,8.4,9.4));
  for(let i=0;i<5;i++) sparkle(g,960+Math.cos(i*1.5)*180,185+Math.sin(i*1.5)*125,10*p,{fill:C.red});
 }
 // Keep the actual source visible throughout the relay.
 table(g,76,664,.42);bowl(g,76,654,.43,t);
}
function ending(g,t){
 const z=ss(seg(t,14.1,14.65));
 person(g,0,295,650,.65,t,'neutral',1,.52);
 person(g,3,1020,650,.65,t,'wow',-1,.8);
 table(g,507,581,1.38);bowl(g,507,561,1.50,t);
 bubble(g,899,195,171,3,'a MONSTER!',t,1020,320);
 // A held tiny hand-width gesture and real bowl puncture the embellished story.
 text(g,'It was this big.',454,328,{font:'italic 33px Georgia',fill:C.ink,maxW:330});
 line(g,[[475,361],[538,361]],2.5,C.red);
 line(g,[[475,354],[475,369]],2.5,C.red);line(g,[[538,354],[538,369]],2.5,C.red);
 if(t>16){
  const k=ss(seg(t,16,16.5));
  text(g,'?',1091,279,{font:'bold 58px Georgia',fill:C.red,alpha:k,rot:.13});
 }
}
export function render(g,t){
 t=Math.max(0,Math.min(duration,t));setClock(t);REG.dx=3.2;REG.dy=2.1;REG.jit=.8;
 field(g,t);
 if(t<3.2)opening(g,t);else if(t<14.1)chain(g,t);else ending(g,t);
 paperFinish(g,width,height,.75);
}
