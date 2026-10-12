// Faithful JS port of MIT people.rs JOINTS, joints(), stride(), sagittal leg geometry.
export const JOINTS=[[30,5,0],[27,12,-4],[24,18,-3],[19,16,2],[14,11,5],[8,7,7],[3,5,9],[-2,4,10],[-7,6,9],[-11,9,6],[-12,17,0],[-9,32,-12],[-2,48,-14],[7,60,-8],[15,63,-3],[22,58,0],[27,46,1],[30,30,1],[31,15,0],[31,7,0]];
export const THIGH=22.5,SHIN=21.5,PELVIS=9,ARM_SWING=18,ARM_LAG=.05;
export function joints(phase){const f=((phase%1)+1)%1*20,i=Math.floor(f),t=f-i,p=k=>JOINTS[(i+k+20)%20];const cr=(a,b,c,d)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);return[0,1,2].map(k=>(cr(p(-1)[k],p(0)[k],p(1)[k],p(2)[k])-(k===0?PELVIS:0))*Math.PI/180)}
const ahead=phase=>{let[a,b]=joints(phase);return THIGH*Math.sin(a)+SHIN*Math.sin(a-b)};export const stride=()=>(ahead(0)-ahead(.5))/.5/100;
export function legs(phase,amount=1){const a=[0,1].map(i=>{let[th,kn,an]=joints(phase+i*.5);th*=amount;kn*=amount;return{knee:[THIGH*Math.sin(th),THIGH*Math.cos(th)],ankle:[THIGH*Math.sin(th)+SHIN*Math.sin(th-kn),THIGH*Math.cos(th)+SHIN*Math.cos(th-kn)],tilt:(th-kn+an*amount)}});const hipY=-Math.max(a[0].ankle[1],a[1].ankle[1])-4;return{hipY,legs:a}}
