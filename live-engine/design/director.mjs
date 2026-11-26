import {journeySchema,validateJourney} from './journey.mjs';
import {object,list,string} from './scene.mjs';
import {directionDetailSchema,directionDetailSchema11,stateActionVersion} from './contract-schema.mjs';
function evidenceIds(knowledge){
  const reviewed=knowledge.reviewedCards;
  return {rules:[...knowledge.rules,...reviewed.filter(c=>c.kind==='DesignRule')].map(c=>c.id),
    preferences:[...(knowledge.preferences??[]),...(knowledge.confirmedPreferences??[])].map(c=>c.id),
    visual:[...knowledge.exemplars,...reviewed.filter(c=>c.kind==='VisualExemplar'),...(knowledge.analogies??[])].map(c=>c.id)};
}
export function strategySchema(knowledge,planJourney=false,contract=false){
  const ids=evidenceIds(knowledge);
  const references=allowed=>allowed.length?list({type:'string',enum:allowed}):{...list(string),maxItems:0};
  return object({options:list(object({id:string,name:string,structure:string,informationArchitecture:string,
    focalPoint:string,typography:string,interactionPath:string,advantages:string,costs:string,fit:string,
    ruleIds:references(ids.rules),preferenceIds:references(ids.preferences),visualCaseIds:references(ids.visual),
    ...(contract?{design:contract===stateActionVersion?directionDetailSchema11:directionDetailSchema}:{})})),
    selectedId:string,selectionReason:string,evidenceGaps:list(string),...(planJourney?{journey:journeySchema}:{})});
}
export function directorPrompt(brief,analysis,prepared,preferences=[],planJourney=false){
  return ['担任产品艺术指导。为同一个真实业务需求给出 2–3 个可实现的原创候选，选定其一并说明针对该用户任务的取舍。',
    '候选必须在信息架构、视觉中心、字阶组织和实际操作路径上各有区别。structure 概括组织方式。请写代价、优势和适用理由，禁止仅替换色彩或包装命名。',
    '只引用输入中实际出现的规则与视觉案例 ID。说明具体可迁移的机制及其边界。没有合适的案例时留空并写明缺口。优先遵守明确品牌约束和上下文，不虚构文化事实。',
    '本次允许的引用 ID，各自填入对应字段。\n'+JSON.stringify(evidenceIds(prepared.knowledge)),
    '每个案例仅在写明可迁移之处和边界时引用。跨领域范例只提供结构参考。',
    planJourney?'为所有候选指定同一条真实主任务的实际操作和可见结果。journey 含一至四步；id 和 state 取小写 ASCII 短横线键。operation 使用 click、fill 或 select，value 对应输入或原生选项值。contains 是用户将看到的结果片段，可以使用明确标示的示例数据。收藏、提交、预约等产生业务变更的动作将 requireChange 设为 true，结果区必须出现新状态。':'',
    planJourney?'每个动作对应一个实际控件。若有的方案需要先进入详情、展开菜单或打开表单，将这个真实的前置入口写入 opener 的 id 与 action，操作直接可达时可跳过。没有前置入口填 null。':'',
    '用户需求\n'+brief,'场景理解\n'+JSON.stringify(analysis),'检索内容\n'+prepared.knowledgeText,
    '已核验视觉观察\n'+JSON.stringify([...prepared.knowledge.exemplars,...prepared.knowledge.reviewedCards.filter(c=>c.kind==='VisualExemplar'),...(prepared.knowledge.analogies??[])]),
    preferences.length?'此上下文已确认的用户取舍\n'+JSON.stringify(preferences):''].filter(Boolean).join('\n\n');
}
export function validateStrategies(raw,knowledge,planJourney=false){
  if(planJourney)validateJourney(raw.journey);
  const options=raw?.options;
  if(!Array.isArray(options)||options.length<2||options.length>3)throw Error('艺术指导须提供两至三个方向');
  const ids=evidenceIds(knowledge);
  for(const option of options){
    for(const key of ['id','name','structure','informationArchitecture','focalPoint','typography','interactionPath','advantages','costs','fit'])
      if(typeof option[key]!=='string'||!option[key].trim())throw Error('艺术方向未说明 '+key);
    if(!Array.isArray(option.ruleIds)||!option.ruleIds.length||option.ruleIds.some(id=>!ids.rules.includes(id))||
      (option.preferenceIds??[]).some(id=>!ids.preferences.includes(id))||
      !Array.isArray(option.visualCaseIds)||option.visualCaseIds.some(id=>!ids.visual.includes(id)))throw Error('艺术方向引用了不在本轮检索结果中的证据');
    if(!option.visualCaseIds.length&&!raw.evidenceGaps?.length)throw Error('缺少视觉案例时必须说明证据缺口');
  }
  for(const key of ['id','informationArchitecture','focalPoint','typography','interactionPath'])
    if(new Set(options.map(o=>o[key].trim().toLowerCase())).size!==options.length)throw Error('艺术候选方向重复 '+key);
  if(!options.some(o=>o.id===raw.selectedId)||!raw.selectionReason?.trim())throw Error('缺少可追溯的方向选择');
  return raw;
}

function directionSignature({design}){
  const norm=text=>text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
  // Follow the actual user path. JSON array order and internal action/state IDs do not affect the experience.
  const states=new Map(design.states.map(s=>[s.id,s]));
  const visited=new Map(),steps=[];
  let state=states.get('initial');
  while(state&&!visited.has(state.id)){
    visited.set(state.id,steps.length);
    steps.push([state.priority.map(norm),state.primaryAction.operation]);
    state=states.get(state.primaryAction.nextState);
  }
  const t=design.system.tokens;
  const length=value=>{
    const match=/^(\d+(?:\.\d+)?)(px|rem)?$/.exec(norm(value));
    return match?Number(match[1])*(match[2]==='rem'?16:1):value;
  };
  const family=norm(t['type.family.body']).split(',').map(f=>f.trim());
  return JSON.stringify({
    readingOrder:['desktop','mobile'].map(k=>design.layouts[k].order.map(norm)),
    steps,cycleTo:state?visited.get(state.id):null,
    type:[family,length(t['type.size.body']),length(t['type.size.heading']),Number(t['type.weight.body']),Number(t['type.lineHeight.body'])],
    spacing:length(t['space.component.md'])
  });
}

// Require a non-color difference that can be read from the proposed engineering decisions.
export function validateDirectionDifferences(options){
  for(let i=0;i<options.length;i++)for(const b of options.slice(i+1)){
    const a=options[i];
    if(directionSignature(a)===directionSignature(b)||a.design.art.language.visualDifference===b.design.art.language.visualDifference||
      a.design.art.language.architectureDifference===b.design.art.language.architectureDifference)throw Error('候选需体现可核对的非配色差异，并分别解释视觉表达及信息架构差异');
  }
}
