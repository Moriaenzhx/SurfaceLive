// Offline audit of real K-03B desktop receipts. stdout is the JSON report; no files or model sessions are created.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {validateScene} from '../live-engine/design/scene.mjs';
import {matchDesignSeeds,directorSeedBrief} from '../live-engine/design/design-language.mjs';
import {validateStrategies,validateDirectionDifferences} from '../live-engine/design/director.mjs';
import {assembleContract,contractInstruction,requirementsFor} from '../live-engine/design/contract.mjs';
import {journeyInstruction} from '../live-engine/design/journey.mjs';
import {readRevisionContract} from '../desktop/design-trace.mjs';
import {composePrompt,devices} from '../desktop/engine.mjs';
import {sourceFiles} from '../desktop/library.mjs';
import {cases} from './k01-cases.mjs';

const root=resolve('runs/K-03B'),hash=data=>createHash('sha256').update(data).digest('hex');
const json=async file=>JSON.parse(await readFile(file));
function stored(base,name){
  const path=resolve(base,name);assert(path.startsWith(resolve(base)+sep),'unexpected artifact path '+name);return path;
}
async function imageEvidence(base,record){
  const file=stored(base,record.file),bytes=await readFile(file);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',record.file);
  assert.equal(hash(bytes),record.sha256,record.file);
  assert.equal(bytes.length,record.bytes,record.file);
  assert.equal(bytes.readUInt32BE(16),record.width);assert.equal(bytes.readUInt32BE(20),record.height);
  return {...record,file:relative(root,file)};
}
async function verify(file){
  const receipt=await json(file),folder=dirname(file);
  assert(Object.hasOwn(cases,receipt.scenario));assert.equal(receipt.request,cases[receipt.scenario].text);
  assert.equal(receipt.agent,'codex');assert(['BLOCKED','FUNCTIONAL_FAILURE','READY'].includes(receipt.status),'unknown outcome');
  const report={scenario:receipt.scenario,receipt:relative(root,file),status:receipt.status,runId:receipt.runId??null,
    entry:receipt.entry,model:receipt.model,effort:receipt.effort,elapsedMs:Date.parse(receipt.endedAt)-Date.parse(receipt.startedAt),
    calls:[],stages:[],directions:[],browser:[],error:receipt.error??null};
  for(const [name,sha] of Object.entries(receipt.runtimeHashes??{}))assert.equal(hash(await readFile(stored(receipt.runtime,name))),sha,name);
  if(!receipt.trace){assert.equal(receipt.status,'BLOCKED');assert(report.error,'missing blocker');return report;}
  const traceFile=stored(folder,receipt.trace),base=dirname(traceFile);
  const bytes=await readFile(traceFile),t=JSON.parse(bytes);
  assert.equal(t.attemptId,report.runId);assert.equal(t.request,receipt.request);
  report.trace={file:relative(root,traceFile),sha256:hash(bytes)};
  for(const call of t.invocations??[]){
    assert.equal(call.override,false,'offline fixture is not real generation');assert.equal(call.agent,'codex');
    assert.equal(call.requestedModel,receipt.model);assert(/^(scene|art-direction)(-correction)?$|^source$/.test(call.operation),'unexpected call '+call.operation);
    const file=call.operation==='source'?'prompt.md':join('steps',call.operation.replace(/-correction$/,''),
      call.operation.endsWith('-correction')?'correction-prompt.md':'prompt.md');
    assert.equal(hash(await readFile(stored(base,file))),call.promptSha256,call.operation);
    report.calls.push({operation:call.operation,sessionId:call.sessionId,reportedModels:call.reportedModels,
      outcome:call.outcome,promptSha256:call.promptSha256,elapsedMs:call.elapsedMs,tokens:call.totalTokens,costUsd:call.costUsd});
  }
  for(const [name,step] of Object.entries(t.steps??{})){
    const stage={name,status:step.status,error:step.error??null,attempts:[]};
    for(const a of step.attempts){
      const response=stored(base,a.response),prompt=stored(base,a.prompt);
      stage.attempts.push({response:relative(root,response),responseSha256:hash(await readFile(response)),
        prompt:relative(root,prompt),promptSha256:hash(await readFile(prompt)),validationError:a.validationError??null});
    }
    report.stages.push(stage);
  }
  const sourceCalls=(t.invocations??[]).filter(call=>call.operation==='source');
  assert(sourceCalls.length<=1,'source budget exceeded');
  if(!t.designLanguage&&!t.contracts?.length){assert.equal(receipt.status,'BLOCKED');assert.equal(sourceCalls.length,0);return report;}
  const analysis=validateScene(await json(stored(base,t.steps.scene.response)),t.request);
  assert.deepEqual(analysis,t.scene.analysis);
  const matches=matchDesignSeeds({brief:t.request,analysis,device:t.scene.device});
  const seedText=directorSeedBrief(matches),language=t.designLanguage;
  assert(language,'trace has no K-03B language shortlist');
  assert.deepEqual(language.shortlist,matches.map(({id,score,reasons,seed})=>({id,score,reasons,sha256:seed.sha256,references:seed.references})));
  assert.equal(hash(seedText),language.seedContextSha256);assert.equal(Buffer.byteLength(seedText),language.seedContextBytes);
  const directorRequested=t.events.some(e=>e.stage==='art-direction-requested');
  if(directorRequested)assert((await readFile(stored(base,'steps/art-direction/prompt.md'),'utf8')).includes(seedText));
  report.directorInput={requested:directorRequested,seedIds:matches.map(m=>m.id),seedContextSha256:hash(seedText),seedContextBytes:Buffer.byteLength(seedText),ruleIds:language.ruleIds};
  if(!t.contracts?.length){assert.equal(receipt.status,'BLOCKED');assert.equal(sourceCalls.length,0);return report;}
  const optionSchema=(await json(stored(base,'steps/art-direction/schema.json'))).properties.options.items.properties;
  const rules=optionSchema.ruleIds.items.enum??[],visual=optionSchema.visualCaseIds.items.enum??[];
  assert.deepEqual([...language.ruleIds].sort(),[...rules].sort());
  const k=t.knowledge,knowledge={...k,rules:k.rules.filter(r=>rules.includes(r.id)),
    reviewedCards:k.reviewedCards.filter(c=>rules.includes(c.id)||visual.includes(c.id))};
  const raw=await json(stored(base,t.steps['art-direction'].response));
  const selection=validateStrategies(raw,knowledge,true);
  validateDirectionDifferences(selection.options);
  assert.deepEqual({...selection,status:'selected'},t.artDirection);
  const requirements=requirementsFor(t.request,analysis);
  const viewports=[...new Set([t.scene.device,'desktop','mobile'])].map(device=>({device,width:devices[device].width,height:devices[device].height}));
  let selected;
  assert.equal(t.contracts.length,raw.options.length);
  for(const ref of t.contracts){
    const c=await readRevisionContract({folder:base,designContract:ref});
    assert.equal(c.schemaVersion,'1.1');assert.equal(c.runId,report.runId);
    const option=selection.options.find(o=>o.id===c.directionId);
    const rebuilt=assembleContract({runId:t.attemptId,brief:t.request,analysis,requirements,knowledge,option,selection,
      steps:selection.journey,viewports,schemaVersion:'1.1',seedMatches:matches});
    assert.deepEqual({...rebuilt,id:c.id},c,'saved contract differs from the verified director decision');
    const chosen=c.id===t.selectedContractId;
    assert.equal(chosen,c.directionId===raw.selectedId);
    if(chosen)selected=c;
    report.directions.push({id:c.directionId,contractId:c.id,name:c.artDirection.concept,selected:chosen,sha256:ref.sha256,
      file:relative(root,stored(base,ref.file)),selection:c.artDirection.selection,...c.artDirection.language});
  }
  assert(selected);
  report.stateGraph=selected.experiencePlan.states.map(s=>({stateId:s.id,goal:s.purpose,primaryInformation:s.priority[0],
    primaryAction:s.controls[0],id:s.primaryAction.id,operation:s.primaryAction.operation,nextState:s.primaryAction.nextState}));
  if(t.prompt){
    const instruction=contractInstruction(selected),binding=t.sourceInputs?.source;
    const rendered=composePrompt(t.request,t.scene,null,t.request,instruction,'1.1')+'\n'+journeyInstruction(selected.evaluationPlan.journey);
    const prompt=await readFile(stored(base,t.prompt.file),'utf8');
    assert.equal(hash(prompt),t.prompt.sha256);assert.equal(rendered,prompt,'final coding input mismatch');
    if(binding){
      assert.equal(binding.contractId,selected.id);assert.equal(binding.promptSha256,hash(prompt));
      assert.equal(binding.contractSha256,report.directions.find(d=>d.selected).sha256);
      const principles=selected.artDirection.principles.map(({seedId,principleId,sourceIds})=>({seedId,principleId,sourceIds}));
      assert.deepEqual(binding.language,{mode:selected.artDirection.language.mode,principles,stateIds:report.stateGraph.map(s=>s.stateId),
        instructionSha256:hash(instruction)});
      for(const call of sourceCalls){
        assert.equal(call.promptSha256,binding.promptSha256);assert.equal(call.contractSha256,binding.contractSha256);assert.equal(call.contractId,selected.id);
      }
      report.codingInput={file:relative(root,stored(base,t.prompt.file)),sha256:hash(prompt),bytes:Buffer.byteLength(prompt),...binding.language};
    }
  }
  if(!t.code){assert.equal(receipt.status,'BLOCKED');return report;}
  assert.equal(sourceCalls.length,1);assert.equal(sourceCalls[0].outcome,'returned');
  const order=['contracts-validated','contract-input-prepared','agent-requested','contract-output-linked','source-recorded']
    .map(stage=>t.events.findIndex(event=>event.stage===stage));
  assert(order.every((index,i)=>index>=0&&(!i||index>order[i-1])),'Contract and source generation events are out of order');
  assert.equal(t.code.contractId,selected.id);assert.equal(t.code.contractSha256,t.sourceInputs.source.contractSha256);
  assert.equal(t.code.promptSha256,report.codingInput.sha256);
  const byFile={};
  for(const name of Object.keys(sourceFiles)){
    const bytes=await readFile(stored(base,name));byFile[name]=hash(bytes);
    assert.equal(byFile[name],t.code.files[name].sha256,name);assert.equal(bytes.length,t.code.files[name].bytes,name);
  }
  report.sourceVersion=hash(JSON.stringify(byFile));
  assert.equal(report.sourceVersion,t.sourceInputs.source.sourceVersion);assert.equal(report.sourceVersion,t.code.sourceVersion);
  for(const check of t.browser){
    assert.deepEqual(check.requestedViewport,{width:devices[check.device].width,height:devices[check.device].height});
    const view={device:check.device,functionalPass:check.functionalPass,requestedViewport:check.requestedViewport,viewport:check.viewport,fits:check.fits,errors:check.errors,
      journey:check.journey,states:[],screenshot:check.screenshot?await imageEvidence(base,check.screenshot):null};
    const measured=check.contractCheck;
    if(measured){
      assert.equal(measured.contractId,selected.id);assert.equal(measured.directionId,selected.directionId);
      for(const state of measured.states){
        const definition=selected.experiencePlan.states.find(s=>s.id===state.stateId);assert(definition);
        assert.equal(state.actionId,definition.primaryAction.id);assert.equal(state.nextState,definition.primaryAction.nextState);
        assert.equal(state.primaryInformation,definition.priority[0]);
        const screenshot=state.screenshot?await imageEvidence(base,state.screenshot):null;
        const uncertain=state.captureUncertain?await imageEvidence(base,state.captureUncertain):null;
        view.states.push({stateId:state.stateId,actionId:state.actionId,nextState:state.nextState,passed:state.passed,
          accessibility:state.accessibility??null,expectedText:state.expectedText,observed:state.result??null,
          primaryInformation:state.before?.information??null,transientDOM:state.transientDOM??null,screenshot,captureUncertain:uncertain});
      }
      view.stateError=measured.error??null;view.unreached=measured.unreached;view.findings=measured.findings;view.statePass=measured.passed;
      if(measured.passed){
        assert.deepEqual(measured.unreached,[]);
        assert.deepEqual(view.states.map(s=>s.stateId).sort(),selected.experiencePlan.states.map(s=>s.id).sort());
        assert(view.states.every(s=>s.passed&&(s.screenshot||s.transientDOM||s.captureUncertain)),'state requires observed evidence');
      }
    }
    if(view.functionalPass)assert(measured?.passed,'missing contract verification on passing view');
    report.browser.push(view);
  }
  assert.deepEqual(report.browser.map(v=>v.device).sort(),['desktop','mobile']);
  assert.equal(report.browser.every(v=>v.functionalPass),receipt.status==='READY');
  report.visualReview=t.visualReview?.status??'not-run';
  report.automaticRepair=t.automaticRepair?.status??'not-run';
  return report;
}
const args=process.argv.slice(2);
assert(args.length,'Pass one K-03B receipt.json per attempt');
const attempts=[];
for(const name of args)attempts.push(await verify(resolve(name)));
for(const scenario of Object.keys(cases)){
  assert(attempts.filter(a=>a.scenario===scenario).flatMap(a=>a.calls).filter(call=>call.operation==='source').length<=1,'multiple source calls '+scenario);
}
console.log(JSON.stringify({verifiedReceipts:attempts.length,ready:attempts.filter(a=>a.status==='READY').length,attempts},null,2));
