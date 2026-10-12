import * as T from 'three';import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const smooth=(t,a,b)=>{let p=Math.max(0,Math.min(1,(t-a)/(b-a)));return p*p*(3-2*p)};
export function makeTurntable(){const root=new T.Group(),black=new T.MeshStandardMaterial({color:'#171a19',roughness:.35,metalness:.3}),silver=new T.MeshStandardMaterial({color:'#b4b9b6',metalness:.86,roughness:.22});
 const add=(geo,mat,x,y,z,p=root)=>{let o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o},cyl=(r,h)=>new T.CylinderGeometry(r,r,h,80);
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;const ctx=cv.getContext('2d');ctx.fillStyle='#573e29';ctx.fillRect(0,0,512,256);for(let i=0;i<220;i++){ctx.strokeStyle=i%3?'#79583a':'#3f2c1e';ctx.globalAlpha=.25;ctx.beginPath();for(let x=0;x<=512;x+=8){const y=i*1.4+Math.sin(x*.018+i)*1.8;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;
 add(new RoundedBoxGeometry(3.8,.36,2.8,3,.045),new T.MeshStandardMaterial({map:tex,roughness:.4}),0,.37,0);add(new T.BoxGeometry(3.67,.045,2.67),black,0,.57,0);
 for(const x of [-1.5,1.5])for(const z of [-1,1]){add(cyl(.19,.18),black,x,.09,z);add(cyl(.16,.07),silver,x,.20,z)}
 const platter=add(cyl(1.05,.13),silver,-.48,.66,0);const record=add(cyl(1,.019),black,-.48,.735,0);for(let r=.33;r<.98;r+=.030){const ring=add(new T.TorusGeometry(r,.0016,3,128),new T.MeshStandardMaterial({color:"#343a36",roughness:.62,metalness:.25}),0,.011,0,record);ring.rotation.x=Math.PI/2}
 const label=add(cyl(.29,.022),new T.MeshStandardMaterial({color:'#b34f37',roughness:.85}),0,0,0,record);const mark=add(new T.BoxGeometry(.02,.006,.15),new T.MeshStandardMaterial({color:'#e8d9b3'}),.12,.013,0,record);add(cyl(.026,.105),silver,-.48,.79,0);
 const pivot=new T.Group();pivot.position.set(1.23,.7755,-.87);root.add(pivot);add(cyl(.145,.30),silver,0,-.02,0,pivot);const pitch=new T.Group();pivot.add(pitch);
 const tube=add(new T.CylinderGeometry(.028,.028,1.86,20),silver,0,.10,.74,pitch);tube.rotation.x=Math.PI/2;const weight=add(cyl(.105,.22),silver,0,.10,-.25,pitch);weight.rotation.x=Math.PI/2;
 add(new T.BoxGeometry(.135,.075,.25),black,0,.055,1.63,pitch);const needle=add(new T.CylinderGeometry(.006,.006,.04,8),silver,0,-.011,1.68,pitch);
 add(cyl(.12,.035),silver,1.48,.625,.95);const led=add(new T.SphereGeometry(.017,12,8),new T.MeshStandardMaterial({color:'#d6b763',emissive:'#bd7c25',emissiveIntensity:.6}),1.22,.62,.95);
 function update(t){const sweep=smooth(t,2,5),lower=smooth(t,5,6.5);pivot.rotation.y=-.64*sweep;pitch.rotation.x=-.10*(1-lower);record.rotation.y=-Math.max(0,t-6.5)*3.49;led.material.emissiveIntensity=.2+lower;root.updateMatrixWorld(true);return{needle:needle.getWorldPosition(new T.Vector3()).toArray(),recordY:.7445,playing:t>=6.5}}
 update(0);return{root,update,record,pivot,pitch,needle};}
