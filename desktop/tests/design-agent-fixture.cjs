#!/usr/bin/env node
// Offline transport fixture for the workbench smoke test. Never used by the design benchmark.
const fs=require('node:fs');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
const schema=JSON.parse(fs.readFileSync(arg('--output-schema'),'utf8')).properties;
let input='';
process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',()=>{
  if(input.includes('FAIL_FIXTURE')){console.error('fixture failure');process.exitCode=1;return;}
  if(input.includes('WAIT_FIXTURE')){setTimeout(()=>{},60000);return;}
  let value;
  if(schema.catalog&&schema.dimensions){
    const request=input.split('用户原文\n').at(-1),evidence=request.slice(0,12);
    const dimensions=Object.fromEntries(Object.keys(schema.dimensions.properties).map(k=>[k,[]]));
    dimensions.task=[{value:'测试用报名流程',certainty:'inferred',evidence}];
    value={dimensions,catalog:[{tag:'local-consumer',evidence}],device:'mobile',uncertainties:['Fixture'],assumptionsToVerify:[],...(schema.brands?{brands:[]}:{})};
    if(schema.hardRequirements)Object.assign(value,{hardRequirements:[],tokenLocks:[],conflicts:[]});
  }else if(schema.options){
    const fields=schema.options.items.properties;
    const rules=fields.ruleIds.items.enum||[],visual=fields.visualCaseIds.items.enum||[];
    value={options:['list','detail'].map(id=>({id,name:id,structure:id,informationArchitecture:id+' order',focalPoint:id+' focus',
      typography:id+' type',interactionPath:id+' flow',advantages:'Fixture',costs:'Fixture',fit:'Fixture',ruleIds:rules.slice(0,1),
      visualCaseIds:visual.slice(0,1),preferenceIds:[]})),selectedId:'list',selectionReason:'Fixture',evidenceGaps:['Fixture only']};
    if(fields.design){
      const quotes=JSON.parse(input.split('原样复制以下任务引文之一：')[1].split('\n')[0]);
      const stateActions=Boolean(fields.design.properties.states.items.properties.primaryAction);
      for(const o of value.options){
        const states=['initial','booked'].map((id,i)=>({id,purpose:i?'确认报名':'选择场次',taskEvidence:quotes[0],
          priority:i?['名额','场次']:['场次','名额'],controls:[i?'查看记录':'报名']}));
        o.design={audience:'测试观众',pageGoal:'报名活动',entities:['场次','名额'],states,transitions:[{from:'initial',to:'booked',action:'报名'}],
          layouts:{desktop:{structure:'场次旁展示名额',order:['场次','名额']},mobile:{structure:'按场次展开名额',order:['场次','名额']}},
          art:{brandTone:'测试放映手册',colorIntent:'墨色正文',surfaceTone:'light',headingScale:'larger',density:'场次之间留白',
            componentLanguage:'放映单',antiPatterns:['勿遮住余票'],caseDecisions:visual.map((id,i)=>({id,adopt:i===0,mechanism:'列表邻接',boundary:'不借用外观'}))},
          system:{tokens:{'color.brand.primary':'#38466b','color.surface.base':'#fff','color.text.primary':'#222','color.action.primary':'#43506d',
            'type.family.body':'system-ui','type.size.body':'16px','type.size.heading':'24px','type.weight.body':'400','type.lineHeight.body':'1.5',
            'space.component.md':'12px','radius.control':'4px','border.control':'1px solid #555','shadow.surface':'none','motion.feedback':'100ms'},
            iconLanguage:'文字配线形图标',componentStates:'报名可用、已报名禁用',motion:'减少动效时直接反馈',responsiveRule:'窄屏按场次阅读'},
          evaluation:{checkpoints:states.map(s=>({state:s.id,visible:s.priority,firstViewport:{desktop:s.priority,mobile:s.priority},success:s.purpose})),
            brandConsistency:'同一场次使用同一标题格式',accessibility:'可用键盘报名',responsive:'390 宽可读余票',humanQuestions:['报名反馈是否清楚？']},
          creativeFreedom:'按片名调整断行'};
        if(stateActions){
          const detail=o.id==='detail';
          states[1].controls=['取消报名'];
          for(const [index,state] of states.entries()){
            state.primaryAction={id:index?'cancel-booking':'reserve-seat',operation:'click',value:null,
              nextState:index?'initial':'booked',expectedText:index?'活动报名':'已报名'};
            state.prerequisites=index?['已经完成报名']:[];state.presentation={desktop:'显示可报名场次及名额',mobile:'先读片名再确认名额'};
          }
          o.design.transitions.push({from:'booked',to:'initial',action:'取消报名'});
          if(detail){
            o.design.layouts.desktop.order=['名额','场次'];
            o.design.layouts.desktop.structure='先展示可报名余量，再列出场次选择。';
            o.design.layouts.mobile.order=['名额','场次'];
            o.design.layouts.mobile.structure='先用单行名额摘要，再展开场次。';
            o.design.art.headingScale='equal';
            o.design.art.density='紧凑的场次数量账目';
            o.design.system.tokens['type.size.heading']='16px';
            o.design.system.tokens['space.component.md']='6px';
          }
          if(fields.design.properties.art.properties.language){
            const seeds=JSON.parse(input.split('设计语言候选（JSON）\n')[1].split('\n')[0]);
            o.design.art.language={mode:seeds.length&&!detail?'adopt':'original',
              choices:seeds.map((seed,i)=>({seedId:seed.id,principleIds:i===0&&!detail?[seed.principles[0].id]:[],
                reason:i===0&&!detail?'以场次和余量对齐，适合逐项比较。':'此方向的单项名额说明无需该原则。',boundary:'只采用信息组织，不迁移业务名称。'})),
              visualDifference:detail?'同字号标记，缩短行间距离。':'较大的场次标题与留白分隔。',
              architectureDifference:detail?'从名额详情回到场次。':'在名单中比较后报名。',
              tokenRationale:detail?'type.size.heading = 16px，space.component.md = 6px 表达紧凑密度。':'type.size.heading = 24px，space.component.md = 12px 分隔场次。'};
          }
        }
      }
      if(input.includes('CONTRACT_BAD_FIXTURE')||(input.includes('CONTRACT_RETRY_FIXTURE')&&!input.includes('上一次结构化回答未通过核对'))){
        value.options[0].design.art.caseDecisions.push({id:'not-retrieved',adopt:false,mechanism:'fixture-only',boundary:'unknown case'});
      }
    }
    if(schema.journey)value.journey=[{id:'book',state:'book-status',action:'点报名',operation:'click',value:'',result:'显示已报名',contains:'已报名',requireChange:true,opener:null}];
  }else if(schema.preferred){
    value={preferred:'uncertain',reason:'Fixture only',dimensions:{hierarchy:'test',layout:'test',typography:'test',color:'test',sceneFit:'test'},
      issues:[],uncertainty:'需要真实用户评价'};
  }else{
    value={title:'活动报名',html:'<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><h1>活动报名</h1><button data-task="book" data-testid="primary-action">报名</button><p data-state="book-status" data-testid="action-feedback">尚未报名</p><script src="app.js"></script></body></html>',
      css:'body{font:18px system-ui;margin:20px}@media(max-width:600px){body{margin:12px}}',js:'document.querySelector("button").onclick=()=>document.querySelector("p").textContent="已报名"'};
    if(input.includes('真实状态与下一步操作')){
      const tokens=[...input.matchAll(/^• ((?:color|type|space|radius|border|shadow|motion)\.[\w.]+) = ([^\n]+)$/gm)];
      const properties=tokens.map(([,name,raw])=>'--'+name.replaceAll('.','-')+':'+raw.replace(' [用户锁定]','')).join(';');
      value.css=':root{'+properties+'}body{font-family:var(--type-family-body);line-height:var(--type-lineHeight-body);font-size:var(--type-size-body);font-weight:var(--type-weight-body);color:var(--color-text-primary);background:var(--color-surface-base);margin:20px}h1{font-size:var(--type-size-heading);color:var(--color-brand-primary)}button{font:inherit;color:white;background:var(--color-action-primary);padding:var(--space-component-md);border-radius:var(--radius-control);border:var(--border-control)}';
      value.html='<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><main data-experience-state="initial"><h1 data-primary-information="initial">活动报名 · 场次</h1><button data-experience-action="reserve-seat" data-task="book" data-testid="primary-action">报名</button><p data-state="book-status" data-testid="action-feedback">尚未报名</p></main><script src="app.js"></script></body></html>';
      value.js=`const main=document.querySelector('main'),heading=main.querySelector('h1'),control=main.querySelector('button'),status=main.querySelector('p');
control.onclick=()=>{
  const booked=main.dataset.experienceState==='initial',state=booked?'booked':'initial';
  main.dataset.experienceState=state;heading.dataset.primaryInformation=state;
  heading.textContent=booked?'已报名 · 名额':'活动报名 · 场次';status.textContent=booked?'已报名':'尚未报名';
  control.dataset.experienceAction=booked?'cancel-booking':'reserve-seat';control.textContent=booked?'取消报名':'报名';
};`;
    }
    if(input.includes('CONTRACT_REPAIR_FIXTURE')&&!input.includes('只修正以下已定位的问题'))value.css+='\nbody{min-width:1800px}';
  }
  fs.writeFileSync(arg('-o'),JSON.stringify(value));
});
