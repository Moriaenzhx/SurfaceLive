import {createHash} from 'node:crypto';
import {matchDesignSeeds,directorSeedBrief} from '../live-engine/design/design-language.mjs';
import {experiencePlanningInstruction} from '../live-engine/design/experience-patterns.mjs';
import {indexed} from '../live-engine/ingestion/retrieval.ts';
import {journeyInstruction} from '../live-engine/design/journey.mjs';
import {matchingPreferences} from '../live-engine/design/preferences.mjs';
import {scenePrompt,sceneSchema,scopedSceneSchema,validateScene,object,list,string} from '../live-engine/design/scene.mjs';
import {directorPrompt,strategySchema,validateStrategies,validateDirectionDifferences} from '../live-engine/design/director.mjs';
import {composePrompt,devices,direction,interpretedDirection,prepareGeneration} from './engine.mjs';
import {assembleContract,contractInstruction,guardBrandConflict,requirementsFor,sceneTasks} from '../live-engine/design/contract.mjs';
import {literalLockSchema,conflictSchema,directionDetailSchema11,stateActionVersion,checkShape} from '../live-engine/design/contract-schema.mjs';
import {designStage} from './design-stage.mjs';

export async function prepareTurn({description,source,input,options,trace,variant,brief,preferenceContext,knownSteps=[],parentContract=null}){
  const quick=direction(brief.slice(-10000),input.target);
  if(variant==='A0')return {context:quick,knowledge:null,prompt:composePrompt(description,quick,source,input.text)};
  const full=variant!=='A1';
  const baseSchema=preferenceContext?scopedSceneSchema:sceneSchema;
  const schema=full?object({...baseSchema.properties,hardRequirements:list(string),tokenLocks:list(literalLockSchema),conflicts:list(conflictSchema)}):baseSchema;
  const prior=parentContract?.requirements.explicit??[];
  if(full){
    try{guardBrandConflict([brief,...prior].join('\n'));}
    catch(error){await trace.record('contract-blocked',{contractError:error.message});throw error;}
  }
  const policy=full?'逐字摘录明确的功能、保留条款、接口和品牌要求到 hardRequirements。只有用户明确指定某个 Token 及其实际字面值时才填 tokenLocks，quote 必须同时证明角色和取值。未规定颜色、字体的字段留空。识别无法同时满足的条款，将两条不同原话和原因写入 conflicts。禁止把推断、资料偏好和软建议升级为硬规范。\n继承的明确条款：'+JSON.stringify(prior)+'\n':'';
  const analysis=await designStage('scene',options,trace,{prompt:policy+scenePrompt(brief,input.target),schema,validate:raw=>{
    if(full){
      checkShape(schema,raw,'scene');
      const available=[brief,...prior].join('\n');
      const quotes=[...raw.hardRequirements,...raw.tokenLocks.map(l=>l.quote),...raw.conflicts.flatMap(v=>[v.first,v.second])];
      if(quotes.some(q=>!available.includes(q))||raw.tokenLocks.some(l=>!l.value.trim()||!l.quote.includes(l.value)))throw Error('明确约束须有逐字原文和字面值');
    }
    return validateScene(raw,brief);
  }});
  const context=interpretedDirection(quick,analysis,input.target);
  const prepared=prepareGeneration(description,context,source,input.text,analysis);
  context.evidence=[...prepared.knowledge.reviewedCards.map(c=>({id:c.id,title:c.title,note:c.note,url:c.url})),
    ...prepared.knowledge.rules.map(r=>({id:r.id,title:r.decision,note:r.check,url:r.sources[0].url}))];
  await trace.record('scene-interpreted',{scene:context,knowledge:prepared.knowledge});
  if(variant==='A1')return {...prepared,context};
  let preferences=[];
  if(preferenceContext){
    try{
      preferences=matchingPreferences(preferenceContext.file,{user:'local-owner',project:preferenceContext.project,
        brands:(analysis.brands||[]).map(b=>b.name),scenes:[...analysis.catalog.map(c=>c.tag),...analysis.dimensions.product.map(p=>p.value)]});
    }catch(error){await trace.record('preferences-unavailable',{preferenceReadError:error.message});}
  }
  prepared.knowledge.confirmedPreferences=preferences;
  await trace.record('preferences-retrieved',{preferenceIds:preferences.map(p=>p.id)});
  if(!prepared.knowledge.exemplars.length&&!prepared.knowledge.reviewedCards.some(c=>c.kind==='VisualExemplar')){
    const portrait=context.device==='mobile';
    prepared.knowledge.analogies=indexed().flatMap(entry=>entry.cards.filter(c=>c.kind==='VisualExemplar'&&
      Boolean(c.capturedViewport?.height>c.capturedViewport?.width)===portrait).map(c=>({
      id:c.id,sourceId:c.sourceId,url:entry.source.canonicalUrl,scope:'cross-domain',versionHash:c.versionHash,
      screenshotHash:c.inspectedHash,observation:c.visualHierarchy,layout:c.layoutGrammar,typography:c.typographyRhythm,
      focalPoint:c.focalPoint,applicability:c.applicability,restrictions:c.copyingRestrictions
    }))).slice(0,3);
  }
  trace.observe?.(audit=>audit.retrieval(source?description+'\n'+input.text:description,analysis.catalog.map(c=>c.tag),prepared.knowledge));
  await trace.record('knowledge-retrieved',{scene:context,knowledge:prepared.knowledge});
  const seedMatches=matchDesignSeeds({brief,analysis,device:context.device});
  const seedText=directorSeedBrief(seedMatches);
  const shortlist=seedMatches.map(({id,score,reasons,seed})=>({id,score,reasons,sha256:seed.sha256,references:seed.references}));
  // Reuse ranked retrieval. Keep its original results in the trace and bound the director's rule context.
  const k=prepared.knowledge;
  const scoped={...k,rules:k.rules.slice(0,5),reviewedCards:k.reviewedCards.filter(c=>c.kind==='VisualExemplar'||c.kind==='DesignRule').slice(0,4)};
  const rules=[...scoped.rules,...scoped.reviewedCards.filter(c=>c.kind==='DesignRule')];
  const knowledgeText=JSON.stringify({rules:rules.map(r=>({id:r.id,instruction:r.decision??r.note})),
    guidance:scoped.preferences.map(p=>({id:p.id,directive:p.directive}))});
  await trace.record('language-shortlisted',{designLanguage:{shortlist,ruleIds:rules.map(r=>r.id),
    seedContextSha256:createHash('sha256').update(seedText).digest('hex'),seedContextBytes:Buffer.byteLength(seedText)}});
  const planJourney=!knownSteps.length;
  const viewports=[...new Set([context.device,'desktop','mobile'])].map(device=>({device,width:devices[device].width,height:devices[device].height}));
  let artDirection,contracts;
  try{
    const requirements=requirementsFor(brief,analysis,parentContract);
    const instructions=[
      experiencePlanningInstruction(brief),seedText,
      '返回两个精炼的候选；每字段用短句。design.art.language.choices 对入围的每个 seedId 给出 principleIds（拒绝采用填空数组）、具体 reason 和 boundary。mode 取 adopt/combine/original，对应采用一个/多个/零个种子。可提出原创方向。',
      '分别用 visualDifference、architectureDifference 说明本方向的视觉表达和信息架构有何差异。具体验证两方案的阅读顺序、状态优先级或字阶/间距的差异。tokenRationale 引用至少一个精确语义 Token 名，解释其值与适用状态的联系。保留用户硬约束。',
      '每个方向填写自己的 design，精简文字，避免重复。',
      'entities 是稳定的业务对象名称。每个 state 的 priority、每端 layouts.order 必须逐字使用本方向 entities 的条目。initial 和操作后的状态必须由 transitions 连通，priority 第一项随任务改变。控件写可见名称。',
      '每个状态的 taskEvidence 原样复制以下任务引文之一：'+JSON.stringify(sceneTasks(analysis,brief)),
      '桌面和手机分别说明结构、阅读顺序与去留。每个状态在 evaluation.checkpoints 恰有一条。firstViewport.desktop 与 mobile 描述这两个实际视口首屏应认得出的具体内容，以业务文字或控件描述成功结果。保留无障碍、品牌和需要人判断的问题。',
      'art.caseDecisions 对上列每个允许 visual ID 恰列一次。adopt=true 的集合必须等于该方向的 visualCaseIds。给出具体迁移机制和禁用边界。拒用也给出业务理由。',
      'system.tokens 是各方向自行设计的语义 CSS 值。颜色用 #RGB 或 #RRGGBB，正文和底色对比度至少 4.5。surfaceTone 表示底色明暗，headingScale 与标题/正文字号对应。字号/间距/圆角用 px 或 rem，字重和行高用数字字符串。组件状态及减少动效的处理必须具体。',
      '宿主锁定的用户约束：'+JSON.stringify(requirements.explicit)+'；Token 锁：'+JSON.stringify(requirements.tokenLocks),
      '无明确要求的艺术方向和 Token 均属设计推断，说明创作自由，避免风格标签代替决策。目标视口：'+JSON.stringify(viewports),
      knownSteps.length?'保留既有实际业务操作：'+JSON.stringify(knownSteps):''
    ].filter(Boolean);
    artDirection=await designStage('art-direction',options,trace,{prompt:[directorPrompt(brief,analysis,{knowledge:scoped,knowledgeText},preferences,planJourney),...instructions].join('\n\n'),
      schema:strategySchema(scoped,planJourney,stateActionVersion),validate:raw=>{
        validateStrategies(raw,scoped,planJourney);
        contracts=raw.options.map(option=>{
          checkShape(directionDetailSchema11,option.design,'direction.design');
          return assembleContract({runId:trace.data.attemptId,brief,analysis,requirements,knowledge:scoped,seedMatches,schemaVersion:stateActionVersion,
            option,selection:raw,steps:planJourney?raw.journey:knownSteps,viewports,parentId:parentContract?.id??null});
        });
        validateDirectionDifferences(raw.options);
        return raw;
      }});
    await trace.storeContracts(contracts,artDirection.selectedId);
  }catch(error){
    await trace.record('contract-blocked',{contractError:error.message});
    throw error;
  }
  await trace.record('direction-selected',{artDirection:{status:'selected',...artDirection}});
  const steps=knownSteps.length?knownSteps:artDirection.journey;
  const contractFor=option=>contracts.find(c=>c.directionId===option.id);
  const promptFor=option=>composePrompt(description,context,source,input.text,contractInstruction(contractFor(option)),stateActionVersion)+'\n'+journeyInstruction(steps);
  const selected=artDirection.options.find(o=>o.id===artDirection.selectedId);
  return {...prepared,context,artDirection,selected,steps,prompt:promptFor(selected),promptFor,contractFor};
}
