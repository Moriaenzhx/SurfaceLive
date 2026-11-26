import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexed} from '../../live-engine/ingestion/retrieval.ts';
import {principles,sources} from '../../live-engine/knowledge/src/live-knowledge.ts';
import {cases} from '../../experiments/k01-cases.mjs';
import {designSeeds,validateSeedCatalog,matchDesignSeeds,directorSeedBrief,validateLanguageDecision,selectedLanguage} from '../../live-engine/design/design-language.mjs';

const sample=async()=>JSON.parse(await readFile(new URL('../../live-engine/design/language-seeds.json',import.meta.url)));
test('库中每条规则和截图引用可直接对回仓库里的权利及审核记录',async()=>{
  const data=await sample(),factory=indexed();
  assert.equal(validateSeedCatalog(data),data);assert.equal(designSeeds.length,5);
  for(const ref of data.sources){
    if(ref.kind==='knowledge-rule'){
      const card=principles.find(p=>p.id===ref.id);
      assert.equal(card.decision,ref.title);
      assert.deepEqual(card.sources,ref.citations.map(c=>c.sourceId));
      for(const c of ref.citations)assert.equal(c.url,sources.find(s=>s.id===c.sourceId).url);
    }else{
      const entry=factory.find(e=>e.cards.some(c=>c.id===ref.id));
      assert.equal(ref.rights,entry.source.licenseOrTerms);
      assert.equal(ref.inspectedHash,entry.cards.find(c=>c.id===ref.id).inspectedHash);
      assert.equal(ref.citations[0].url,entry.source.canonicalUrl);
      assert.equal(ref.review,[entry.stage,entry.review.by,entry.review.at].join(' / '));
    }
  }
  data.seeds[0].principles[0].sourceIds.push('unavailable');
  assert.throws(()=>validateSeedCatalog(data),/原则依据/);
});
test('需求和场景按任务排序；终端、气质、被否定的业务不能单独触发选择',()=>{
  for(const [id,expected] of [['zhishi','daily-index'],['recruiting','evidence-register']]){
    const c=cases[id],matches=matchDesignSeeds({brief:c.text,device:c.target});
    assert.equal(matches.length,2);assert.equal(matches[0].id,expected);
    assert(matches[0].reasons.some(r=>r.axis==='task'));
    assert(!directorSeedBrief(matches).includes('media-stage'));
    assert(Buffer.byteLength(directorSeedBrief(matches))<6500);
  }
  for(const brief of ['高级的官网。','不要招聘工具，做一个作品介绍。','专业蓝色的手机页面']){
    assert.deepEqual(matchDesignSeeds({brief,device:'desktop'}),[]);
  }
  const analysis={dimensions:{task:[{evidence:'查看当前波动',value:'监测指标异常'}],
    audience:[{evidence:'运营负责人',value:'运维负责人'}],visual:[{evidence:'简洁的工具感',value:'冷静'}]}};
  const hit=matchDesignSeeds({brief:'查看当前波动，运营负责人，简洁的工具感',analysis,device:'desktop'})[0];
  assert.equal(hit.id,'signal-window');assert.deepEqual(hit.reasons.map(r=>r.axis),['task','structure','audience','brand','device']);
});
test('采用、组合、原创与逐项拒绝均可还原；注入只包含已选原则',()=>{
  const c=cases.zhishi,matches=matchDesignSeeds({brief:c.text,device:c.target});
  const decisions={mode:'original',visualDifference:'以时间数字作为层级，另一方向用长文叙事',architectureDifference:'按天索引，与按事项集不同',
    tokenRationale:'正文比注释更重，动作色服从已确认品牌色',choices:matches.map(m=>({seedId:m.id,principleIds:[],reason:'当前方向自建索引',boundary:'不迁移输入步骤'}))};
  assert.deepEqual(selectedLanguage(decisions,matches),[]);
  decisions.mode='adopt';decisions.choices[0].principleIds=['composition'];
  const items=selectedLanguage(decisions,matches);
  assert.equal(items.length,1);assert.equal(items[0].seedId,'daily-index');assert.equal(items[0].principleId,'composition');
  assert(items[0].sourceIds.includes('vis-nearby'));assert(items[0].guidance.includes('日期'));
  decisions.mode='combine';decisions.choices[1].principleIds=['interaction'];
  assert.equal(selectedLanguage(decisions,matches).length,2);
  const invalid=(adjust,err)=>{const d=structuredClone(decisions);adjust(d);assert.throws(()=>validateLanguageDecision(d,matches),err);};
  invalid(d=>{d.choices.pop();},/逐项说明/);
  invalid(d=>{d.choices[0].seedId='guessed-seed';},/逐项说明/);
  invalid(d=>{d.choices[0].principleIds=['nonexistent'];},/原则未在本轮/);
  invalid(d=>{d.mode='original';},/选择模式/);
  assert.deepEqual(selectedLanguage({...decisions,mode:'original',choices:[]},[]),[]);
});
