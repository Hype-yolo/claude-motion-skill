import * as T from 'three';
export {T};
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
export function setup({background='#c3d3ce',camera=[8,7,10],look=[0,1,0],alpha=false}={}){
 const scene=new T.Scene();if(!alpha)scene.background=new T.Color(background);
 const renderer=new T.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,preserveDrawingBuffer:true,alpha});renderer.setSize(1280,720);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 const cam=new T.PerspectiveCamera(42,1280/720,.05,500);cam.position.set(...camera);cam.lookAt(...look);scene.add(new T.HemisphereLight('#d5eafa','#353431',1.6));const sun=new T.DirectionalLight('#fff1d4',3);sun.position.set(-8,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,far:100});scene.add(sun);
 window.CAPTURE=renderer.domElement;window.DUR=18;return {scene,renderer,cam,sun};
}
export function box(parent,size,xyz,color,roughness=.65){const m=new T.Mesh(new T.BoxGeometry(...size),new T.MeshStandardMaterial({color,roughness}));m.position.set(...xyz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function cyl(parent,r1,r2,len,xyz,col,segments=16){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,len,segments),new T.MeshStandardMaterial({color:col,roughness:.5}));m.position.set(...xyz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function link(parent,a,b,r,color){const p=new T.Vector3(...a),q=new T.Vector3(...b),m=cyl(parent,r,r,p.distanceTo(q),p.clone().add(q).multiplyScalar(.5).toArray(),color);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return m;}
