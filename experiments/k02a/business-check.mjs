// Use the existing task journeys against immutable sources. No screenshots or evidence are written to K-01.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {journeys} from '../k01-journeys.mjs';
import {sha256,readJSON} from '../design-evidence.mjs';
const manifest=await readJSON('runs/K-01/verified-manifest.json'),views=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
  for(const r of manifest){
    const key=r.scene+'/'+r.group;
    const proof=await readJSON(join('runs/K-01',key,'verification/results.json'));
    assert.equal(proof.sourceVersion,r.sourceVersion);
    const urls=[];
    for(const [file,digest] of Object.entries(proof.files)){
      const path=resolve(r.source,file);assert.equal(sha256(await readFile(path)),digest);urls.push(pathToFileURL(path).href);
    }
    for(let round=1;round<=2;round++){
      for(const {device,viewport} of proof.views){
        const ctx=await browser.newContext({viewport,locale:'zh-CN',timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
        const row={key,device,viewport,sourceVersion:r.sourceVersion,run:r.run_id,round,steps:[],errors:[]};
        views.push(row);
        try{
          await ctx.route('**/*',route=>urls.includes(route.request().url())?route.continue():route.abort());
          const p=await ctx.newPage();p.setDefaultTimeout(3500);
          p.on('pageerror',err=>row.errors.push(err.message));
          p.on('console',msg=>{if(msg.type()==='error')row.errors.push(msg.text());});
          await p.goto(urls[0]);assert.equal(await p.evaluate(()=>localStorage.length),0);
          await journeys[key](p,async(label,action)=>{
            const observed=await action();row.steps.push({label,observed});
          });
          row.completed=true;
        }catch(error){row.error=error.message;}
        finally{await ctx.close();}
      }
    }
  }
}finally{
  await browser.close();
  const folder=await mkdtemp('runs/K-02A/tests/business-');
  await writeFile(join(folder,'results.json'),JSON.stringify(views,null,2)+'\n');
  console.log(folder,views.filter(v=>v.completed&&!v.errors.length).length+'/'+views.length);
}
assert(views.length===16&&views.every(v=>v.completed&&!v.errors.length));
