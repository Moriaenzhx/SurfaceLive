import {readFile,writeFile,mkdir,mkdtemp,copyFile,rename} from 'node:fs/promises';
import {randomInt} from 'node:crypto';
import {resolve,join} from 'node:path';
import {getScenario} from './scenarios.ts';
import {variants} from './prompts.ts';
import type {Audit} from './verification.ts';

const run=resolve(process.argv[2]||'.');
const manifest=JSON.parse(await readFile(join(run,'manifest.json'),'utf8'));
if(manifest.mode!=='execute') throw new Error('Blind review requires a real generation run.');
const scenario=getScenario(manifest.scenarioId);
const order=[...variants];
for(let i=order.length-1;i>0;i--){
  const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];
}
// Validate every condition before making a review packet.
for(const v of order){
  const a:Audit=JSON.parse(await readFile(join(run,v,'audit.json'),'utf8'));
  if(manifest.variants[v]?.status!=='generated-static-passed' || !a.staticChecks.every(c=>c.passed) || a.browser.status!=='passed') throw new Error('Quality gate pending: '+v);
}
const folder=await mkdtemp(join(run,'blind-'));
const staging=join(folder,'in-progress');
const key:Record<string,string>={};
for(const [i,v] of order.entries()){
  const name=['X','Y','Z'][i], target=join(staging,name);
  key[name]=v;await mkdir(target,{recursive:true});
  for(const file of ['index.html','styles.css','app.js']) await copyFile(join(run,v,file),join(target,file));
  for(const device of ['desktop','mobile']) await copyFile(join(run,v,'evidence',device+'.png'),join(target,device+'.png'));
}
await writeFile(join(folder,'organizer-key.json'),JSON.stringify(key,null,2));
await writeFile(join(staging,'REVIEW.md'),[
  '# '+scenario.title+'盲评','', '评审身份（招聘顾问 / 设计师）________    日期 ________',
  '请依次打开三个文件夹里的 index.html。任务是'+scenario.primaryTask+'。分别记录任务成功与阻断，再对照桌面和手机截图评价。','',
  '| 方案 | 主任务成功 | 阻断或误操作 | 第一眼看到什么 |','|---|---|---|---|',
  ...['X','Y','Z'].map(n=>'| '+n+' | | | |'),'',
  '| 比较 | 首选或平局 | 具体原因（层级、可读性、场景适配等） |','|---|---|---|',
  '| X / Y | | |','| Y / Z | | |','| Z / X | | |','',
  '评审是否参与生成 ________    最希望修改的区域 ________',''
].join('\n'));
await rename(staging,join(folder,'reviewer'));
console.log(join(folder,'reviewer'));
