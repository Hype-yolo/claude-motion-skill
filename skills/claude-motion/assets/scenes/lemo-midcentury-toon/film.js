import {PAL,setClock,shape,rect,ellipse,ink,paperFinish} from './upstream/engine/toon.js';
import {drawOwner} from './upstream/engine/chars.js';
import {makeScore} from './score-base.js';
const c=document.querySelector('#frame'),x=c.getContext('2d');
const ease=(t,a,b)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u)};
function render(t){x.setTransform(1,0,0,1,0,0);setClock(t);x.fillStyle=PAL.paper;x.fillRect(0,0,1280,720);
shape(x,[[0,530],[1280,495],[1280,720],[0,720]],{fill:'#dfcdb4',line:false});
shape(x,rect(775,105,325,350),{fill:'#668b93',line:'#3b4766',lw:3});
shape(x,[[782,447],[785,340],[895,277],[963,355],[1088,298],[1093,447]],{fill:'#d6b995',line:false});
ink(x,[[936,105],[936,455]],4);ink(x,[[775,298],[1100,298]],4);
shape(x,[[739,460],[1128,460],[1111,475],[752,475]],{fill:'#c48754',line:false});
// Source-compatible geometric plant, no unrelated sprite or mascot.
for(let k=0;k<6;k++){const a=-2.7+k*.42,px=1050+Math.cos(a)*67,py=525+Math.sin(a)*115;ink(x,[[1050,540],[px,py]],3,{line:'#456d55'});shape(x,ellipse(px,py,30,11,18,0,Math.PI*2,a),{fill:k%2?'#527960':'#8b9e70',line:false});}
shape(x,[[1011,536],[1089,536],[1076,600],[1024,600]],{fill:'#b86748',line:false});
const down=ease(t,4.5,7.3),wave=ease(t,8,9.3)*(1-ease(t,10.3,11.6));
drawOwner(x,{x:567,y:607,s:.85,view:'q',face:down>.5?'wink':'focus',look:[down*3,-1],blink:(t%3.8<.1?1:0),armF:{a1:1.0+down*.4,a2:-1.15+down*2.7},armB:{a1:1.8,a2:1.7-wave*2.3},handB:wave>.2?'open':'flat',prop:{kind:'phone',hand:'F',screen:'message'}},t);
x.fillStyle='#3b4766';x.font='italic 26px Georgia';x.fillText('a moment, offline',90,115);x.font='13px sans-serif';x.fillText('AFTER HOURS  /  01',92,143);paperFinish(x,1280,720,.45);}
window.DUR=12;window.CAPTURE=c;window.render=render;window.audioWav=makeScore({duration:12,notes:[64,67,71,69,67,64],root:40,step:1.6});window.READY=true;render(0);
