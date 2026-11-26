// Key states are obligations of these complete business briefs. Other products define their own state IDs.
const timingWorkflow={
  initial:'可查看或维护用于民俗参考的基础资料，允许沿用现有资料。',
  criteria:'选择事项和日期范围。',
  querying:'执行真实查询，显示本次事项和时间条件；自动完成时用 wait。',
  results:'候选时段取代输入条件成为首要实体；给出具体日期、时间和理由入口。',
  reason:'展开与所选时段对应的民俗依据和使用边界。',
  saved:'保存所选时段并可在保存项里辨认它。',
  comparison:'比较实际候选时段或保存项的时间和理由。'
};
const recruitingWorkflow={
  initial:'在岗位上下文中查看候选名单，有搜索或选择候选人的实际入口。',
  selected:'明确当前候选身份、岗位和主要证据缺口。',
  evidence:'展开该候选人与要求相对应的匹配证据和出处。',
  review:'人工选择待补证等复核结论；保留身份、证据和经办状态。',
  saved:'呈现实际保存后的复核结论与名单反馈。'
};

// Use related task signals together. Later explicit changes to an operation take precedence.
function requested(brief,terms){
  let active=false;
  for(const clause of brief.split(/[，,。；;、\n]|但是|但/)){
    for(const match of clause.matchAll(new RegExp(terms.source,'gu'))){
      const before=clause.slice(0,match.index);
      const after=clause.slice(match.index+match[0].length);
      active=!/(?:不需要|不要|不得|不做|不用|无需|取消|移除|去掉|不支持|禁止|暂不|不必).{0,8}$/.test(before)&&
        !/^(?:功能)?(?:不需要|不用|暂缓|取消|去掉)/.test(after);
    }
  }
  return active;
}
function workflowFor(brief){
  if(/择时|选时|选日/.test(brief)&&/资料|生辰|八字/.test(brief)&&/事项|事由|事务类型/.test(brief)&&
    /日期|时间范围|起止时间/.test(brief)&&/时段|时间段|备选时间/.test(brief)&&/理由|依据|说明/.test(brief)){
    const workflow={...timingWorkflow};
    if(!requested(brief,/保存|收藏|留存/))delete workflow.saved;
    if(!requested(brief,/比较|对比|比对/))delete workflow.comparison;
    return workflow;
  }
  if(/招聘|招募|人才顾问/.test(brief)&&/候选人|人选|应聘者/.test(brief)&&/证据|依据|佐证/.test(brief)&&
    requested(brief,/复核|人工审阅|人工核实|人工审核/)){
    const workflow={...recruitingWorkflow};
    if(!requested(brief,/保留|保存|留存|存储|提交结论|记录结论|记录状态/))delete workflow.saved;
    return workflow;
  }
  return null;
}

export function experiencePlanningInstruction(brief){
  const workflow=workflowFor(brief);
  return [
    '先规划体验，再决定视觉。沿用 states、transitions 与 checkpoints，给每个关键状态具体任务，priority[0] 是该状态首要业务实体。',
    '每个状态有独立 id（小写英文及短横线）、purpose、controls。controls[0] 是当前真实主操作的精确可访问名称，其余是次要操作。primaryAction.id 同样是唯一的小写短键，与显示名分开。',
    'primaryAction.operation 选 click、fill、select 或等候真实处理完成的 wait。fill/select 的 value 给具体可用输入；click/wait 的 value 为 null。wait 的 controls[0] 写可见进度状态名称，不加测试按钮。',
    'primaryAction.nextState 关联本方向下一状态。transitions 必须有同样的 from/to，action 逐字等于当前 controls[0]。primaryAction.expectedText 写执行后可在目标状态看到的简短、真实字面文本。',
    'prerequisites 逐项写操作所需的真实业务事实。presentation.desktop、presentation.mobile 分别说明这个状态如何安排和显露首要信息、当前操作。每个状态的主操作连成从 initial 可复查的业务路径，覆盖所有这些关键状态后可回到已访问状态。其它分支用次要控件和 transitions 表达。',
    '状态可以是页面内的展开、选中、提交或反馈，不必制作向导或额外页面。让共享 journey 里的现有真实任务也能从干净的页面按顺序执行。',
    ...(workflow?['以下任务的所有状态必须可检查，ID 为验收锚点，各方向自行设计页面和动作。'+JSON.stringify(workflow)]:[])
  ].join('\n');
}

const safeId=/^[a-z][a-z0-9-]{0,47}$/;
export function validateStateActions(experience,brief){
  const {states,transitions}=experience;
  const byId=new Map(states.map(s=>[s.id,s]));
  const actionIds=new Set();
  for(const state of states){
    const action=state.primaryAction;
    if(!safeId.test(state.id)||!safeId.test(action.id)||actionIds.has(action.id))throw Error('状态和主操作需要唯一且可定位的短键 '+state.id);
    actionIds.add(action.id);
    const takesValue=['fill','select'].includes(action.operation);
    if(takesValue?typeof action.value!=='string'||!action.value.trim()||action.value.length>160:action.value!==null)
      throw Error('主操作输入值与操作类型不一致 '+state.id);
    if(!state.controls.length||state.controls.some(label=>!label.trim())||new Set(state.controls).size!==state.controls.length)
      throw Error('主次操作需要清楚且不同的可访问名称 '+state.id);
    if(!byId.has(action.nextState)||!transitions.some(edge=>
      edge.from===state.id&&edge.to===action.nextState&&edge.action===state.controls[0]))
      throw Error('主操作必须绑定已声明的目标状态，transitions.action 与 controls[0] 需逐字相同 '+state.id);
    if(action.expectedText.length>180)throw Error('验收文本需要简短、可定位 '+state.id);
  }
  const visited=new Set();
  let id='initial';
  while(byId.has(id)&&!visited.has(id)){
    visited.add(id);
    id=byId.get(id).primaryAction.nextState;
  }
  const untested=states.filter(s=>!visited.has(s.id));
  if(untested.length)throw Error('以下关键状态不在从 initial 开始的主操作验收路径中 '+untested.map(s=>s.id).join('、'));
  const workflow=workflowFor(brief);
  if(workflow){
    const missing=Object.keys(workflow).filter(key=>!byId.has(key));
    if(missing.length)throw Error('当前业务流程缺少关键状态 '+missing.join('、'));
    if(workflow.results&&byId.get('criteria').priority[0]===byId.get('results').priority[0])
      throw Error('查询结果状态必须从条件输入切换到候选时段');
  }
}

export function stateActionInstruction(experience){
  return ['真实状态与下一步操作',
    '在每个状态当前可见的真实业务内容容器使用 data-experience-state="状态id"。状态发生变化时更新标记。标记与可见业务内容同步；同一状态应只有一个可见容器。',
    '在当前状态容器内真正可操作的控件使用 data-experience-action="动作id"，以合同中的主操作名称设置可访问名称。操作后让目标状态区域显示约定结果。共享旅程可以在同一个控件上加 data-task。wait 使用真实进度文本并自动完成，无需点击。',
    ...experience.states.map(state=>{
      const a=state.primaryAction;
      const value=a.value===null?'':'，输入 '+a.value;
      return state.id+' '+state.purpose+'；主信息 '+state.priority[0]+'；主操作 '+state.controls[0]+' ['+a.id+', '+a.operation+value+'] → '+
        a.nextState+'；目标区域出现「'+a.expectedText+'」；次要操作 '+(state.controls.slice(1).join('、')||'无')+'；所需条件 '+
        (state.prerequisites.join('、')||'可直接执行')+'；桌面 '+state.presentation.desktop+'；手机 '+state.presentation.mobile;
    })
  ].join('\n');
}
