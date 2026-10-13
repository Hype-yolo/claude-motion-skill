import{cp,access,readFile}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const args=process.argv.slice(2),i=args.indexOf('--out');if(i<0||!args[i+1])throw Error('Usage: node create-project.mjs --out NEW_DIRECTORY [--example paper-harbor]');
const ei=args.indexOf('--example'),example=ei<0?'paper-harbor':args[ei+1];if(example!=='paper-harbor')throw Error('Supported example: paper-harbor');
const out=path.resolve(args[i+1]),root=path.dirname(fileURLToPath(import.meta.url));
try{await access(out);throw Error('Output already exists; choose a new directory.')}catch(e){if(e.code!=='ENOENT')throw e}
await cp(path.join(root,'examples',example),out,{recursive:true});await cp(path.join(root,'upstream'),path.join(out,'upstream'),{recursive:true});
console.log(JSON.stringify({out,example,entry:'scene.js',render:`cd ${JSON.stringify(out)} && npm install && npx playwright install chromium && npm run render`,existingRuntime:'Set MOTION_PLAYWRIGHT_MODULE to an existing Playwright entry to render without reinstalling.'},null,2));
