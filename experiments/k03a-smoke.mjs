// One fresh private desktop attempt per business case. "ambiguous" stops after real contract preparation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from 'playwright-core';
import {cases,settings} from './k01-cases.mjs';

const id=process.argv[2],planOnly=id==='ambiguous'||id==='conflict';
const scenario=cases[id]??{ambiguous:{target:'auto',text:'做一个高级的 SaaS 产品官网。'},
  conflict:{target:'auto',text:'保持现有品牌视觉不变，但整体换成完全不同的视觉体系。'}}[id];
assert(['zhishi','recruiting','ambiguous','conflict'].includes(id),'Choose zhishi, recruiting, ambiguous or conflict');
assert(!process.env.SURFACELIVE_CODEX_EXEC&&!process.env.SURFACELIVE_CLAUDE_EXEC,'Only the installed CLI is allowed');
const batch=process.argv[3]??'K-03A';
assert(['K-03A','K-03B'].includes(batch),'Unknown experimental batch');
const root=resolve('runs',batch),runtime=(await readFile(join(root,'runtime-path.txt'),'utf8')).trim();
const output=await mkdtemp(join(root,id+'-')),temp=await realpath(await mkdtemp(join(tmpdir(),'surface-contract-')));
const result={scenario:id,request:scenario.text,...settings,startedAt:new Date().toISOString(),status:'BLOCKED',
  entry:planOnly?'prepareTurn (plan only)':'window.studio.start → studio:start',runtime};
let app;
try{
  if(planOnly){
    const load=file=>import(pathToFileURL(join(runtime,'desktop',file)));
    const {prepareTurn}=await load('prepare-turn.mjs'),{DesignTrace}=await load('design-trace.mjs');
    result.runId=randomUUID();
    const trace=await DesignTrace.begin(output,result.runId,{request:scenario.text,target:'auto',...settings});
    result.trace=result.runId+'/design-trace.json';
    const options={type:settings.agent,model:settings.model,effort:settings.effort,cwd:temp,signal:AbortSignal.timeout(30*60_000),
      onInvocation:(call,prompt)=>trace.invocation(call,prompt)};
    try{
      const plan=await prepareTurn({description:scenario.text,brief:scenario.text,input:scenario,options:id==='conflict'?{}:options,trace,variant:'A2',
        preferenceContext:{file:join(temp,'empty-preferences.sqlite'),project:null}});
      assert.notEqual(id,'conflict','Expected a pre-source conflict');
      await trace.prepared(plan.prompt,plan.context,plan.knowledge,[]);
      await trace.finish('contract-only');result.status='VALIDATED_PLAN';
    }catch(error){
      await trace.finish('failed',{error:error.message});
      if(id!=='conflict'||!trace.data.contractError?.includes('品牌硬约束冲突'))throw error;
      assert.equal(trace.data.invocations,undefined);assert.equal(trace.data.code,null);
      result.status='CONFLICT_BLOCKED';result.reason=error.message;
    }
  }else{
    app=await electron.launch({args:[runtime,'--user-data-dir='+temp,'--workbench-acceptance','--background-design-check','--first-source-only'],
      env:{...process.env,SURFACELIVE_DESIGN_AUDIT:'1'},timeout:45000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),temp);
    const page=await app.firstWindow();await page.getByRole('tab',{selected:true}).waitFor();
    result.runId=await page.evaluate(input=>window.studio.start(input),{...settings,...scenario,base:null,edits:[],references:[]});
    console.log(id,'submitted',result.runId);
    const deadline=Date.now()+65*60_000;
    let outcome;
    while(Date.now()<deadline){
      const state=await page.evaluate(()=>window.studio.state());
      if(!state.job&&state.outcome?.token===result.runId){outcome=state.outcome;break;}
      await delay(600);
    }
    if(!outcome){await page.evaluate(()=>window.studio.cancel());throw Error('Desktop attempt timed out');}
    const src=outcome.kind==='ready'?join(temp,'revisions',outcome.id):join(temp,'revisions','.design-traces',result.runId);
    await cp(src,join(output,'attempt'),{recursive:true});result.trace='attempt/design-trace.json';
    const trace=JSON.parse(await readFile(join(output,result.trace)));
    result.status=outcome.kind==='ready'?'READY':trace.code?'FUNCTIONAL_FAILURE':'BLOCKED';
    if(outcome.message)result.error=outcome.message;
  }
}catch(error){result.error=error.message;}
finally{
  await app?.close();
  if(!planOnly&&result.runId&&!result.trace){
    try{
      await cp(join(temp,'revisions','.design-traces',result.runId),join(output,'interrupted-attempt'),{recursive:true});
      result.trace='interrupted-attempt/design-trace.json';
    }catch(copyError){result.evidenceError=copyError.message;}
  }
  result.endedAt=new Date().toISOString();
  result.runtimeHashes={};
  const batchFiles=batch==='K-03B'?['desktop/contract-check.mjs','desktop/interaction-check.mjs','desktop/preview.mjs','desktop/engine.mjs','desktop/visual-review.mjs',
    'live-engine/design/language-seeds.json','live-engine/design/design-language.mjs','live-engine/design/experience-patterns.mjs','live-engine/design/director.mjs']:[];
  for(const f of ['desktop/main.mjs','desktop/prepare-turn.mjs','desktop/design-trace.mjs','live-engine/design/contract.mjs','live-engine/design/contract-schema.mjs',...batchFiles]){
    result.runtimeHashes[f]=createHash('sha256').update(await readFile(join(runtime,f))).digest('hex');
  }
  await writeFile(join(output,'receipt.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  if(result.trace||!result.runId)await rm(temp,{recursive:true,force:true});
  console.log(output,result.status,result.error??'');
  if(!['READY','VALIDATED_PLAN','CONFLICT_BLOCKED'].includes(result.status))process.exitCode=1;
}
