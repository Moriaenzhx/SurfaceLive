import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {contractInstruction,guardBrandConflict,requirementsFor,validateContract} from '../../live-engine/design/contract.mjs';
import {tokenNames} from '../../live-engine/design/contract-schema.mjs';
import {journeyInstruction} from '../../live-engine/design/journey.mjs';
import {DesignTrace,readRevisionContract} from '../design-trace.mjs';
import {prepareTurn} from '../prepare-turn.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const example=async id=>JSON.parse(await readFile(new URL('../../docs/live-engine/examples/k03a/'+id+'.json',import.meta.url)));
const scene=()=>({dimensions:{task:[]},uncertainties:[],assumptionsToVerify:[],hardRequirements:[],tokenLocks:[],conflicts:[]});
async function privateTrace(t,request='验证',agent='codex'){
  const root=await mkdtemp(join(tmpdir(),'surface-contract-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return DesignTrace.begin(root,randomUUID(),{request,agent,target:'auto'});
}
async function useDesignFixture(t){
  const root=await mkdtemp(join(tmpdir(),'surface-contract-fixture-'));
  const executable=join(root,'design-agent.cjs'),prior=process.env.SURFACELIVE_CODEX_EXEC;
  const bytes=await readFile(new URL('design-agent-fixture.cjs',import.meta.url));
  await writeFile(executable,bytes,{mode:0o700});
  process.env.SURFACELIVE_CODEX_EXEC=executable;
  t.after(async()=>{
    if(prior===undefined)delete process.env.SURFACELIVE_CODEX_EXEC;
    else process.env.SURFACELIVE_CODEX_EXEC=prior;
    await rm(root,{recursive:true,force:true});
  });
}

test('知时示例的结果与理由有自己的首屏、操作和民俗边界',async()=>{
  const c=validateContract(await example('zhishi'));
  const states=c.experiencePlan.states;
  assert.deepEqual(states.map(s=>s.id),['initial','submitted','results','reason','saved']);
  const result=states.find(s=>s.id==='results');
  assert.equal(result.priority[0],'候选时段');
  assert.notEqual(states[0].priority[0],result.priority[0]);
  const mobile=c.evaluationPlan.checks.find(s=>s.state==='results'&&s.viewport==='mobile');
  assert.match(mobile.firstViewport.join(),/时段与理由入口/);
  assert(c.requirements.explicit.some(s=>s.includes('科学保证')));
  assert.match(c.artDirection.caseDecisions.find(d=>d.id==='vis-nearby').boundary,/地理/);
  assert.deepEqual(Object.keys(c.designSystem.tokens).sort(),[...tokenNames].sort());
});

test('招聘示例把名单、缺口、原文和结论关联到操作，两端阅读结构独立',async()=>{
  const c=validateContract(await example('recruiting'));
  const {entities,layouts,states}=c.experiencePlan;
  assert(entities.includes('证据缺口')&&entities.includes('复核结论'));
  assert.equal(states.find(s=>s.id==='source').controls[0],'标为需补证');
  assert.match(layouts.desktop.structure,/并排/);
  assert.match(layouts.mobile.structure,/返回名单/);
  for(const id of ['vis-calc','vis-gnucash']){
    assert.equal(c.artDirection.caseDecisions.find(d=>d.id===id).adopt,false);
    assert(!c.provenance.adoptedKnowledgeIds.includes(id));
    assert(contractInstruction(c).includes('排除 ['+id+']'));
  }
});

test('模糊需求保留未知和默认方案，用户没有指定颜色',async()=>{
  const c=validateContract(await example('ambiguous'));
  assert(c.requirements.uncertainties.length&&c.requirements.assumptions.length);
  assert.deepEqual(c.requirements.tokenLocks,[]);
  assert(!c.requirements.explicit.some(q=>/蓝|色|#/.test(q)));
  assert.equal(c.experiencePlan.audience[0].source,'director-inference');
  assert(c.provenance.decisionSources.some(d=>d.path==='/designSystem'&&d.source==='art-director'));
  assert(c.designSystem.creativeFreedom&&c.evaluationPlan.humanQuestions.length);
});

test('只有原文中的肯定字面值能成为指定角色的硬 Token；父版约束继续生效',()=>{
  const quoted='品牌色必须使用 #abc',lock={token:'color.brand.primary',value:'#abc',quote:quoted};
  const r=requirementsFor(quoted+'，保留搜索。',scene());
  assert.deepEqual(r.tokenLocks,[lock]);
  assert.deepEqual(requirementsFor('调整导航',scene(),{requirements:r}).tokenLocks,[lock]);
  assert.throws(()=>requirementsFor('品牌色为 #445566',scene(),{requirements:r}),/硬 Token 冲突/);
  for(const phrase of ['例如品牌色 #abc','建议使用品牌色 #abc','禁止品牌色 #abc']){
    assert.deepEqual(requirementsFor(phrase,scene()).tokenLocks,[]);
    assert.throws(()=>requirementsFor(phrase,{...scene(),tokenLocks:[{...lock,quote:'品牌色 #abc'}]}),/硬 Token 缺少/);
  }
  assert.throws(()=>requirementsFor(quoted,{...scene(),tokenLocks:[{...lock,token:'color.text.primary'}]}),/语义角色/);
  assert.throws(()=>requirementsFor('高级官网',{...scene(),hardRequirements:['必须使用蓝色']}),/逐字依据/);
  assert.deepEqual(requirementsFor('建议使用蓝色',{...scene(),hardRequirements:['使用蓝色']}).explicit,[]);
});

test('互斥品牌条款在正式入口阻断，证据不产生源码或 CLI 回执',async t=>{
  const brief='保持现有品牌视觉不变，但整体换成完全不同的视觉体系。';
  const trace=await privateTrace(t,brief);
  await assert.rejects(prepareTurn({description:brief,brief,input:{target:'auto',text:brief},variant:'A2',trace}),/品牌硬约束冲突/);
  assert.match(trace.data.contractError,/保持现有品牌视觉不变/);
  assert.equal(trace.data.stage,'contract-blocked');
  assert.equal(trace.data.invocations,undefined);
  assert.equal(trace.data.sourceInputs,undefined);
  assert.doesNotThrow(()=>guardBrandConflict('保持现有品牌视觉不变，不要整体换成完全不同的视觉体系。'));
  assert.doesNotThrow(()=>guardBrandConflict('无需保持现有品牌视觉不变，整体换成完全不同的视觉体系。'));
  const conflicts=[{first:'只允许搜索',second:'禁止搜索',reason:'同一操作同时必需和禁用'}];
  assert.throws(()=>requirementsFor('只允许搜索。禁止搜索。',{...scene(),conflicts}),/用户约束冲突/);
});

test('版本、身份、类型、来源和用户约束均参与运行时校验',async()=>{
  const original=await example('ambiguous');
  const invalid=(alter,err)=>{const c=structuredClone(original);alter(c);assert.throws(()=>validateContract(c),err);};
  invalid(c=>{c.schemaVersion='8';},/允许范围/);
  invalid(c=>{c.runId='unknown';},/身份无效/);
  invalid(c=>{c.experiencePlan.states='initial';},/需要数组/);
  invalid(c=>{delete c.artDirection.density;},/缺少字段/);
  invalid(c=>{c.undocumented='x';},/未知字段/);
  invalid(c=>{c.provenance.decisionSources[1].source='user';},/决策来源/);
  invalid(c=>{c.provenance.adoptedKnowledgeIds.push('not-retrieved');},/采用知识/);
  invalid(c=>{c.requirements.explicit.push('蓝色');},/原始需求/);
  invalid(c=>{c.experiencePlan.tasks[0].evidence='另一则需求';},/请求依据/);
  invalid(c=>{c.experiencePlan.tasks[0].value='';},/字段类型/);
  const locked=structuredClone(original),quote='品牌色必须使用 #112233';
  locked.requirements.brief+=' '+quote;
  locked.requirements.explicit.push(quote);
  locked.requirements.tokenLocks.push({token:'color.brand.primary',value:'#112233',quote});
  locked.provenance.decisionSources.push({path:'/designSystem/tokens/color.brand.primary',source:'user',reference:'/requirements/tokenLocks/0'});
  assert.throws(()=>validateContract(locked),/用户硬约束与 Token 不一致/);
  locked.designSystem.tokens['color.brand.primary']='#112233';
  assert.equal(validateContract(locked),locked);
});

test('校验拒绝矛盾的艺术 Token、不可达的状态和缺席的验收条件',async()=>{
  const original=await example('zhishi');
  const invalid=(alter,err)=>{const c=structuredClone(original);alter(c);assert.throws(()=>validateContract(c),err);};
  invalid(c=>{c.artDirection.surfaceTone='dark';},/明暗/);
  invalid(c=>{c.designSystem.tokens['type.size.heading']='12px';},/标题字阶/);
  invalid(c=>{c.designSystem.tokens['color.text.primary']=c.designSystem.tokens['color.surface.base'];},/对比度/);
  invalid(c=>{c.experiencePlan.states.at(-1).priority=['孤立的实体'];},/优先级/);
  invalid(c=>{c.experiencePlan.transitions.pop();},/无法到达/);
  invalid(c=>{c.experiencePlan.states.forEach(s=>s.priority=c.experiencePlan.entities);},/重心变化/);
  invalid(c=>{c.experiencePlan.layouts.mobile=c.experiencePlan.layouts.desktop;},/桌面和手机/);
  invalid(c=>{c.evaluationPlan.checks.pop();},/状态和视口/);
  invalid(c=>{c.evaluationPlan.checks[0].controls=['其它动作'];},/控件不一致/);
  invalid(c=>{c.artDirection.caseDecisions.find(d=>d.adopt).adopt=false;},/采用知识/);
  invalid(c=>{c.evaluationPlan.journey[0].operation='fill';c.evaluationPlan.journey[0].value='';},/业务操作缺少/);
});

test('A2 生产准备器用单次场景和导演夹具调用组装每个候选；A0/A1 维持原入口',async t=>{
  // Only this test process uses the bundled offline transport. Every recorded invocation must declare the override.
  await useDesignFixture(t);
  const brief='为邻里居民制作周末活动报名页面。';
  for(const variant of ['A0','A1','A2']){
    const trace=await privateTrace(t,brief);
    const options={type:'codex',cwd:trace.folder,signal:new AbortController().signal,onInvocation:(c,p)=>trace.invocation(c,p)};
    const prepared=await prepareTurn({description:brief,brief,input:{text:brief,target:'mobile'},trace,variant,options});
    assert.deepEqual((trace.data.invocations??[]).map(i=>i.operation),variant==='A0'?[]:variant==='A1'?['scene']:['scene','art-direction']);
    assert((trace.data.invocations??[]).every(i=>i.override));
    if(variant!=='A2'){assert.equal(prepared.contractFor,undefined);continue;}
    assert.equal(trace.data.contracts.length,2);
    for(const option of prepared.artDirection.options){
      const c=prepared.contractFor(option),prompt=prepared.promptFor(option);
      assert.equal(c.schemaVersion,'1.1');
      assert(c.experiencePlan.states.every(s=>s.primaryAction.nextState));
      assert(trace.data.designLanguage.shortlist.length<=2);
      assert(!prompt.includes('设计语言候选（JSON）'));
      assert(prompt.includes(c.artDirection.language.tokenRationale));
      for(const p of c.artDirection.principles)assert(prompt.includes(p.guidance));
      assert.equal(c.runId,trace.data.attemptId);
      assert(prompt.includes(contractInstruction(c))&&prompt.includes('data-task='));
      assert(!prompt.includes(JSON.stringify(c)));
      const file=trace.data.contracts.find(f=>f.id===c.id);
      const bytes=await readFile(join(trace.folder,file.file));
      assert.equal(hash(bytes),file.sha256);
      assert.equal((await stat(join(trace.folder,file.file))).mode&0o777,0o600);
      assert.equal(validateContract(JSON.parse(bytes)).id,c.id);
    }
  }
});

test('缺少视觉案例决定时保存原回答，仅接受一次纠正；持续矛盾会在源码前停止',async t=>{
  await useDesignFixture(t);
  for(const permanent of [false,true]){
    const brief='邻里活动报名 '+(permanent?'CONTRACT_BAD_FIXTURE':'CONTRACT_RETRY_FIXTURE');
    const trace=await privateTrace(t,brief);
    const options={type:'codex',cwd:trace.folder,signal:new AbortController().signal,onInvocation:(c,p)=>trace.invocation(c,p)};
    const plan=prepareTurn({description:brief,brief,input:{text:brief,target:'mobile'},trace,variant:'A2',options});
    if(permanent){
      await assert.rejects(plan,/案例/);
      assert.equal(trace.data.stage,'contract-blocked');
      assert.equal(trace.data.contracts,undefined);
    }else assert((await plan).selected);
    const stage=trace.data.steps['art-direction'];
    assert.equal(stage.attempts.length,2);
    assert.match(stage.attempts[0].validationError,/案例/);
    assert.equal(stage.status,permanent?'failed':'validated');
    assert.equal(trace.data.sourceInputs,undefined);
    assert.deepEqual(trace.data.invocations.map(c=>c.operation),['scene','art-direction','art-direction-correction']);
    for(const record of stage.attempts)assert((await stat(join(trace.folder,record.response))).size>0);
  }
});

test('初稿、备选和修复绑定实发输入与独立源码；篡改不可发布，手调保留来源',async t=>{
  const trace=await privateTrace(t),a=await example('zhishi'),b=await example('recruiting');
  a.runId=b.runId=trace.data.attemptId;
  await trace.storeContracts([a,b],a.directionId);
  const source={title:'单测',html:'<html>初稿</html>',css:'body{}',js:'void 0'};
  const alt={...source,html:'<html>备选</html>'},fixed={...alt,css:'body{margin:0}'};
  await assert.rejects(trace.generated('source',source),/候选契约输入/);
  await assert.rejects(trace.source({id:'skipped'},source),/最终源码/);
  for(const [operation,c,product] of [['source',a,source],['alternative',b,alt],['repair',b,fixed]]){
    const prompt=contractInstruction(c)+'\n'+journeyInstruction(c.evaluationPlan.journey)+'\n任务 '+operation;
    await assert.rejects(trace.contractInput(operation,c.id,'仅 ID '+c.id),/完整契约指令/);
    await assert.rejects(trace.contractInput(operation,c.id,contractInstruction(c)),/完整契约指令/);
    await trace.contractInput(operation,c.id,prompt);
    await assert.rejects(trace.generated(operation,product),/实发契约回执/);
    const receipt={operation,outcome:'returned',reportedModels:[],override:true,promptSha256:hash(prompt)};
    await assert.rejects(trace.invocation(receipt,prompt+'X'),/实发文本/);
    await trace.invocation(receipt,prompt);await trace.generated(operation,product);
    const bound=trace.data.sourceInputs[operation];
    assert.equal(bound.contractId,c.id);assert.equal(bound.promptSha256,receipt.promptSha256);
  }
  const revision={id:randomUUID(),project:randomUUID(),parent:null};
  await trace.record('review-finished',{finalSourceInput:{candidate:'repair',sha256:trace.data.sourceInputs.alternative.promptSha256}});
  await assert.rejects(trace.source(revision,fixed),/最终输入/);
  await trace.record('review-finished',{finalSourceInput:{candidate:'repair',sha256:trace.data.sourceInputs.repair.promptSha256}});
  await assert.rejects(trace.source(revision,alt),/最终源码/);
  await assert.rejects(stat(join(trace.folder,'index.html')),{code:'ENOENT'});
  await trace.source(revision,fixed);
  assert.equal(revision.designContract.id,b.id);
  assert.equal(trace.data.code.promptSha256,trace.data.sourceInputs.repair.promptSha256);
  assert.notEqual(trace.data.code.sourceVersion,trace.data.sourceInputs.alternative.sourceVersion);
  const base={...revision,folder:trace.folder};
  assert.equal((await readRevisionContract(base)).id,b.id);
  assert.equal(await readRevisionContract({id:'legacy'}),null);
  const manual=await privateTrace(t,'手动修改','manual');
  await manual.storeContracts([b],b.directionId);
  const manualRev={id:randomUUID(),designContract:{...manual.data.contracts[0],application:'inherited-manual-edit'}};
  await manual.source(manualRev,{...fixed,css:'body{margin:4px}'});
  assert.equal(manual.data.code.contractId,b.id);assert.equal(manual.data.code.application,'inherited-manual-edit');
  assert.equal(manual.data.invocations,undefined);assert.equal(manual.data.code.promptSha256,undefined);
  await assert.rejects(readRevisionContract({...base,designContract:{...base.designContract,file:'../escape'}}),/引用无效/);
  await writeFile(join(trace.folder,base.designContract.file),'{}');
  await assert.rejects(readRevisionContract(base),/哈希不符/);
});
