import {cp,mkdir,mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const isolated=process.argv.includes('--isolated');
const out=isolated?await mkdtemp(join(root,'runs','desktop-build-')):join(root,'build','desktop');
if(!isolated){
  await rm(out,{force:true,recursive:true});
  await mkdir(out,{recursive:true});
}
const runtime=['desktop/contract-check.mjs','live-engine/design/design-language.mjs','live-engine/design/experience-patterns.mjs','live-engine/design/contract.mjs','live-engine/design/contract-schema.mjs','desktop/design-audit.mjs','live-engine/design/journey.mjs','live-engine/design/preferences.mjs','live-engine/design/judge.mjs','desktop/visual-review.mjs','desktop/interaction-check.mjs','desktop/prepare-turn.mjs','live-engine/design/director.mjs','live-engine/design/scene.mjs','desktop/design-stage.mjs','desktop/design-trace.mjs','desktop/main.mjs','desktop/preview.mjs','desktop/engine.mjs','desktop/agent.mjs','desktop/library.mjs','desktop/inspector.mjs',
  'experiments/agent.ts','live-engine/knowledge/src/live-knowledge.ts','live-engine/ingestion/retrieval.ts','live-engine/ingestion/schema.ts'];
for(const file of runtime){
  const target=join(out,file.replace(/\.ts$/,'.mjs'));
  const src=await readFile(join(root,file),'utf8');
  // Electron runs plain ESM; the desktop build uses the same engine as the experiments.
  const js=file.endsWith('.ts')?stripTypeScriptTypes(src):src;
  await mkdir(dirname(target),{recursive:true});await writeFile(target,js.replace(/(from\s+['"][^'"]+)\.ts(['"])/g,'$1.mjs$2'));
}
for(const file of ['live-engine/design/language-seeds.json','live-engine/design/benchmark.json','desktop/preload.cjs','desktop/ui','desktop/samples','live-engine/knowledge/data','live-engine/ingestion/data/factory.sqlite']){
  await mkdir(dirname(join(out,file)),{recursive:true});await cp(join(root,file),join(out,file),{recursive:true});
}
await writeFile(join(out,'package.json'),JSON.stringify({name:'surfacelive',productName:'SurfaceLive',version:'0.3.0',type:'module',main:'desktop/main.mjs'}));
if(isolated)console.log(out);
if(process.argv.includes('--package')){
  const {packager}=await import('@electron/packager');
  const {version}=JSON.parse(await readFile(join(root,'node_modules/electron/package.json'),'utf8'));
  let electronZipDir;
  const cache=process.env.electron_config_cache;
  if(cache){
    const name='electron-v'+version+'-'+process.platform+'-'+process.arch+'.zip';
    const checksums=JSON.parse(await readFile(join(root,'node_modules/electron/checksums.json'),'utf8'));
    for(const item of await readdir(cache,{withFileTypes:true}).catch(()=>[])){
      if(!item.isDirectory())continue;
      const folder=join(cache,item.name);
      const bytes=await readFile(join(folder,name)).catch(()=>null);
      if(bytes && createHash('sha256').update(bytes).digest('hex')===checksums[name]){electronZipDir=folder;break;}
    }
  }
  const paths=await packager({dir:out,out:resolve(root,'dist'),name:'SurfaceLive',electronVersion:version,
    electronZipDir,overwrite:true,asar:false,prune:false,icon:process.platform==='darwin'?join(root,'desktop','assets','surfacelive.icns'):undefined,
    appBundleId:'studio.surfacelive.desktop',download:{cacheRoot:process.env.electron_config_cache}});
  if(process.platform==='darwin')for(const dir of paths){
    const bundle=join(dir,'SurfaceLive.app');
    execFileSync('codesign',['--force','--deep','--sign','-',bundle],{stdio:'inherit'});
    execFileSync('codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
  }
  console.log(paths.join('\n'));
}
