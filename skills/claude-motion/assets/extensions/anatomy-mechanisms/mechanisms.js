// Canvas bridge for wheresryan22/anatomy. Upstream geometry is kept unchanged.
import * as k from './vendor/iso-kit.mjs';
export { k };
export const materials = {
  brass: {top:'#d8bb76',sides:['#6a5032','#967241','#ba9357','#ceb375'],edge:'#554c39',shine:'#f7e6ba'},
  steel: {top:'#cbd5d2',sides:['#455d5e','#627a7b','#8fa5a3','#b7c6c2'],edge:'#304c4d',shine:'#eaf4eb'},
  enamel: {top:'#315b5c',sides:['#122d32','#1b3e42','#214b4e','#386264'],edge:'#0c2327',shine:'#81a19b'},
  paper: {top:'#f2e9d5',sides:['#ad9d7e','#c4b697','#e0d3b6','#e9dec6'],edge:'#a8997e',shine:'#fff9e9'},
  walnut: {top:'#765541',sides:['#352e28','#48392f','#5d4536','#70523f'],edge:'#282a27',shine:'#a88461'},
};
export function path(ctx,d,{fill,stroke,width=1,alpha=1}={}){
  if(!d)return;ctx.save();ctx.globalAlpha*=alpha;const p=new Path2D(d);
  if(fill){ctx.fillStyle=fill;ctx.fill(p)}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke(p)}ctx.restore();
}
export function solid(ctx,geometry,material=materials.brass,{width=.85,detail=true}={}){
  path(ctx,geometry.fill,{fill:material.sides[1]});
  geometry.shades.forEach((d,i)=>path(ctx,d,{fill:material.sides[i]}));
  path(ctx,geometry.top,{fill:material.top});
  path(ctx,geometry.outline,{stroke:material.edge,width});
  if(detail){path(ctx,geometry.crease,{stroke:material.edge,width:width*.65,alpha:.4});path(ctx,geometry.bevel,{stroke:material.shine,width:width*.8,alpha:.75});}
}
export function gearRing(cx,cy,pitch,teeth,angle=0){
  const out=[];const module=2*pitch/teeth;
  for(let i=0;i<teeth;i++)for(const [phase,r]of [[-.48,pitch-1.15*module],[-.28,pitch-1.15*module],[-.16,pitch+module],[.16,pitch+module],[.28,pitch-1.15*module],[.48,pitch-1.15*module]]){
    const a=angle+(i+phase)*Math.PI*2/teeth;out.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);
  }return out;
}
export function gear(ctx,{x=0,y=0,z=0,radius=30,teeth=24,angle=0,height=4,projection,material=materials.brass}){
  const points=gearRing(x,y,radius,teeth,angle);
  solid(ctx,k.extrude(points,z,height,projection,{convex:false}),material);
  path(ctx,k.ring(x,y,radius*.66,z+height+.1,projection),{stroke:material.edge,width:.75,alpha:.55});
  for(let i=0;i<5;i++){const a=angle+i*Math.PI*2/5;const p1=[x+Math.cos(a)*radius*.2,y+Math.sin(a)*radius*.2],p2=[x+Math.cos(a)*radius*.58,y+Math.sin(a)*radius*.58];path(ctx,k.lineOnTop(p1,p2,z+height+.15,projection),{stroke:material.edge,width:2,alpha:.45});}
  solid(ctx,k.cylinder(x,y,radius*.18,z+height,3,projection,24,.6),material);
}
export function screw(ctx,x,y,z,projection,r=1.7){
  solid(ctx,k.cylinder(x,y,r,z,.8,projection,16,.2),materials.steel,{width:.5});
  path(ctx,k.lineOnTop([x-r*.7,y],[x+r*.7,y],z+.85,projection),{stroke:'#334449',width:.8});
}
export function boltPlate(ctx,plan,z,height,projection,material=materials.enamel){
  solid(ctx,k.slabOf(plan,z,height,projection,10,1),material);
  k.corners(plan,6).forEach(([x,y])=>screw(ctx,x,y,z+height,projection));
}
