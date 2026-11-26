import {randomUUID} from 'node:crypto';
import {contractVersion,stateActionVersion,designContractSchema,designContractSchema11,checkShape,tokenNames} from './contract-schema.mjs';
import {selectedLanguage} from './design-language.mjs';
import {validateStateActions,stateActionInstruction} from './experience-patterns.mjs';
import {validateJourney} from './journey.mjs';

const unique=items=>[...new Set(items)];
const hostRequirements=[
  '离线 HTML/CSS/JS，使用系统字体和本地资源。','主操作改变真实业务状态并给出可见反馈。',
  '保留键盘操作和可见焦点，目标视口避免横向溢出，正文与底色对比度至少 4.5。'
];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const hex=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const normalizeColor=s=>s.length===4?'#'+[...s.slice(1)].map(v=>v+v).join('').toLowerCase():s.toLowerCase();
function brightness(s){
  const v=normalizeColor(s).slice(1).match(/../g).map(x=>parseInt(x,16)/255)
    .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722;
}
const equivalent=(key,a,b)=>key.startsWith('color.')&&hex.test(a)&&hex.test(b)?normalizeColor(a)===normalizeColor(b):a===b;
const optionalWording=/例如|比如|可选|建议|可以考虑|for example|optional|could use/i;
const noPositiveLock=/不要|不得|禁止|避免|不应|无需|不必|不使用|不用|do not|don't|avoid/i;
function hasAffirmativeQuote(context,quote,reject){
  if(!quote.trim()||reject(quote))return false;
  let start=0;
  while((start=context.indexOf(quote,start))!==-1){
    const prefix=context.slice(0,start).split(/[，,。；;\n]/).at(-1);
    if(!reject(prefix))return true;
    start+=quote.length;
  }
  return false;
}
function size(s){
  const m=/^(\d+(?:\.\d+)?)(px|rem)$/.exec(s);
  return m?Number(m[1])*(m[2]==='rem'?16:1):NaN;
}
export function guardBrandConflict(brief){
  const clauses=brief.split(/[，,。；;\n]|但是|但|同时/).map(v=>v.trim());
  const preserve=clauses.find(v=>/(?:保持|保留|维持|沿用).{0,12}品牌.{0,10}(?:不变|不动|原样)|(?:不能|不得|不要)改[变动].{0,8}品牌视觉/.test(v)&&!/(?:无需|不用|不必|不需要|不要)(?:再)?(?:保[持留]|维持|沿用)/.test(v));
  const replace=clauses.find(v=>!/(?:不要|不得|不必|不应|避免|无需|不能)/.test(v)&&/(?:整体|全部|彻底|完全).{0,6}(?:换成|替换|改换|改成|更换|重做|重构).{0,12}(?:视觉体系|视觉系统|品牌视觉)/.test(v));
  if(preserve&&replace)throw Error('品牌硬约束冲突，请明确保留范围：'+preserve+' / '+replace);
}
// Literal brand/token declarations are also locked if the scene extractor omits them.
function literalLocks(brief){
  const out=[];
  for(const match of brief.matchAll(/(?:品牌(?:主)?色|主品牌色|操作主色|页面底色|正文色)\s*(?:必须|固定|保持|指定|使用|采用|沿用|设为|为|是|用|=|：|:|\s)*\s*(#[\da-f]{6}|#[\da-f]{3})(?![\da-f])/gi)){
    if(!hasAffirmativeQuote(brief,match[0],s=>optionalWording.test(s)||noPositiveLock.test(s)))continue;
    const token=match[0].startsWith('操作')?'color.action.primary':match[0].startsWith('页面')?'color.surface.base':
      match[0].startsWith('正文')?'color.text.primary':'color.brand.primary';
    out.push({token,value:match[1],quote:match[0]});
  }
  return out;
}
const tokenRoles={
  'color.brand.primary':/品牌.{0,4}色|brand colou?r/i,'color.action.primary':/操作|操作色|按钮|行动色|action colou?r/i,
  'color.surface.base':/底色|背景色|背景颜色|background/i,'color.text.primary':/正文.{0,3}色|文字.{0,3}色|text colou?r/i,
  'type.family.body':/字体|字族|font family/i,'type.size.body':/正文.{0,5}字号|body size/i,'type.size.heading':/标题.{0,5}字号|heading size/i,
  'type.weight.body':/字重|font.weight/i,'type.lineHeight.body':/行高|line.height/i,'space.component.md':/间距|留白|spacing/i,
  'radius.control':/圆角|radius/i,'border.control':/边框|border/i,'shadow.surface':/阴影|shadow/i,'motion.feedback':/动效|时长|duration/i
};
function sourcedLock(lock,context){
  const role=tokenRoles[lock.token];
  return role&&lock.value.trim()&&lock.quote.includes(lock.value)&&(lock.quote.includes(lock.token)||role.test(lock.quote))&&
    hasAffirmativeQuote(context,lock.quote,s=>optionalWording.test(s)||noPositiveLock.test(s));
}
export function requirementsFor(brief,analysis,parent=null){
  const prior=parent?.requirements;
  const context=[brief,...(prior?.explicit??[])].join('\n');
  guardBrandConflict(context);
  for(const conflict of analysis.conflicts??[]){
    ensure(conflict.first!==conflict.second&&[conflict.first,conflict.second].every(q=>q.trim()&&context.includes(q)),'冲突必须引用两项真实要求');
    throw Error('用户约束冲突，需确认：'+conflict.first+' / '+conflict.second+' — '+conflict.reason);
  }
  const directives=brief.split(/[，,。；;\n]/).map(s=>s.trim()).filter(s=>/必须|不得|禁止|不要|保持|保留|务必/.test(s));
  const quotes=[...directives,...(analysis.hardRequirements??[]),
    ...Object.values(analysis.dimensions).flat().filter(v=>v.certainty==='explicit').map(v=>v.evidence)];
  ensure(quotes.every(q=>q.trim()&&context.includes(q)),'硬约束缺少用户逐字依据');
  const explicit=unique([...(prior?.explicit??[]),...quotes.filter(q=>hasAffirmativeQuote(context,q,s=>optionalWording.test(s)))]);
  const locks=[];
  for(const lock of [...(prior?.tokenLocks??[]),...literalLocks(brief),...(analysis.tokenLocks??[])]){
    ensure(tokenNames.includes(lock.token)&&sourcedLock(lock,context),'硬 Token 缺少用户对该语义角色和实际取值的要求');
    const old=locks.find(x=>x.token===lock.token);
    ensure(!old||equivalent(lock.token,old.value,lock.value),'硬 Token 冲突，需确认 '+lock.token);
    if(!old)locks.push(lock);
    if(!explicit.includes(lock.quote))explicit.push(lock.quote);
  }
  return {brief,explicit,tokenLocks:locks,host:hostRequirements,uncertainties:analysis.uncertainties,assumptions:analysis.assumptionsToVerify};
}
export function sceneTasks(analysis,brief){
  const tasks=analysis.dimensions.task;
  return tasks.length?tasks.map(t=>t.evidence):[brief];
}
function facts(entries,fallback,brief){
  return entries.length?entries.map(e=>({value:e.value,evidence:e.evidence,source:e.certainty==='explicit'?'user':'scene-inference'})):
    [{value:fallback,evidence:brief,source:'director-inference'}];
}
function decisionSources(directionId,locks,rules,cases,preferences){
  return [
    {path:'/experiencePlan/tasks',source:'scene',reference:'scene/dimensions/task (empty uses labelled director-inference)'},
    ...['/experiencePlan/states','/experiencePlan/layouts','/artDirection','/designSystem','/evaluationPlan/checks']
      .map(path=>({path,source:'art-director',reference:directionId})),
    ...locks.map((v,i)=>({path:'/designSystem/tokens/'+v.token,source:'user',reference:'/requirements/tokenLocks/'+i})),
    ...rules.map((v,i)=>({path:'/artDirection/rules/'+i,source:'knowledge-rule',reference:v.id})),
    ...cases.map((v,i)=>({path:'/artDirection/caseDecisions/'+i,source:'visual-case',reference:v.id})),
    ...preferences.map((v,i)=>({path:'/artDirection/preferences/'+i,source:v.source,reference:v.id}))
  ];
}
export function assembleContract({runId,brief,analysis,requirements,knowledge,option,selection,steps,viewports,parentId=null,schemaVersion=contractVersion,seedMatches=[]}){
  const d=option.design;
  const rules=option.ruleIds.map(id=>{
    const row=[...knowledge.rules,...knowledge.reviewedCards].find(r=>r.id===id);
    return {id,instruction:row.decision??row.note};
  });
  const preferences=(option.preferenceIds??[]).map(id=>{
    const human=knowledge.confirmedPreferences?.find(r=>r.id===id);
    const seed=knowledge.preferences?.find(r=>r.id===id);
    return {id,source:human?'confirmed-preference':'bundled-guidance',instruction:human?.reason??seed.directive};
  });
  const {states,entities,layouts,transitions}=d;
  const checks=[];
  for(const cp of d.evaluation.checkpoints){
    const state=states.find(s=>s.id===cp.state);
    ensure(state,'评价引用了未知状态 '+cp.state);
    for(const vp of viewports)checks.push({state:cp.state,viewport:vp.device,visible:cp.visible,controls:state.controls,
      primaryEntity:state.priority[0],firstViewport:cp.firstViewport[vp.device]??cp.visible,success:cp.success});
  }
  const journey=steps.map(step=>({operation:'click',value:'',requireChange:false,opener:null,...step}));
  const contract={schemaVersion,id:randomUUID(),runId,directionId:option.id,requirements,
    experiencePlan:{audience:facts(analysis.dimensions.audience,d.audience,brief),productGoals:facts(analysis.dimensions.product,d.pageGoal,brief),
      pageGoal:d.pageGoal,tasks:facts(analysis.dimensions.task,d.pageGoal,brief),entities,informationArchitecture:option.informationArchitecture,
      states,transitions,layouts,preservedFunctions:unique(analysis.dimensions.task.filter(t=>t.certainty==='explicit'&&requirements.explicit.includes(t.evidence)).map(t=>t.evidence))},
    artDirection:{concept:option.name,rationale:option.fit,selection:option.id===selection.selectedId?selection.selectionReason:option.advantages+' / '+option.costs,
      composition:option.structure,focalPoint:option.focalPoint,typography:option.typography,interactionPath:option.interactionPath,motionDirection:d.system.motion,
      ...d.art,...(schemaVersion===stateActionVersion?{principles:selectedLanguage(d.art.language,seedMatches)}:{}),rules,preferences,evidenceGaps:selection.evidenceGaps},
    designSystem:{...d.system,creativeFreedom:d.creativeFreedom},
    evaluationPlan:{viewports,checks,journey,brandConsistency:d.evaluation.brandConsistency,accessibility:d.evaluation.accessibility,
      responsive:d.evaluation.responsive,antiPatterns:d.art.antiPatterns,humanQuestions:d.evaluation.humanQuestions},
    provenance:{sceneStage:'scene',directorStage:'art-direction',adoptedKnowledgeIds:[...option.ruleIds,...option.visualCaseIds,...(option.preferenceIds??[])],parentContractId:parentId,
      decisionSources:decisionSources(option.id,requirements.tokenLocks,rules,d.art.caseDecisions,preferences)}};
  validateContract(contract);
  const availableCases=[...knowledge.exemplars,...knowledge.reviewedCards.filter(c=>c.kind==='VisualExemplar'),...(knowledge.analogies??[])].map(c=>c.id);
  ensure(same([...availableCases].sort(),d.art.caseDecisions.map(c=>c.id).sort()),'每张入围案例需要一条采用或排除说明');
  ensure(same([...option.visualCaseIds].sort(),d.art.caseDecisions.filter(c=>c.adopt).map(c=>c.id).sort()),'案例决策与方案引用不一致');
  return contract;
}

export function validateContract(c){
  checkShape(c?.schemaVersion===stateActionVersion?designContractSchema11:designContractSchema,c);
  const {experiencePlan:x,artDirection:a,designSystem:s,evaluationPlan:e,requirements:r}=c;
  const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  ensure(uuid.test(c.id)&&uuid.test(c.runId)&&(c.provenance.parentContractId===null||uuid.test(c.provenance.parentContractId)),'契约身份无效');
  const sources=decisionSources(c.directionId,r.tokenLocks,a.rules,a.caseDecisions,a.preferences);
  ensure(sources.length===c.provenance.decisionSources.length&&sources.every(expected=>c.provenance.decisionSources.some(v=>
    v.path===expected.path&&v.source===expected.source&&v.reference===expected.reference)),'决策来源与实际依据不一致');
  const tokens=s.tokens;
  for(const name of tokenNames.filter(k=>k.startsWith('color.')))ensure(hex.test(tokens[name]),name+' 需要可校验的十六进制颜色');
  const base=brightness(tokens['color.surface.base']),ink=brightness(tokens['color.text.primary']);
  ensure((Math.max(ink,base)+0.05)/(Math.min(ink,base)+0.05)>=4.5,'正文与底色对比度低于 4.5');
  ensure(a.surfaceTone==='dark'?base<0.35:base>=0.35,'艺术方向的明暗与底色 Token 矛盾');
  const body=size(tokens['type.size.body']),heading=size(tokens['type.size.heading']);
  ensure(body>0&&heading>0&&a.headingScale===(heading>body?'larger':heading<body?'smaller':'equal'),'标题字阶与字号 Token 矛盾，字号用 px 或 rem');
  const lineHeight=Number(tokens['type.lineHeight.body']);
  ensure(/^[1-9]\d{0,2}$|^1000$/.test(tokens['type.weight.body'])&&Number.isFinite(lineHeight)&&lineHeight>0,'字重或无单位行高无效');
  ensure(a.motionDirection===s.motion,'动效策略与工程规范不一致');
  for(const key of ['space.component.md','radius.control'])ensure(tokens[key]==='0'||size(tokens[key])>=0,key+' 需要非负 px 或 rem');
  if(!c.provenance.parentContractId)ensure(r.explicit.every(q=>r.brief.includes(q)),'明确要求缺少原始需求依据');
  for(const lock of r.tokenLocks)ensure(r.explicit.includes(lock.quote)&&sourcedLock(lock,r.brief.includes(lock.quote)?r.brief:lock.quote)&&
    equivalent(lock.token,tokens[lock.token],lock.value),'用户硬约束与 Token 不一致 '+lock.token);
  for(const t of [...x.tasks,...x.audience,...x.productGoals])ensure(t.value.trim()&&r.brief.includes(t.evidence),'场景结论没有请求依据');
  ensure(x.tasks.length&&x.audience.length&&x.productGoals.length,'体验规划缺少角色、目标或任务');
  ensure(x.preservedFunctions.every(q=>r.explicit.includes(q)),'保留功能缺少明确需求出处');
  ensure(x.entities.length>=2&&unique(x.entities).length===x.entities.length,'业务实体需要至少两项且不可重复');
  const validOrder=order=>order.length&&unique(order).length===order.length&&order.every(id=>x.entities.includes(id));
  const stateIds=x.states.map(state=>state.id);
  ensure(stateIds.length>=2&&stateIds.includes('initial')&&unique(stateIds).length===stateIds.length,'至少需要 initial 和一个可区分的后续状态');
  for(const state of x.states){
    ensure(validOrder(state.priority)&&state.controls.length,'状态优先级必须引用实体并列出实际操作 '+state.id);
    ensure(x.tasks.some(t=>t.evidence===state.taskEvidence),'状态没有连接实际任务依据 '+state.id);
  }
  ensure(unique(x.states.map(v=>v.priority[0])).length>1,'初始与后续状态必须表达重心变化');
  const reachable=new Set(['initial']);
  for(const edge of x.transitions)ensure(stateIds.includes(edge.from)&&stateIds.includes(edge.to),'状态转换引用未知端点');
  for(let i=0;i<stateIds.length;i++)for(const edge of x.transitions)if(reachable.has(edge.from))reachable.add(edge.to);
  ensure(reachable.size===stateIds.length,'存在从初始状态无法到达的业务状态');
  for(const l of Object.values(x.layouts))ensure(validOrder(l.order),'设备阅读顺序引用了未知或重复实体');
  ensure(x.layouts.desktop.structure.trim()!==x.layouts.mobile.structure.trim(),'需要分别说明桌面和手机的布局行为');
  const devices=e.viewports.map(v=>v.device);
  ensure(devices.includes('mobile')&&devices.includes('desktop')&&devices.length===unique(devices).length&&
    e.viewports.every(v=>v.width>0&&v.height>0),'目标视口缺失或重复');
  ensure(e.checks.length===stateIds.length*devices.length,'每个状态和视口需要一条验收条件');
  for(const state of x.states)for(const device of devices){
    const check=e.checks.find(v=>v.state===state.id&&v.viewport===device);
    ensure(check&&check.visible.length&&check.firstViewport.length&&check.primaryEntity===state.priority[0]&&same(check.controls,state.controls),
      '评价条件与状态重心或控件不一致 '+state.id+'/'+device);
  }
  ensure(e.humanQuestions.length&&a.antiPatterns.length&&same(e.antiPatterns,a.antiPatterns),'缺少人工判断问题或反模式边界');
  ensure(a.caseDecisions.every(v=>v.mechanism!==v.boundary),'视觉案例的迁移机制与边界不能相同');
  const adopted=[...a.rules.map(v=>v.id),...a.caseDecisions.filter(v=>v.adopt).map(v=>v.id),...a.preferences.map(v=>v.id)];
  ensure(unique(adopted).length===adopted.length&&same([...adopted].sort(),[...c.provenance.adoptedKnowledgeIds].sort()),'采用知识的来源不一致');
  if(c.schemaVersion===stateActionVersion){
    validateStateActions(x,r.brief);
    const used=a.language.choices.filter(v=>v.principleIds.length);
    const keys=a.language.choices.flatMap(v=>v.principleIds.map(id=>v.seedId+'/'+id));
    ensure(unique(keys).length===keys.length&&same(keys,a.principles.map(p=>p.seedId+'/'+p.principleId))&&
      a.principles.every(p=>p.sourceIds.length)&&a.language.mode===(used.length===0?'original':used.length===1?'adopt':'combine'),'设计语言与采用原则不符');
    ensure(tokenNames.some(name=>a.language.tokenRationale.includes(name)),'语言到 Token 的解释须引用本方向的语义 Token 名');
  }
  validateJourney(e.journey);
  return c;
}

// Render only implementation instructions. The private contract also retains the full evidence and audit metadata.
export function contractInstruction(c){
  const x=c.experiencePlan,a=c.artDirection,s=c.designSystem,e=c.evaluationPlan,r=c.requirements;
  const rows=(heading,lines)=>[heading,...lines.map(line=>'• '+line)].join('\n');
  return [
    '设计决策契约 '+c.schemaVersion+' / '+c.id+' / 方向 '+a.concept,
    rows('产品目标与业务任务',[x.pageGoal,'产品：'+x.productGoals.map(v=>v.value).join('、'),'使用者：'+x.audience.map(v=>v.value).join('、'),
      ...x.tasks.map(t=>t.value),'信息架构：'+x.informationArchitecture,'保留功能：'+x.preservedFunctions.join('、')]),
    rows('状态、结构和操作',[...x.states.map(v=>v.id+' '+v.purpose+'；阅读顺序 '+v.priority.join(' → ')+'；控件 '+v.controls.join('、')),
      ...x.transitions.map(t=>t.from+' → '+t.to+'：'+t.action),
      ...Object.entries(x.layouts).map(([device,l])=>device+' '+l.structure+'；'+l.order.join(' → '))]),
    ...(c.schemaVersion===stateActionVersion?[stateActionInstruction(x),
      rows('所选设计语言与工程落实',[a.language.tokenRationale,
        ...a.language.choices.filter(v=>v.principleIds.length).map(v=>v.seedId+'：'+v.reason+'；边界 '+v.boundary),
        ...a.principles.map(p=>p.seedId+'/'+p.principleId+' '+p.guidance+' ['+p.sourceIds.join(', ')+']'),
        '在每个可见状态区域内，用 data-primary-information="状态id" 标记体现首要信息的真实元素；可操作控件放在相应状态区域内。',
        '为14个语义 Token 在 :root 定义 CSS 变量，变量名为 -- 加语义名并把点号换成连字符。使用变量设置真实组件样式。每个用户锁定值还须在体现它的可见元素上标记 data-design-token（空格分隔完整语义名）。'])]:[]),
    rows('艺术指导与设计依据',[a.rationale,a.selection,a.brandTone,a.composition,a.focalPoint,a.typography,a.colorIntent,a.density,
      a.componentLanguage,a.interactionPath,...a.rules.map(v=>'['+v.id+'] '+v.instruction),
      ...a.caseDecisions.map(v=>(v.adopt?'借鉴 ':'排除 ')+'['+v.id+'] '+v.mechanism+'；边界 '+v.boundary),
      ...a.preferences.map(v=>'['+v.id+'] '+v.source+' '+v.instruction),...a.evidenceGaps.map(v=>'资料缺口 '+v)]),
    rows('语义 Token 与组件规范；锁定值必须遵守，其他值为方向建议',[
      ...Object.entries(s.tokens).map(([k,v])=>k+' = '+v+(r.tokenLocks.some(lock=>lock.token===k)?' [用户锁定]':'')),
      s.iconLanguage,s.componentStates,s.motion,s.responsiveRule]),
    rows('硬约束、假设与可自主设计范围',[...r.explicit.map(v=>'用户原话 '+v),...r.host.map(v=>'宿主约束 '+v),
      ...r.uncertainties.map(v=>'未知 '+v),...r.assumptions.map(v=>'待验证 '+v),'可自主决定 '+s.creativeFreedom]),
    rows('验收计划',[...e.viewports.map(v=>v.device+' '+v.width+'×'+v.height),...e.checks.map(v=>
      v.viewport+'/'+v.state+' 优先 '+v.primaryEntity+'；首屏 '+v.firstViewport.join('、')+'；必须可见 '+v.visible.join('、')+'；验证 '+v.success),
      e.brandConsistency,e.accessibility,e.responsive,...e.antiPatterns.map(v=>'避免 '+v),...e.humanQuestions.map(v=>'留待人评 '+v)])
  ].join('\n\n');
}
