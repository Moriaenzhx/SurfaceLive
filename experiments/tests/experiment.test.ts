import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrompt} from '../prompts.ts';
import {getScenario,scenarios} from '../scenarios.ts';
import {runExperiment} from '../runner.ts';
import {auditFiles} from '../verification.ts';

test('three scenarios and three distinct prompt conditions',()=>{
  assert.equal(scenarios.length,3);
  const s=getScenario('recruiting');
  const a0=createPrompt(s,'A0'),a1=createPrompt(s,'A1'),a2=createPrompt(s,'A2');
  assert.ok(a0.includes('data-testid'));
  assert.ok(!a0.includes('Live Engine 设计知识'));
  assert.ok(a1.includes('场景理解层')&&!a1.includes('https://'));
  assert.ok(a2.includes('Live Engine 设计知识')&&a2.includes('https://'));
});

test('plan mode persists prompt artifacts without running any Agent',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sl-plan-'));
  try{
    const {folder,manifest}=await runExperiment({root,mode:'plan',scenarioId:'coroof'});
    assert.deepEqual(Object.keys(manifest.variants),['A0','A1','A2']);
    assert.equal(manifest.variants.A0.status,'planned');
    assert.match(await readFile(join(folder,'A2','prompt.md'),'utf8'),/视觉/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('mock validates orchestration but never reports production-ready or aesthetic superiority',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sl-mock-'));
  try{
    const {folder,manifest}=await runExperiment({root,mode:'mock',scenarioId:'neighborhood',variants:['A0','A2']});
    assert.equal(manifest.variants.A0.status,'generated-static-passed');
    assert.equal(manifest.variants.A2.productionReady,false);
    assert.equal(manifest.variants.A2.browser,'not-run');
    assert.ok((await auditFiles(join(folder,'A0'))).every(c=>c.passed));
    assert.match(await readFile(join(folder,'HUMAN_BLIND_REVIEW.md'),'utf8'),/待填写/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('execute refuses to infer or silently choose an Agent',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sl-real-'));
  try{await assert.rejects(()=>runExperiment({root,mode:'execute',scenarioId:'recruiting'}),/声明 --agent/)}
  finally{await rm(root,{recursive:true,force:true});}
});

test('invalid user scenarios and conditions must fail',async()=>{
  assert.throws(()=>getScenario('none'),/未知场景/);
  const root=await mkdtemp(join(tmpdir(),'sl-bad-'));
  try{await assert.rejects(()=>runExperiment({root,mode:'plan',scenarioId:'coroof',variants:['B9' as any]}),/有效/)}
  finally{await rm(root,{recursive:true,force:true});}
});
