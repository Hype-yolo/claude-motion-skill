/* New coastal transmission scene; upstream factories remain intact in lib/. */
(()=>{
const {pr,E,track,Story}=ExplainerCore, K=Kit;
const story=new Story(STORY), spec=TOPIC, root=document.querySelector('#root'),layer=document.querySelector('#labels'),svg=document.querySelector('#wires'),g=document.querySelector('#art').getContext('2d');
const bg=K.backdrop(document.querySelector('#backdrop')),chapter=new ExplainerCore.Chapters(document.querySelector('#chapter'),story),hud=K.hud(story); document.querySelector('#hud').append(hud.el);
const add=(x,left,top)=>{layer.append(x.el);x.el.style.left=left+'px';x.el.style.top=top+'px';return x};
const title=document.createElement('div');title.className='display';title.style.cssText='left:92px;top:160px';layer.append(title);const headTicker=K.ticker(title,[[0,'A message crosses the ocean.']]);
const subtitle=document.createElement('div');subtitle.className='subline';subtitle.style.cssText='left:96px;top:268px';layer.append(subtitle);const subTicker=K.ticker(subtitle,[[.35,'LAND → LIGHT → OCEAN → LIGHT → LAND']],.4);
const labels=[add(K.label({text:'TRANSMITTER',at:.7}),92,356),add(K.label({text:'RECEIVER',at:.9}),1490,356),add(K.label({text:'OPTICAL FIBRE',sub:'inside the cable',at:2.0}),500,868)];
const notes=[add(K.note('The message becomes a pattern of light.',{tag:'01',at:1,until:5.5}),96,927),add(K.note('Repeaters amplify the fading optical signal.',{tag:'02',at:5.5,until:12.6}),96,927),add(K.note('The receiver reads the same pattern.',{tag:'03',at:12.6,until:18}),96,927)];
const wires=spec.segments.map(p=>K.wire(svg,{packets:0,width:7,base:'#65768a',color:'#c8ff3e'}));
const repX=[550,840,1129],repY=[691,738,717];
const trackers=repX.map((x,i)=>add(K.tracker({w:112,h:104}),x-56,repY[i]-52));
const repLabels=repX.map((x,i)=>add(K.label({text:spec.repeaterLabels[i],at:3.0+i*.16}),x-35,repY[i]-88));
const stamp=add(K.stamp({text:'MESSAGE INTACT',sub:spec.message}),1120,813);
const bits=(x,y)=>{let el=document.createElement('div');el.className='bits';el.style.left=x+'px';el.style.top=y+'px';layer.append(el);return [...spec.message].map(v=>{let b=document.createElement('span');b.className='bit';b.textContent=v;el.append(b);return b})};
const sendBits=bits(91,426),recvBits=bits(1502,426);let stateT=0;
const line=(x1,y1,x2,y2,c,w=2)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
const path=(pts,fill,stroke)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke()}};
const rr=(x,y,w,h,r,fill,stroke)=>{g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke()}};
function station(x,y,rx){
 path([[x-70,y+48],[x-54,y+84],[x+68,y+84],[x+75,y+42]],'#192838','#5b6f83');
 rr(x-51,y-75,102,125,8,'#162231','#6b7f92');rr(x-37,y-59,74,41,3,'#080d14','#5b6f83');
 for(let j=0;j<4;j++)line(x-32,y+3+j*10,x+29,y+3+j*10,'#34445a',3);
 g.fillStyle='#c8ff3e';g.globalAlpha=rx;g.fillRect(x-28,y-47,56,14);g.globalAlpha=1;
 line(x,y-75,x,y-124,'#6b7f92',3);g.beginPath();g.arc(x,y-124,6,0,7);g.fillStyle='#c8ff3e';g.fill();
}
function repeater(i,t){const x=repX[i],y=repY[i],arrival=spec.packetStart+(i+1)/4*(spec.packetEnd-spec.packetStart),on=pr(t,arrival-.32,.32)*(1-pr(t,arrival+.55,.45));
 g.save();g.translate(x,y);g.rotate(i===0?.09:i===1?-.005:-.09);rr(-44,-25,88,50,22,'#1c2c3b',on>0?'#c8ff3e':'#7c8e9d');
 rr(-34,-23,9,46,3,'#536675');rr(25,-23,9,46,3,'#536675');line(-10,-19,-10,19,'#516c7e',3);line(10,-19,10,19,'#516c7e',3);g.fillStyle='#c8ff3e';g.globalAlpha=.2+.8*on;g.fillRect(-5,-9,10,18);g.restore();
 trackers[i].render(t,arrival-.16,arrival+.8,1.6);
}
function point(q){q=Math.max(0,Math.min(.999999,q));let k=Math.floor(q*4);return K.bez(spec.segments[k],q*4-k)}
function paint(t){
 g.clearRect(0,0,1920,1080); const seaTop=397;
 // Ocean, shore terraces and a subdued seabed drawn anew for this story.
 const sea=g.createLinearGradient(0,seaTop,0,880);sea.addColorStop(0,'#152b3b');sea.addColorStop(1,'#0c1520');g.fillStyle=sea;g.fillRect(91,seaTop,1740,473);
 line(91,seaTop,1831,seaTop,'#5c7b8b',2);for(let i=0;i<25;i++){let x=380+i*46;line(x,seaTop+13,x+21,seaTop+13,'#36515f',2)}
 path([[91,seaTop],[349,seaTop],[400,447],[412,520],[448,550],[459,644],[512,689],[580,735],[726,798],[1050,831],[1322,796],[1498,685],[1530,551],[1584,478],[1610,seaTop],[1831,seaTop],[1831,877],[91,877]],'#12212c','#304453');
 path([[91,seaTop],[349,seaTop],[357,430],[382,453],[367,478],[402,507],[393,541],[278,576],[91,553]],'#324251','#798592');
 path([[1610,seaTop],[1831,seaTop],[1831,553],[1650,587],[1548,562],[1571,522],[1566,487],[1591,454]],'#324251','#798592');
 for(let i=0;i<8;i++){line(94+i*28,562+i*3,115+i*28,611+i*3,'#1f3543',2);line(1600+i*28,586-i*3,1621+i*28,634-i*3,'#1f3543',2)}
 g.fillStyle='#6a8191';g.font='24px monospace';g.fillText('OCEAN / CROSS-SECTION',760,449);g.font='21px monospace';g.fillText('DIAGRAM · NOT TO SCALE',94,862);
 station(277,531,1-pr(t,3.1,.3)*.7);station(1642,531,.25+.75*pr(t,13.3,.3));
 // A single encoded train follows the retained upstream Bézier geometry. Loss resets at each repeater.
 const q=pr(t,spec.packetStart,spec.packetEnd-spec.packetStart),active=t>=spec.packetStart&&t<spec.packetEnd;
 if(active){for(let i=0;i<6;i++){const qi=q-i*.0085;if(qi<0)continue;const p=point(qi),atten=1-(qi*4%1)*.56,one=spec.message[i]==='1';g.save();g.globalAlpha=(one?1:.28)*atten;g.shadowColor='#c8ff3e';g.shadowBlur=one?25:0;rr(p.x-9,p.y-14,one?18:8,one?28:12,4,'#c8ff3e');g.restore()}}
 for(let i=0;i<3;i++)repeater(i,t);
 // Measured amplification inset, only while the pulse is at a repeater.
 const a=E.o3(pr(t,5.8,.4))*(1-pr(t,11.7,.4));if(a>0){g.save();g.globalAlpha=a;rr(1097,486,348,137,9,'#0c141e','#4a5d73');g.fillStyle='#8fa1b5';g.font='22px monospace';g.fillText('OPTICAL AMPLIFICATION',1120,515);line(1121,583,1418,583,'#34445a');for(let i=0;i<3;i++){rr(1137+i*23,574-(i%2?15:30),13,i%2?15:30,2,'#79935b');rr(1317+i*23,540,13,43,2,'#c8ff3e')}line(1230,555,1277,555,'#8fa1b5',2);path([[1277,555],[1269,551],[1269,559]],'#8fa1b5');g.restore()}
 // Completion retains exactly the sent pattern; no fabricated throughput statistic.
 const received=pr(t,13.6,.35);if(received>0){g.save();g.globalAlpha=received;g.strokeStyle='#c8ff3e';g.lineWidth=3;g.beginPath();g.arc(1642,531,92,Math.PI*.12,Math.PI*1.88);g.stroke();g.restore()}
}
window.render=t=>{stateT=t;headTicker.render(t);subTicker.render(t);chapter.render(t);hud.render(t);bg.render({s:1,tx:0,ty:0});notes.forEach(n=>n.render(t));labels.forEach(l=>l.render(t));repLabels.forEach(l=>l.render(t));wires.forEach((w,i)=>w.render(t,spec.segments[i],{draw:E.io2(pr(t,1.65+i*.28,.7)),live:false}));paint(t);sendBits.forEach((b,i)=>b.classList.toggle('on',t>=1.4+i*.14));recvBits.forEach((b,i)=>{b.textContent=t>=13.65+i*.12?spec.message[i]:'·';b.classList.toggle('on',t>=13.65+i*.12)});stamp.render(t,14.65,18);document.querySelector('#seek').value=t;};
window.DUR=STORY.duration;window.READY=true;window.render(0);let playing=false,last=0;document.querySelector('#play').onclick=()=>{playing=!playing;last=performance.now()};document.querySelector('#seek').oninput=e=>{playing=false;render(+e.target.value)};function raf(now){if(playing){let t=stateT+(now-last)/1000;if(t>18)t=0;render(t)}last=now;requestAnimationFrame(raf)}requestAnimationFrame(raf);
})();
