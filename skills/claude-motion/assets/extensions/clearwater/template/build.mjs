import {build} from 'esbuild';await build({entryPoints:['scene.source.js'],outfile:'scene.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
