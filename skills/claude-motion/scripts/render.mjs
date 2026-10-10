import http from 'node:http';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const args=process.argv.slice(2),opt=(key,d)=>args.includes(key)?args[args.indexOf(key)+1]:d;
if(args.includes('--help')){
 console.log('Usage: node render.mjs --root <scene directory> --out <film.mp4> [--fps 24] [--frames 0,3,8]\nRequires scene.js, Playwright Chromium, ffmpeg and ffprobe. No audio unless scene.js exports audioWav().');process.exit(0);
}
const root=await realpath(path.resolve(opt('--root','.'))),out=path.resolve(opt('--out',path.join(root,'film.mp4'))),fps=Number(opt('--fps','24')),times=opt('--frames','').split(',').filter(Boolean).map(Number);
if(!Number.isInteger(fps)||fps<1||fps>60)throw Error('fps must be 1..60');
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let dependency=process.env.MOTION_PLAYWRIGHT_MODULE;
if(!dependency){
 for(const base of [skill,root]){try{dependency=createRequire(path.join(base,'package.json')).resolve('playwright');break;}catch{}}
}
if(!dependency)throw Error('Playwright not installed. Run npm ci in the claude-motion Skill directory, then npm run setup.');
const playwright=await import(pathToFileURL(dependency).href);
const chromium=playwright.chromium || playwright.default?.chromium;
if(!chromium)throw Error('Playwright chromium export unavailable');
const host=`<!doctype html><meta charset="utf-8"><canvas></canvas><script type="module">import * as s from '/scene.js'; await s.ready;await document.fonts.ready;const c=document.querySelector('canvas');c.width=s.width;c.height=s.height;const g=c.getContext('2d');window.film={width:s.width,height:s.height,duration:s.duration,async draw(t,type='image/jpeg'){g.reset();await s.render(g,t);return c.toDataURL(type,.94)},audio:async()=>{let a=await s.audioWav?.();if(!a)return null;if(typeof a==='string')return a;let x='';for(let i=0;i<a.length;i+=16000)x+=String.fromCharCode(...a.subarray(i,i+16000));return btoa(x)}};</script>`;
const mime={'.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(host);return;}const file=await realpath(path.resolve(root,'.'+decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))throw Error('outside root');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url=`http://127.0.0.1:${server.address().port}`,errors=[],blocked=[];let browser,encoder;
await mkdir(path.dirname(out),{recursive:true});const stem=out.replace(/\.[^.]+$/,'');
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith(url+'/')||u.startsWith('data:')||u.startsWith('blob:'))return r.continue();blocked.push(u);return r.abort();});
 await page.goto(url);await page.waitForFunction(()=>window.film,null,{timeout:30000});const info=await page.evaluate(()=>({width:film.width,height:film.height,duration:film.duration}));
 if(![info.width,info.height].every(n=>Number.isInteger(n)&&n>0&&n%2===0)||!Number.isFinite(info.duration)||info.duration<=0)throw Error('invalid dimensions/duration');
 const grab=async(t,type='image/jpeg')=>Buffer.from((await page.evaluate(async({t,type})=>await film.draw(t,type),{t,type})).split(',')[1],'base64');
 const checkAt=Math.min(2.371,info.duration*.31),a=await grab(checkAt,'image/png');await grab(info.duration*.81);const b=await grab(checkAt,'image/png');if(!a.equals(b))throw Error('non-deterministic seek');
 if(times.length){for(const t of times){if(!Number.isFinite(t)||t<0||t>=info.duration)throw Error('frame outside duration');await writeFile(`${stem}-${t.toFixed(3)}.png`,await grab(t,'image/png'));}console.log(JSON.stringify({frames:times,errors,blocked}));}
 else{
  const audio=await page.evaluate(()=>film.audio()),params=['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0'];
  if(audio){const p=stem+'-score.wav';await writeFile(p,Buffer.from(audio,'base64'));params.push('-i',p,'-c:a','aac','-b:a','160k');}
  params.push('-c:v','libx264','-threads','2','-preset','fast','-crf','19','-pix_fmt','yuv420p','-t',String(info.duration),'-movflags','+faststart',out);
  encoder=spawn('ffmpeg',params,{stdio:['pipe','ignore','pipe']});let log='';encoder.stderr.on('data',d=>log+=d);encoder.stdin.on('error',()=>{});const done=once(encoder,'close');const frames=Math.ceil(info.duration*fps),start=Date.now();
  for(let i=0;i<frames;i++){if(encoder.exitCode!==null)throw Error(log);if(!encoder.stdin.write(await grab(i/fps)))await Promise.race([once(encoder.stdin,'drain'),done.then(()=>{throw Error(log||'encoder stopped')})]);if(i%(fps*6)===0)console.log(`${i}/${frames}`);}
  encoder.stdin.end();const [code]=await done;encoder=null;if(code!==0)throw Error(log);
  const dec=spawnSync('ffmpeg',['-v','error','-i',out,'-f','null','-'],{encoding:'utf8'});if(dec.status!==0)throw Error(dec.stderr);
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',out],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr);
  await writeFile(stem+'-poster.png',await grab(Math.min(3,info.duration*.2),'image/png'));
  await writeFile(stem+'-render-report.json',JSON.stringify({...info,fps,frames,seconds:(Date.now()-start)/1000,audio:!!audio,decode:'passed',seekRepeat:'identical',seekSha256:createHash('sha256').update(a).digest('hex'),errors,blocked,probe:JSON.parse(probe.stdout)},null,2));console.log(out);
 }
 if(errors.length||blocked.length)throw Error(JSON.stringify({errors,blocked}));
}finally{encoder?.kill('SIGTERM');await browser?.close();await new Promise(ok=>server.close(ok));}
