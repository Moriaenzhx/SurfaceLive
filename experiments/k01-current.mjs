// Click the normal composer in a clean private desktop profile. Never open the owner's library.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile,cp,realpath,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {_electron as electron} from 'playwright-core';
import {cases,settings} from './k01-cases.mjs';
const runtime=(await readFile('runs/K-01/runtime-path.txt','utf8')).trim();
if(process.env.SURFACELIVE_CODEX_EXEC||process.env.SURFACELIVE_CLAUDE_EXEC)throw Error('Real installed CLI required');
const fileHash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
for(const [id,scenario] of Object.entries(cases)){
  const dir=resolve('runs/K-01',id,'A-current');
  await mkdir(dir,{mode:0o700}); // Never silently re-submit an existing experiment.
  const started=Date.now(), profile=await realpath(await mkdtemp(join(tmpdir(),'k01-ui-')));
  const record={...settings,...scenario,startedAt:new Date(started),sourceLimit:1,entry:'desktop #generate',status:'BLOCKED'};
  let app;
  try{
    app=await electron.launch({args:[runtime,'--user-data-dir='+profile,'--workbench-acceptance','--background-design-check','--first-source-only'],
      env:{...process.env,SURFACELIVE_DESIGN_AUDIT:'1'},timeout:45000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    await page.getByRole('tab',{selected:true}).waitFor();
    await page.click('#new');
    if(!await page.locator('#target').isVisible())await page.click('#toggle-right');
    await page.selectOption('#target',scenario.target);
    await page.click('#agent-trigger');await page.click('[data-agent="codex"]');
    await page.click('#model-picker');await page.fill('#model-search',settings.model);
    if(await page.locator('[data-model="'+settings.model+'"]').count())await page.click('[data-model="'+settings.model+'"]');
    else{await page.click('[data-model="@custom"]');await page.fill('#model',settings.model);await page.locator('#model').press('Tab');}
    await page.click('[data-effort="low"]');await page.click('#agent-trigger');
    await page.fill('#brief',scenario.text);await page.click('#generate');
    const deadline=Date.now()+70*60_000;
    let outcome;
    do{
      const state=await page.evaluate(()=>window.studio.state());
      if(state.job&&!record.run_id){record.run_id=state.job.token;console.log(id,'submitted',record.run_id);}
      if(!state.job&&state.outcome){outcome=state.outcome;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }while(Date.now()<deadline);
    if(!outcome){await page.evaluate(()=>window.studio.cancel());throw Error('Desktop deadline');}
    record.run_id=outcome.token;
    const root=join(profile,'revisions');
    const traceDir=outcome.kind==='ready'?join(root,outcome.id):join(root,'.design-traces',outcome.token);
    const evidence=join(dir,'attempt');
    await cp(traceDir,evidence,{recursive:true});
    const trace=JSON.parse(await readFile(join(evidence,'design-trace.json')));
    assert.equal(trace.request,scenario.text);assert.equal(trace.agent.requestedModel,settings.model);
    assert.equal(trace.agent.effort,settings.effort);assert.equal(trace.parent,null);
    record.status=outcome.kind==='ready'?'READY':trace.code?'FUNCTIONAL_FAILURE':'BLOCKED';
    record.error=outcome.message;
    record.traceSha256=await fileHash(join(evidence,'design-trace.json'));
    record.buildEntrySha256=await fileHash(join(runtime,'desktop/main.mjs'));
  }catch(error){
    record.error=error.message;
  }finally{
    await app?.close();record.elapsedMs=Date.now()-started;
    await writeFile(join(dir,'receipt.json'),JSON.stringify(record,null,2)+'\n',{mode:0o600});
    if(record.traceSha256||!record.run_id)await rm(profile,{recursive:true,force:true});
    console.log(id,record.status);
  }
}
