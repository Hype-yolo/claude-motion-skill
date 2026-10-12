import * as T from 'three';
const clamp=x=>Math.max(0,Math.min(1,x));
// Sand upper chamber is a conical frustum; bottom is a conical pile.
// Both use the same volume, rather than independently shrinking two meshes.
export const sandVolume=h=>Math.PI*(.035**2*h+.035*.52*h*h+.52**2*h*h*h/3);
export function sandState(progress){const p=clamp(progress),total=sandVolume(.88);let lo=0,hi=.88;for(let i=0;i<45;i++){let m=(lo+hi)/2;if(sandVolume(m)<total*(1-p))lo=m;else hi=m}const height=(lo+hi)/2,heapHeight=Math.cbrt(3*total*p/(Math.PI*.76**2));return{topHeight:height,topRadius:.035+.52*height,heapHeight,heapRadius:.76*heapHeight,topVolume:total*(1-p),bottomVolume:total*p,total};}
export function makeHourglass(){const root=new T.Group(),gold=new T.MeshStandardMaterial({color:'#947c50',metalness:.78,roughness:.32}),dark=new T.MeshStandardMaterial({color:'#292d2b',metalness:.2,roughness:.35}),sand=new T.MeshStandardMaterial({color:'#d6ad69',roughness:1});
 const add=(geo,mat,x,y,z,p=root)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m};
 for(const y of [.08,2.80]){add(new T.CylinderGeometry(.82,.82,.16,96),dark,0,y,0);add(new T.CylinderGeometry(.83,.83,.026,96),gold,0,y+.045,0);add(new T.CylinderGeometry(.72,.72,.05,96),gold,0,y+(y<1?.11:-.11),0)}
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3+.3,x=Math.sin(a)*.73,z=Math.cos(a)*.73;add(new T.CylinderGeometry(.038,.038,2.57,20),gold,x,1.44,z);for(const y of [.23,2.64])add(new T.SphereGeometry(.065,20,12),gold,x,y,z)}
 const outer=[[0, .23],[.55,.23],[.65,.27],[.66,.38],[.63,.48],[.55,.63],[.44,.80],[.30,1.04],[.17,1.26],[.075,1.40],[.065,1.45],[.075,1.50],[.17,1.64],[.30,1.86],[.44,2.1],[.55,2.27],[.63,2.42],[.65,2.55],[.61,2.63],[0,2.63]];
 const shell=new T.Mesh(new T.LatheGeometry(outer.map(([r,y])=>new T.Vector2(r,y)),96),new T.MeshPhysicalMaterial({color:'#f5fcfa',roughness:.06,metalness:0,transmission:.96,thickness:.035,ior:1.46,side:T.DoubleSide,envMapIntensity:1.25}));root.add(shell);
 let upper=add(new T.CylinderGeometry(1,1,1,64),sand,0,0,0),lower=add(new T.ConeGeometry(1,1,64),sand,0,0,0);shell.castShadow=false;
 const arr=new Float32Array(90*3),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(arr,3));const stream=new T.Points(geo,new T.PointsMaterial({color:'#e3bd7b',size:.011}));root.add(stream);
 function update(t,p=clamp((t-2)/13)){const s=sandState(p);upper.geometry.dispose();upper.geometry=new T.CylinderGeometry(s.topRadius,.035,Math.max(.0001,s.topHeight),64);upper.position.y=1.45+s.topHeight/2;upper.visible=p<.9999;lower.scale.set(s.heapRadius,Math.max(.0001,s.heapHeight),s.heapRadius);lower.position.y=.245+s.heapHeight/2;lower.visible=p>.0001;const end=.245+s.heapHeight;for(let i=0;i<90;i++){const u=(i/90+t*.9)%1;arr[i*3]=Math.sin(i*31)*.012;arr[i*3+1]=1.44-u*(1.44-end);arr[i*3+2]=Math.cos(i*7)*.012}geo.attributes.position.needsUpdate=true;stream.visible=p>0&&p<1;return s}
 update(0);return{root,update,shell,upper,lower,stream};}
