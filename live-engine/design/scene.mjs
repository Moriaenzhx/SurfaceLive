// Only the retrieval taxonomy is closed. The eight descriptions can name domains the library has never seen.
export const dimensions={product:'产品类型',audience:'用户群体',task:'核心业务任务',interaction:'页面与交互模式',
  device:'设备类型',cultureBrand:'文化和品牌语境',complexity:'设计复杂度',visual:'视觉风格约束'};
export const catalogScenes=['b2b-workbench','executive-dashboard','local-consumer','consumer-commerce','creative-editor'];
export const string={type:'string'};
export const list=items=>({type:'array',items});
export const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const entry=object({value:string,evidence:string,certainty:{enum:['explicit','inferred']}});
export const sceneSchema=object({
  dimensions:object(Object.fromEntries(Object.keys(dimensions).map(key=>[key,list(entry)]))),
  catalog:list(object({tag:{enum:catalogScenes},evidence:string})),
  device:{enum:['desktop','tablet','mobile','unknown']},uncertainties:list(string),assumptionsToVerify:list(string)
});
export const scopedSceneSchema=object({...sceneSchema.properties,brands:list(object({name:string,evidence:string}))});
export function scenePrompt(brief,target){
  return ['理解这段前端产品需求，逐维提取语义，供设计和检索使用。不要生成页面。',
    JSON.stringify(dimensions),'每维可有多项。每项的 evidence 必须逐字摘录用户原文，区分明确要求和有依据的推断。未知维度返回空数组，把会影响设计的未知事项列为问题、把尚需确认的推断列为假设。不要从一种文化推断品牌色、禁忌或权威历法。',
    'catalog 只是设计资料库的可用索引。按业务相关程度给出零至多个标签，只因都是手机应用或都有列表不构成业务相关性。无法覆盖就留空，在 uncertainties 说明具体缺口，在 assumptionsToVerify 提出一项可经原型或用户验证的设计假设。device 依据原文，无依据时填 unknown。',
    '如有 brands 字段，仅列出用户明确作为本项目品牌的名称，给出含品牌名的逐字引文。提到的竞品或反例不列入。',
    '宿主终端选项 '+target,'用户原文\n'+brief].join('\n\n');
}
export function validateScene(raw,brief){
  if(!raw?.dimensions||!Array.isArray(raw.catalog))throw Error('场景理解缺少维度或索引结果');
  const evidence=text=>typeof text==='string'&&text.trim().length>0&&brief.includes(text);
  for(const key of Object.keys(dimensions)){
    const items=raw.dimensions[key];
    if(!Array.isArray(items)||items.some(i=>!i?.value?.trim()||!evidence(i.evidence)||!['explicit','inferred'].includes(i.certainty)))
      throw Error('场景维度缺少原文依据 '+key);
  }
  if(!Array.isArray(raw.uncertainties)||!Array.isArray(raw.assumptionsToVerify)||
    !['desktop','tablet','mobile','unknown'].includes(raw.device)||
    raw.catalog.some(item=>!catalogScenes.includes(item.tag)||!evidence(item.evidence)))throw Error('场景索引或设备依据无效');
  if([...raw.uncertainties,...raw.assumptionsToVerify].some(text=>typeof text!=='string'||!text.trim())||
    !raw.catalog.length&&(!raw.uncertainties.length||!raw.assumptionsToVerify.length))
    throw Error('领域未覆盖时需要说明具体的知识缺口和待验证的设计假设');
  if(raw.brands!==undefined&&(!Array.isArray(raw.brands)||raw.brands.some(b=>typeof b.name!=='string'||!b.name.trim()||!evidence(b.evidence)||!b.evidence.includes(b.name))))
    throw Error('项目品牌缺少原文依据');
  const missing=Object.entries(dimensions).filter(([key])=>!raw.dimensions[key].length).map(([key])=>key);
  return {...raw,missingDimensions:missing,catalogCoverage:raw.catalog.length?'related-records':'uncovered'};
}
