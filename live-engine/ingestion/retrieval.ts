import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkCandidate,checkCards,kinds,type Card} from './schema.ts';
import type {Entry} from './store.ts';
export const catalog=fileURLToPath(new URL('./data/factory.sqlite',import.meta.url));
export function indexed(path=catalog):Entry[]{
  if(!existsSync(path))return [];
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    const entries=db.prepare("SELECT entry FROM sources WHERE json_extract(entry,'$.stage')='indexed' ORDER BY id").all();
    return entries.map(row=>{
      const e:Entry=JSON.parse(String(row.entry));
      if(!e.review?.by || !e.capture || e.error || e.source.rightsStatus==='link-only') throw new Error('Invalid indexed source '+e.source.id);
      checkCandidate(e.source);checkCards(e.cards!,e.source,e.capture);
      return e;
    });
  }finally{db.close();}
}
export function factoryHits(scene:string,description:string,path=catalog){
  const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
  const terms=[...segmenter.segment(description.toLowerCase())].map(s=>s.segment).filter(t=>t.length>=2);
  const candidates=indexed(path).flatMap(e=>e.cards!.filter(c=>c.sceneTags.includes(scene)).map(c=>{
    const phrase=[c.title,c.applicability,c.context,c.topic].join(' ').toLowerCase();
    const score=terms.filter(t=>phrase.includes(t)).length;
    return {card:c,url:e.source.canonicalUrl,rights:e.source.licenseOrTerms,review:e.review,score};
  }));
  const ranked=candidates.sort((a,b)=>b.score-a.score || a.card.id.localeCompare(b.card.id));
  return kinds.flatMap(k=>ranked.filter(h=>h.card.kind===k).slice(0,k==='InteractionCase'||k==='PreferencePair'?1:2));
}
export function summary(c:Card){
  switch(c.kind){
    case 'DesignRule': return [c.decision,c.applicability,c.contraindications,c.observableCheck];
    case 'VisualExemplar': return [c.transferablePrinciples,c.applicability,c.contraindications,c.copyingRestrictions];
    case 'InteractionCase': return [c.preconditions,c.userAction,c.visibleOutcome,c.contraindications];
    case 'PreferencePair': return [c.context,'个人偏好 '+c.chosen,c.freeTextReason,c.reviewerType];
  }
}
