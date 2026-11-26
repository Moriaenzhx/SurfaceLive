import {readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {decisionSource,inventory,readJSON,replayEvidence,sha256} from './design-evidence.mjs';

const [source,packetDir]=process.argv.slice(2);
if(!source)throw Error('Usage: node experiments/design-results.mjs <run> [blind-packet]');
const root=resolve(source),cases=await inventory(root);
const rel=path=>relative(root,path);
const replay=await replayEvidence(root).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const rows=[],attempts=[];
for(const {scenario:s,groups} of cases)for(const g of groups){
  for(const a of g.attempts){
    let traceFile=a.trace?join(a.revision,'design-trace.json'):null;
    if(!traceFile){
      const receipt=await readJSON(join(a.dir,'submission.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(receipt)traceFile=join(a.dir,'profile/revisions/.design-traces',receipt.token,'design-trace.json');
    }
    const trace=a.trace??(traceFile?await readJSON(traceFile).catch(e=>{if(e.code==='ENOENT')return null;throw e;}):null);
    attempts.push({scene:s.id,condition:g.variant,path:rel(a.dir),status:a.status,startedAt:trace?.startedAt??null,
      lastEvent:trace?.stage??null,error:trace?.error??null});
  }
  const a=g.decision;
  const row={scene:s.id,name:s.name,condition:g.variant,status:a?.status??'pending',attempts:g.attempts.length,plannedSteps:s.steps.length*2};
  rows.push(row);if(!a)continue;
  const t=a.trace,dir=a.revision,output=await decisionSource(a),real=replay?.cases.find(c=>c.scene===s.id&&c.variant===g.variant&&c.attemptId===t.attemptId);
  const record=real?.checks?await readJSON(join(replay.folder,real.checks)):null;
  const tests=record?.checks??t.browser,folder=record?dirname(join(replay.folder,real.checks)):dir;
  const screenshots={};
  for(const c of tests){
    if(!c.screenshot)continue;
    const shot=join(folder,c.screenshot.file);
    if(sha256(await readFile(shot))!==c.screenshot.sha256)throw Error('截图已变化 '+rel(shot));
    screenshots[c.device]=rel(shot);
  }
  Object.assign(row,{requestHash:sha256(a.input.text),agent:t.agent,attemptId:t.attemptId,elapsedSeconds:a.receipt.elapsedMs/1000,
    trace:rel(join(dir,'design-trace.json')),receipt:rel(join(a.dir,'receipt.json')),initialPrompt:t.prompt?rel(join(dir,t.prompt.file)):null,
    source:rel(join(output.folder,'index.html')),sourcePrompt:t.code?.input?.file?rel(join(dir,t.code.input.file)):rel(join(output.folder,'prompt.md')),images:screenshots,
    supportedRules:t.knowledge?.rules?.map(r=>r.id)??[],visualCases:[...(t.knowledge?.exemplars??[]),...(t.knowledge?.reviewedCards??[]).filter(c=>c.kind==='VisualExemplar'),...(t.knowledge?.analogies??[])].map(c=>c.id),
    catalogCoverage:t.scene?.analysis?.catalogCoverage??null,artDirections:t.artDirection?.options?.map(o=>({id:o.id,name:o.name,ruleIds:o.ruleIds,visualCaseIds:o.visualCaseIds}))??[],
    winningStrategy:t.winningStrategy??null,winningCandidate:t.chosenCandidate??null,candidates:t.candidates??{},review:t.visualReview.status,
    repair:t.automaticRepair.status,repairAccepted:t.automaticRepair.accepted??null,diff:t.automaticRepair.diff?rel(join(dir,t.automaticRepair.diff)):null,
    checks:record?rel(join(replay.folder,real.checks)):row.trace,uniformReplay:!!record,replayError:real?.error??null,
    viewports:tests.map(c=>({device:c.device,viewport:c.viewport,primary:c.action,passed:c.functionalPass,errors:c.errors?.length??null,
      steps:c.journey.map(j=>({step:j.step,passed:j.passed,changed:j.changed??null}))}))});
  if(t.automaticRepair?.reason)row.targetedFindings=t.automaticRepair.reason.visual;
  if(record?.serviceJourney){
    row.serviceJourney={passed:record.serviceJourney.passed,views:record.serviceJourney.checks.map(v=>({device:v.device,passed:v.functionalPass,
      intermediate:v.journey.find(j=>j.navigation)?.navigation??null,result:v.journey.at(-1)?.text??null,
      screenshot:v.resultScreenshot?rel(join(folder,record.serviceJourney.directory,v.resultScreenshot.file)):null}))};
  }
  if(row.diff){
    row.changes=[];
    for(const d of await readJSON(join(root,row.diff))){
      if(!d.file)continue;
      row.changes.push({device:d.device,changedPixels:d.changedPixels,pixels:d.pixels,
        before:rel(join(dir,'candidates',t.automaticRepair.input,d.device+'.png')),
        after:rel(join(dir,'candidates','repair',d.device+'.png')),difference:rel(join(dir,d.file))});
    }
  }
}
let blind=null;
const votes=[];
if(packetDir){
  const folder=resolve(packetDir),key=await readJSON(join(folder,'organizer-key.json'));
  blind=rel(join(folder,'reviewer','REVIEW.md'));
  for(const file of await readdir(join(folder,'human-results')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
    const vote=await readJSON(join(folder,'human-results',file));
    if(vote.packet===key.packet)votes.push({reviewer:vote.reviewer,comparisons:vote.results});
  }
}
const md=['# 四个场景的同题验收','',
  '每个场景固定需求、目标终端、业务步骤、Codex、gpt-6.2-sol 和 low。耗时为一次提交到终态的墙钟时间，包含生成和检查。A2 会调用模型多次。型号以回执中的 requestedModel 与 reportedModel 分列，CLI 未回报型号的调用保留空值。','',
  '| 场景 | 条件 | 生成与验收 | 秒 | 核验步骤 | 原件 | 实际画面 |','| --- | --- | --- | ---: | --- | --- | --- |'];
for(const r of rows){
  const checks=(r.viewports??[]).flatMap(v=>v.steps),shots=Object.entries(r.images??{}).map(([k,v])=>'['+(k==='desktop'?'桌面':k==='mobile'?'手机':k)+']('+v+')').join(' · ');
  const link=r.trace?'[记录]('+r.trace+') · [提示词]('+r.sourcePrompt+') · [作品]('+r.source+')':'';
  const status=r.replayError?'复查错误':r.status==='ready'?(r.viewports.every(v=>v.passed)?'通过':'复查未通过'):r.status==='functional-failure'?'功能门禁阻止发布':'待取得记录';
  md.push('| '+[r.name,r.condition,status,r.elapsedSeconds?.toFixed(1)??'—',checks.length?'['+checks.filter(c=>c.passed).length+'/'+r.plannedSteps+']('+r.checks+')':'—',link,shots].join(' | ')+' |');
}
md.push('','A2 会保留最初候选、对照候选，以及实际触发的修复候选。可在对应 Trace 的 comparisons 中逐项比对两端 PNG、送审图片的哈希及模型原答。','',
  '| 场景 | 提议方向 | 最终候选 | 定向修复 | 视觉判断状态 |','| --- | --- | --- | --- | --- |');
for(const row of rows.filter(r=>r.condition==='A2'&&r.trace)){
  const fix=row.repair==='attempted'?(row.repairAccepted?'采用':'保留修前版本')+(row.diff?' · [变化图记录]('+row.diff+')':''):row.repair==='not-needed'?'未触发':'未执行';
  md.push('| '+[row.name,row.artDirections.map(o=>o.name).join(' / '),row.winningCandidate??'—',fix,row.review].join(' | ')+' |');
}
for(const row of rows.filter(r=>r.changes?.length)){
  const issue=row.targetedFindings?.[0],view=row.changes.find(v=>v.device===issue?.viewport)??row.changes[0];
  md.push('','**'+row.name+'** '+(issue?'模型在'+(view.device==='mobile'?'手机':'桌面')+'的「'+issue.region+'」指出'+issue.observation:'浏览器任务触发了定向修复。')+
    ' 修前后有 '+view.changedPixels+' / '+view.pixels+' 个 CSS 像素超过差异阈值。[修前]('+view.before+') · [修后]('+view.after+') · [差异图]('+view.difference+')');
}
for(const row of rows.filter(r=>r.condition==='A2'&&r.catalogCoverage==='uncovered')){
  md.push('','**'+row.name+'的知识覆盖** 本轮没有匹配到相应业务领域。Trace 收录了待验证假设和可用于参考的视觉案例编号。各方向实际引用的案例和适用边界可在[本次记录]('+row.trace+')中检查。');
}
const booking=rows.filter(r=>r.serviceJourney);
if(booking.length){
  md.push('','## 附近生活服务的实际预约路径','',
    '冻结的检查要求每个带定位的操作都能直接点击。补充复查允许用户先进入晴川保洁的服务详情，再选 14:00。三个版本共用相同的补充流程。原来的失败与发布决定保留。','',
    '| 条件 | 桌面和手机实际预约 | 操作后的真实画面 |','| --- | --- | --- |');
  for(const row of booking){
    const shots=row.serviceJourney.views.filter(v=>v.screenshot).map(v=>'['+(v.device==='desktop'?'桌面':'手机')+']('+v.screenshot+')').join(' · ');
    md.push('| '+row.condition+' | '+(row.serviceJourney.passed?'完成':'存在阻断')+' | '+shots+' |');
  }
}
md.push('','## 验收条件与人工判断','',
  replay?'所有已复查的表格行都链接到同一套最终 Chromium 检查的原始结果。生成时的初次检查也保留在每个版本的 Trace。':'当前表格使用生成当时的检查，统一浏览器复查尚待执行。',
  '每组取首次取得可发布版本或被真实功能门禁阻止的结果。单独保留中断、证据引用错误及其纠正记录。[所有尝试及其终态](summary.json)',
  '每个场景每种条件只取一份作品。统一复查控制了浏览器检查的差异；模型采样波动和 A2 的额外计算量仍会影响比较。后台验收曾修正艺术指导返回证据类别的宿主校验，早期回执可能只含请求型号。',
  '真人评价者 '+votes.length+' 位，共 '+votes.reduce((n,v)=>n+v.comparisons.length,0)+' 个成对判断。'+(votes.length?'原始胜负与理由见汇总。':'审美胜负待真人评审。')+(blind?' [匿名人工评审入口]('+blind+')':''),'');
const summary={writtenAt:new Date().toISOString(),fixedModel:'gpt-6.2-sol',effort:'low',uniformVerification:replay?rel(join(replay.folder,'manifest.json')):null,rows,attempts,blind,humanVotes:votes};
for(const [file,data] of [['summary.json',JSON.stringify(summary,null,2)+'\n'],['RESULTS.md',md.join('\n')+'\n']]){
  const temp=join(root,'.'+file+'.'+process.pid);
  await writeFile(temp,data);await rename(temp,join(root,file));
}
console.log(rows.filter(r=>r.status!=='pending').length+'/'+rows.length+' 组取得实验结果');
