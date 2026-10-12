import{FRAMES,hash}from'./birds.js';export const width=1280,height=720,duration=18;
const low=document.createElement('canvas');low.width=320;low.height=180;const c=low.getContext('2d');const smooth=(a,b,t)=>{let x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x)};
function twig(x,y,a=0,col='#9c714f',len=21){c.save();c.translate(x,y);c.rotate(a);c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(-len/2,0);c.lineTo(len/2,0);c.stroke();c.lineWidth=1;c.beginPath();c.moveTo(2,0);c.lineTo(6,-4);c.stroke();c.restore()}
function bird(x,y,t,pal,carrying=false,feather=false){let frame=FRAMES[pal][Math.sin(t*9)>.25?'SQUASH':'STAND'];c.drawImage(frame.c,Math.round(x-16),Math.round(y-frame.h));if(carrying){if(feather){c.fillStyle='#e6d6b6';for(let i=0;i<12;i++){c.fillRect(x+4+i,y-13-Math.floor(Math.sin(i/12*Math.PI)*3),1,4)}c.strokeStyle='#a88662';c.beginPath();c.moveTo(x+3,y-10);c.lineTo(x+17,y-10);c.stroke()}else twig(x+8,y-11,-.12,'#b58a59',18)}}
export function render(g,t){c.clearRect(0,0,320,180);const gr=c.createLinearGradient(0,0,0,180);gr.addColorStop(0,'#73988f');gr.addColorStop(.7,'#c4cbb0');gr.addColorStop(1,'#5d8062');c.fillStyle=gr;c.fillRect(0,0,320,180);c.fillStyle='#cfd0ab';c.fillRect(14,19,27,11);c.fillRect(23,13,16,21);
 for(let j=0;j<8;j++){const x=10+j*45;c.fillStyle=j%2?'#577a68':'#60846b';c.fillRect(x,34+j%3*7,5,114);for(let i=0;i<24;i++){const px=x+Math.round((hash(j,i,1)-.5)*49),py=25+Math.round(hash(i,j,2)*68);c.fillRect(px,py,8+Math.floor(hash(i,2,3)*10),4)}}
 c.fillStyle='#536e51';c.fillRect(0,132,320,48);c.fillStyle='#72865d';for(let i=0;i<450;i++)c.fillRect(Math.floor(hash(i,4,3)*320),135+Math.floor(hash(i,8,1)*45),2,1);
 c.fillStyle='#78573e';c.fillRect(206,113,64,42);c.fillStyle='#ae8a5e';c.fillRect(201,106,74,9);c.fillStyle='#4e4536';c.fillRect(208,114,2,40);c.fillRect(263,114,2,40);
 for(let i=0;i<20;i++){const visible=i<6+Math.floor(smooth(3,13,t)*14);if(visible)twig(229+(hash(i,1,3)-.5)*27,106+(hash(i,3,8)-.5)*7,(i%2?1:-1)*.5,'#a77b4f',23)}
 const u1=smooth(0,5,t),u2=smooth(3,9,t),x1=50+160*u1,x2=300-62*u2;const weave=smooth(5,6,t)*(1-smooth(11,12,t));bird(x1,132-26*u1-Math.abs(Math.sin(t*5))*2,t,0,t<5);bird(x2,137-31*u2-Math.abs(Math.sin(t*4))*2,t+.2,2,t<9);
 if(t>=5&&t<12){twig(221,107,(t-5)*.25,'#c29b68',19)}
 if(t>12){const u3=smooth(12,16,t);bird(318-57*u3,140-34*u3-Math.abs(Math.sin(t*5))*2,t,4,t<16,true);if(t>=16){c.fillStyle='#e6d6b6';for(let i=0;i<17;i++)c.fillRect(223+i,103-Math.floor(Math.sin(i/17*Math.PI)*3),1,4)}}
 g.imageSmoothingEnabled=false;g.drawImage(low,0,0,1280,720);
}
