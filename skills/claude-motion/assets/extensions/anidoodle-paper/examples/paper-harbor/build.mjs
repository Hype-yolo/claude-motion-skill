import {build} from 'esbuild';
await build({entryPoints:['src/paper-materials.ts'],bundle:true,format:'esm',target:'es2020',outfile:'lib/paper-materials.js'});
