// Original primitives. No reference implementation or scene assets imported.
export const W=1280,H=720,TAU=Math.PI*2;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,p)=>a+(b-a)*p;
export const prog=(t,a,b)=>clamp((t-a)/(b-a));
export const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
export const phase=(t,a,b)=>ease(prog(t,a,b));
export const fract=x=>x-Math.floor(x);
export const hash=x=>fract(Math.sin(x*42.713+6.18)*19643.137);
export const arrive=(t,a,d=1)=>{const q=prog(t,a,a+d);return q===1?1:1-Math.exp(-7*q)*Math.cos(10*q)};
export function rgba(c,a){const n=parseInt(c.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
export function color(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);return '#'+[16,8,0].map(k=>Math.round(mix(A>>k&255,B>>k&255,t)).toString(16).padStart(2,'0')).join('')}
export function rect(g,x,y,w,h,c,r=0){g.fillStyle=c;g.beginPath();g.roundRect(x,y,w,h,Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2)));g.fill()}
export function ellipse(g,x,y,rx,ry,c,rot=0){if(rx<=0||ry<=0)return;g.beginPath();g.ellipse(x,y,rx,ry,rot,0,TAU);if(c){g.fillStyle=c;g.fill()}}
export const disc=(g,x,y,r,c)=>ellipse(g,x,y,r,r,c);
export function line(g,pts,c='#243f42',w=3,close=false){if(!pts.length)return;g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);if(close)g.closePath();g.lineWidth=w;g.strokeStyle=c;g.lineCap='round';g.lineJoin='round';g.stroke()}
export function poly(g,pts,c,stroke=null,w=2){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();if(c){g.fillStyle=c;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke()}}
export function text(g,s,x,y,size=26,c='#243f42',align='left',font='Noto Sans SC',weight=600){g.font=`${weight} ${size}px "${font}",sans-serif`;g.textAlign=align;g.textBaseline='alphabetic';g.fillStyle=c;g.fillText(s,x,y)}
export function fitText(g,s,x,y,size,maxw,c,align='left'){g.font=`600 ${size}px "Noto Sans SC"`;const k=Math.min(1,maxw/g.measureText(s).width);text(g,s,x,y,size*k,c,align)}
export function withX(g,x,y,s,r,fn){g.save();g.translate(x,y);g.rotate(r);g.scale(s,s);fn();g.restore()}
export function alpha(g,a,fn){g.save();g.globalAlpha*=clamp(a);fn();g.restore()}
export function clip(g,fn,draw){g.save();g.beginPath();fn();g.clip();draw();g.restore()}
export function radial(g,x,y,r,c,a=.4){const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,rgba(c,a));q.addColorStop(1,rgba(c,0));rect(g,x-r,y-r,2*r,2*r,q)}
export function gradient(g,x,y,w,h,colors){const q=g.createLinearGradient(x,y,x+w,y+h);colors.forEach((c,i)=>q.addColorStop(i/(colors.length-1),c));return q}
const paperCache=new Map();
export function paper(g,bg='#f4eddf',seed=1){let c=paperCache.get(bg+seed);if(!c){c=document.createElement('canvas');c.width=1280;c.height=720;const k=c.getContext('2d');rect(k,0,0,W,H,bg);for(let i=0;i<11500;i++){const x=hash(i+seed*233)*W,y=hash(i*3.7+seed)*H;k.fillStyle=i%2?'#ffffff25':'#4a39210a';k.fillRect(x,y,.6+hash(i*4)*1.2,hash(i*8)*3+.3)}paperCache.set(bg+seed,c)}g.drawImage(c,0,0)}
export function grain(g,seed=1,a=.12){g.save();g.globalAlpha=a;for(let i=0;i<900;i++){const x=hash(i+seed)*W,y=hash(i*7+seed)*H;rect(g,x,y,1.5,hash(i*3)*3+.5,i%2?'#fff':'#121919')}g.restore()}
export function grid(g,c,step=40,a=.1){g.save();g.globalAlpha=a;for(let x=0;x<W;x+=step)line(g,[[x,0],[x,H]],c,1);for(let y=0;y<H;y+=step)line(g,[[0,y],[W,y]],c,1);g.restore()}
export function arcPts(x,y,rx,ry,a=0,b=TAU,n=80){return Array.from({length:n+1},(_,i)=>[x+Math.cos(mix(a,b,i/n))*rx,y+Math.sin(mix(a,b,i/n))*ry])}
export function pathPart(pts,u){if(u<=0)return[];if(u>=1)return pts;let ls=[0];for(let i=1;i<pts.length;i++)ls.push(ls.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));let target=ls.at(-1)*u,out=[pts[0]];for(let i=1;i<pts.length;i++){if(ls[i]<=target)out.push(pts[i]);else{const k=(target-ls[i-1])/(ls[i]-ls[i-1]||1);out.push([mix(pts[i-1][0],pts[i][0],k),mix(pts[i-1][1],pts[i][1],k)]);break}}return out}
export function drawPath(g,pts,u,c,w=3,nib=false){const p=pathPart(pts,clamp(u));line(g,p,c,w);if(nib&&p.length)disc(g,...p.at(-1),w*1.5,c)}
export function curve(a,b,c,d,n=60){return Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return [0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k])})}
export function arrow(g,a,b,c,w=3){line(g,[a,b],c,w);const ang=Math.atan2(b[1]-a[1],b[0]-a[0]);line(g,[[b[0]-14*Math.cos(ang-.5),b[1]-14*Math.sin(ang-.5)],b,[b[0]-14*Math.cos(ang+.5),b[1]-14*Math.sin(ang+.5)]],c,w)}
export function rough(pts,seed=1,amount=2){return pts.map((p,i)=>[p[0]+(hash(i*2+seed)-.5)*amount,p[1]+(hash(i*2+1+seed)-.5)*amount])}
export function brush(g,pts,c,width=10,u=1,seed=1,wet=.3){const p=pathPart(pts,u);if(p.length<2)return;g.save();for(let j=0;j<8;j++){g.globalAlpha=wet/8;line(g,rough(p,seed+j,width*.18),c,width*(1+j*.05))}g.globalAlpha=.3;for(let j=0;j<6;j++){line(g,p.map((q,i)=>[q[0]+(j-3)*width*.14,q[1]+Math.sin(i*.3+seed)*1.5]),c,.5+hash(j+seed)*1.8)}g.restore()}
export function wash(g,pts,c,a=.2,seed=1){g.save();g.globalCompositeOperation='multiply';for(let i=0;i<5;i++){g.globalAlpha=a/3;poly(g,rough(pts,seed+i,5+i*2),c)}g.restore()}
export function hatch(g,pts,c,spacing=8,angle=-.7){clip(g,()=>{pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath()},()=>{g.save();g.translate(640,360);g.rotate(angle);for(let y=-900;y<900;y+=spacing)line(g,[[-1400,y],[1400,y]],c,1);g.restore()})}
export function star(g,x,y,r,c,n=5,rot=0){poly(g,Array.from({length:n*2},(_,i)=>{const a=rot+i*Math.PI/n-Math.PI/2,rr=r*(i%2?.43:1);return[x+Math.cos(a)*rr,y+Math.sin(a)*rr]}),c)}
export function eyes(g,x,y,t,look=0,c='#20383b',scale=1){const blink=Math.abs((t%4.6)-4.3)<.08;for(const s of[-1,1])ellipse(g,x+s*13*scale+look,y,3*scale,(blink?.65:4)*scale,c)}
export function shadow(g,x,y,w,a=.15){ellipse(g,x,y,w,w*.12,`rgba(10,20,30,${a})`)}
export function ring(g,x,y,r,c,w=2){line(g,arcPts(x,y,r,r),c,w)}
// Orthographic scene geometry, independent of any source implementation.
export function project(p,view={}){const a=view.yaw??-.65,b=view.pitch??.62,s=view.scale??1;const X=p[0]*Math.cos(a)+p[2]*Math.sin(a),Z=-p[0]*Math.sin(a)+p[2]*Math.cos(a);return[(view.x??640)+X*s,(view.y??430)+(Z*Math.sin(b)-p[1]*Math.cos(b))*s,Z*Math.cos(b)+p[1]*Math.sin(b)]}
export function box(g,x,y,z,w,h,d,c,view={}){const V=[[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]].map(p=>project(p,view));const faces=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].map((f,i)=>({f,i,depth:f.reduce((s,j)=>s+V[j][2],0)/4})).sort((a,b)=>a.depth-b.depth);for(const {f,i} of faces)poly(g,f.map(j=>V[j].slice(0,2)),color(c,i===4?'#ffffff':'#15252c',i===4?.14:[.22,.1,.35,.27][i]))}
export function dimension(g,a,b,label,c='#b9e4ec'){line(g,[a,b],c,1.3);for(const p of[a,b])line(g,[[p[0]-5,p[1]-7],[p[0]+5,p[1]+7]],c,1.3);text(g,label,(a[0]+b[0])/2+12,(a[1]+b[1])/2-9,19,c)}
export function footer(g,s,t,dark=false){const c=dark?'#e9e7de':'#243c3b';alpha(g,Math.min(1,t*2),()=>{fitText(g,s,640,670,26,1120,c,'center')})}
export function score(duration=24,seed=1){const rate=24000,n=rate*duration,b=new ArrayBuffer(44+n*2),v=new DataView(b);const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);const notes=[0,3,7,10,12,7,3,5];for(let i=0;i<n;i++){const t=i/rate,beat=Math.floor(t/.6),age=t% .6,f=220*2**((notes[(beat+seed)%8]+seed%5)/12);let x=(Math.sin(TAU*f*age)+.25*Math.sin(TAU*f*2.003*age))*Math.exp(-age*6)*.09*Math.min(age*60,1);x+=.025*Math.sin(TAU*55*t)*Math.min(1,t)*Math.min(1,duration-t);x*=Math.min(1,(duration-t)/1.2);v.setInt16(44+i*2,clamp(x,-1,1)*32760,true)}const bytes=new Uint8Array(b);let s='';for(let i=0;i<bytes.length;i+=16000)s+=String.fromCharCode(...bytes.subarray(i,i+16000));return btoa(s)}
