import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContract,contractInstruction} from '../../live-engine/design/contract.mjs';
import {validateStateActions,experiencePlanningInstruction,stateActionInstruction} from '../../live-engine/design/experience-patterns.mjs';
import {checkShape,designContractSchema11} from '../../live-engine/design/contract-schema.mjs';
import {cases} from '../../experiments/k01-cases.mjs';

const fixture=(id,priority,label,nextState,expectedText,operation='click')=>({
  id,purpose:'验证'+priority,taskEvidence:'此夹具用于状态图校验',priority:[priority],controls:[label],
  primaryAction:{id:'act-'+id,operation,value:operation==='select'?'待补证':null,nextState,expectedText},
  prerequisites:id==='initial'?[]:['已完成上一步业务操作'],presentation:{desktop:'结果与来源并列',mobile:'先读结果，再展开来源'}
});
const graph=states=>({states,transitions:states.map(s=>({from:s.id,to:s.primaryAction.nextState,action:s.controls[0]}))});
const hiring=()=>graph([
  fixture('initial','候选名单','选择周宁','selected','周宁'),
  fixture('selected','周宁身份','查看证据','evidence','资料来源'),
  fixture('evidence','岗位依据及缺口','人工复核','review','复核记录'),
  fixture('review','待补证结论','保存复核','saved','周宁已保存'),
  fixture('saved','保存回执','返回名单','initial','候选名单')
]);
const timing=()=>graph([
  fixture('initial','基础资料','使用我的资料','criteria','选择事项'),
  fixture('criteria','事项与日期','查询候选','querying','正在查询'),
  fixture('querying','查询进度','正在查询','results','候选时段','wait'),
  fixture('results','候选时段','查看理由','reason','推荐理由'),
  fixture('reason','推荐理由','保存时段','saved','已保存'),
  fixture('saved','已保存时段','比较候选','comparison','时段差异'),
  fixture('comparison','时段差异','返回条件','criteria','选择事项')
]);

test('知时在条件、处理与结果间改变重心，保存后可继续比较',()=>{
  const plan=timing();
  validateStateActions(plan,cases.zhishi.text);
  const prompt=stateActionInstruction(plan);
  assert(prompt.includes('正在查询 [act-querying, wait]'));
  assert(prompt.includes('查看理由 [act-results, click] → reason'));
  assert(prompt.includes('data-experience-state='));
  plan.states.find(s=>s.id==='results').priority=['事项与日期'];
  assert.throws(()=>validateStateActions(plan,cases.zhishi.text),/候选时段/);
});
test('招聘不可强制名单直接保存，显示入口与实际目标必须在同一状态边',()=>{
  const plan=hiring();validateStateActions(plan,cases.recruiting.text);
  assert.equal(plan.states[0].controls[0],'选择周宁');
  plan.transitions[0].action='保存复核';
  assert.throws(()=>validateStateActions(plan,cases.recruiting.text),/目标状态/);
});
test('检测遗漏的业务阶段、不可执行的输入、重复定位以及走不到的主操作',()=>{
  const missing=timing();missing.states.pop();
  missing.states.at(-1).primaryAction.nextState='initial';missing.transitions.at(-2).to='initial';
  assert.throws(()=>validateStateActions(missing,cases.zhishi.text),/comparison/);
  const duplicate=hiring();duplicate.states[2].primaryAction.id='act-initial';
  assert.throws(()=>validateStateActions(duplicate,cases.recruiting.text),/短键/);
  const badValue=hiring();badValue.states[0].primaryAction.operation='fill';
  assert.throws(()=>validateStateActions(badValue,cases.recruiting.text),/输入值/);
  const unreachable=hiring();unreachable.states[1].primaryAction.nextState='initial';unreachable.transitions[1].to='initial';
  assert.throws(()=>validateStateActions(unreachable,cases.recruiting.text),/验收路径/);
});
test('通用产品可以自行定义业务状态；旧契约读取保留原来的指令',async()=>{
  const path=new URL('../../docs/live-engine/examples/k03a/ambiguous.json',import.meta.url);
  const contract=validateContract(JSON.parse(await readFile(path)));
  assert(!contractInstruction(contract).includes('data-experience-state='));
  const experience=contract.experiencePlan;
  experience.states.forEach((s,i)=>{
    const next=experience.states[(i+1)%experience.states.length];
    s.primaryAction={id:'open-'+next.id,operation:'click',value:null,nextState:next.id,expectedText:next.purpose};
    s.prerequisites=[];s.presentation={desktop:experience.layouts.desktop.structure,mobile:experience.layouts.mobile.structure};
    if(i===experience.states.length-1)experience.transitions.push({from:s.id,to:next.id,action:s.controls[0]});
  });
  checkShape(designContractSchema11.properties.experiencePlan,experience);
  validateStateActions(experience,contract.requirements.brief);
  assert(!experiencePlanningInstruction(contract.requirements.brief).includes('候选时段'));
  assert.throws(()=>validateContract(contract),/未知字段/);
});

test('语义相近的任务能找到对应阶段，明确取消比较时不用生成比较状态',()=>{
  const brief='做一个民俗选时工具，可改个人资料，选办理事项和日期区间，查看备选时间段与依据，允许收藏和比较。修改：暂不提供比较。';
  const instruction=experiencePlanningInstruction(brief);
  assert(instruction.includes('"criteria"')&&instruction.includes('"saved"'));
  assert(!instruction.includes('"comparison"'));
  assert(experiencePlanningInstruction('人才顾问在名单中选应聘者，查看简历佐证，人工审阅并留存每次决定。').includes('"review"'));
  assert(!experiencePlanningInstruction('为招聘品牌网站提供报名表和人才理念介绍。').includes('"review"'));
});
