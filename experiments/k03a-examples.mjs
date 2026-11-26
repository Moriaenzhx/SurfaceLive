// Offline worked examples. The new decisions below are authored fixtures, never Agent receipts.
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {dimensions} from '../live-engine/design/scene.mjs';
import {tokenNames} from '../live-engine/design/contract-schema.mjs';
import {assembleContract,requirementsFor} from '../live-engine/design/contract.mjs';
import {cases} from './k01-cases.mjs';

const data={
  zhishi:{
    goal:'依事项找出可安排的时段，知道参考依据，并能回读已保存的选择。',audience:'为自己安排事项的人',
    entities:['事项与日期条件','候选时段','民俗理由','已保存的时段'],
    states:[
      ['initial','准备查询',0,'查看候选时段','事项与起止日期','查看候选时段按钮',1],
      ['submitted','已提交的条件可辨认',0,'编辑条件','出行、起止日期摘要','已提交的日期范围',1],
      ['results','按日期比较时段',1,'查看理由','日期组及首条完整时间范围','首条时段与理由入口',2],
      ['reason','核对解释边界',2,'保存时段','所选时段及参考说明','解释与同一时段标题',2],
      ['saved','从保存项认回原选择',3,'查看已保存','已保存状态、原查询条件','保存反馈与时段',3]],
    desktop:'条件摘要靠近日期清单，时段和行内理由在同一阅读列。',
    mobile:'初始可展示标题，提交后收起条件为可编辑摘要。用日期分组替代完整表单，首个时段与理由入口同屏。',
    tone:'民俗日用手记，平实、可读',color:'暗紫指示当前动作，暖纸底留给时间与解释。',density:'同日行紧凑，跨日留出可见的段落间距。',
    component:'日期分隔线、等宽时段及原行展开的理由。',anti:'结果上方重复占据半屏的品牌插图',
    icon:'编辑与保存用文字配小型线描图标',componentStates:'保存前、已保存、焦点可见。已保存同时写出文字。',
    motion:'只展开当前理由。减少动态偏好下直接显示。',brand:'切换后保留时间字形和同一组识别色。',
    human:'这种中文行距是否支持跨日期扫读，同时传达民俗参考的边界？',
    tokens:['#493659','#fcfaf5','#281f2a','#503855','system-ui','16px','24px','400','1.625','12px','0','1px solid #c4b9bb','none','120ms']
  },
  recruiting:{
    goal:'根据岗位要求逐条核实候选证据，保留缺口与人工结论。',audience:'需连续处理多位候选人的招聘顾问',
    entities:['候选人与岗位要求','证据缺口','简历原文','复核结论'],
    states:[['initial','找到待复核人选',0,'按姓名搜索','岗位与当前候选名单','搜索字段与姓名',1],
      ['evidence','确认所选人缺少哪项依据',1,'查看原文','姓名、独立带队待核实','所选人及其主要缺口',1],
      ['source','核对原文及出处',2,'标为需补证','所选人、页码与引用原文','姓名与已展开的证据',1],
      ['reviewed','确认人工状态',3,'返回名单','结论与更新后的名单状态','需补证反馈与返回入口',4]],
    desktop:'候选列表与证据栏并排，主要缺口、出处、人工复核动作可并行查看。',
    mobile:'名单保留姓名和状态。点击人选进入逐条证据阅读，顶端保留人名与返回名单，原文靠近对应要求。',
    tone:'核对案卷的克制、明确',color:'墨蓝用于选中与操作，缺证同时用文字和边框标出。',density:'压缩可比较的名单行，为原文与出处提供行距。',
    component:'固定当前人选标识、要求证据对照、独立的复核操作区。',anti:'手机端缩小所有桌面列，或把匹配分当作复核结论',
    icon:'来源展开与返回以文字配方向线',componentStates:'待核实、已匹配、需补证都有文字；所选与键盘焦点标记区分。',
    motion:'切换对象时原位刷新证据栏，减少动态时关闭过渡。',brand:'同一缺口状态在列表与证据页采用同一名称和标记。',
    human:'顾问能否辨认待核实的证据，且不会把评分看成录用决定？',
    tokens:['#264c64','#f9fbfd','#19232d','#164c70','system-ui','13px','18px','400','1.55','8px','3px','1px solid #b3bdc5','none','80ms']
  },
  ambiguous:{
    goal:'让访客理解产品能帮助完成什么，查看一个清楚标注的示例。',audience:'正在判断是否值得继续了解的访客（待确认）',
    entities:['产品用途','能力示例','下一步联系'],
    states:[['initial','理解用途',0,'查看示例','产品用途与示例入口','产品用途与查看示例',0],
      ['example','查看一次示意工作流',1,'了解接入条件','示例输入、处理和结果','示例结果及用途',0],
      ['contact','了解下一步',2,'返回示例','接入条件及联系途径','下一步入口',0]],
    desktop:'说明与示意工作流并排，保留一条阅读主线。',mobile:'用途、示例、下一步顺序阅读，示例可折叠。',
    tone:'简练的产品说明书，待品牌确认',color:'纸白底配墨色文字，暗砖红用作暂定强调色。',density:'一屏只展开一个能力示例。',
    component:'章节标题、输入与输出对照、清晰的下一步链接。',anti:'虚构客户标识、收入图表和未经证实的量化承诺',
    icon:'只为外部链接和展开动作使用线描箭头',componentStates:'展开、已读和焦点均有文字或边框反馈。',
    motion:'章节切换使用短暂淡入，减少动态时立即切换。',brand:'在品牌明确前保持同一文字层级与产品称谓。',
    human:'这种编辑式呈现是否符合尚待确认的品牌和购买者预期？',
    tokens:['#873e30','#fffaf4','#30251f','#80382d','Georgia, serif','17px','32px','400','1.6','16px','2px','1px solid #bba899','none','140ms']
  }
};
const read=async path=>JSON.parse(await readFile(path));
async function make(id){
  const d=data[id],runId=randomUUID(),viewports=[{device:'desktop',width:1440,height:900},{device:'mobile',width:390,height:844}];
  let brief,analysis,knowledge,option,selection,steps,prior=null;
  if(id==='ambiguous'){
    brief='做一个高级的 SaaS 产品官网。';
    const axes=Object.fromEntries(Object.keys(dimensions).map(key=>[key,[]]));
    axes.product=[{value:'SaaS 产品官网',evidence:'SaaS 产品官网',certainty:'explicit'}];
    analysis={dimensions:axes,uncertainties:['核心能力、购买者、品牌规范和转化目标均未知。'],assumptionsToVerify:['暂以了解能力示例为第一步，待确认。']};
    knowledge={rules:[],reviewedCards:[],preferences:[],exemplars:[]};
    option={id:'example-walkthrough',name:'以一个示例解释产品',structure:'从用户问题进入对照示例。',
      informationArchitecture:'用途、能力示意、接入条件。',focalPoint:'当前阅读章节中的示例输入与输出。',
      typography:'大标题建立阅读入口，小字注明示意内容。',interactionPath:'读用途，打开示例，再了解接入条件。',
      fit:'能力和品牌尚待确认，先用一个带边界的示例解释价值。',ruleIds:[],preferenceIds:[],visualCaseIds:[]};
    steps=[{id:'open-example',operation:'click',value:'',action:'查看示例',state:'example-result',contains:'示例结果',result:'展示示例输入与输出',requireChange:true,opener:null}];
    selection={selectedId:option.id,selectionReason:option.fit,evidenceGaps:['此离线示例未执行检索。']};
  }else{
    const file=join('runs/K-01',id,'A-current/attempt/design-trace.json');
    const bytes=await readFile(file),t=JSON.parse(bytes);
    prior={file,sha256:createHash('sha256').update(bytes).digest('hex'),runId:t.attemptId};
    brief=cases[id].text;analysis=t.scene.analysis;knowledge=t.knowledge;selection=t.artDirection;steps=selection.journey;
    option=selection.options.find(o=>o.id===selection.selectedId);
    const seeds=await read('live-engine/knowledge/data/preferences.json');
    for(const p of knowledge.preferences)p.directive=seeds.find(s=>s.id===p.id).directive;
  }
  const taskQuotes=analysis.dimensions.task.map(t=>t.evidence);
  const states=d.states.map(([key,purpose,i,control,,,task])=>({id:key,purpose,priority:[d.entities[i],...d.entities.filter(e=>e!==d.entities[i])],
    controls:[control],taskEvidence:taskQuotes[task]??brief}));
  const visuals=[...knowledge.exemplars,...knowledge.reviewedCards.filter(c=>c.kind==='VisualExemplar'),...(knowledge.analogies??[])];
  const caseDecisions=visuals.map(c=>({id:c.id,adopt:option.visualCaseIds.includes(c.id),
    mechanism:c.id==='vis-nearby'?'理由摘要邻近对应的时段行。':c.id==='vis-calc'?'矩阵定位并未覆盖固定证据栏。':
      c.id==='vis-gnucash'?'财务主从行未覆盖人选签核。':'此方向没有采用该案例的导航或排名结构。',
    boundary:c.id==='vis-nearby'?'仅迁移邻接关系，排除地理语义、示例资产和距离排序。':'不能从该跨域案例推导当前任务的操作流程。'}));
  option.design={audience:d.audience,pageGoal:d.goal,entities:d.entities,states,
    transitions:states.slice(1).map((s,i)=>({from:states[i].id,to:s.id,action:states[i].controls[0]})),
    layouts:{desktop:{structure:d.desktop,order:d.entities},mobile:{structure:d.mobile,order:d.entities}},
    art:{brandTone:d.tone,colorIntent:d.color,surfaceTone:'light',headingScale:'larger',density:d.density,componentLanguage:d.component,antiPatterns:[d.anti],caseDecisions},
    system:{tokens:Object.fromEntries(tokenNames.map((name,i)=>[name,d.tokens[i]])),iconLanguage:d.icon,componentStates:d.componentStates,motion:d.motion,responsiveRule:d.mobile},
    evaluation:{checkpoints:states.map((s,i)=>({state:s.id,visible:[d.states[i][4]],firstViewport:{desktop:[d.states[i][4]],mobile:[d.states[i][5]]},
      success:'可辨认'+d.states[i][4]+'，可找到「'+s.controls[0]+'」。'})),brandConsistency:d.brand,
      accessibility:'正文清晰，使用键盘可完成主要操作，反馈有文字说明。',responsive:d.mobile,humanQuestions:[d.human]},
    creativeFreedom:'在保留状态重心、用户要求和可操作性的前提下调整换行、控件细节与非锁定 Token。'};
  const contract=assembleContract({runId,brief,analysis,requirements:requirementsFor(brief,analysis),knowledge,option,selection,steps,viewports});
  return {contract,prior};
}
const dir=await mkdtemp(join(resolve('runs/K-03A'),'examples-'));
const manifest={kind:'offline-worked-examples',newModelCalls:0,examples:[]};
for(const id of Object.keys(data)){
  const {contract,prior}=await make(id),file=id+'.json',bytes=JSON.stringify(contract,null,2)+'\n';
  await writeFile(join(dir,file),bytes,{mode:0o600});
  manifest.examples.push({id,file,sha256:createHash('sha256').update(bytes).digest('hex'),prior,
    origin:prior?'K-01 actual scene and selected direction; K-03A supplemental fields are authored examples':'Authored ambiguity example; no model or retrieval'});
}
await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log(dir);
