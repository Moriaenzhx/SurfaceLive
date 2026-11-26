// The same field definitions drive structured director output and validation in the host.
import {list,object,string} from './scene.mjs';
import {journeySchema} from './journey.mjs';

export const contractVersion='1.0';
export const tokenNames=[
  'color.brand.primary','color.surface.base','color.text.primary','color.action.primary',
  'type.family.body','type.size.body','type.size.heading','type.weight.body','type.lineHeight.body',
  'space.component.md','radius.control','border.control','shadow.surface','motion.feedback'
];
const strings=list(string);
const choice=(...values)=>({type:'string',enum:values});
const flag={type:'boolean'};
const nullable=s=>({anyOf:[s,{type:'null'}]});
export const literalLockSchema=object({token:choice(...tokenNames),value:string,quote:string});
export const conflictSchema=object({first:string,second:string,reason:string});
const state=object({id:string,purpose:string,taskEvidence:string,priority:strings,controls:strings});
const transition=object({from:string,to:string,action:string});
const layout=object({structure:string,order:strings});
const layouts=object({desktop:layout,mobile:layout});
const caseDecision=object({id:string,adopt:flag,mechanism:string,boundary:string});
const typographyScale=choice('larger','equal','smaller');
const surfaceTone=choice('light','dark');
const tokens=object(Object.fromEntries(tokenNames.map(name=>[name,string])));
const checkpoint=object({state:string,visible:strings,firstViewport:object({desktop:strings,mobile:strings}),success:string});
const evaluationFields={
  checkpoints:list(checkpoint),brandConsistency:string,accessibility:string,responsive:string,humanQuestions:strings
};
const systemFields={tokens,iconLanguage:string,componentStates:string,motion:string,responsiveRule:string};
const artFields={
  brandTone:string,colorIntent:string,surfaceTone,headingScale:typographyScale,
  density:string,componentLanguage:string,antiPatterns:strings,caseDecisions:list(caseDecision)
};
// Each rendered candidate gets its own decisions, including the alternative selected later by review.
export const directionDetailSchema=object({
  audience:string,pageGoal:string,entities:strings,states:list(state),transitions:list(transition),layouts,
  art:object(artFields),system:object(systemFields),evaluation:object(evaluationFields),creativeFreedom:string
});
const fact=object({value:string,evidence:string,source:choice('user','scene-inference','director-inference')});
const rule=object({id:string,instruction:string});
const preference=object({id:string,source:choice('confirmed-preference','bundled-guidance'),instruction:string});
const viewport=object({device:choice('desktop','tablet','mobile'),width:{type:'integer'},height:{type:'integer'}});
const hostCheck=object({state:string,viewport:choice('desktop','tablet','mobile'),visible:strings,controls:strings,
  primaryEntity:string,firstViewport:strings,success:string});
export const designContractSchema=object({
  schemaVersion:choice(contractVersion),id:string,runId:string,directionId:string,
  requirements:object({brief:string,explicit:strings,tokenLocks:list(literalLockSchema),host:strings,uncertainties:strings,assumptions:strings}),
  experiencePlan:object({audience:list(fact),productGoals:list(fact),pageGoal:string,tasks:list(fact),entities:strings,
    informationArchitecture:string,states:list(state),transitions:list(transition),layouts,preservedFunctions:strings}),
  artDirection:object({concept:string,rationale:string,selection:string,composition:string,focalPoint:string,typography:string,
    interactionPath:string,motionDirection:string,...artFields,rules:list(rule),preferences:list(preference),evidenceGaps:strings}),
  designSystem:object({...systemFields,creativeFreedom:string}),
  evaluationPlan:object({viewports:list(viewport),checks:list(hostCheck),journey:journeySchema,brandConsistency:string,
    accessibility:string,responsive:string,antiPatterns:strings,humanQuestions:strings}),
  provenance:object({sceneStage:string,directorStage:string,adoptedKnowledgeIds:strings,parentContractId:nullable(string),
    decisionSources:list(object({path:string,source:choice('user','scene','art-director','knowledge-rule','visual-case','confirmed-preference','bundled-guidance'),reference:string}))})
});

// Keep the exact 1.0 field definitions available for saved projects and historical input replay.
export const stateActionVersion='1.1';
const state11=object({...state.properties,
  primaryAction:object({id:string,operation:choice('click','fill','select','wait'),value:nullable(string),nextState:string,expectedText:string}),
  prerequisites:strings,presentation:object({desktop:string,mobile:string})
});
export const languageDecisionSchema=object({
  mode:{type:'string',enum:['adopt','combine','original']},
  choices:list(object({seedId:string,principleIds:list(string),reason:string,boundary:string})),
  visualDifference:string,architectureDifference:string,tokenRationale:string
});

const principle=object({seedId:string,principleId:string,guidance:string,sourceIds:strings});
export const directionDetailSchema11=object({...directionDetailSchema.properties,art:object({...artFields,language:languageDecisionSchema}),states:list(state11)});
export const designContractSchema11=object({...designContractSchema.properties,schemaVersion:choice(stateActionVersion),
  artDirection:object({...designContractSchema.properties.artDirection.properties,language:languageDecisionSchema,principles:list(principle)}),
  experiencePlan:object({...designContractSchema.properties.experiencePlan.properties,states:list(state11)})
});

// Strict validation of the JSON Schema subset used here. No coercion, stripping or silent defaults.
export function checkShape(schema,value,path='contract'){
  const fail=message=>{throw Error(path+' '+message);};
  if(schema.enum&&!schema.enum.includes(value))fail('不在允许范围内');
  if(!schema.type&&schema.enum)return;
  if(schema.anyOf){
    if(value===null&&schema.anyOf.some(s=>s.type==='null'))return;
    return checkShape(schema.anyOf.find(s=>s.type!=='null'),value,path);
  }
  if(schema.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('需要对象');
    for(const k of Object.keys(value))if(!Object.hasOwn(schema.properties,k))fail('未知字段 '+k);
    for(const [k,child] of Object.entries(schema.properties)){
      if(!Object.hasOwn(value,k))fail('缺少字段 '+k);
      checkShape(child,value[k],path+'.'+k);
    }
  }else if(schema.type==='array'){
    if(!Array.isArray(value))fail('需要数组');
    value.forEach((v,i)=>checkShape(schema.items,v,path+'['+i+']'));
  }else if(schema.type==='integer'){
    if(!Number.isSafeInteger(value))fail('需要整数');
  }else if(typeof value!==schema.type||(schema.type==='string'&&!value.trim()&&!/\.journey\[\d+\]\.value$/.test(path)))fail('字段类型或内容无效');
}
