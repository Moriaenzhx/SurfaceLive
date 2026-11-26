import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {direction,prepareGeneration} from '../engine.mjs';
import {DesignTrace} from '../design-trace.mjs';
import {Library,newMetadata} from '../library.mjs';

test('prompt provenance follows the actual modification turn and publishes alongside the exact exported source',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-trace-'));
  try{
    const library=new Library(root,new URL('../samples/',import.meta.url).pathname);
    await library.load();
    const base=library.require('sample'),change='改为手机端附近居民的预约服务',target='auto';
    const product=await library.source(base.id);
    const context=direction(base.description+'\n'+change,target);
    const {prompt,knowledge}=prepareGeneration(base.description,context,product,change);
    assert(prompt.includes(change));
    for(const {id} of [...knowledge.rules,...knowledge.exemplars,...knowledge.preferences,...knowledge.reviewedCards])assert(prompt.includes(id));
    const token=randomUUID();
    const trace=await DesignTrace.begin(join(root,'.design-traces'),token,{base,request:change,target,agent:'codex'});
    await trace.prepared(prompt,context,knowledge,[]);
    const revision=newMetadata({base,description:base.description,change,target,context,agent:'codex'},base.title);
    await trace.source(revision,product);await library.commit(revision,product,[],trace);
    const path=join(root,revision.id),record=JSON.parse(await readFile(join(path,'design-trace.json')));
    assert.equal(record.parent,base.id);assert.equal(record.code.revision,revision.id);
    assert.deepEqual(record.browser,[]);assert.equal(record.visualReview.status,'not-run');assert.equal(record.agent.reportedModel,null);
    const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha(await readFile(join(path,'prompt.md'))),record.prompt.sha256);
    const exported=await library.export(revision.id,root);
    assert.deepEqual((await readdir(exported)).sort(),['app.js','index.html','styles.css']);
    for(const [name,file] of Object.entries(record.code.files))assert.equal(sha(await readFile(join(exported,name))),file.sha256);
    assert.deepEqual(await readdir(join(root,'.design-traces')),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('failed and cancelled attempts retain separate receipts without inventing code or browser outcomes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-trace-'));
  try{
    const library=new Library(root,new URL('../samples/',import.meta.url).pathname);
    for(const stage of ['failed','cancelled']){
      const trace=await DesignTrace.begin(join(root,'.design-traces'),randomUUID(),{request:'test',agent:'codex',target:'auto'});
      await trace.finish(stage,{error:'test case'});
      const record=JSON.parse(await readFile(join(trace.folder,'design-trace.json')));
      assert.equal(record.stage,stage);assert.equal(record.code,null);assert.equal(record.prompt,null);assert.deepEqual(record.browser,[]);
    }
    await library.load();assert(library.list().every(r=>r.sample));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('optional audit indexes actual CLI input without copying request, model prose or private preference IDs',async()=>{
  const {DesignAudit}=await import('../design-audit.mjs');
  const folder=await mkdtemp(join(tmpdir(),'surface-audit-'));
  const privateText='sensitive-probe@example.invalid';
  try{
    const audit=new DesignAudit(randomUUID(),privateText);
    const {knowledge}=prepareGeneration('招聘',direction('招聘','desktop'),null,'');
    knowledge.confirmedPreferences=[{id:'personal-feedback',reason:privateText}];
    audit.retrieval(privateText,['b2b-workbench'],knowledge);
    const first=knowledge.rules[0].id, prompt='['+first+' / layout] "personal-feedback"';
    audit.invocation({operation:'source',promptSha256:createHash('sha256').update(prompt).digest('hex'),outcome:'returned'},prompt);
    await audit.save(folder,{stage:'completed-checks',target:'desktop',artDirection:{status:'selected',selectedId:privateText},
      browser:[],visualReview:{status:'not-run'},automaticRepair:{status:'not-run'}});
    const text=await readFile(join(folder,'design-audit.json'),'utf8'), record=JSON.parse(text);
    assert(!text.includes(privateText));assert(!text.includes('personal-feedback'));
    assert.equal(record.calls[0].present.length,2);assert.equal(record.calls[0].present[0].id,first);
    assert(record.calls[0].excludedAfterRetrieval.length>0);
    assert(record.candidates.some(c=>c.excluded==='below-diversified-limit'));
    assert(record.candidates.some(c=>c.excluded==='outside-tag-and-analogy-selection'));
  }finally{await rm(folder,{recursive:true,force:true});}
});
