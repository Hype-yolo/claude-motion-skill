import {init,frame,g,stroke,ell,fillOnly} from './upstream/toon.js';
import {normalCafe,cafeCounter,barista} from './upstream/worlds.js';
import {coffeeCup} from './upstream/chars.js';
import {makeScore} from './score-base.js';
const c=document.querySelector('#frame'),x=c.getContext('2d'),stage=document.createElement('canvas');stage.width=1920;stage.height=1080;init(stage);
const ease=(t,a,b)=>{let u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u)};
function render(t){frame(t,{amp:1.3});normalCafe(t);const a=ease(t,1,3)*(1-ease(t,6,8));barista(650,740,.72,t,{arm:a});cafeCounter(t);
// Cup settles on counter, steam continues after the hand withdraws.
const u=ease(t,2.3,4),cx=795+180*u,cy=527+38*u;coffeeCup(cx,cy,.72,{t,eyes:false,arms:0});
for(let k=0;k<3;k++){const pts=[];for(let j=0;j<20;j++){const q=j/19;pts.push([cx+(k-1)*26+Math.sin(q*7-t*1.4+k)*8,cy-80-q*90]);}stroke(pts,3,{line:'rgba(255,255,245,.65)'});}
x.clearRect(0,0,1280,720);x.drawImage(stage,0,0,1280,720);x.fillStyle='#2d4739';x.font='italic 23px Georgia';x.fillText('one last cup',78,60);}
window.DUR=12;window.CAPTURE=c;window.render=render;window.audioWav=makeScore({duration:12,notes:[60,64,67,71,69,67],root:36,step:1.5,cues:[4]});window.READY=true;render(0);
