import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PNG} from 'pngjs';
import {Collector,digest} from '../capture.ts';
import {Queue} from '../store.ts';
import {factoryHits} from '../retrieval.ts';
import {checkCards,type Card,type Candidate} from '../schema.ts';

const source:Candidate={id:'sample',title:'Source',publisher:'Test',canonicalUrl:'https://example.org/workspace',sceneTags:['b2b-workbench'],screenshotUrl:'https://example.org/screen.png',rightsStatus:'analysis-permitted',licenseOrTerms:'Test-only fixture',termsUrl:'https://example.org/terms',rightsReviewedAt:'2026-01-01',rightsReviewedBy:'tester'};
const png=PNG.sync.write(new PNG({width:4,height:3}));
function setup(t:any){
  const dir=mkdtempSync(join(tmpdir(),'factory-test-')), path=join(dir,'q.sqlite'),q=new Queue(path);
  t.after(()=>{q.db.close();rmSync(dir,{recursive:true,force:true});});
  q.discover(source);
  q.reserve=()=>0; // no wall-clock waits in HTTP fixture tests
  let status=200, policy='User-agent: *\nAllow: /', img=png;
  const collector=new Collector(q,dir,async input=>{
    const url=String(input);
    if(url.endsWith('robots.txt'))return new Response(policy);
    return url.endsWith('.png')?new Response(img,{status}):new Response('<title>Untrusted page</title>');
  });
  return {q,path,dir,collector,fail:()=>status=410,block:()=>policy='User-agent: *\nDisallow: /screen',badImage:()=>img=Buffer.from('not an image')};
}
function rule(q:Queue):Card{
  return {id:'rule',kind:'DesignRule',title:'Table rhythm',sceneTags:source.sceneTags,sourceId:source.id,versionHash:q.get(source.id).capture!.versionHash,topic:'tables',decision:'Align values',applicability:'Comparisons',contraindications:'Narrative text',positiveExample:'Consistent columns',negativeExample:'Variable column order',observableCheck:'Columns share baselines',confidence:0.6};
}
test('registry rejects canonical aliases, duplicate titles/IDs and missing terms',t=>{
  const {q}=setup(t);
  q.discover({...source});
  assert.equal(q.all().length,1);
  assert.throws(()=>q.discover({...source,id:'other',canonicalUrl:source.canonicalUrl+'?utm_campaign=foo#top',title:'Another'}),/UNIQUE/);
  assert.throws(()=>q.discover({...source,id:'other',canonicalUrl:'https://example.net',title:'SOURCE'}),/UNIQUE/);
  assert.throws(()=>q.discover({...source,canonicalUrl:'https://example.net'}),/Duplicate/);
  assert.throws(()=>q.discover({...source,rightsReviewedBy:''}),/review/);
});
test('reviewed source is versioned, indexed by scene and withdrawn after HTTP 410',async t=>{
  const {q,path,collector,fail}=setup(t);await collector.capture(source.id);
  const r=rule(q);q.distill(source.id,[r]);
  assert.throws(()=>q.index(source.id),/review/);
  assert.deepEqual(factoryHits('b2b-workbench','',path),[]);
  assert.throws(()=>q.review(source.id,'reviewer','old hash'),/current/);
  q.review(source.id,'reviewer',r.versionHash);q.index(source.id);
  await collector.capture(source.id);
  assert.equal(factoryHits('b2b-workbench','',path)[0].card.id,r.id);
  assert.equal(factoryHits('creative-editor','',path).length,0);
  fail();await assert.rejects(collector.capture(source.id),/410/);
  assert.equal(q.get(source.id).stage,'discovered');
  assert.equal(factoryHits('b2b-workbench','',path).length,0);
  assert.ok(q.db.prepare("SELECT seq FROM history WHERE json_extract(entry,'$.stage')='indexed'").get());
});
test('link-only, blocked robots and broken PNG never reach captured',async t=>{
  const {q,collector,block}=setup(t);
  q.discover({...source,rightsStatus:'link-only'});await assert.rejects(collector.capture(source.id),/Link-only/);
  q.discover(source);block();await assert.rejects(collector.capture(source.id),/robots/);
  assert.equal(q.get(source.id).capture,undefined);
  const other=setup(t);other.badImage();await assert.rejects(other.collector.capture(source.id),/PNG/);
});
test('four object types require their own evidence',async t=>{
  const {q,dir,collector}=setup(t);await collector.capture(source.id);
  const r=rule(q), cap=q.get(source.id).capture!;
  const validate=(c:Card)=>checkCards([c],source,cap);
  assert.throws(()=>validate({...r,versionHash:'old'}),/Stale/);
  assert.throws(()=>validate({...r,decision:''}),/decision/);
  assert.throws(()=>checkCards([r,{...r,id:'new'}],source,cap),/Duplicate/);
  const v={...r,kind:'VisualExemplar',pageState:'open',visualHierarchy:'grouped',layoutGrammar:'rows',typographyRhythm:'stable',colorRoles:'neutral',density:'high',focalPoint:'record',transferablePrinciples:'Align text',copyingRestrictions:'No marks',pixelInspectedBy:'fixture',humanReview:'pending',screenshotPathOrLink:source.screenshotUrl,viewportBasis:'screenshot-raster',capturedViewport:{width:4,height:3}} as Card;
  assert.throws(()=>validate(v),/matching inspected/);validate({...v,inspectedHash:digest(png)});
  const i={...r,kind:'InteractionCase',preconditions:'selection',userAction:'choose',visibleOutcome:'updated',failureStates:'empty',reducedMotion:'untested'} as Card;
  assert.throws(()=>validate(i),/behavioral evidence/);
  const trace={sourceId:source.id,versionHash:r.versionHash,observedAt:'2026-01-01',userAction:i.userAction,before:'original',after:i.visibleOutcome};
  const traceFile=join(dir,'trace.json');writeFileSync(traceFile,JSON.stringify(trace));
  const sha256=q.attachTrace(source.id,traceFile,dir);
  checkCards([{...i,testEvidence:{kind:'dom-trace',sha256}}],source,q.get(source.id).capture!);
  assert.throws(()=>validate({...i,testEvidence:{kind:'recording',url:source.screenshotUrl}}),/behavioral evidence/);
  const p={...r,kind:'PreferencePair',context:'comparison',variantA:'compact',variantB:'spacious',chosen:'A',reviewerType:'target-user',freeTextReason:'easier to scan',taskSuccess:true,timestamp:'2026-01-01'} as Card;
  validate(p);assert.throws(()=>validate({...p,chosen:'C'}),/comparison/);
});
test('web discovery only records unique same-site candidates and grants no capture rights',async t=>{
  const {q}=setup(t);
  const links='<a href="/wiki/File:A.png">A</a><a href="/wiki/File:A.png#info">duplicate</a><a href="https://other.test/wiki/File:X.png">external</a>';
  const collector=new Collector(q,'',async url=>new Response(String(url).endsWith('robots.txt')?'User-agent: *\nAllow: /':links));
  const ids=await collector.discoverLinks(source,'/wiki/File:',2);
  assert.equal(ids.length,1);assert.equal(q.get(ids[0]).source.rightsStatus,'link-only');
  assert.deepEqual(await collector.discoverLinks(source,'/wiki/File:',2),[]);
  await assert.rejects(collector.capture(ids[0]),/Link-only/);
});
test('permissions downgrade withdraws published objects and earlier revisions are preserved',async t=>{
  const {q,path,collector}=setup(t);await collector.capture(source.id);
  const card=rule(q);q.distill(source.id,[card]);q.review(source.id,'reviewer',card.versionHash);q.index(source.id);
  q.discover({...source,rightsStatus:'link-only'});
  assert.equal(factoryHits('b2b-workbench','',path).length,0);
  assert.throws(()=>q.distill(source.id,[card]),/Capture required/);
  await assert.rejects(collector.capture(source.id),/Link-only/);
  assert.ok(q.db.prepare("SELECT seq FROM history WHERE json_extract(entry,'$.stage')='indexed'").get());
});
test('repeat capture of changed pixels requires renewed rights review before caching',async t=>{
  const {q,collector,dir}=setup(t);await collector.capture(source.id);
  const changed=new PNG({width:3,height:2}), replacement=PNG.sync.write(changed);
  const second=new Collector(q,dir,async input=>{
    const url=String(input);return new Response(url.endsWith('robots.txt')?'User-agent: *\nAllow: /':url.endsWith('.png')?replacement:'<title>Untrusted page</title>');
  });
  await assert.rejects(second.capture(source.id),/renew terms/);
  await assert.rejects(second.capture(source.id),/renew terms/);
  assert.equal(q.get(source.id).stage,'discovered');
  q.discover({...source,rightsReviewedAt:'2026-02-01'});
  await second.capture(source.id);assert.equal(q.get(source.id).capture?.screenshot?.width,3);
});
