import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import scenarios from '../live-engine/design/benchmark.json' with {type:'json'};

export const conditions=['A0','A1','A2'];
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
export function trialInput(s){
  const text=s.brief+'\n为重复检验业务行为，所有方案使用以下相同示例及测试钩子。每一步可直接点击，不额外添加测试专用按钮。钩子应标在实际操作与实际业务结果上。通用 primary-action 无需前置操作即可改变状态。\n'+
    s.steps.map(step=>step.action+'，按钮属性 data-task="'+step.id+'"；'+step.result+'，结果容器 data-state="'+step.state+'"。').join('\n');
  return {text,target:s.device,agent:'codex',model:'gpt-6.2-sol',effort:'low',references:[],edits:[]};
}
export function isFunctionalRejection(trace){
  return trace.releaseStatus==='blocked'||trace.visualReview?.status==='blocked';
}
export async function decisionSource(attempt){
  if(attempt.trace.code)return {folder:attempt.revision,revision:attempt.trace.code.revision,files:attempt.trace.code.files};
  const name=attempt.trace.chosenCandidate;
  if(!['initial','alternative','repair'].includes(name))throw Error('未取得最终候选源码 '+attempt.dir);
  const folder=join(attempt.revision,'candidates',name),candidate=await readJSON(join(folder,'checks.json'));
  return {folder,revision:null,files:Object.fromEntries(Object.entries(candidate.files).map(([file,sha256])=>[file,{sha256}]))};
}
export async function replayEvidence(root){
  const {manifest}=await readJSON(join(root,'verification.json'));
  if(!/^verification-[A-Za-z0-9]+\/manifest\.json$/.test(manifest))throw Error('复查目录无效');
  const file=join(root,manifest),data=await readJSON(file);
  return {folder:dirname(file),cases:data.cases};
}
export async function inventory(root){
  const cases=[];
  for(const scenario of scenarios){
    const groups=[],frozen=trialInput(scenario);
    for(const variant of conditions){
      const folder=join(root,scenario.id,variant),attempts=[];
      for(const name of await readdir(folder).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
        if(!name.startsWith('attempt-'))continue;
        const dir=join(folder,name);
        const receipt=await readJSON(join(dir,'receipt.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
        if(!receipt){attempts.push({dir,status:'no-terminal-receipt'});continue;}
        const expectedVersion='profile/revisions/'+(receipt.outcome.kind==='ready'?receipt.outcome.id:'.design-traces/'+receipt.token);
        if(receipt.version!==expectedVersion||!/^profile\/revisions\/(?:\.design-traces\/)?[a-f0-9-]{36}$/.test(expectedVersion))throw Error('非法版本路径 '+dir);
        const input=await readJSON(join(dir,'input.json')),revision=join(dir,expectedVersion),trace=await readJSON(join(revision,'design-trace.json'));
        if(receipt.caseId!==scenario.id||receipt.variant!==variant||trace.attemptId!==receipt.token||trace.variant!==variant||
          input.text!==trace.request||input.model!==trace.agent?.requestedModel||input.effort!==trace.agent?.effort)throw Error('运行输入与回执不符 '+dir);
        if(['text','target','agent','model','effort'].some(k=>input[k]!==frozen[k])||
          input.references?.length||input.edits?.length)throw Error('本次输入与冻结的实验条件不一致 '+dir);
        if(trace.invocations?.some(c=>c.override))throw Error('匿名比较只接受真实本机 CLI '+dir);
        if(trace.invocations?.some(c=>c.requestedModel!==frozen.model||c.reportedModels.some(name=>name!==frozen.model)))
          throw Error('调用记录中的模型与实验条件不一致 '+dir);
        let status=isFunctionalRejection(trace)?'functional-failure':receipt.outcome.kind;
        if(status==='ready'||status==='functional-failure'&&trace.code){
          const shots=trace.browser.map(c=>c.screenshot);
          if(status==='ready'&&shots.some(s=>!s))throw Error('已发布的比较作品缺少截图 '+dir);
          const artifacts=[trace.prompt,...Object.entries(trace.code.files).map(([file,info])=>({file,...info})),...shots.filter(Boolean)];
          const allowed=['prompt.md','index.html','styles.css','app.js','evidence/mobile.png','evidence/desktop.png','evidence/tablet.png'];
          for(const a of artifacts)if(!a||!allowed.includes(a.file)||sha256(await readFile(join(revision,a.file)))!==a.sha256)throw Error('验收原件哈希不符 '+dir);
          if(status==='ready'&&variant==='A2'&&(!trace.steps||['scene','art-direction','pair-review'].some(name=>trace.steps[name]?.status!=='validated')))status='incomplete-condition';
          if(!trace.browser.every(c=>c.functionalPass&&c.journey.length===scenario.steps.length))status='functional-failure';
        }
        attempts.push({dir,status,receipt,trace,input,revision});
      }
      // A failed business flow is a result of the experiment, even if a later attempt would pass.
      attempts.sort((a,b)=>(a.trace?.startedAt||'').localeCompare(b.trace?.startedAt||''));
      const decision=attempts.find(a=>['ready','functional-failure'].includes(a.status));
      groups.push({variant,attempts,decision,sample:decision?.status==='ready'?decision:null});
    }
    const present=groups.filter(g=>g.decision).map(g=>g.decision);
    const conditionsUsed=new Set(present.map(s=>JSON.stringify([s.input.text,s.input.target,s.input.agent,s.input.model,s.input.effort])));
    if(conditionsUsed.size>1)throw Error('同题对照的需求、设备或模型不一致 '+scenario.id);
    cases.push({scenario,groups});
  }
  return cases;
}
