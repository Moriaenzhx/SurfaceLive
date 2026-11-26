import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,readFile,realpath} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const nonempty=s=>typeof s==='string'&&s.trim().length>0;
const sha=b=>createHash('sha256').update(b).digest('hex');
export function matchingPreferences(file,{user,project,brands=[],scenes}){
  if(!existsSync(file))return [];
  const db=new DatabaseSync(file,{readOnly:true});
  try{
    const rows=db.prepare("SELECT document FROM feedback WHERE actor=? AND confirmed=1 ORDER BY rowid DESC").iterate(user);
    const found=[];
    for(const row of rows){
      const v=JSON.parse(row.document),s=v.scope;
      if(s.project&&s.project!==project||s.scene&&!scenes.includes(s.scene)||s.brand&&!brands.includes(s.brand))continue;
      found.push({id:v.id,reason:v.reason,chosen:v.choice.direction||v.choice.strategy,
        rejected:v.rejected.map(r=>r.direction||r.strategy),verifiedViewports:v.choice.observed.filter(c=>c.passed).map(c=>c.device)});
      if(found.length===6)break;
    }
    return found;
  }finally{db.close();}
}
async function evidence(input){
  if(!nonempty(input?.folder))throw Error('偏好必须关联到真实版本目录');
  const folder=await realpath(input.folder);
  const trace=JSON.parse(await readFile(join(folder,'design-trace.json'),'utf8'));
  if(trace.invocations?.some(call=>call.override))throw Error('测试替身生成的作品不能计入真实用户偏好');
  const name=input.candidate||null;
  if(name&&!/^(initial|alternative|parent|manual|repair)$/.test(name))throw Error('未知候选名称');
  const dir=name?join(folder,'candidates',name):folder;
  const candidate=name?JSON.parse(await readFile(join(dir,'checks.json'),'utf8')):null;
  const checks=candidate?.checks??trace.browser,files=candidate?.files??trace.code?.files;
  if(!files||!trace.attemptId||!Array.isArray(checks)||!checks.length)throw Error('版本缺少源码或实际浏览器记录');
  for(const key of ['index.html','styles.css','app.js']){
    const recorded=typeof files[key]==='string'?files[key]:files[key]?.sha256;
    if(sha(await readFile(join(dir,key)))!==recorded)throw Error('偏好证据中的源码已变化');
  }
  for(const c of checks){
    if(!['desktop','mobile','tablet'].includes(c.device))throw Error('不支持的视口记录');
    if(!c.screenshot)continue;
    const expected=name?c.device+'.png':'evidence/'+c.device+'.png';
    if(c.screenshot.file!==expected||sha(await readFile(join(dir,expected)))!==c.screenshot.sha256)throw Error('偏好证据中的截图已变化');
  }
  const strategy=candidate?.strategy??trace.winningStrategy??null;
  const option=trace.artDirection?.options?.find(o=>o.id===strategy);
  const direction=option?{name:option.name,structure:option.structure,focalPoint:option.focalPoint,interactionPath:option.interactionPath}:null;
  return {id:trace.attemptId+(name?'/'+name:''),revision:trace.code?.revision??null,strategy,direction,
    folder,candidate:name,edits:trace.edits||[],differences:trace.differences??trace.automaticRepair?.diff??null,
    observed:checks.map(c=>({device:c.device,passed:c.functionalPass===true,feedback:c.after??null,
      screenshotHash:c.screenshot?.sha256??null,errors:c.errors??[]}))};
}
export async function recordPreference(file,input){
  const {scope,reason}=input;
  if(!scope||!nonempty(scope.user)||![scope.project,scope.brand,scope.scene].some(nonempty)||
    [scope.project,scope.brand,scope.scene].some(s=>s!=null&&(!nonempty(s)||s.length>200||['*','general'].includes(s.trim())))||
    !nonempty(reason)||reason.length>2000||!Array.isArray(input.rejected)||!input.rejected.length)
    throw Error('请提供评价者、具体的项目/品牌/场景范围、被拒绝的方案和理由');
  if(typeof input.humanVerified!=='boolean')throw Error('请明确记录用户是否亲自验证任务');
  const choice=await evidence(input.choice),rejected=await Promise.all(input.rejected.map(evidence));
  if(rejected.some(r=>r.id===choice.id)||new Set(rejected.map(r=>r.id)).size!==rejected.length)throw Error('同一方案不能与自身比较');
  const healthy=['mobile','desktop'].every(device=>choice.observed.some(c=>c.device===device&&c.passed&&c.screenshotHash));
  const confirmed=input.humanVerified&&healthy;
  const id=input.id||randomUUID();
  if(!/^[a-zA-Z0-9_-]{1,96}$/.test(id))throw Error('无效评价 ID');
  const entry={id,scope,reason,choice,rejected,humanVerified:input.humanVerified,confirmed};
  await mkdir(dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  try{
    db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,actor TEXT NOT NULL,confirmed INTEGER NOT NULL,document TEXT NOT NULL,created_at TEXT NOT NULL)');
    const doc=JSON.stringify(entry);
    db.prepare('INSERT INTO feedback VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,scope.user,Number(confirmed),doc,new Date().toISOString());
    if(db.prepare('SELECT document FROM feedback WHERE id=?').get(id).document!==doc)throw Error('同一评价 ID 已用于另一条记录');
    return {id,confirmed,reason:confirmed?'explicit-human-with-browser-evidence':'not-applied-to-generation'};
  }finally{db.close();}
}
