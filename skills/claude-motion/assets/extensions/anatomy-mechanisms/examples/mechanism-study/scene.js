import {k,materials,solid,gear,boltPlate} from './mechanisms.js';
export const width=1280,height=720,duration=6;
export function render(ctx,t){
 ctx.fillStyle='#e8e4d8';ctx.fillRect(0,0,width,height);
 const P={origin:[640,480],scale:3,azimuth:37,elevation:34};
 boltPlate(ctx,{x:-95,y:-56,w:190,d:112,r:10},-12,12,P,materials.walnut);
 for(const x of [-34,26])solid(ctx,k.cylinder(x,0,8,0,36,P,32,1),materials.enamel);
 gear(ctx,{x:-34,y:0,z:32,radius:24,teeth:24,angle:t,projection:P});
 gear(ctx,{x:26,y:0,z:32,radius:36,teeth:36,angle:-t*24/36+Math.PI/36,projection:P});
 for(const x of [-34,26])solid(ctx,k.cylinder(x,0,3,39,8,P,32,.5),materials.steel);
}
