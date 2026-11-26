// Runs inside the isolated preview. Every geometry reading precedes driver scrolling.
import {applyStep} from './interaction-check.mjs';

const evaluate=(wc,fn,arg)=>wc.executeJavaScript('('+fn.toString()+')('+JSON.stringify(arg)+')');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function inspectRegion({id,actionId}){
  const shown=node=>node.getClientRects().length>0&&node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!node.closest('[inert],[aria-hidden="true"]');
  const rect=node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
  const selector='[data-experience-state="'+CSS.escape(id)+'"]';
  const regions=[...document.querySelectorAll(selector)].filter(shown);
  if(regions.length!==1)return {visible:false,count:regions.length,text:''};
  const region=regions[0],infoSelector='[data-primary-information="'+CSS.escape(id)+'"]';
  const info=[region,...region.querySelectorAll(infoSelector)].find(n=>n.matches(infoSelector)&&shown(n));
  const actionSelector='[data-experience-action="'+CSS.escape(actionId)+'"]';
  const actions=[region,...region.querySelectorAll(actionSelector)].filter(n=>
    n.matches(actionSelector)&&n.closest('[data-experience-state]')===region&&shown(n));
  function path(el){
    const segments=[];
    while(el&&el!==document.documentElement){
      segments.unshift(':nth-child('+([...el.parentElement.children].indexOf(el)+1)+')');el=el.parentElement;
    }
    return 'html > '+segments.join(' > ');
  }
  let information=null;
  if(info){
    const walker=document.createTreeWalker(info,NodeFilter.SHOW_TEXT);
    for(let t=walker.nextNode();t;t=walker.nextNode()){
      if(!t.textContent.trim()||!shown(t.parentElement))continue;
      const range=document.createRange();range.selectNodeContents(t);
      const box=range.getBoundingClientRect();
      if(box.width&&box.height){
        let left=Math.max(0,box.left),top=Math.max(0,box.top),right=Math.min(innerWidth,box.right),bottom=Math.min(innerHeight,box.bottom);
        for(let el=t.parentElement;el;el=el.parentElement){
          const style=getComputedStyle(el),clip=el.getBoundingClientRect();
          if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}
          if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}
        }
        information={text:t.textContent.trim().slice(0,160),x:box.x,y:box.y,inViewport:right>left&&bottom>top};break;
      }
    }
  }
  return {visible:true,count:1,text:region.innerText.trim().slice(0,6000),bounds:rect(region),scrollY,
    information,actionCount:actions.length,actions:actions.map(node=>({selector:path(node),bounds:rect(node),
      disabled:!!node.closest(':disabled,[aria-disabled="true"]')})),
    viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}};
}

// Capture the real transient DOM between input and the next CDP round trip. Never attach a later screenshot to this observation.
function watchTransition({id,expectedText}){
  window.__surfaceObservation?.observer?.disconnect();
  const slot={sample:null};
  const check=()=>{
    const nodes=[...document.querySelectorAll('[data-experience-state="'+CSS.escape(id)+'"]')].filter(n=>
      n.getClientRects().length&&n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!n.closest('[aria-hidden="true"],[inert]'));
    if(nodes.length===1&&nodes[0].innerText.includes(expectedText))slot.sample={text:nodes[0].innerText.trim().slice(0,6000),at:performance.now()};
  };
  slot.observer=new MutationObserver(check);
  slot.observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true,characterData:true});
  window.__surfaceObservation=slot;
}

// Observe the compositor without changing styles, preferences or the page's animation clock.
function settleStateFrame({id,budgetMs}){
  const selector='[data-experience-state="'+CSS.escape(id)+'"]';
  const visible=node=>node.getClientRects().length&&node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!node.closest('[inert],[aria-hidden="true"]');
  const regions=()=>[...document.querySelectorAll(selector)].filter(visible);
  const region=regions()[0],start=performance.now(),seen=new Set();
  const current=()=>{const found=regions();return found.length===1&&found[0]===region;};
  const paintable=target=>{
    if(!(target instanceof Element)||!target.checkVisibility({contentVisibilityAuto:true,checkVisibilityCSS:true}))return false;
    for(let details=target.parentElement?.closest('details:not([open])');details;details=details.parentElement?.closest('details:not([open])')){
      if(!details.querySelector(':scope > summary')?.contains(target))return false;
    }
    return [...target.getClientRects()].some(rect=>rect.width>0&&rect.height>0);
  };
  const active=()=>region.getAnimations({subtree:true}).filter(animation=>
    animation.playState==='running'&&animation.playbackRate!==0&&Number.isFinite(animation.effect?.getComputedTiming().endTime)&&paintable(animation.effect.target));
  return new Promise(resolve=>{
    let frame,quietFrames=0;
    const finish=status=>{
      clearTimeout(timer);cancelAnimationFrame(frame);
      resolve({status,finiteAnimations:seen.size,elapsedMs:Math.round(performance.now()-start),budgetMs});
    };
    const timer=setTimeout(()=>finish(current()?'timeout':'state-changed'),budgetMs);
    const observe=()=>{
      if(!current())return finish('state-changed');
      const running=active();
      for(const animation of running)seen.add(animation);
      quietFrames=running.length?0:quietFrames+1;
      if(quietFrames>=2)return finish('settled');
      frame=requestAnimationFrame(observe);
    };
    frame=requestAnimationFrame(observe);
  });
}

function styles({tokens,locks}){
  const properties={
    'color.brand.primary':['color','background-color','border-top-color','fill','stroke'],
    'color.surface.base':['background-color'],'color.text.primary':['color'],'color.action.primary':['background-color','color','border-top-color'],
    'type.family.body':['font-family'],'type.size.body':['font-size'],'type.size.heading':['font-size'],
    'type.weight.body':['font-weight'],'type.lineHeight.body':['line-height'],'space.component.md':['gap','padding-left','padding-top','margin-bottom'],
    'radius.control':['border-top-left-radius'],'border.control':['border-top'],'shadow.surface':['box-shadow'],
    'motion.feedback':['transition-duration','animation-duration']
  };
  const visible=node=>node.getClientRects().length&&node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!node.closest('[aria-hidden="true"],[inert]');
  const probe=document.createElement('span');
  probe.style.cssText='all:initial;position:fixed;visibility:hidden;pointer-events:none';
  document.documentElement.appendChild(probe);
  function normalized(prop,value,fontSize){
    if(!value||!CSS.supports(prop,value))return null;
    probe.style.fontSize=fontSize;
    probe.style.setProperty(prop,value);
    const result=getComputedStyle(probe).getPropertyValue(prop);
    probe.style.removeProperty(prop);return result;
  }
  try{
    const rootStyle=getComputedStyle(document.documentElement);
    const entries=Object.entries(tokens).map(([name,expected])=>{
      const locked=locks.some(l=>l.token===name);
      const variable='--'+name.replaceAll('.','-'),declared=rootStyle.getPropertyValue(variable).trim();
      const props=properties[name],roleNodes=[...document.querySelectorAll('[data-design-token~="'+CSS.escape(name)+'"]')].filter(visible);
      const eq=(prop,a,b,fs)=>{const av=normalized(prop,a,fs);return av!==null&&av===normalized(prop,b,fs);};
      const declarationMatches=props.some(prop=>eq(prop,expected,declared,rootStyle.fontSize));
      const uses=roleNodes.map(el=>{
        const css=getComputedStyle(el);
        const computed=Object.fromEntries(props.map(p=>[p,css.getPropertyValue(p)]));
        const actual=props.some(p=>{
          if(p.startsWith('border')&&p.endsWith('color')&&(!parseFloat(css.borderTopWidth)||css.borderTopStyle==='none'))return false;
          if((p==='fill'||p==='stroke')&&el.namespaceURI!=='http://www.w3.org/2000/svg')return false;
          return eq(p,expected,computed[p],css.fontSize);
        });
        return {tag:el.localName,computed,matches:actual};
      });
      const representative=name.startsWith('type.')||name==='color.text.primary'?document.body:null;
      const rendered=name==='type.size.heading'?[...document.querySelectorAll('h1,h2')].find(visible):representative;
      let sample=null;
      if(rendered){
        const css=getComputedStyle(rendered),property=props[0],actual=css.getPropertyValue(property);
        sample={tag:rendered.localName,property,actual,matches:eq(property,expected,actual,css.fontSize)};
      }
      return {token:name,expected,declared,declarationMatches,locked,uses,sample};
    });
    const sample=node=>{if(!node)return null;const c=getComputedStyle(node);return {fontFamily:c.fontFamily,fontSize:c.fontSize,color:c.color,background:c.backgroundColor};};
    return {entries,body:sample(document.body),heading:sample([...document.querySelectorAll('h1,h2')].find(visible))};
  }finally{probe.remove();}
}

async function accessibility(cdp,rootId,selector){
  const {nodeId}=await cdp.sendCommand('DOM.querySelector',{nodeId:rootId,selector});
  if(!nodeId)throw Error('主控件已离开 DOM');
  const {nodes}=await cdp.sendCommand('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});
  const ax=nodes[0];
  return {name:ax?.name?.value??'',role:ax?.role?.value??'',ignored:ax?.ignored??true,
    disabled:ax?.properties?.some(p=>p.name==='disabled'&&p.value?.value===true)??false};
}
const interactive=new Set(['button','link','textbox','searchbox','combobox','checkbox','radio','switch','tab','option','menuitem',
  'menuitemcheckbox','menuitemradio','slider','spinbutton','treeitem','listbox','DisclosureTriangle','togglebutton']);
const compact=s=>s.normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
const operationRoles={fill:new Set(['textbox','searchbox','combobox','spinbutton']),select:new Set(['combobox','listbox']),click:interactive};
export function conflictsWithLocks(suggestion,requirements){
  return Boolean(suggestion.overridesRequirements?.length||requirements?.tokenLocks.some(lock=>suggestion.changesTokens?.includes(lock.token)));
}
export async function inspectContract(wc,contract,device,screenshot,signal){
  const {experiencePlan:plan,designSystem,requirements}=contract;
  const states=[],findings=[],byId=new Map(plan.states.map(s=>[s.id,s]));
  const report={contractId:contract.id,directionId:contract.directionId,states,findings,passed:false};
  const visited=new Set(),observedLocks=new Set();
  let state=byId.get('initial'),lastObservation=null,ownsDebugger=false;
  const inspect=s=>evaluate(wc,inspectRegion,{id:s.id,actionId:s.primaryAction.id});
  try{
    if(!wc.debugger.isAttached()){wc.debugger.attach('1.3');ownsDebugger=true;}
    while(!visited.has(state.id)){
      signal.throwIfAborted();visited.add(state.id);
      const a=state.primaryAction,next=byId.get(a.nextState);
      let view=await inspect(state);
      const row={stateId:state.id,userGoal:state.purpose,primaryInformation:state.priority[0],actionId:a.id,operation:a.operation,
        expectedName:state.controls[0],prerequisites:state.prerequisites,nextState:next.id,expectedText:a.expectedText,passed:false};
      states.push(row);
      // Async completion may precede the driver's second observation of the loading state.
      if(!view.visible&&!(a.operation==='wait'&&view.count===0&&lastObservation?.stateId===state.id))throw Error('业务状态缺失或重复 '+state.id);
      if(view.visible){
        if(a.operation!=='wait'){
          row.captureTiming=await evaluate(wc,settleStateFrame,{id:state.id,budgetMs:700});
          view=await inspect(state);
          if(!view.visible||row.captureTiming.status==='state-changed')throw Error('截图前业务状态已切换 '+state.id);
        }else row.captureTiming={status:'transient'};
        row.before=view;
        const shot=await screenshot(device+'-state-'+state.id);
        if(!(await inspect(state)).visible)row.captureUncertain={...shot,reason:'state changed during capture'};
        else if(row.captureTiming.status==='timeout')row.captureUncertain={...shot,reason:'frame did not settle within capture budget'};
        else row.screenshot=shot;
        if(!view.information?.inViewport)findings.push({state:state.id,kind:view.information?'priority-below-fold':'information-unverified',severity:'review'});
        if(view.viewport.scrollWidth>view.viewport.width+2)throw Error('状态出现横向溢出 '+state.id);
        row.styles=await evaluate(wc,styles,{tokens:designSystem.tokens,locks:requirements.tokenLocks});
        for(const token of row.styles.entries){
          if(token.uses.length)observedLocks.add(token.token);
          if(!token.declarationMatches||token.uses.some(u=>!u.matches))
            findings.push({state:state.id,kind:'token-deviation',token:token.token,severity:token.locked?'block':'review'});
          if(token.sample&&!token.sample.matches)findings.push({state:state.id,kind:'rendered-style-deviation',token:token.token,severity:'review'});
        }
      }else row.transientDOM=lastObservation;
      const prior=await inspect(next);
      await evaluate(wc,watchTransition,{id:next.id,expectedText:a.expectedText});
      if(a.operation!=='wait'){
        // Re-read after capture: lists can re-render before input. Repeated rows share an action ID.
        const current=await inspect(state),matches=[];
        const {root}=await wc.debugger.sendCommand('DOM.getDocument',{depth:0});
        for(const control of current.actions??[]){
          const ax=await accessibility(wc.debugger,root.nodeId,control.selector);
          if(!ax.ignored&&operationRoles[a.operation]?.has(ax.role)&&compact(ax.name)===compact(row.expectedName))
            matches.push({control,ax});
        }
        row.actionMatch={visible:current.actionCount??0,matching:matches.length};
        if(!matches.length)throw Error('状态内找不到角色及可访问名称符合契约的主操作 '+state.id);
        if(matches.length>1)throw Error('状态内有多个角色及可访问名称相同的主操作 '+state.id);
        const {control,ax}=matches[0];
        row.accessibility=ax;
        if(control.disabled||ax.disabled)throw Error('状态内匹配的主操作已禁用 '+state.id);
        row.actionMatch.selector=control.selector;
        row.control=await applyStep(wc,a,control.selector,{},true);
      }
      let observed=null;
      for(let i=0;i<45;i++){
        const after=await inspect(next);
        const alreadyAdvanced=a.operation==='wait'&&!view.visible;
        if(after.visible&&after.text.includes(a.expectedText)&&(!prior.visible||prior.text!==after.text||alreadyAdvanced)){
          observed={text:after.text,via:'visible-region'};break;
        }
        const transient=await wc.executeJavaScript('window.__surfaceObservation?.sample');
        if(transient&&(!prior.visible||prior.text!==transient.text||alreadyAdvanced)){
          observed={...transient,via:'dom-mutation'};break;
        }
        await delay(65);
      }
      if(!observed)throw Error('未观察到目标状态及业务结果 '+next.id+' / '+a.expectedText);
      row.result={...observed,stateId:next.id};row.passed=true;lastObservation=row.result;state=next;
    }
  }catch(error){signal.throwIfAborted();report.error=String(error.message);}
  finally{
    if(!wc.isDestroyed())await wc.executeJavaScript('window.__surfaceObservation?.observer?.disconnect()').catch(()=>{});
    if(ownsDebugger&&wc.debugger.isAttached())wc.debugger.detach();
  }
  for(const lock of requirements.tokenLocks)if(!observedLocks.has(lock.token))findings.push({kind:'locked-role-unobserved',token:lock.token,severity:'block'});
  report.unreached=plan.states.filter(s=>!visited.has(s.id)).map(s=>s.id);
  report.explicitRequirements=requirements.explicit.map(quote=>({quote,semanticAssessment:'requires-human',observedRelatedStates:states.filter(s=>s.passed&&byId.get(s.stateId).taskEvidence===quote).map(s=>s.stateId)}));
  report.passed=!report.error&&!report.unreached.length&&!findings.some(f=>f.severity==='block');
  return report;
}
