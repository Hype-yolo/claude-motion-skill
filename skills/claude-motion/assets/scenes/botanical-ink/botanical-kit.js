import rough from './rough.esm.js';
export const palette={paper:'#eee8db',ink:'#283e36',sage:'#899b7b',rust:'#b76346',pale:'#d8ddc5'};
export const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function makeDrawing(canvas){
 const ctx=canvas.getContext('2d'),rc=rough.canvas(canvas);let calls=0;
 const line=(a,b,seed=1,w=.8,color=palette.ink)=>{calls++;rc.line(...a,...b,{seed,roughness:.48,bowing:.5,stroke:color,strokeWidth:w})};
 const path=(d,seed=1,options={})=>{calls++;rc.path(d,{seed,roughness:.34,stroke:palette.ink,strokeWidth:.85,...options})};
 function leaf(x,y,length,angle,seed=1,filled=true){ctx.save();ctx.translate(x,y);ctx.rotate(angle);const width=length*.22;
  path(`M0 0 C${-width} ${-length*.25} ${-width} ${-length*.8} 0 ${-length} C${width*.8} ${-length*.8} ${width*1.2} ${-length*.28} 0 0`,seed,{fill:filled?palette.sage:undefined,fillStyle:'hachure',hachureGap:3,fillWeight:.55,roughness:.34});
  path(`M0 0 Q${length*.035} ${-length*.5} 0 ${-length}`,seed+1);
  for(let i=1;i<9;i++){const p=i/10,wide=Math.sin(p*Math.PI)*width*.81;line([0,-length*p],[wide,-length*p-length*.07],seed+i*7,.5);line([0,-length*p],[-wide,-length*p-length*.07],seed+i*11,.5)}ctx.restore();
 }
 function seed(x,y,scale=1,angle=0,id=1,{canopyOpacity=1}={}){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  path('M0 15 C-4 23 -3 33 0 37 C4 29 3 20 0 15',id,{fill:palette.rust,fillStyle:'solid',strokeWidth:.6});
  ctx.globalAlpha*=canopyOpacity;line([0,17],[0,-12],id+2,.6);
  for(let i=0;i<22;i++){let a=Math.PI+Math.PI*i/21,px=Math.cos(a)*24,py=-12+Math.sin(a)*18;path(`M0 -10 Q${px*.4} ${py-3} ${px} ${py}`,id+10+i,{strokeWidth:.48,roughness:.35});line([px,py],[px-2,py-3],id+90+i,.42)}ctx.restore();
 }
 function toothedLeaf(x,y,length,angle,seed){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);let outline='M0 0';
  const lobes=[];for(let i=1;i<=6;i++){const u=i/8,w=Math.sin(u*Math.PI)*length*.14,y=-u*length;lobes.push({u,w,y});outline+=` Q${-w*.32} ${y+length*.075} ${-w} ${y+length*.034} Q${-w*.94} ${y-length*.018} ${-w*.26} ${y-length*.022}`}
  outline+=` Q${-length*.037} ${-length*.86} 0 ${-length}`;
  for(let i=lobes.length-1;i>=0;i--){const {w,y}=lobes[i];outline+=` Q${w*.27} ${y-length*.02} ${w*.93} ${y+length*.028} Q${w*.49} ${y+length*.061} ${w*.20} ${y+length*.08}`}outline+=' Q2 -5 0 0 Z';
  path(outline,seed,{fill:'#c3c9a8',fillStyle:'solid',strokeWidth:.65,roughness:.23,stroke:'#728265'});
  path(outline,seed+1,{fill:'#869679',fillStyle:'hachure',hachureGap:4.5,fillWeight:.3,stroke:'none',roughness:.2});
  path(`M0 0 Q${length*.018} ${-length*.55} 0 ${-length*.96}`,seed+100,{strokeWidth:.7,roughness:.18,stroke:'#687e5e'});
  for(let i=0;i<lobes.length;i++){const {w,y}=lobes[i];line([0,y+length*.015],[-w*.8,y+length*.033],seed+i,.4,'#7c8b70');line([0,y+length*.015],[w*.8,y+length*.033],seed+i+20,.4,'#7c8b70')}ctx.restore();
 }
 function dandelion(x,y,r=82,t=0){ctx.save();ctx.translate(x,y);const wobble=Math.sin(t*.9)*.018;ctx.rotate(wobble);
  // Organic stalk and toothed rosette, not a circle on a rectangle.
  path('M-3 243 C5 149 8 74 0 0 M3 244 C12 146 12 74 5 0',43,{strokeWidth:1.4});
  for(const [a,l,h]of[[-1.15,100,226],[-.72,135,226],[.67,143,231],[1.3,92,225]])toothedLeaf(0,h,l,a,100+Math.round(l));
  rc.ellipse(0,0,24,17,{seed:56,fill:palette.ink,fillStyle:'solid',stroke:'none'});
  for(let i=0;i<66;i++){const a=i*2.399963,rad=r*Math.sqrt((i+.5)/66),px=Math.cos(a)*rad,py=Math.sin(a)*rad;ctx.save();ctx.translate(px,py);let ang=Math.atan2(py,px)+Math.PI/2;ctx.rotate(ang);line([0,0],[0,Math.max(5,rad*.45)],i+200,.55);for(let k=0;k<7;k++){const aa=Math.PI+Math.PI*k/6;line([0,0],[Math.cos(aa)*11,Math.sin(aa)*9],i*7+k+1200,.38)}ctx.restore();}
  // A radial scaffold connects every fine parachute back to the receptacle.
  for(let i=0;i<44;i++){const a=i*Math.PI*2/44;line([Math.cos(a)*9,Math.sin(a)*6],[Math.cos(a)*r*.89,Math.sin(a)*r*.89],700+i,.35,'#71826b')}ctx.restore();
 }
 function paper(){ctx.fillStyle=palette.paper;ctx.fillRect(0,0,canvas.width,canvas.height);let s=927;for(let i=0;i<42000;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;const x=s%canvas.width;s=(Math.imul(s,1664525)+1013904223)>>>0;const y=s%canvas.height;ctx.fillStyle=i%3?'rgba(67,53,32,.022)':'rgba(255,255,255,.18)';ctx.fillRect(x,y,1,1)}}
 return {ctx,rc,line,path,leaf,seed,toothedLeaf,dandelion,paper,get calls(){return calls}};
}
