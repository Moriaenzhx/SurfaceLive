// All browser-side arguments are data. The test driver performs trusted pointer input on the rendered element.
function probe({selector,position}){
  const node=document.querySelector(selector);
  if(!node)return {visible:false};
  if(position)node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  const b=node.getBoundingClientRect(),style=getComputedStyle(node);
  const visible=b.width>0&&b.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)>0;
  const x=Math.round(b.left+b.width/2),y=Math.round(b.top+b.height/2);
  return {visible,text:(node.innerText??node.textContent??'').trim().slice(0,2000),x,y,
    hit:visible&&node.contains(document.elementFromPoint(x,y))&&!node.matches(':disabled,[aria-disabled=true]')};
}
async function observe(wc,selector,position=false){return wc.executeJavaScript('('+probe.toString()+')('+JSON.stringify({selector,position})+')');}
async function click(wc,selector){
  let target;
  for(let i=0;i<20;i++){
    target=await observe(wc,selector,true);
    if(target.hit)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!target.hit)throw Error('元素缺失、禁用或被遮挡 '+selector);
  wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:target.x,y:target.y});
  wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:target.x,y:target.y});
  return target.text;
}
// A candidate may repeat its date inline or inherit it from its own visible section heading.
export function matchesDatedSlot(root,{date,time}){
  const compact=text=>text.replace(/\s+/g,'').replace(/[–—~]/g,'-');
  const visible=node=>node.getClientRects().length>0&&node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
  const day=compact(date),range=compact(time);
  const inlineSlot=new RegExp('(?:^|[^0-9])'+day+range+'(?![0-9])');
  const headingSelector='h1,h2,h3,h4,h5,h6,[role="heading"]';
  const groupSelector='section,fieldset,[role="group"],[role="region"]';
  if(!root)return false;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let text=walker.nextNode();text;text=walker.nextNode()){
    const value=compact(text.data),node=text.parentElement;
    if(!value.includes(range)||!node||!visible(node))continue;
    // Preserve text such as “候选：11 月 24 日 09:00–11:00” while rejecting partial dates.
    const row=node.closest('article,li,tr,[role="row"],[role="listitem"]');
    if(node===root&&!root.childElementCount&&inlineSlot.test(value))return true;
    if(row&&root.contains(row)){
      const parts=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
      let label='';
      for(let part=parts.nextNode();part;part=parts.nextNode()){
        if(visible(part.parentElement))label+=part.data;
      }
      if(inlineSlot.test(compact(label)))return true;
    }
    if(value!==range||(!row&&!node.closest('time')))continue;
    const group=node.closest(groupSelector);
    if(!group||!root.contains(group))continue;
    const headings=[...group.querySelectorAll(headingSelector+',legend')].filter(h=>
      h.closest(groupSelector)===group&&visible(h)&&Boolean(h.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING));
    if(headings.length&&compact(headings.at(-1).innerText)===day)return true;
  }
  return false;
}
async function visibleResult(wc,selector,matches,slot){
  const slotProbe=slot?'('+matchesDatedSlot.toString()+')(document.querySelector('+JSON.stringify(selector)+'),'+JSON.stringify(slot)+')':null;
  for(let i=0;i<35;i++){
    const observed=await observe(wc,selector);
    if(observed.visible&&observed.text&&matches(observed.text)&&(!slotProbe||await wc.executeJavaScript(slotProbe)))return observed.text;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('预期的可见结果没有出现 '+selector);
}
export async function openIfNeeded(wc,target,opener){
  for(let i=0;i<20;i++){
    if((await observe(wc,target,true)).hit)return null;
    if((await observe(wc,opener,true)).hit)return {opened:opener,label:await click(wc,opener),target};
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('操作和前置入口均不可用 '+target+' / '+opener);
}
export async function primaryAction(wc){
  const output='[data-testid="action-feedback"]',before=(await observe(wc,output)).text||'';
  try{
    const label=await click(wc,'[data-testid="primary-action"]');
    const after=await visibleResult(wc,output,text=>text!==before);
    return {action:true,label,before,after};
  }catch(error){return {action:false,before,after:(await observe(wc,output)).text,reason:error.message};}
}
export async function applyStep(wc,step,selector,diagnostics,verifyHit=false){
  if(step.operation==='select'){
    if(verifyHit&&!(await observe(wc,selector,true)).hit)throw Error('选择框被遮挡或禁用');
    // Set the option on the real native control and notify the page just as a keyboard selection would.
    const select=({selector,value})=>{
      const node=document.querySelector(selector);
      if(!(node instanceof HTMLSelectElement)||node.disabled||!node.getClientRects().length)throw Error('选择框不可用');
      const option=[...node.options].find(o=>!o.disabled&&(o.value===value||o.label===value));
      if(!option)throw Error('没有此选项 '+value);
      node.value=option.value;
      for(const type of ['input','change'])node.dispatchEvent(new Event(type,{bubbles:true}));
      return option.label;
    };
    return wc.executeJavaScript('('+select.toString()+')('+JSON.stringify({selector,value:step.value})+')');
  }
  const label=await click(wc,selector);
  if(step.operation==='fill'){
    const hasFocus='Boolean(document.querySelector('+JSON.stringify(selector)+')?.contains(document.activeElement))';
    let focused=false;
    for(let i=0;i<20&&!focused;i++){
      focused=await wc.executeJavaScript(hasFocus);
      if(!focused)await new Promise(resolve=>setTimeout(resolve,50));
    }
    if(!focused)throw Error('输入目标未取得焦点 '+selector);
    wc.selectAll();
    await wc.insertText(step.value);
    // Masked inputs and committed chips may transform/clear their value. The business outcome is authoritative.
    diagnostics.inputValueMatched=await wc.executeJavaScript('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');return (n?.value??n?.textContent)==='+JSON.stringify(step.value)+'})()');
  }
  return label;
}
export async function businessJourney(wc,steps,prepareStep){
  const results=[];
  for(const step of steps){
    let navigation;
    const diagnostics={};
    try{
      const target='[data-task="'+step.id+'"]';
      navigation=step.opener?await openIfNeeded(wc,target,'[data-task="'+step.opener.id+'"]'):await prepareStep?.(wc,step);
      const state='[data-state="'+step.state+'"]',before=await observe(wc,state);
      const button=await applyStep(wc,step,target,diagnostics);
      const dateTime=step.contains.match(/^(\d{1,2}\s*月\s*\d{1,2}\s*日)\s*(\d{2}:\d{2}\s*[–—~-]\s*\d{2}:\d{2})$/u);
      const slot=dateTime?{date:dateTime[1],time:dateTime[2]}:null;
      const text=await visibleResult(wc,state,value=>(slot!==null||value.includes(step.contains))&&
        (!step.requireChange||!before.visible||value!==before.text),slot);
      results.push({step:step.id,operation:step.operation||'click',button,before:before.visible?before.text:null,
        text,...diagnostics,...(slot?{matchedDateTime:slot}:{}),changed:!before.visible||before.text!==text,passed:true,...(navigation?{navigation}:{})});
    }catch(error){results.push({step:step.id,passed:false,reason:error.message,...diagnostics,...(navigation?{navigation}:{})});break;}
  }
  if(results.length&&results.length===steps.length&&results.every(r=>r.passed&&!r.changed))
    results[results.length-1]={...results.at(-1),passed:false,reason:'业务流程没有产生可见状态变化'};
  return results;
}
export function functionalPass(check){
  return !!(check.fits&&check.action&&check.screenshot&&!check.error&&!check.screenshotError&&
    check.errors.length===0&&check.viewport.width===check.requestedViewport.width&&check.viewport.height===check.requestedViewport.height&&
    check.journey?.every(step=>step.passed));
}
