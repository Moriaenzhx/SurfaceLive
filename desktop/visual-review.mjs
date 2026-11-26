import {nativeImage} from 'electron';
import {createHash,randomInt,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {judgePrompt,judgeSchema,validateJudgment} from '../live-engine/design/judge.mjs';
import {object,list,string} from '../live-engine/design/scene.mjs';
import {tokenNames} from '../live-engine/design/contract-schema.mjs';
import {designStage} from './design-stage.mjs';
import {sourceFiles} from './library.mjs';
import {generate} from './agent.mjs';
import {inspectPage} from './preview.mjs';
import {readRevisionContract} from './design-trace.mjs';
import {conflictsWithLocks} from './contract-check.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function json(file,record){await writeFile(file,JSON.stringify(record,null,2)+'\n',{mode:0o600});}
export async function renderCandidate({name,product,prompt,strategy},env){
  const {trace,resources,options,device,steps}=env;
  const folder=join(trace.folder,'candidates',name);
  await mkdir(folder,{recursive:true,mode:0o700});
  const files={};
  for(const [file,key] of Object.entries(sourceFiles)){await writeFile(join(folder,file),product[key],{mode:0o600});files[file]=sha(product[key]);}
  if(prompt)await writeFile(join(folder,'prompt.md'),prompt,{mode:0o600});
  const checks=[],id=randomUUID();
  const ref=trace.data.contracts?.find(r=>r.directionId===strategy);
  const contract=ref?await readRevisionContract({folder:trace.folder,designContract:ref}):env.parentContract;
  const sink={screenshot:async(view,bytes)=>{
    const file=view+'.png';await writeFile(join(folder,file),bytes,{mode:0o600});
    return {file,sha256:sha(bytes),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  }};
  resources.pending.set(id,product);
  try{
    for(const view of new Set([device,'desktop','mobile'])){
      options.signal.throwIfAborted();
      checks.push(await inspectPage(id,view,resources,options.signal,sink,steps,undefined,contract));
    }
  }finally{resources.pending.delete(id);}
  const record={name,strategy:strategy??null,files,sourceVersion:sha(JSON.stringify(files)),checks,passed:checks.every(c=>c.functionalPass)};
  await trace.record('candidate-rendered',{candidates:{...trace.data.candidates,[name]:{sourceVersion:record.sourceVersion,
    checks:'candidates/'+name+'/checks.json',passed:record.passed,strategy:record.strategy}}});
  await json(join(folder,'checks.json'),record);
  return {...record,folder,product,prompt,contract};
}
async function compare(first,second,env,name){
  const pair=randomInt(2)?[first,second]:[second,first],labels=[],images=[],artifacts=[];
  const stageFolder=join(env.trace.folder,'steps',name);
  await mkdir(stageFolder,{recursive:true,mode:0o700});
  for(const [index,candidate] of pair.entries()){
    for(const device of ['desktop','mobile']){
      const shot=candidate.checks.find(c=>c.device===device)?.screenshot;
      if(!shot)throw Error('缺少评审截图 '+candidate.name+'/'+device);
      const bytes=await readFile(join(candidate.folder,shot.file));
      if(sha(bytes)!==shot.sha256)throw Error('评审截图已变化');
      const width=device==='desktop'?1440:390;
      const jpeg=nativeImage.createFromBuffer(bytes).resize({width}).toJPEG(90);
      const label=index?'Y':'X';
      const imageName=label+'-'+device+'.jpg';
      await writeFile(join(stageFolder,imageName),jpeg,{mode:0o600});
      labels.push(label+' '+device);images.push({bytes:jpeg,mime:'image/jpeg'});
      artifacts.push({label,device,candidate:candidate.name,file:'candidates/'+candidate.name+'/'+shot.file,
        pngSha256:shot.sha256,submittedJpegSha256:sha(jpeg),submittedImage:'steps/'+name+'/'+imageName});
    }
  }
  const scoped=[first,second].some(c=>c.contract?.experiencePlan.states[0].primaryAction);
  const constraints=scoped?pair.map(c=>({locked:c.contract?.requirements.tokenLocks??[],explicit:c.contract?.requirements.explicit??[]})):[];
  const prompt=judgePrompt(env.brief,labels)+(scoped?'\nX/Y 对应的用户约束：'+JSON.stringify(constraints)+
    '\n每条建议注明要变更约定值的语义 Token（changesTokens）及会覆盖的用户原话（overridesRequirements）。保持约定值、纠正实现偏差时留空。': '');
  const schema=scoped?object({...judgeSchema.properties,issues:list(object({...judgeSchema.properties.issues.items.properties,
    changesTokens:list({type:'string',enum:tokenNames}),overridesRequirements:list(string)}))}):judgeSchema;
  await env.trace.record(name+'-images',{comparisons:{...env.trace.data.comparisons,[name]:artifacts}});
  const opinion=await designStage(name,env.options,env.trace,{prompt,schema,images,validate:raw=>{
    validateJudgment(raw);
    if(scoped&&raw.issues.some(i=>!Array.isArray(i.changesTokens)||!Array.isArray(i.overridesRequirements)||
      !i.changesTokens.every(t=>tokenNames.includes(t))||!i.overridesRequirements.every(q=>typeof q==='string'&&q.trim())))throw Error('修复建议缺少可核对的约束影响');
    return raw;
  }});
  return {opinion,pair,choice:opinion.preferred==='uncertain'?first:pair[opinion.preferred==='X'?0:1]};
}
export async function differences(before,after,trace){
  const results=[],subdir='diff-'+before.name+'-'+after.name;
  const out=join(trace.folder,subdir);await mkdir(out,{recursive:true});
  for(const c of after.checks){
    const prev=before.checks.find(b=>b.device===c.device);
    if(!prev?.screenshot||!c.screenshot){results.push({device:c.device,status:'missing-screenshot'});continue;}
    // Decode both at the same CSS viewport. Record source hashes even when the bitmap sizes differ.
    const read=async(candidate,check)=>nativeImage.createFromBuffer(await readFile(join(candidate.folder,check.screenshot.file))).resize({width:check.viewport.width,height:check.viewport.height}).toBitmap();
    if(prev.viewport.width!==c.viewport.width||prev.viewport.height!==c.viewport.height){results.push({device:c.device,status:'viewport-mismatch'});continue;}
    const {width,height}=c.viewport;
    const a=await read(before,prev),b=await read(after,c);
    if(a.length!==b.length||b.length!==width*height*4){results.push({device:c.device,status:'pixel-size-mismatch'});continue;}
    const diff=Buffer.alloc(b.length);let changed=0;
    for(let i=0;i<b.length;i+=4){
      const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
      const value=delta>12?235:18;if(delta>12)changed++;
      diff[i]=diff[i+1]=diff[i+2]=value;diff[i+3]=255;
    }
    const file=subdir+'/'+c.device+'.png';
    await writeFile(join(trace.folder,file),nativeImage.createFromBitmap(diff,{width,height,scaleFactor:1}).toPNG(),{mode:0o600});
    results.push({device:c.device,file,before:prev.screenshot.sha256,after:c.screenshot.sha256,changedPixels:changed,pixels:width*height,channelThreshold:12});
  }
  await json(join(out,'differences.json'),results);return subdir+'/differences.json';
}
async function codeCandidate(name,prompt,strategy,env){
  const cwd=join(env.options.cwd,name);await mkdir(cwd,{recursive:true});
  const dir=join(env.trace.folder,'candidates',name);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'prompt.md'),prompt,{mode:0o600});
  const ref=env.trace.data.contracts?.find(r=>r.directionId===strategy);
  if(env.trace.data.contracts&&!ref)throw Error('此候选缺少对应设计方向的契约');
  if(ref)await env.trace.contractInput(name,ref.id,prompt);
  await env.trace.record(name+'-requested');
  const product=await generate({...env.options,operation:name,cwd,prompt,images:env.images});
  await env.trace.generated(name,product);
  return renderCandidate({name,product,prompt,strategy},env);
}
export async function reviewAndRepair(initial,prepared,env){
  const first=await renderCandidate(initial,env);
  let chosen=first,other,verdict,uncertainty='',repair=null;
  if(env.baseProduct){
    other=await renderCandidate({name:'parent',product:env.baseProduct},{...env,steps:env.baseSteps??[]});
    const diff=await differences(other,first,env.trace);await env.trace.record('parent-comparison',{differences:diff});
  }else{
    const alternative=prepared.artDirection.options.find(o=>o.id!==prepared.selected.id);
    try{other=await codeCandidate('alternative',prepared.promptFor(alternative)+env.referenceText,alternative.id,env);}
    catch(error){env.options.signal.throwIfAborted();uncertainty='另一候选生成失败：'+error.message;
      await env.trace.record('alternative-failed',{alternativeError:error.message});}
  }
  try{if(other)verdict=await compare(first,other,env,'pair-review');}
  catch(error){env.options.signal.throwIfAborted();uncertainty=error.message;}
  if(verdict){
    if(!env.baseProduct)chosen=verdict.choice;
    if(verdict.opinion.preferred==='uncertain')uncertainty=verdict.opinion.uncertainty;
    if(env.baseProduct&&verdict.choice===other)uncertainty='旧版的视觉比较占优，修改结果需人工核对。';
  }
  if(!env.baseProduct&&!chosen.passed){
    const healthy=[first,other].find(c=>c?.passed);
    if(healthy)chosen=healthy;
  }
  const label=verdict?.pair.indexOf(chosen)===0?'X':'Y';
  const proposed=verdict?.opinion.issues.filter(i=>i.candidate===label&&i.priority!=='low')||[];
  const blocked=proposed.filter(i=>conflictsWithLocks(i,chosen.contract?.requirements));
  const issues=proposed.filter(i=>!blocked.includes(i));
  if(blocked.length){
    uncertainty='涉及用户已确认约束的建议需由用户决定。';
    await env.trace.record('repair-constraint-blocked',{blockedRepairSuggestions:blocked});
  }
  if(!chosen.passed||issues.length){
    const reason={visual:issues,browser:chosen.checks.filter(c=>!c.functionalPass)};
    const prompt=chosen.prompt+'\n\n只修正以下已定位的问题，保留业务行为与既有结构。\n'+JSON.stringify(reason)+'\n当前版本源码\n'+JSON.stringify(chosen.product);
    repair={input:chosen.name,reason,accepted:false};
    let fixed;
    try{
      fixed=await codeCandidate('repair',prompt,chosen.strategy,env);
      repair.diff=await differences(chosen,fixed,env.trace);
    }catch(error){
      env.options.signal.throwIfAborted();repair.error=error.message;uncertainty='定向修复未完成：'+error.message;
    }
    if(fixed?.passed){
      try{
        const assessment=await compare(chosen,fixed,env,'repair-review');
        if(!chosen.passed||assessment.choice===fixed){chosen=fixed;repair.accepted=true;}
        if(assessment.opinion.preferred==='uncertain')uncertainty=assessment.opinion.uncertainty;
      }catch(error){env.options.signal.throwIfAborted();uncertainty=error.message;if(!chosen.passed){chosen=fixed;repair.accepted=true;}}
    }
    if(fixed&&!fixed.passed&&chosen.passed)uncertainty='修复候选未通过交互检查，保留修复前的版本，视觉问题待复核。';
    if(!repair.accepted&&!uncertainty&&issues.some(issue=>issue.priority==='high'))uncertainty='高优先级视觉问题仍待复核。';
  }
  if(!chosen.passed)uncertainty='关键功能或浏览器证据未通过';
  if(env.baseProduct&&other&&chosen!==first){
    const initialRevisionDifferences=env.trace.data.differences;
    const finalDiff=await differences(other,chosen,env.trace);
    await env.trace.record('final-revision-comparison',{initialRevisionDifferences,differences:finalDiff});
  }
  const status=!chosen.passed?'blocked':uncertainty?'needs-human':'candidate';
  const reason=verdict?.opinion.reason||uncertainty;
  const finalSourceInput={candidate:chosen.name,file:'candidates/'+chosen.name+'/prompt.md',sha256:sha(chosen.prompt)};
  await env.trace.record('review-finished',{chosenCandidate:chosen.name,winningStrategy:chosen.strategy,finalSourceInput,
    visualReview:{status,reason,uncertainty,modelJudgment:verdict?.opinion??null},
    automaticRepair:repair?{status:'attempted',...repair}:{status:blocked.length?'blocked-by-constraint':'not-needed'}});
  if(status==='needs-human')await json(join(env.trace.folder,'human-review.json'),{status:'awaiting-review',reason:uncertainty,candidate:chosen.name});
  if(status==='blocked')throw Error(uncertainty+'，已保留候选源码和截图。');
  return chosen.product;
}
