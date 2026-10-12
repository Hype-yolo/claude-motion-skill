import {createCrayonRenderer} from './crayon.js';
export const width=1280,height=720,duration=18;
const engines=new WeakMap();
export const prompt='A little otter repairs a torn windsock at a riverside weather station; when the breeze returns, the windsock lifts and the otter watches its reflection.';
function environment(E,t){
 const {crayon:C,stroke:L,polyPts:Q,ellipsePts:A,PP,box,P,pxcm}=E;
 // A broad valley with irregular riverbanks; all material is the upstream crayon renderer.
 C(Q([[0,0],[1280,0],[1280,430],[0,420]],34),'#d5e4df',{seed:2,gap:11,alpha:.23,base:.18,rim:false});
 C(Q([[0,290],[130,275],[260,287],[355,231],[444,241],[552,195],[673,255],[785,224],[929,276],[1090,249],[1280,291],[1280,449],[0,449]],30),'#99b2a0',{seed:3,gap:8,len:52,alpha:.55,base:.22,rim:false});
 C(Q([[0,336],[133,345],[255,307],[424,331],[630,313],[777,345],[995,323],[1280,347],[1280,487],[0,474]],30),'#c7cf9f',{seed:4,gap:7,alpha:.64,base:.2,rim:false});
 C(Q([[0,464],[133,443],[311,475],[472,461],[646,425],[794,422],[1012,459],[1280,483],[1280,720],[0,720]],28),'#84aaa9',{seed:5,gap:7,len:63,alpha:.66,base:.3,rim:false,angle:-.12,mix:['#d0d8bd',.18]});
 C(Q(PP([[-140,0,-45],[100,0,-45],[110,0,58],[-2,0,85],[-70,0,150],[-180,0,210]]),30),'#c1bf8d',{seed:6,gap:7,alpha:.6,base:.28,rim:false});
 // Pier boards have true pinhole perspective, visible sides and individual joins.
 for(let i=0;i<7;i++)box([-71+i*17,-55+i*17],[-5,-1],[30,105],'#ab8260',{seed:60+i,gap:5,alpha:.64,top:.15});
 // River ripples drift only after the breeze returns.
 const wind=E.smooth(E.win(t,10,13));
 for(let i=0;i<24;i++){
  const x=120+(i*167)%1100,y=506+(i*43)%184;
  L([[x,y],[x+28+7*Math.sin(t*1.4+i)*wind,y-1],[x+65,y+1]],i%3?'#d0d7be':'#5e979e',1.5,{seed:710+i,alpha:.36,wob:.6,passes:2});
 }
 // Reeds near the bank, seed heads and longer grass.
 for(let i=0;i<26;i++){
 const x=35+(i*123)%1210,y=488+(i*17)%51;
 if(x>320&&x<1030)continue;
 const sway=wind*Math.sin(t*2+i)*6;
 L([[x,y+27],[x-4+sway,y-20],[x-12+sway,y-56]],'#7c8856',2,{seed:800+i,wob:1});
 C(A(x-12+sway,y-51,3,12,-.12,14),'#966749',{seed:840+i,gap:2,w:2,rim:false,fixed:true});
 }
}
function station(E,t){
 const {box,stroke:L,PP,crayon:C,polyPts:Q,P,pxcm,ellipsePts:A}=E;
 // Stevenson screen: raised enclosure, pitched roof, shaded slats and brass latch.
 for(const x of [-105,-64])for(const z of [-12,14])box([x,x+3],[0,49],[z,z+3],'#ad9c78',{seed:90+x+z,gap:3});
 box([-108,-59],[48,86],[-15,21],'#e0dcc4',{seed:110,gap:4,alpha:.53,base:.46});
 for(let y=51;y<83;y+=4)L(PP([[-104,y,21.5],[-62,y,21.5]]),'#9b9b81',1.6,{seed:114+y,wob:.5});
 C(Q(PP([[-113,86,-20],[-85,99,-20],[-54,86,-20],[-54,86,27],[-85,99,27],[-113,86,27]]),10),'#667e77',{seed:117,gap:3.5,alpha:.78,mix:['#a4ad92',.13]});
 L(PP([[-84,50,22],[-84,82,22]]),'#989985',1,{seed:118});
 let latch=P([-82,67,23]);C(A(latch[0],latch[1],2,4,0,10),'#aa8549',{seed:119,gap:2,w:2,rim:false,fixed:true});
 // Mast, hand crank and accessible windsock mouth.
 box([24,27],[0,113],[-1,2],'#68797b',{seed:130,gap:3,w:2});
 L(PP([[26,103,0],[33,103,0],[33,97,0]]),'#6d7978',3,{seed:131});
 const mast=P([26,38,3]),sc=pxcm([26,38,3]);L([[mast[0]-sc*5,mast[1]],[mast[0]+sc*4,mast[1]],[mast[0]+sc*4,mast[1]+sc*6]],'#8d7256',2.5,{seed:132});
 // Cup anemometer: calm at first, rotates when wind rises.
 L(PP([[-75,98,3],[-75,115,3]]),'#7a8580',2,{seed:140});
 let spin=t*E.smooth(E.win(t,10,13))*3.8;
 for(let k=0;k<3;k++){
 const a=spin+k*2.094,p=[-75+Math.cos(a)*12,115,3+Math.sin(a)*12];
 L(PP([[-75,115,3],p]),'#7a8580',2,{seed:141+k});
 const q=P(p),s=pxcm(p);C(A(q[0],q[1],s*3.7,s*2,0,16),'#6d8585',{seed:145+k,gap:2,w:2,rim:false,fixed:true});
 }
 // Work basket, spool and folded patch on the pier.
 box([-40,-24],[0,10],[39,52],'#b19868',{seed:160,gap:3,mix:['#dac790',.24]});
 for(let y=2;y<9;y+=2)L(PP([[-40,y,52],[-24,y,52]]),'#806849',1,{seed:170+y});
 const q=P([-28,12,44]),s=pxcm([-28,12,44]);C(A(q[0],q[1],s*2.5,s*3,0,16),'#f0e2bf',{seed:180,gap:2,w:2,rim:false});
}
function sockGeom(E,t){
 const lift=E.smooth(E.win(t,10,13)),flutter=lift*Math.sin(t*4.2)*2.1;
 let pts=[];
 for(let i=0;i<=24;i++){
 const u=i/24;
 pts.push([33+u*(9+58*lift),98-u*(44*(1-lift)+6*lift)+flutter*u*u,0+Math.sin(u*3+t*3)*lift*2]);
 }
 return pts;
}
function windsock(E,t){
 const {PP,crayon:C,stroke:L,polyPts:Q,P,ellipsePts:A,pxcm}=E,cent=sockGeom(E,t),lift=E.smooth(E.win(t,10,13));
 // Tapered sleeve made as six real strips in world space, with an open mouth and ragged tear.
 const edge=(i,side)=>{let p=cent[i],u=i/24,r=8*(1-u)+2.5*u;return [p[0]+side*r*(1-lift),p[1]+side*r*lift,p[2]+side*1.5];};
 for(let k=0;k<6;k++){
 let a=k*4,b=(k+1)*4,pts=[];
 for(let i=a;i<=b;i++)pts.push(edge(i,1));
 for(let i=b;i>=a;i--)pts.push(edge(i,-1));
 C(Q(PP(pts),5),k%2?'#eee5ca':'#be664e',{seed:200+k,gap:3.1,len:16,w:2.8,alpha:.86,base:.46,rimColor:k%2?'#b3a78a':'#a34d41',wob:1.5,angle:-.5});
 }
 const mouth=P(cent[0]),s=pxcm(cent[0]);C(A(mouth[0],mouth[1],s*4,s*8,1.3*lift,22),'#625e55',{seed:208,gap:2.8,alpha:.8,base:.4,rimColor:'#ac8261',rimW:3});
 const heal=E.smooth(E.win(t,3.5,8.2)),tear=PP([edge(13,1),cent[13],cent[15],edge(17,1)]);
 if(heal<1)C(Q(tear,5),'#d7decb',{seed:210,gap:3,alpha:.65,base:.5,rim:false});
 // Patch develops under the paws. It travels with the cloth after the repair.
 if(heal>.04){const p=[edge(12,1),edge(17,1),cent[18],cent[12]];C(Q(PP(p),5),'#d5b575',{seed:211,gap:2.8,w:2.2,alpha:heal,base:heal*.5,rimAlpha:.5});}
 for(let k=0;k<8;k++)if(heal>(k+1)/9){const i=12+k*.75,j=Math.floor(i),p=cent[j],q=P(p),sc=pxcm(p);L([[q[0]-sc*1.8,q[1]-sc*2],[q[0]+sc*2.2,q[1]+sc*1.5]],'#725e48',1.25,{seed:220+k,wob:.35,passes:2});}
 return cent;
}
function otter(E,t,pos,reflection=false){
 const {crayon:C,stroke:L,ellipsePts:A,polyPts:Q,ribbon:R,bez,ctx:g,pxcm,P}=E;
 const f=P(pos),s=pxcm(pos),walk=E.smooth(E.win(t,13,15));
 g.save();g.translate(f[0],f[1]);g.scale(s,reflection?-s*.43:s);
 const body='#92715b',shade='#735747',cream='#d7c198',rim='#694d40';
 const opt={gap:3.8,len:18,w:2.7,base:.36,alpha:.85,rimColor:rim,rimW:2,wob:1.3,mix:['#b19776',.18]};
 const sc=(pts,col,seed,other={})=>C(pts,col,{...opt,seed,...other});
 // Muscular tapering tail, webbed hindfeet, curved torso, chest and rounded ears.
 sc(Q([[-9,-15],[-27,-8],[-49,5],[-56,7],[-51,10],[-33,10],[-11,5],[5,-6]],4),shade,300);
 for(let k=-1;k<=1;k+=2){let step=t>13&&t<15?Math.sin((t-13)*8+k)*2:0;
 sc(Q([[k*9,-11],[k*15,-9],[k*21,0+step],[k*16,3+step],[k*5,1+step]],3),body,301+k);
 for(let j=0;j<3;j++)L([[k*11+j*1.5,-1+step],[k*15+j*1.5,1+step]],rim,.7,{seed:310+k+j,wob:.2,passes:2});}
 sc(Q([[-11,0],[-20,-11],[-19,-35],[-14,-50],[-13,-60],[0,-64],[13,-56],[18,-35],[15,-11],[9,0]],4),body,320);
 sc(A(0,-35,10,20,.12,26),cream,321,{gap:3.8,alpha:.62,rim:false,mix:undefined});
 sc(A(-14,-77,7,7,0,22),body,330);sc(A(14,-77,7,7,0,22),body,331);
 sc(A(-14,-77,3.7,3.5,0,16),shade,332,{gap:2,rim:false});sc(A(14,-77,3.7,3.5,0,16),shade,333,{gap:2,rim:false});
 const headTilt=E.smooth(E.win(t,15,16))*.14;
 g.save();g.translate(0,-68);g.rotate(headTilt);
 sc(Q([[-20,-4],[-19,-13],[-10,-21],[1,-24],[15,-20],[21,-10],[21,2],[13,11],[0,14],[-13,11],[-21,3]],3),body,340);
 sc(A(8,5,13,8,-.03,24),cream,341,{gap:2.5,rim:false,mix:undefined});
 const eyesDown=t>15?4:0,blink=Math.pow(Math.max(0,Math.cos(t*1.3)),36);
 for(const x of [-7,13])sc(A(x,-4+eyesDown,2.1,2.8*(1-blink*.8),0,14),'#3c382f',350+x,{gap:1,w:1.2,base:.9,rim:false,mix:undefined,wob:.2});
 sc(Q([[4,0],[10,-1],[11,3],[7,5],[3,2]],1.5),'#473a30',360,{gap:1.5,w:1.4,rim:false,base:.8,mix:undefined});
 L([[7,5],[7,8],[3,9]],'#6d5141',.8,{seed:361,wob:.2});
 for(let k=0;k<3;k++){L([[-1,4+k*2],[-14,2+k*3]],'#796c53',.6,{seed:363+k,wob:.2,passes:2});L([[14,4+k*2],[26,2+k*3]],'#796c53',.6,{seed:367+k,wob:.2,passes:2});}
 g.restore();
 // Each wrist converges on the tear, then the forearms pull apart to snug the knot.
 let repair=E.smooth(E.win(t,1.7,3)),withdraw=E.smooth(E.win(t,8.3,10));
 let tear=sockGeom(E,t)[14],tp=P(tear),tx=(tp[0]-f[0])/s,ty=(tp[1]-f[1])/s;
 let stitch=t>3&&t<8?Math.sin((t-3)*7)*2.5:0;
 for(let k=-1;k<=1;k+=2){let hx=E.lerp(k*17,tx+k*(2+withdraw*6),repair*(1-withdraw)),hy=E.lerp(-36,ty+stitch*k,repair*(1-withdraw));
 sc(R(bez([k*13,-49],[k*24,-32],[hx-k*14,hy+10],[hx,hy],10),9,6),body,380+k);
 sc(A(hx,hy,4,3.1,-.4,16),body,384+k,{gap:2,w:2,rimW:1});
 if(k===1&&t>2.5&&t<8.4){L([[hx,hy],[hx+4,hy-3]],'#5e6868',.7,{seed:390,wob:.1,passes:2});L(bez([hx+4,hy-3],[hx+8,hy-10],[tx+7,ty-8],[tx,ty],12),'#e1d0a4',.6,{seed:391,wob:.15,passes:2});}}
 g.restore();
}
export function render(ctx,t){
 let E=engines.get(ctx);if(!E){E=createCrayonRenderer(ctx.canvas);engines.set(ctx,E);}t=E.clamp(t,0,17.999);
 E.begin(t);const push=E.smooth(E.win(t,0,18));E.setCamera([158-15*push,146-7*push,273-10*push],[-8,50,24],895+18*push);
 environment(E,t);
 let walk=E.smooth(E.win(t,13,15));let pos=[5+walk*8,0,22+walk*40];
 // Reflection follows the same authored character and pose, clipped to river water.
 if(t>13){ctx.save();E.trace([[0,515],[400,528],[680,483],[965,525],[1280,531],[1280,720],[0,720]]);ctx.clip();otter(E,t,pos,true);ctx.restore();ctx.globalAlpha=.48;ctx.fillStyle='#acc6be';ctx.fillRect(0,545,1280,175);ctx.globalAlpha=1;}
 E.depthSort([{pos:[-85,50,0],draw:()=>station(E,t)},{pos:[38,76,0],draw:()=>windsock(E,t)},{pos,draw:()=>otter(E,t,pos)}]);
 E.finish();
}
