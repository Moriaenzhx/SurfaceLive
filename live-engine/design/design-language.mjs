// Seeds are optional references. Only a task match makes a seed eligible.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export {languageDecisionSchema} from './contract-schema.mjs';
import {checkShape,languageDecisionSchema} from './contract-schema.mjs';

const hash=text=>createHash('sha256').update(text).digest('hex');
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const unique=items=>new Set(items).size===items.length;
function requireField(ok,message){if(!ok)throw Error('Design Language: '+message);}
const axes=['composition','typography','color-material','interaction','responsive'];

export function validateSeedCatalog(data){
  requireField(data?.version===1&&Array.isArray(data.seeds)&&Array.isArray(data.sources),'种子库版本或集合无效');
  const refs=new Map(data.sources.map(s=>[s.id,s]));
  requireField(refs.size===data.sources.length&&unique(data.seeds.map(s=>s.id)),'重复的种子或出处');
  for(const s of refs.values()){
    requireField([s.id,s.title,s.review,s.rights,s.scope].every(nonempty)&&['visual-observation','knowledge-rule'].includes(s.kind),'出处信息不完整');
    requireField(s.citations?.length&&s.citations.every(c=>nonempty(c.publisher)&&nonempty(c.sourceId)&&/^https:\/\//.test(c.url)),'出处链接缺失 '+s.id);
    if(s.kind==='visual-observation')requireField(/^[a-f0-9]{64}$/.test(s.inspectedHash),'缺少原始观察哈希 '+s.id);
  }
  for(const seed of data.seeds){
    requireField([seed.id,seed.title,seed.concept,seed.tone,seed.applies,seed.excludes,seed.rationale].every(nonempty)&&seed.review==='authored-unreviewed','设计概念或审核标识无效');
    const available=new Set(seed.references.map(r=>r.id));
    requireField(available.size===seed.references.length&&seed.references.every(r=>refs.has(r.id)&&nonempty(r.use)),'无效的引用依据 '+seed.id);
    requireField(['task','structure','audience','brand','devices'].every(k=>seed.match[k]?.length&&seed.match[k].every(nonempty)),'匹配条件缺失');
    requireField(seed.principles.length===axes.length&&axes.every(id=>seed.principles.some(p=>p.id===id)),'设计语言维度缺失 '+seed.id);
    for(const p of seed.principles)requireField(nonempty(p.guidance)&&p.sourceIds.length&&unique(p.sourceIds)&&p.sourceIds.every(id=>available.has(id)),'原则依据无效 '+seed.id+'/'+p.id);
    requireField(seed.antiPatterns?.length&&seed.antiPatterns.every(a=>nonempty(a.when)&&nonempty(a.avoid)),'反模式缺少适用条件');
  }
  return data;
}
const catalog=validateSeedCatalog(JSON.parse(readFileSync(new URL('./language-seeds.json',import.meta.url),'utf8')));
const sources=new Map(catalog.sources.map(ref=>[ref.id,ref]));
export const designSeeds=catalog.seeds.map(seed=>{
  const references=seed.references.map(r=>({...sources.get(r.id),use:r.use}));
  return {...seed,references,sha256:hash(JSON.stringify({...seed,references}))};
});

function positiveText(value){
  // A clause explicitly ruled out by the user is not a positive retrieval signal.
  return (value??'').normalize('NFKC').toLowerCase().split(/[。；，,;！!？?\n]/)
    .filter(clause=>!/(?:不要|避免|不做|不希望|不得|禁止|不强制|do not|avoid\b)/i.test(clause)).join(' ');
}
function dimensionText(analysis,keys){
  return keys.flatMap(key=>(analysis?.dimensions?.[key]??[]).filter(d=>positiveText(d.evidence)).map(d=>d.value)).join(' ');
}
export function matchDesignSeeds({brief='',analysis,device}){
  const text=positiveText(brief);
  const field=keys=>text+' '+positiveText(dimensionText(analysis,keys));
  const input={task:field(['task','product']),structure:field(['interaction','task']),audience:field(['audience']),
    brand:field(['cultureBrand','visual'])};
  const weights={task:4,structure:2,audience:2,brand:1};
  const results=[];
  for(const seed of designSeeds){
    const reasons=[];
    for(const [axis,weight] of Object.entries(weights)){
      const terms=seed.match[axis].filter(term=>input[axis].includes(term));
      if(terms.length)reasons.push({axis,terms,points:weight*Math.min(terms.length,3)});
    }
    if(!reasons.some(r=>r.axis==='task'))continue;
    if(seed.match.devices.includes(device))reasons.push({axis:'device',terms:[device],points:1});
    results.push({id:seed.id,score:reasons.reduce((n,r)=>n+r.points,0),reasons,seed});
  }
  return results.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,2);
}
export function directorSeedBrief(matches){
  const compact=matches.map(({id,seed})=>({id,title:seed.title,concept:seed.concept,tone:seed.tone,applies:seed.applies,
    excludes:seed.excludes,rationale:seed.rationale,principles:seed.principles,antiPatterns:seed.antiPatterns,
    references:seed.references.map(r=>({id:r.id,use:r.use}))}));
  return '设计语言候选（JSON）\n'+JSON.stringify(compact);
}

export function validateLanguageDecision(decision,matches){
  checkShape(languageDecisionSchema,decision,'language');
  const {choices,mode}=decision,ids=choices.map(c=>c.seedId);
  requireField(unique(ids)&&ids.length===matches.length&&matches.every(m=>ids.includes(m.id)),'逐项说明本轮候选的采用或拒绝');
  for(const choice of choices){
    const principles=matches.find(m=>m.id===choice.seedId).seed.principles;
    requireField(unique(choice.principleIds)&&choice.principleIds.every(id=>principles.some(p=>p.id===id)),'原则未在本轮提供 '+choice.seedId);
    requireField(choice.reason.trim()!==choice.boundary.trim(),'采用理由与适用边界须有区别');
  }
  const used=choices.filter(c=>c.principleIds.length).length;
  requireField(mode===(used===0?'original':used===1?'adopt':'combine'),'选择模式与实际取用不符');
  return decision;
}
export function selectedLanguage(decision,matches){
  validateLanguageDecision(decision,matches);
  return decision.choices.flatMap(c=>{
    const seed=matches.find(m=>m.id===c.seedId).seed;
    return c.principleIds.map(id=>{
      const p=seed.principles.find(p=>p.id===id);
      return {seedId:seed.id,principleId:id,guidance:p.guidance,sourceIds:p.sourceIds};
    });
  });
}
