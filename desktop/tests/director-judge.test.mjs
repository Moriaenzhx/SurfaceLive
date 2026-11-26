import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strategySchema,validateStrategies,validateDirectionDifferences} from '../../live-engine/design/director.mjs';
import {validateJudgment} from '../../live-engine/design/judge.mjs';
const proposal=id=>({id,name:id,structure:'s'+id,informationArchitecture:'ia'+id,focalPoint:'focus'+id,typography:'type'+id,
  interactionPath:'flow'+id,advantages:'a',costs:'c',fit:'f',ruleIds:['R'],visualCaseIds:[]});
test('reject a palette-only alternative and invented exemplar IDs',()=>{
  const a=proposal('a'),b=proposal('b'),raw={options:[a,b],selectedId:'a',selectionReason:'fit',evidenceGaps:['domain']};
  const knowledge={rules:[{id:'R'}],exemplars:[],reviewedCards:[]};
  assert.equal(validateStrategies(raw,knowledge).selectedId,'a');
  assert.throws(()=>validateStrategies({...raw,options:[a,{...a,id:'b',name:'blue'}]},knowledge));
  assert.throws(()=>validateStrategies({...raw,options:[a,{...b,visualCaseIds:['imaginary']}]},knowledge));
});
test('an uncertain screenshot comparison must name what needs human judgment',()=>{
  const raw={preferred:'uncertain',reason:'tradeoff',issues:[],dimensions:{hierarchy:'h',layout:'l',typography:'t',color:'c',sceneFit:'s'}};
  assert.throws(()=>validateJudgment(raw));
  assert.equal(validateJudgment({...raw,uncertainty:'用户更偏好哪种阅读顺序'}).preferred,'uncertain');
});
test('a scoped human choice can be cited as a preference only when it was retrieved',()=>{
  const knowledge={rules:[{id:'R'}],preferences:[{id:'seed'}],confirmedPreferences:[{id:'human-a'}],exemplars:[],reviewedCards:[]};
  const raw={options:[{...proposal('a'),preferenceIds:['human-a']},proposal('b')],selectedId:'a',selectionReason:'fit',evidenceGaps:['domain']};
  assert.deepEqual(strategySchema(knowledge).properties.options.items.properties.preferenceIds.items.enum,['seed','human-a']);
  assert.equal(validateStrategies(raw,knowledge).selectedId,'a');
  assert.throws(()=>validateStrategies(raw,{...knowledge,confirmedPreferences:[]}));
  assert.throws(()=>validateStrategies({...raw,options:[{...proposal('a'),ruleIds:['human-a']},proposal('b')]},knowledge));
});

test('direction comparison uses visible reading order, interaction and type; serialization and bookkeeping differences are inert',()=>{
  const a={design:{layouts:{desktop:{order:['姓名','依据']},mobile:{order:['姓名','依据']}},
    states:[{id:'initial',priority:['姓名','依据'],primaryAction:{id:'show',operation:'click',nextState:'detail'}},
      {id:'detail',priority:['依据','姓名'],primaryAction:{id:'back',operation:'click',nextState:'initial'}}],
    system:{tokens:{'color.brand.primary':'#a00','type.family.body':'system-ui, sans-serif','type.size.body':'16px','type.size.heading':'24px',
      'type.weight.body':'400','type.lineHeight.body':'1.5','space.component.md':'12px'}},
    art:{language:{visualDifference:'强调姓名',architectureDifference:'名单先行'}}}};
  const b=structuredClone(a),design=b.design;
  design.art.language={visualDifference:'另一份说明',architectureDifference:'用另一种方式描述'};
  design.system.tokens['color.brand.primary']='#005';
  design.system.tokens['type.size.body']='1rem';
  design.system.tokens['type.size.heading']='1.5rem';
  design.system.tokens['type.family.body']='SYSTEM-UI,sans-serif';
  design.system.tokens['space.component.md']='0.75rem';
  design.states[0].primaryAction={id:'choose',operation:'click',nextState:'evidence'};
  design.states[1].id='evidence';
  design.states.reverse();
  assert.throws(()=>validateDirectionDifferences([a,b]),/非配色差异/);
  for(const alter of [d=>d.layouts.mobile.order.reverse(),d=>{d.system.tokens['type.size.heading']='36px';},
    d=>{d.states[0].primaryAction.operation='select';}]){
    const different=structuredClone(b);alter(different.design);
    assert.doesNotThrow(()=>validateDirectionDifferences([a,different]));
  }
});
