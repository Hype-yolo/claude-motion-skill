import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const n of ['generator','params','rng','kit','materials','interiors']){
 let src=await readFile(path.join(root,'upstream/src',n+'.ts'),'utf8');
 if(n==='kit')src=src.replace('constructor(private materials: Map<string, Material>) {}','materials: Map<string, Material>; constructor(materials: Map<string, Material>) { this.materials=materials; }');
 let js=stripTypeScriptTypes(src,{mode:'strip'}).replace(/from "\.\/(\w+)"/g,'from "./$1.js"');
 if(n==='materials')js+='\nexport {glass,voile};\n';
 await writeFile(path.join(root,'template/system',n+'.js'),js);
}
await cp(path.join(root,'upstream/public/assets'),path.join(root,'template/assets'),{recursive:true,filter:(src)=>!src.endsWith('/interiors.jpg')});
await cp(path.join(root,'upstream/LICENSE'),path.join(root,'template/LICENSE-UPSTREAM'));
