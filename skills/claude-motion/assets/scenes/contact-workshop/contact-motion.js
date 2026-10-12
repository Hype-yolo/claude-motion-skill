// Project-authored MIT module. Analytical planar two-link IK, not learned motion.
export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
export function solveTwoLink(base,target,l1,l2,bend=1){
 const x=target[0]-base[0],y=target[1]-base[1],raw=Math.hypot(x,y),d=Math.max(Math.abs(l1-l2)+1e-7,Math.min(l1+l2-1e-7,raw));
 const a=Math.atan2(y,x)+bend*Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));
 const b=-bend*Math.acos(Math.max(-1,Math.min(1,(d*d-l1*l1-l2*l2)/(2*l1*l2))));
 const elbow=[base[0]+l1*Math.cos(a),base[1]+l1*Math.sin(a)];
 const tip=[elbow[0]+l2*Math.cos(a+b),elbow[1]+l2*Math.sin(a+b)];
 return {shoulder:a,elbow:b,elbowPoint:elbow,tip,error:Math.hypot(tip[0]-target[0],tip[1]-target[1]),reachable:raw<=l1+l2&&raw>=Math.abs(l1-l2)};
}
export function track(t,keys){
 if(t<=keys[0][0])return keys[0][1].slice();for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=ease((t-a[0])/(b[0]-a[0]));return a[1].map((v,j)=>v+(b[1][j]-v)*u)}return keys.at(-1)[1].slice();
}
export function pickPlace(t,{home,pick,place,lift=1.5}){
 const target=track(t,[[0,home],[1.2,home],[3,[pick[0],pick[1]+.95]],[4.3,pick],[5.2,pick],[7.1,[pick[0],pick[1]+lift]],[9.3,[place[0],pick[1]+lift]],[10.9,place],[12,place],[13.8,[place[0],pick[1]+lift]],[15.5,home],[18,home]]);
 const grip=t<4.3?0:t<5.2?ease((t-4.3)/.9):t<11.15?1:t<12?1-ease((t-11.15)/.85):0;
 const phase=t<5.2?'approach':t<10.9?'carry':'placed';
 const object=phase==='approach'?pick.slice():phase==='carry'?target.slice():place.slice();
 return {target,grip,object,phase};
}
