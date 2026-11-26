import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScene,dimensions} from '../../live-engine/design/scene.mjs';
import {prepareGeneration,direction} from '../engine.mjs';
test('unknown cultural products preserve uncertainty and do not inherit unrelated local services rules',()=>{
  const brief='为居民设计传统文化择时手机应用';
  const axes=Object.fromEntries(Object.keys(dimensions).map(key=>[key,[]]));
  const raw={dimensions:{...axes,cultureBrand:[{value:'传统文化',evidence:'传统文化',certainty:'explicit'}]},device:'mobile',catalog:[],uncertainties:['资料库缺少择时案例'],assumptionsToVerify:['先选事项是否便于比较时段']};
  const analysis=validateScene(raw,brief);
  assert(analysis.missingDimensions.includes('visual'));assert.equal(analysis.catalogCoverage,'uncovered');
  const {knowledge}=prepareGeneration(brief,direction(brief),null,brief,analysis);
  assert.equal(knowledge.scene,'general');assert.equal(knowledge.reviewedCards.length,0);
  assert.throws(()=>validateScene({...raw,dimensions:{...axes,visual:[{value:'金色',evidence:'用户喜欢金色',certainty:'explicit'}]}},brief));
  assert.throws(()=>validateScene({...raw,assumptionsToVerify:[]},brief),/待验证/);
});
