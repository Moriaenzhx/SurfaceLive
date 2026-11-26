import {copyFile,mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {audit} from './verification.ts';
import {variants} from './prompts.ts';

const run=resolve(process.argv[2]||'.');
const source=JSON.parse(await readFile(join(run,'manifest.json'),'utf8'));
if(source.mode!=='execute' || source.sourceRun) throw new Error('Choose an original model run.');
const selected=process.argv[3]?[process.argv[3]]:variants;
for(const v of selected){
  if(!variants.includes(v as typeof variants[number]) || !source.variants[v] || ['running','planned'].includes(source.variants[v].status))throw new Error('Generation pending or invalid condition: '+v);
}
const folder=await mkdtemp(join(run,'verification-'));
const result={...source,sourceRun:run,verifiedAt:new Date().toISOString(),variants:{} as Record<string,unknown>};
for(const v of selected){
  const dir=join(folder,v), hashes:Record<string,string>={};
  await mkdir(dir);
  for(const name of ['index.html','styles.css','app.js']){
    try{
      await copyFile(join(run,v,name),join(dir,name));
      hashes[name]=createHash('sha256').update(await readFile(join(dir,name))).digest('hex');
    }catch(err){if((err as NodeJS.ErrnoException).code!=='ENOENT')throw err;}
  }
  const report=await audit(dir,{browser:true});
  const passed=report.staticChecks.every(c=>c.passed);
  result.variants[v]={...source.variants[v],generationStatus:source.variants[v].status,status:passed?'generated-static-passed':'generated-static-failed',browser:report.browser.status,hashes};
  if(!passed || report.browser.status!=='passed')process.exitCode=1;
}
await writeFile(join(folder,'manifest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({folder,variants:result.variants},null,2));
