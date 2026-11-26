import test from 'node:test';
import assert from 'node:assert/strict';
import {validateJourney} from '../../live-engine/design/journey.mjs';
import {functionalPass} from '../interaction-check.mjs';

test('flow accepts form input and stable selectors, rejects selectors outside the data hook and empty assertions',()=>{
  const step={id:'search-name',state:'results',action:'按姓名查找',operation:'fill',value:'陈曦',result:'匹配姓名',contains:'陈曦'};
  assert.equal(validateJourney([step]).length,1);
  assert.equal(validateJourney([{...step,opener:{id:'details',action:'打开服务详情'}}]).length,1);
  for(const change of [{id:'input,body'},{state:'bad key'},{contains:''},{operation:'execute'},{value:''},{opener:{id:'input,body',action:'打开'}}])
    assert.throws(()=>validateJourney([{...step,...change}]));
});
test('functional regressions block a rendered candidate even if the visual model likes it',()=>{
  const view={width:390,height:844},ok={fits:true,action:true,screenshot:{file:'mobile.png'},errors:[],viewport:view,requestedViewport:view,journey:[{passed:true}]};
  assert(functionalPass(ok));
  for(const change of [{action:false},{fits:false},{screenshot:null},{errors:[{message:'uncaught'}]},{journey:[{passed:false}]}])
    assert.equal(functionalPass({...ok,...change}),false);
});
