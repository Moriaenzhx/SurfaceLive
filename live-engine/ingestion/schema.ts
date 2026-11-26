export const scenes = ['b2b-workbench','executive-dashboard','local-consumer','consumer-commerce','creative-editor','general'];
export const kinds = ['DesignRule','VisualExemplar','InteractionCase','PreferencePair'] as const;
export type Kind = typeof kinds[number];
export type Candidate = {
  id:string; title:string; canonicalUrl:string; publisher:string; sceneTags:string[];
  rightsStatus:'link-only'|'analysis-permitted'|'licensed-reproduction';
  licenseOrTerms:string; termsUrl:string; rightsReviewedBy?:string; rightsReviewedAt?:string;
  screenshotUrl?:string; discoveredFrom?:string;
};
export type Trace={sourceId:string;versionHash:string;observedAt:string;userAction:string;before:string;after:string};
export type Capture = {
  traces?:{sha256:string;observedAt:string;userAction:string;after:string}[];
  versionHash:string; pageHash:string; revision?:string; pageTitle:string; capturedAt:string;
  robots:{url:string; hash:string; checkedAt:string}[];
  screenshot?:{url:string; sha256:string; width:number; height:number};
};
export type Card = {id:string; title:string; kind:Kind; sourceId:string; versionHash:string;
  sceneTags:string[]; [field:string]:unknown};
export function ensure(ok:unknown, message:string): asserts ok { if (!ok) throw new Error(message); }
export function hasText(s:unknown): s is string {return typeof s==='string' && !!s.trim() && s.length<=4000;}
export function canonical(raw:string){
  const u=new URL(raw);
  ensure(u.protocol==='https:' && !u.username && !u.password,'Expected public HTTPS URL');
  u.hash='';
  for(const k of [...u.searchParams.keys()]) if(/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href;
}
export function checkId(id:unknown){ensure(typeof id==='string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id),'Invalid identifier');}
function checkScenes(tags:unknown){
  ensure(Array.isArray(tags) && tags.length && tags.every(s=>scenes.includes(s)), 'Missing or unknown scene');
}
export function checkCandidate(s:Candidate){
  checkId(s.id); checkScenes(s.sceneTags);
  ensure([s.title,s.publisher,s.licenseOrTerms].every(hasText),'Incomplete source metadata');
  canonical(s.canonicalUrl); canonical(s.termsUrl);
  if(s.screenshotUrl) canonical(s.screenshotUrl);
  ensure(['link-only','analysis-permitted','licensed-reproduction'].includes(s.rightsStatus),'Unknown rights status');
  if(s.rightsStatus!=='link-only') ensure(hasText(s.rightsReviewedBy) && Number.isFinite(Date.parse(s.rightsReviewedAt!)), 'Terms review required');
}
const fields:Record<Kind,string[]> = {
  DesignRule:['topic','decision','applicability','contraindications','positiveExample','negativeExample','observableCheck'],
  VisualExemplar:['pageState','visualHierarchy','layoutGrammar','typographyRhythm','colorRoles','density','focalPoint','transferablePrinciples','copyingRestrictions','applicability','contraindications','pixelInspectedBy'],
  InteractionCase:['preconditions','userAction','visibleOutcome','failureStates','reducedMotion','applicability','contraindications'],
  PreferencePair:['context','variantA','variantB','chosen','reviewerType','freeTextReason','timestamp'],
};
export function checkCards(cards:Card[], source:Candidate, cap:Capture){
  ensure(Array.isArray(cards) && cards.length,'No distilled objects');
  const ids=new Set(), names=new Set();
  for(const c of cards){
    checkId(c.id); checkScenes(c.sceneTags);
    ensure(c.sceneTags.every(tag=>source.sceneTags.includes(tag)), 'Unreviewed scene');
    ensure(c.sourceId===source.id && c.versionHash===cap.versionHash,'Stale or missing source version');
    ensure(kinds.includes(c.kind) && hasText(c.title),'Invalid kind or title');
    ensure(!ids.has(c.id) && !names.has(c.title.trim().toLowerCase()),'Duplicate object ID or title');
    ids.add(c.id); names.add(c.title.trim().toLowerCase());
    for(const key of fields[c.kind]) ensure(hasText(c[key]),c.id+' missing '+key);
    if(c.kind==='VisualExemplar'){
      ensure(cap.screenshot && c.inspectedHash===cap.screenshot.sha256,'No matching inspected screenshot');
      ensure(c.viewportBasis==='screenshot-raster' || c.viewportBasis==='browser-css','Unknown viewport basis');
      const v=c.capturedViewport as {width:number;height:number};
      ensure(v && [v.width,v.height].every(x=>Number.isInteger(x)&&x>0),'Missing viewport');
      ensure(c.screenshotPathOrLink===cap.screenshot.url && ['pending','reviewed'].includes(String(c.humanReview)),'Missing screenshot reference or human review status');
      if(c.viewportBasis==='screenshot-raster') ensure(v.width===cap.screenshot.width && v.height===cap.screenshot.height,'Screenshot dimensions differ');
    }
    if(c.kind==='InteractionCase'){
      const e=c.testEvidence as {kind:string;sha256:string};
      ensure(e?.kind==='dom-trace' && cap.traces?.some(t=>t.sha256===e.sha256 && t.userAction===c.userAction && t.after===c.visibleOutcome), 'Interaction requires source-bound behavioral evidence');
    }
    if(c.kind==='PreferencePair'){
      ensure(['A','B','tie'].includes(String(c.chosen)) && c.variantA!==c.variantB && typeof c.taskSuccess==='boolean' && Number.isFinite(Date.parse(String(c.timestamp))), 'Invalid preference comparison');
    }
    if(c.kind==='PreferencePair'||c.kind==='DesignRule') ensure(typeof c.confidence==='number' && c.confidence>=0 && c.confidence<=1,'Invalid confidence');
  }
}
