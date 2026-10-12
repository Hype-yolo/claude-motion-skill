import {makeDrawing,palette,ease} from './botanical-kit.js';
import {makeScore} from './score.js';
const audioWav=makeScore({duration:18});
const canvas=document.querySelector('#frame'),d=makeDrawing(canvas),g=d.ctx;
const mix=(a,b,u)=>a+(b-a)*u,soft=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10)};
const background=document.createElement('canvas');background.width=1280;background.height=720;const bg=makeDrawing(background);bg.paper();
bg.ctx.globalAlpha=.16;bg.rc.circle(1000,206,176,{seed:319,fill:'#c68b64',fillStyle:'hachure',hachureAngle:0,hachureGap:2.8,stroke:'none',fillWeight:.45});bg.ctx.globalAlpha=1;
bg.path('M62 614 C223 603 425 620 609 612 Q815 608 990 612 Q1100 615 1218 611',321,{strokeWidth:.8,roughness:.2});
for(let i=0;i<115;i++){const x=72+i*10,y=626+(i*19%39);bg.line([x,y],[x+3+(i%3)*2,y+2],333+i,.3,'#a5a18c')}
for(const [x,l]of[[146,12],[454,15],[1142,11]])bg.path(`M${x} 612 q-3 -${l} -8 -${l+4} M${x} 612 q4 -${l-2} 8 -${l+1}`,420+x,{strokeWidth:.55});
const headCanvas=document.createElement('canvas');headCanvas.width=headCanvas.height=250;const hd=makeDrawing(headCanvas);hd.ctx.translate(125,125);
// Delicate radial florets, with a reserved socket for the persistent hero seed.
for(let i=0;i<96;i++){
 const a=i*2.399963,r=86*Math.sqrt((i+.5)/96),x=Math.cos(a)*r,y=Math.sin(a)*r;
 if(x>35&&y< -20&&y> -65)continue;
 hd.line([Math.cos(a)*8,Math.sin(a)*6],[x,y],700+i,.29,'#9ca48c');
 hd.ctx.save();hd.ctx.translate(x,y);hd.ctx.rotate(a+Math.PI/2);
 for(let k=0;k<9;k++){const aa=Math.PI+Math.PI*k/8;hd.path(`M0 0 Q${Math.cos(aa)*5} ${Math.sin(aa)*6-2} ${Math.cos(aa)*10} ${Math.sin(aa)*11}`,i*11+k+1200,{strokeWidth:.30,roughness:.26,stroke:'#566a58'})}hd.ctx.restore();
}
hd.rc.ellipse(0,1,15,11,{seed:56,fill:'#829078',fillStyle:'hachure',hachureGap:1.5,stroke:'#66785f',strokeWidth:.5});
const plantBase=document.createElement('canvas');plantBase.width=420;plantBase.height=230;const bd=makeDrawing(plantBase);
for(const [l,a,seed]of[[130,-1.17,182],[149,-.71,184],[143,.69,186],[116,1.19,188]])bd.toothedLeaf(200,202,l,a,seed);
function headAt(t){const wind=soft((t-1.8)/2)*(1-soft((t-10.5)/3));return [295+6*Math.sin(t*.9)*wind,326+1.4*Math.sin(t*.7)*wind]}
const depart=3.8,arrival=12.8,headStart=headAt(depart),angleStart=.92,seedScale=.78;
const startOrigin=[headStart[0]+58,headStart[1]-43],startTip=[startOrigin[0]-37*seedScale*Math.sin(angleStart),startOrigin[1]+37*seedScale*Math.cos(angleStart)];
function render(t){
 g.resetTransform();g.clearRect(0,0,1280,720);g.drawImage(background,0,0);
 const [hx,hy]=headAt(t),wind=soft((t-1.8)/2)*(1-soft((t-10.5)/3));
 // The root is stationary. Only the stem's upper control points move in the gust.
 d.path(`M292 612 C306 509 ${hx+11} 422 ${hx+2} ${hy+7} L${hx-1} ${hy+7} C${hx+4} 423 300 511 288 612 Z`,43,{fill:'#c1c6a6',fillStyle:'solid',strokeWidth:.7,roughness:.25});
 g.drawImage(plantBase,90,410);g.drawImage(headCanvas,hx-125,hy-125);
 const u=soft((t-depart)/(arrival-depart));let tip,angle;
 if(t<depart){const origin=[hx+58,hy-43];angle=angleStart;tip=[origin[0]-37*seedScale*Math.sin(angle),origin[1]+37*seedScale*Math.cos(angle)]}
 else{tip=[mix(startTip[0],990,u),mix(startTip[1],612,u)-220*Math.sin(Math.PI*u)];angle=mix(angleStart,.12,soft(u/.23))+.10*Math.sin(t*1.25)*Math.sin(Math.PI*u)}
 const origin=[tip[0]+37*seedScale*Math.sin(angle),tip[1]-37*seedScale*Math.cos(angle)];
 g.save();g.globalAlpha=.13*soft((u-.55)/.45);g.fillStyle='#777962';g.beginPath();g.ellipse(tip[0],614,13-6*u,1.5,0,0,7);g.fill();g.restore();
 d.seed(origin[0],origin[1],seedScale,angle,281,{canopyOpacity:1-.82*soft((t-14)/3)});
 // Air traces follow travel and disappear before contact; no extra seeds pop into view.
 g.globalAlpha=.11*wind;for(let i=0;i<2;i++)d.path(`M446 ${378+i*41} C590 ${315+i*41} 686 ${343+i*41} 789 ${321+i*41}`,810+i,{strokeWidth:.5,roughness:.3,stroke:'#8c987d'});g.globalAlpha=1;
 const grow=soft((t-14.1)/3.65),height=78*grow;
 if(grow>0){
  d.path(`M990 612 C${990-12*grow} ${612-height*.42} ${990+13*grow} ${612-height*.75} ${990+3*grow} ${612-height}`,900,{strokeWidth:1.25,stroke:'#536e4f',roughness:.25});
  // Leaves share the growing stem's Bezier nodes, then unfurl around their petioles.
  function node(u){const v=1-u;return [v*v*v*990+3*v*v*u*(990-12*grow)+3*v*u*u*(990+13*grow)+u*u*u*(990+3*grow),v*v*v*612+3*v*v*u*(612-height*.42)+3*v*u*u*(612-height*.75)+u*u*u*(612-height)]}
  for(const [p,sign,l,id]of[[.54,-1,37,902],[.78,1,43,904]]){const [x,y]=node(p),unfurl=soft((grow-.1)/.8);g.save();g.translate(x,y);g.rotate(sign*(.15+.88*unfurl));g.scale(unfurl,unfurl);d.leaf(0,0,l,0,id);g.restore()}
 }
 window.LIBRARY_AUDIT={revision:2,renderer:'RoughJS 4.6.6',phase:t<depart?'attached':t<arrival?'drift':t<14.1?'land':'sprout',seedTip:tip,seedOrigin:origin,root:[990,612],growth:grow,landingError:t>=arrival?Math.hypot(tip[0]-990,tip[1]-612):null,plantRoot:[290,612]};
}
Object.assign(window,{READY:true,DUR:18,CAPTURE:canvas,render,audioWav});render(0);
