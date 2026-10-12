// Original story, props and acting. The credited Clawd model and pigment renderer are reused.
window.SCORE={notes:[62,66,69,74,73,69,66,62],root:38,step:1.6,cues:[5.5,9,12.5],seed:53};
function kite(x,y,a,k){push();translate(x,y);rotate(a);boilSeed('kite');paint([[0,-105],[85,0],[0,125],[-85,0]],{wash:PAL.ochre,fill:PAL.clay,fillOp:65,ink:PAL.ink,sw:.65});paint([[0,-105],[85,0],[0,0]],{wash:PAL.rose,ink:null});inkLine([[0,-105],[0,125]],.55,PAL.ink);inkLine([[-85,0],[85,0]],.55,PAL.ink);const pts=[];for(let i=0;i<10;i++)pts.push([Math.sin(i*.7+T*2)*15,125+i*16]);inkLine(pts,.5,PAL.clayDk);for(let i=0;i<3;i++){const yy=160+i*38,xx=Math.sin((yy-125)/16*.7+T*2)*15;paint([[xx-14,yy-8],[xx+14,yy+8],[xx+14,yy-8],[xx-14,yy+8]],{wash:PAL.teal,ink:PAL.ink,sw:.35})}pop()}
window.LOOP=t=>{boilSeed('land');paint(ellPts(560,945,960,290,40,3),{wash:'#d8dfbc',fill:PAL.sap,fillOp:35,ink:null});paint(ellPts(1650,985,700,225,40,3),{wash:'#e4d39f',fill:PAL.ochre,fillOp:25,ink:null});inkLine([[-40,829],[700,831],[1400,813],[2010,815]],.65,'#7d815f');
for(let i=0;i<9;i++){boilSeed('stalk'+i);const x=120+i*217,y=905+hash(i)*90;inkLine([[x-9,y-21],[x,y],[x+8,y-26]],.45,'#8e9a68')}
let m=stroll(t,0,4,400,775,25),lift=ease(seg(t,7,12)),kx=lerp(960,1280,lift),ky=lerp(708,300,lift)-Math.sin(lift*Math.PI)*60;
boilSeed('string');inkLine([[m.x+160,715],[lerp(900,1140,lift),lerp(800,620,lift)],[kx,ky+110]],.5,'#817664');
const fix=t>4&&t<7;clawd(m.x,832,25,{...feel(t<4?'curious':t<8?'focused':'happy',t),...m,boilKey:'mender',aR:fix?-.4:lift*.8,aL:fix?-.3:.1,view:fix?'q':m.view,lookX:1,lookY:lift?-.8:.4});
kite(kx,ky,-.35*(1-lift)+Math.sin(t*1.4)*.06,lift);
if(t>4&&t<7){boilSeed('patch');paint(rectPts(920,727,34,26,2),{wash:PAL.cream,ink:PAL.ink,sw:.4})}
if(t>12){boilSeed('wind');for(let i=0;i<3;i++)inkLine([[1370+i*24,270+i*55],[1480+i*30,250+i*55],[1620+i*21,255+i*55]],.3,'#a8b3a0')}
letter('A little wind. A little help.',130,124,36,PAL.ink,{font:'italic 36px Georgia',ink:false,align:'left'});};
