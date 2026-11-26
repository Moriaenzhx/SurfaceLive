// Seal completed cells without invoking a model. Re-running verifies the existing blind assignment.
import assert from 'node:assert/strict';
import {createHash,randomInt} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cases,settings} from './k01-cases.mjs';
const root='runs/K-01', hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const write=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{mode:0o600});
const blind=join(root,'blind');
await mkdir(blind,{recursive:true});
const keyFile=join(root,'blind-key.json');
let assignments;
try{assignments=await read(keyFile);}
catch(error){
  if(error.code!=='ENOENT')throw error;
  assignments=Object.fromEntries(Object.keys(cases).map(scene=>[scene,randomInt(2)?['A0','A-current']:['A-current','A0']]));
  await write(keyFile,assignments);
}
const rows=[];
for(const [scene,scenario] of Object.entries(cases)){
  for(const group of ['A0','A-current']){
    const dir=join(root,scene,group),receipt=await read(join(dir,'receipt.json'));
    const current=group==='A-current',source=join(dir,current?'attempt':'source');
    const trace=current?await read(join(source,'design-trace.json')):null;
    const audit=current?await read(join(source,'design-audit.json')):null;
    assert.equal(receipt.text,scenario.text);assert.equal(receipt.target,scenario.target);
    const verified=await read(join(dir,'verification','results.json'));
    for(const [file,expected] of Object.entries(verified.files))assert.equal(hash(await readFile(join(source,file))),expected);
    const calls=trace?.invocations??receipt.invocations;
    assert.equal(calls.filter(c=>c.operation==='source').length,1);
    assert(calls.every(c=>!c.override&&c.outcome==='returned'&&c.requestedModel===settings.model&&c.reportedModels.includes(settings.model)));
    if(current){
      assert.equal(trace.attemptId,receipt.run_id);assert.equal(trace.request,scenario.text);assert.equal(trace.scenarioId,null);
      assert.equal(audit.run_id,receipt.run_id);assert.equal(hash(await readFile(join(source,'design-trace.json'))),receipt.traceSha256);
    }
    const inputs=[];
    for(const [i,call] of calls.entries()){
      const prefix=call.operation.endsWith('-correction')?'correction-':'';
      const stage=call.operation.replace(/-correction$/,'');
      const promptPath=stage==='source'?'prompt.md':join('steps',stage,prefix+'prompt.md');
      const prompt=await readFile(join(current?source:dir,promptPath),'utf8');
      assert.equal(hash(prompt),call.promptSha256);
      const entries=audit?.calls[i]?.present??[];
      if(audit)assert.equal(audit.calls[i].promptSha256,call.promptSha256);
      for(const {id,offsetUTF16} of entries){
        assert(!scenario.text.includes(id));
        assert(prompt.slice(offsetUTF16+1).startsWith(id));
      }
      const visible=new Set(entries.map(e=>e.id));
      const omitted=stage==='source'?audit?.candidates.filter(c=>!c.excluded&&!visible.has(c.id)).map(c=>c.id)??[]:[];
      inputs.push({operation:call.operation,omittedFromSource:omitted,textSha256:call.promptSha256,knowledge:entries.map(e=>e.id),tokens:call.totalTokens,ms:call.elapsedMs});
    }
    const code=assignments[scene].indexOf(group)===0?'X':'Y';
    const folder=join(blind,scene,code);
    await mkdir(folder,{recursive:true});
    for(const v of verified.views){
      for(const shot of [v.screenshot,v.taskScreenshot].filter(Boolean)){
        const file=join(dir,'verification',shot.file);
        assert.equal(hash(await readFile(file)),shot.sha256);
        await copyFile(file,join(folder,shot.file));
      }
    }
    rows.push({scene,group,status:receipt.status,run_id:receipt.run_id,elapsedMs:receipt.elapsedMs,
      sourceVersion:verified.sourceVersion,source,generatedAt:verified.generatedAt,inputs,
      tokens:inputs.every(c=>Number.isFinite(c.tokens))?inputs.reduce((s,c)=>s+c.tokens,0):null,
      views:verified.views.map(v=>({device:v.device,viewport:v.viewport,
        screenshot:v.screenshot,grade:v.issue??null,steps:v.steps.map(s=>[s.label,s.passed]),errors:v.errors,
        rootFits:[v.initial,v.final].every(m=>m&&m.rootWidth<=m.viewport+2),
        clipped:[...new Set([...v.initial.clipped,...v.final.clipped])],buttonProbe:v.initialButtons}))});
  }
}
await write(join(root,'verified-manifest.json'),rows);
await writeFile(join(blind,'README.md'),`# K-01 匿名评阅

请在揭盲前记录每个场景的 X、Y 或难分及理由。这是空白评阅说明，目前没有真人票。

- 知时首先对照 390 × 844 手机图及操作态图。记录中文层级与可读性、资料填写和候选理由的可发现性、民俗参考边界，以及风格是否依赖通用装饰。
- 招聘首先对照 1440 × 900 桌面图及操作态图。记录一屏能核对哪些岗位要求、匹配证据和复核状态，搜索与决策的距离，密度对扫描效率的影响。
- 互看另一视口，记录裁切、遮挡、阅读顺序和不必要的装饰。每条判断附具体区域、能看到的现象和取舍；截图不能证明操作成功。
- 每个场景单独随机分组；desktop / mobile 为首屏，带 task 后缀的是实际操作状态。先独立评阅，再由主持人结合浏览器记录解释任务表现。
`);
const links=[];
for(const scene of Object.keys(cases)){
  for(const code of ['X','Y']){
    const path=scene+'/'+code+'/';
    links.push('| '+(scene==='zhishi'?'知时':'招聘')+' '+code+' | [手机首屏]('+path+'mobile.png) · [操作态]('+path+'mobile-task.png) | [桌面首屏]('+path+'desktop.png) · [操作态]('+path+'desktop-task.png) |');
  }
}
await writeFile(join(blind,'README.md'),'\n| 匿名样本 | 390 × 844 | 1440 × 900 |\n|---|---|---|\n'+links.join('\n')+'\n',{flag:'a'});
console.log('Verified',rows.length,'source versions and paired screenshots.');
