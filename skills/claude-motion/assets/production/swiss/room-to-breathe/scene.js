import {E,snap,seg,lerp,steps} from './engine/ease.js';import {font,revealText} from './engine/type.js';import {C,fx} from './engine/source-film.js';import {makeScore} from './score-base.js';export const width=1280,height=720,duration=18;const f=new FontFace('Archivo','url(./fonts/Archivo.ttf)',{weight:'100 900'});export const ready=f.load().then(x=>document.fonts.add(x));
const ink=C.ink,red=C.red,paper=C.page;function text(g,s,x,y,size,p=1,w=700){font(g,w,size);revealText(g,s,x,y,size,p)}
export function render(g,t){g.reset();g.fillStyle=paper;g.fillRect(0,0,1280,720);let opening=seg(t,0,4),clear=snap(t,7,.8),spread=snap(t,10,.75),settle=snap(t,13,.75);g.fillStyle=ink;text(g,'room',64,172,145,snap(t,1,.5));text(g,'to breathe.',64,316,145,snap(t,2,.5));
const shift=snap(t,5,.5);g.fillStyle=paper;g.fillRect(0,0,1280,380*shift);if(shift>0){g.fillStyle=ink;text(g,'less.',64,238,220,shift*(1-settle));text(g,'but better.',64,646,110,settle)}
// 48 pieces occupy a page. A single red element creates a useful empty centre.
for(let r=0;r<6;r++)for(let c=0;c<8;c++){let i=r*8+c,arr=snap(t,2.5+i*.0625,.125);if(!arr)continue;let x=660+c*58,y=150+r*58;const dx=c-3.5,dy=r-2.5,dist=Math.hypot(dx,dy),out=snap(t,6+dist*.17,.35);x+=Math.sign(dx)*out*(90+spread*110);y+=Math.sign(dy)*out*(38+spread*60);const vanish=snap(t,12+dist*.06,.25);g.fillStyle=i%5===0?'#b6b5ae':ink;g.fillRect(x,y,46*arr,46*(1-vanish));}
let cx=lerp(890,915,spread),cy=lerp(325,309,spread),rr=lerp(25,132,clear);g.fillStyle=red;g.beginPath();g.arc(cx,cy,rr*snap(t,4,.5),0,7);g.fill();
if(t>12){g.save();g.beginPath();g.rect(760,158,340,310);g.clip();g.fillStyle=paper;text(g,'air',785,373,170,snap(t,13,.5),800);g.restore()}
g.fillStyle=ink;g.fillRect(64,674,1152,2);font(g,500,15);g.fillText('A STUDY IN SPACE',64,699);g.fillText('01—48 / ONE EXCEPTION',960,699);
}
export const audioWav=makeScore({notes:[57,60,64,67,69,67,64,60],root:33,step:.5,pulse:true,cues:[1,2,4,5,7,10,13],seed:17});
