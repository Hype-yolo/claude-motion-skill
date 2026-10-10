// Original time/spatial primitives; no scene or story templates.
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,u)=>a+(b-a)*u;
export function progress(t,start,end){if(!(end>start))throw Error('end must exceed start');return clamp((t-start)/(end-start));}
export const ease=u=>{u=clamp(u);return u*u*(3-2*u);};
export function track(t,keys,curve=ease){if(!keys.length)throw Error('empty track');for(let i=1;i<keys.length;i++){if(!(keys[i][0]>keys[i-1][0]))throw Error('keys must increase');}if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=curve(progress(t,a[0],b[0]));return Array.isArray(a[1])?a[1].map((v,j)=>lerp(v,b[1][j],u)):lerp(a[1],b[1],u);}}return keys.at(-1)[1];}
export function impulse(t,events,decay=8){return events.reduce((s,[at,amp])=>s+(t>=at?amp*Math.exp(-decay*(t-at)):0),0);}
export function settle(t,at,{amplitude=1,frequency=3,damping=5,duration=2}={}){const d=t-at;if(d<=0||d>=duration)return 0;return amplitude*Math.sin(d*frequency*Math.PI*2)*Math.exp(-d*damping)*(1-ease(progress(d,duration*.75,duration)));}
export function camera2D(g,{x=640,y=360,zoom=1,rotation=0,width=1280,height=720}={},draw){g.save();g.translate(width/2,height/2);g.rotate(rotation);g.scale(zoom,zoom);g.translate(-x,-y);try{draw();}finally{g.restore();}}
// World y points upward; forward is camera-local +z; returns null behind near plane.
export function perspective(p,{eye=[0,0,-500],target=[0,0,0],focal=700,cx=640,cy=360,near=1}={}){const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const n=Math.hypot(...a);if(n<1e-8)throw Error('invalid camera basis');return a.map(v=>v/n);};const f=norm(sub(target,eye)),up=Math.abs(f[1])>.999?[0,0,1]:[0,1,0],r=norm(cross(up,f)),u=cross(f,r),d=sub(p,eye),z=dot(d,f);return z<=near?null:{x:cx+focal*dot(d,r)/z,y:cy-focal*dot(d,u)/z,depth:z,scale:focal/z};}
export function drawDepth(g,items,view){items.map(item=>({item,p:perspective(item.position,view)})).filter(x=>x.p).sort((a,b)=>b.p.depth-a.p.depth).forEach(({item,p})=>item.draw(g,p));}
export function hinge(point,origin,axis,angle){const len=Math.hypot(...axis);if(!len)throw Error('zero hinge axis');const a=axis.map(v=>v/len),p=point.map((v,i)=>v-origin[i]),c=Math.cos(angle),s=Math.sin(angle),d=p.reduce((v,n,i)=>v+n*a[i],0),cross=[a[1]*p[2]-a[2]*p[1],a[2]*p[0]-a[0]*p[2],a[0]*p[1]-a[1]*p[0]];return p.map((v,i)=>origin[i]+v*c+cross[i]*s+a[i]*d*(1-c));}
