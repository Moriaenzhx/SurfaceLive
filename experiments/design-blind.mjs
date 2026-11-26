import {randomInt,randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {decisionSource,inventory,readJSON,replayEvidence,sha256} from './design-evidence.mjs';
import {reviewForm} from './design-review-form.mjs';

const [source,...flags]=process.argv.slice(2);
if(!source||flags.some(f=>f!=='--partial'))throw Error('Usage: node experiments/design-blind.mjs <evidence folder> [--partial]');
const root=resolve(source),cases=await inventory(root),replay=await replayEvidence(root);
const eligible=cases.filter(c=>c.groups.every(g=>g.decision&&replay.cases.some(v=>v.checks&&v.scene===c.scenario.id&&v.variant===g.variant&&v.attemptId===g.decision.trace.attemptId)));
if(!eligible.length||!flags.includes('--partial')&&eligible.length!==cases.length)throw Error('尚未取得完整的同题三组作品');
const folder=await mkdtemp(join(root,'blind-')),review=join(folder,'assembling'),packet=randomUUID(),key={packet,cases:{}};
await mkdir(review,{recursive:true});
const lines=['# SurfaceLive 作品盲评','',
  '[打开离线评审表](index.html)，可在同一标签页操作作品，保存时自动分配匿名编号。','',
  '每个场景都有 X、Y、Z 三份作品，字母在各场景独立打乱。先按任务使用三个作品，再比较截图。可在同一个浏览器标签页打开作品，返回本页继续。','',
  '每对可选 X、Y、Z 中参与比较的一个，也可以填「平局」。请写一句具体理由，说明哪一步更容易完成，或哪个区域更容易读。',''];
const ballot={packet,reviewer:null,comparisons:[]};
for(const {scenario:s,groups} of eligible){
  const order=[...groups];
  for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
  key.cases[s.id]={};
  lines.push('## '+s.name,'',s.brief,'',s.steps.map((step,i)=>(i+1)+'. '+step.action).join('\n'),'','| 版本 | 真实作品 | 桌面 | 手机 |','| --- | --- | --- | --- |');
  for(const [i,g] of order.entries()){
    const name=['X','Y','Z'][i],dir=join(review,s.id,name),target=g.decision,source=await decisionSource(target);
    const verified=join(replay.folder,s.id,g.variant),record=await readJSON(join(verified,'checks.json'));
    if(record.attemptId!==target.trace.attemptId||record.scene!==s.id||record.variant!==g.variant)throw Error('复查与原版本不一致');
    await mkdir(dir,{recursive:true});
    for(const f of ['index.html','styles.css','app.js']){
      const bytes=await readFile(join(source.folder,f)),hash=sha256(bytes);
      if(hash!==record.files[f]?.sha256||hash!==source.files[f]?.sha256)throw Error('复查后源码已变化 '+f);
      await writeFile(join(dir,f),bytes);
    }
    for(const device of ['desktop','mobile']){
      const shot=record.checks.find(c=>c.device===device)?.screenshot;
      if(shot?.file!==device+'.png')throw Error('缺少匿名截图');
      const bytes=await readFile(join(verified,shot.file));
      if(sha256(bytes)!==shot.sha256)throw Error('复查后截图已变化');
      await writeFile(join(dir,device+'.png'),bytes);
    }
    const link=s.id+'/'+name+'/';
    lines.push('| '+name+' | [打开作品]('+link+'index.html) | [桌面截图]('+link+'desktop.png) | [手机截图]('+link+'mobile.png) |');
    key.cases[s.id][name]={variant:g.variant,attemptId:target.trace.attemptId,revision:source.folder,code:source.files,releaseStatus:target.status,verificationPassed:record.passed};
  }
  lines.push('','| 比较 | 首选或平局 | 主要理由 | 实际任务是否完成 |','| --- | --- | --- | --- |');
  for(const [left,right] of [['X','Y'],['Y','Z'],['Z','X']]){
    lines.push('| '+left+' / '+right+' | | | |');
    ballot.comparisons.push({scene:s.id,left,right,winner:null,reason:'',taskVerified:null});
  }
  lines.push('');
}
await writeFile(join(folder,'organizer-key.json'),JSON.stringify(key,null,2)+'\n',{mode:0o600});
await writeFile(join(review,'REVIEW.md'),lines.join('\n')+'\n');
await writeFile(join(review,'index.html'),reviewForm(packet,eligible.map(c=>c.scenario)));
await writeFile(join(review,'ballot.json'),JSON.stringify(ballot,null,2)+'\n');
await rename(review,join(folder,'reviewer'));
console.log(join(folder,'reviewer','REVIEW.md'));
