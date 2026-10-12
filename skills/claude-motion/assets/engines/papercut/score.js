// Original procedural score/foley. No external audio, deterministic seed.
export function audioWav(){const rate=44100,duration=18,n=rate*duration,out=new Float32Array(n);let seed=170;
const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296*2-1};
function note(t,f,len,g=.1){const start=Math.floor(t*rate);for(let i=0;i<len*rate&&start+i<n;i++){const s=i/rate,e=Math.min(1,s/.015)*Math.exp(-s*6/len);out[start+i]+=g*e*(Math.sin(2*Math.PI*f*s)+.22*Math.sin(2*Math.PI*f*2.005*s));}}
// Soft, sparse electric-piano motif with a resolved ending.
for(const [t,m]of [[0,62],[1.5,69],[3,74],[4.5,76],[6,81],[7.5,78],[9,76],[10.5,74],[12,69],[14,66],[16,62]])note(t,440*2**((m-69)/12),2.4,.095);
for(const [t,notes]of [[0,[50,57]],[6,[54,62]],[12,[50,57]]])for(const m of notes)note(t,440*2**((m-69)/12),5.8,.033);
note(7.7,1174.66,1.3,.12);note(8,1567.98,1.5,.075);note(15.5,1174.66,1.3,.10);
for(let i=0;i<n;i++){const t=i/rate,arrival=Math.max(0,1-Math.abs(t-5)/4),leave=Math.max(0,1-Math.abs(t-19)/4),env=(arrival+leave);out[i]+=(rnd()*.004+Math.sin(2*Math.PI*140*t)*.003)*env;out[i]+=rnd()*.003;}
for(const t of [4.5,6.2,8.4,11.3,12.3,14.4]){const start=Math.floor(t*rate);for(let j=0;j<rate*.1;j++)if(start+j<n)out[start+j]+=rnd()*.035*Math.exp(-j/(rate*.023));}
for(const t of [4.5,11.3]){const start=Math.floor(t*rate);for(let j=0;j<rate*.6;j++)if(start+j<n)out[start+j]+=rnd()*.018*Math.sin(Math.PI*j/(rate*.6));}
let peak=0;for(const v of out)peak=Math.max(peak,Math.abs(v));const buf=new ArrayBuffer(44+n*2),v=new DataView(buf);const str=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++){const fade=Math.min(1,i/(rate*.05),(n-i)/(rate*.8));v.setInt16(44+i*2,Math.max(-32767,Math.min(32767,out[i]*.72/peak*32767*fade)),true)}return new Uint8Array(buf);}
