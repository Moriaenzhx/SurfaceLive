import test from 'node:test';
import assert from 'node:assert/strict';
import {conflictsWithLocks} from '../contract-check.mjs';

test('visual repairs changing a locked semantic value or a user requirement are withheld while other scoped repairs remain eligible',()=>{
  const requirements={tokenLocks:[{token:'color.brand.primary',value:'#123456'}],explicit:['保留查询操作']};
  assert.equal(conflictsWithLocks({changesTokens:['color.brand.primary'],overridesRequirements:[]},requirements),true);
  assert.equal(conflictsWithLocks({changesTokens:[],overridesRequirements:['保留查询操作']},requirements),true);
  assert.equal(conflictsWithLocks({changesTokens:['space.component.md'],overridesRequirements:[]},requirements),false);
  assert.equal(conflictsWithLocks({change:'legacy correction'},undefined),false);
});
