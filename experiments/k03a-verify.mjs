// Offline verification of historical bytes, live CLI receipts and delivered code. No Agent invocation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {basename,dirname,join,relative,resolve} from 'node:path';
import {assembleContract,contractInstruction,requirementsFor} from '../live-engine/design/contract.mjs';
import {readRevisionContract} from '../desktop/design-trace.mjs';
import {composePrompt,devices} from '../desktop/engine.mjs';
import {sourceFiles} from '../desktop/library.mjs';
import {journeyInstruction} from '../live-engine/design/journey.mjs';
import {validateScene} from '../live-engine/design/scene.mjs';
import {validateStrategies} from '../live-engine/design/director.mjs';

const root=resolve('runs/K-03A'),hash=data=>createHash('sha256').update(data).digest('hex');
const json=async file=>JSON.parse(await readFile(file));
async function files(folder){
  const out=[];
  for(const e of await readdir(folder,{withFileTypes:true})){
    const path=join(folder,e.name);
    if(e.isDirectory())out.push(...await files(path));
    else if(e.isFile())out.push(path);
  }
  return out;
}
const frozen=await json(join(root,'prior-evidence-sha256.json'));
const current=[...await files('runs/K-01'),...await files('runs/K-02A')].sort();
assert.deepEqual(current,Object.keys(frozen).sort(),'Historical file set changed');
for(const name of current)assert.equal(hash(await readFile(name)),frozen[name],name);
const report={historicalFilesVerified:current.length,attempts:[]};
const finalRuntime=(await readFile(join(root,'regression-runtime.txt'),'utf8')).trim();
for(const folder of (await readdir(root)).filter(n=>/^(?:zhishi|recruiting|ambiguous)-/.test(n)).sort()){
  const dir=join(root,folder),receipt=await json(join(dir,'receipt.json'));
  const path=join(dir,receipt.trace??'interrupted-attempt/design-trace.json');
  const t=await json(path),base=dirname(path);
  assert.equal(t.attemptId,receipt.runId);assert.equal(t.request,receipt.request);
  const record={scenario:receipt.scenario,status:receipt.status,trace:relative(root,path),runId:t.attemptId,
    traceSha256:hash(await readFile(path)),elapsedMs:Date.parse(receipt.endedAt)-Date.parse(receipt.startedAt),
    runtime:basename(receipt.runtime),finalRuntimeDelta:[],calls:[],contracts:[],browser:[]};
  for(const [file,sha] of Object.entries(receipt.runtimeHashes)){
    assert.equal(hash(await readFile(join(receipt.runtime,file))),sha,file);
    if(hash(await readFile(join(finalRuntime,file)))!==sha)record.finalRuntimeDelta.push(file);
  }
  for(const i of t.invocations??[]){
    assert.equal(i.override,false);assert.equal(i.agent,'codex');assert.equal(i.requestedModel,receipt.model);
    const stage=i.operation.replace(/-correction$/,'');
    const file=stage==='source'?'prompt.md':join('steps',stage,i.operation.endsWith('-correction')?'correction-prompt.md':'prompt.md');
    assert.equal(hash(await readFile(join(base,file))),i.promptSha256,file);
    record.calls.push({operation:i.operation,outcome:i.outcome,model:i.reportedModels,session:i.sessionId,elapsedMs:i.elapsedMs,
      promptSha256:i.promptSha256,tokens:i.totalTokens,costUsd:i.costUsd,override:i.override});
  }
  const inputs=t.sourceInputs??{};
  if(t.contracts){
    assert(t.contracts.length>=2);
    // Rebuild on the final host using only the immutable answers and evidence of the original run.
    const analysis=validateScene(await json(join(base,t.steps.scene.response)),t.request);
    assert.deepEqual(analysis,t.scene.analysis);
    const answer=await json(join(base,t.steps['art-direction'].response));
    const selection=validateStrategies(answer,t.knowledge,true);
    assert.deepEqual({...selection,status:'selected'},t.artDirection);
    const requirements=requirementsFor(t.request,analysis);
    const viewports=[...new Set([t.scene.device,'desktop','mobile'])].map(device=>({device,width:devices[device].width,height:devices[device].height}));
    for(const ref of t.contracts){
      const c=await readRevisionContract({folder:base,designContract:ref});
      assert.equal(c.runId,t.attemptId);
      assert.equal((await stat(join(base,ref.file))).mode&0o077,0);
      const option=selection.options.find(o=>o.id===c.directionId);
      const rebuilt=assembleContract({runId:t.attemptId,brief:t.request,analysis,requirements,knowledge:t.knowledge,
        option,selection,steps:selection.journey,viewports});
      assert.deepEqual({...rebuilt,id:c.id},c,'Final runtime assembly differs from stored proposal '+c.directionId);
      record.contracts.push({id:c.id,direction:c.directionId,name:c.artDirection.concept,file:relative(root,join(base,ref.file)),
        sha256:ref.sha256,selected:c.id===t.selectedContractId,adoptedKnowledgeIds:c.provenance.adoptedKnowledgeIds});
    }
    const chosen=t.contracts.find(r=>r.id===t.selectedContractId);
    assert.equal(chosen.directionId,t.artDirection.selectedId);
    const c=await readRevisionContract({folder:base,designContract:chosen});
    const prompt=await readFile(join(base,t.prompt.file),'utf8');
    const rendered=composePrompt(t.request,t.scene,null,t.request,contractInstruction(c),true)+'\n'+journeyInstruction(t.artDirection.journey);
    assert.equal(hash(rendered),t.prompt.sha256,'Final runtime code prompt differs from original submission');
    assert.equal(hash(prompt),t.prompt.sha256);assert(prompt.includes(contractInstruction(c)));assert(prompt.includes(journeyInstruction(c.evaluationPlan.journey)));
    record.promptSha256=t.prompt.sha256;
    if(t.code){
      const binding=inputs.source,call=t.invocations.find(i=>i.operation==='source'&&i.outcome==='returned');
      assert(binding&&call);
      const order=['contracts-validated','contract-input-prepared','agent-requested','contract-output-linked','source-recorded']
        .map(stage=>t.events.findIndex(event=>event.stage===stage));
      assert(order.every((index,i)=>index>=0&&(!i||index>order[i-1])),'Contract, CLI and output event order is inconsistent');
      assert.equal(binding.contractId,chosen.id);assert.equal(binding.promptSha256,call.promptSha256);
      assert.equal(call.contractId,chosen.id);assert.equal(call.contractSha256,chosen.sha256);
      assert.equal(t.code.contractId,chosen.id);assert.equal(t.code.promptSha256,hash(prompt));assert.equal(t.code.contractSha256,chosen.sha256);
      const fileHashes={};
      for(const name of Object.keys(sourceFiles)){
        fileHashes[name]=hash(await readFile(join(base,name)));
        assert.equal(fileHashes[name],t.code.files[name].sha256);
      }
      const sourceVersion=hash(JSON.stringify(fileHashes));
      assert.equal(sourceVersion,binding.sourceVersion);assert.equal(t.code.sourceVersion,sourceVersion);
      record.sourceVersion=sourceVersion;
    }
  }
  for(const check of t.browser??[]){
    if(check.screenshot){
      const bytes=await readFile(join(base,check.screenshot.file));
      assert.equal(hash(bytes),check.screenshot.sha256);assert.equal(bytes.readUInt32BE(16),check.screenshot.width);
      assert.equal(bytes.readUInt32BE(20),check.screenshot.height);
    }
    record.browser.push({device:check.device,viewport:check.viewport,functionalPass:check.functionalPass,errors:check.errors.length,
      screenshot:check.screenshot?relative(root,join(base,check.screenshot.file)):null,
      journey:check.journey.map(s=>({step:s.step,passed:s.passed,changed:s.changed}))});
  }
  assert((t.invocations??[]).filter(c=>c.operation==='source').length<=1);
  if(receipt.status==='READY'||receipt.status==='FUNCTIONAL_FAILURE'){
    assert(record.sourceVersion);assert(record.browser.some(b=>b.device==='mobile')&&record.browser.some(b=>b.device==='desktop'));
    assert.equal(record.browser.every(b=>b.functionalPass),receipt.status==='READY');
  }
  if(receipt.scenario==='ambiguous'){
    assert.equal(t.code,null);assert.equal(inputs.source,undefined);
    if(receipt.status==='VALIDATED_PLAN')assert(record.contracts.some(c=>c.selected));
  }
  if(receipt.error)record.error=receipt.error;
  report.attempts.push(record);
}
for(const scene of ['zhishi','recruiting','ambiguous']){
  const attempts=report.attempts.filter(a=>a.scenario===scene);
  assert(attempts.length,scene+' missing');
  assert(attempts.flatMap(a=>a.calls).filter(i=>i.operation==='source').length<=(scene==='ambiguous'?0:1),scene+' exceeds source budget');
}
const output=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--save'))await writeFile(join(root,'verification.json'),output,{mode:0o600,flag:'wx'});
else process.stdout.write(output);
