const providerNames={codex:'Codex',claude:'Claude Code'};
const effortNames={'':'默认',minimal:'精简',low:'低',medium:'中',high:'高',xhigh:'更高',max:'最大',ultra:'Ultra'};
const properties=[['布局',[['width','宽度',4096],['height','高度',4096]]],['排版',[['font-size','字号',256]]],['外观',[['color','文字颜色'],['background-color','背景色'],['border-radius','圆角',512]]],['间距',[['padding-inline','水平内距',512],['padding-block','垂直内距',512]]]];
let agentPrefs={},references=[],edits={},picked=null,picking='',hoverSequence=0,agentKey='',threadKey='',refLoad=0;
const editKey=()=> 'style-draft:'+draftScope();
const refsKey=()=> 'references:'+draftScope();
const editList=()=>Object.entries(edits).map(([selector,values])=>({selector,values}));
const prefsKey=()=> 'conversation-agent:'+(current()?.project||draftScope());
const db=new Promise((resolve,reject)=>{
  const req=indexedDB.open('studio-drafts',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('references');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
async function referenceStore(action,key,value){
  const database=await db;
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('references',action==='get'?'readonly':'readwrite'),store=tx.objectStore('references');
    const req=action==='put'?store.put(value,key):store[action](key);
    tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);
  });
}
function forgetReferences(){referenceStore('delete',refsKey()).catch(e=>notice(e.message));}
function saveReferences(){
  ++refLoad;drawReferences();
  if(activeEntry&&!activeEntry.revision){activeEntry.hasReferences=!!references.length;persistTabs();}
  referenceStore('put',refsKey(),references).catch(e=>notice(e.message));
}
function readLocal(key,otherwise){try{return JSON.parse(localStorage.getItem(key))||otherwise;}catch{return otherwise;}}
function resetEditor(){if(inspectorOpenedBySelection)showPanel('right',false,false);stopCrop();++hoverSequence;++refLoad;picked=null;setPicking('');references=[];edits={};threadKey='';$('highlight').hidden=true;$('selected-outline').hidden=true;}
function restoreEditor(){
  edits=readLocal(editKey(),{});const token=++refLoad;
  referenceStore('get',refsKey()).then(value=>{if(token===refLoad){references=value||[];drawReferences();}}).catch(e=>notice(e.message));
  drawReferences();drawFields();
}
function loadAgentPrefs(){
  const legacy=localStorage.getItem('agent')||'codex';
  const r=current(),base=readLocal('last-agent',{agent:legacy,model:localStorage.getItem('model:'+legacy)||''}),saved=readLocal(prefsKey(),{});
  const previous=r?.agent && r.agent!=='manual' && !r.sample?{agent:r.agent,model:r.model||'',effort:r.effort||''}:{};
  agentPrefs={agent:'codex',model:'',effort:'',...base,...previous,...saved};
  if(!data.agents[agentPrefs.agent])agentPrefs.agent=Object.keys(data.agents).find(k=>data.agents[k])||'codex';
  agentKey='';
}
function storeAgent(){
  localStorage.setItem(prefsKey(),JSON.stringify(agentPrefs));localStorage.setItem('last-agent',JSON.stringify(agentPrefs));
  localStorage.setItem('options:'+agentPrefs.agent,JSON.stringify(agentPrefs));updateGenerate();drawAgent();
}
const popovers = [['agent-pop','agent-trigger'], ['history-pop','history-menu'], ['zoom-pop','zoom']];
function closeMenus(){
  $('model-browser').hidden=true;
  $('model-picker').setAttribute('aria-expanded','false');
  for(const [panel,trigger] of popovers){
    $(panel).hidden=true;
    $(trigger).setAttribute('aria-expanded','false');
  }
}
for(const [panel,trigger] of popovers){
  $(trigger).onclick=()=>{
    const open=$(panel).hidden;
    closeMenus();
    $(panel).hidden=!open;
    $(trigger).setAttribute('aria-expanded',String(open));
  };
  $(trigger).onkeydown=e=>{
    if(e.key!=='ArrowDown')return;
    e.preventDefault();
    if($(panel).hidden)$(trigger).click();
    $(panel).querySelector('button:not(:disabled),input:not(:disabled)')?.focus();
  };
}
document.addEventListener('click',e=>{
  const path=e.composedPath();
  if(!popovers.some(([panel,trigger])=>path.includes($(panel))||path.includes($(trigger))))closeMenus();
});
document.addEventListener('focusin',e=>{
  const open=popovers.find(([panel])=>!$(panel).hidden);
  if(open && !$(open[0]).contains(e.target) && !$(open[1]).contains(e.target))closeMenus();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||$('settings-dialog').open)return;
  if(!$('model-browser').hidden){
    e.stopImmediatePropagation();$('model-browser').hidden=true;$('model-picker').setAttribute('aria-expanded','false');$('model-picker').focus();return;
  }
  const open=popovers.find(([panel])=>!$(panel).hidden);
  if(open){e.stopImmediatePropagation();closeMenus();$(open[1]).focus();}
},true);
function drawAgent(){
  const {agent,model,effort}=agentPrefs,available=data.agents[agent];
  $('agent-summary').textContent=(providerNames[agent]||'Codex')+(model?' · '+model:'')+(effort?' · '+effortNames[effort]:'');
  $('connection').textContent=available?'':'离线';$('connection').classList.toggle('online',!!available);
  $('connection').title=available?'已检测到本机可执行文件，账户权限随生成请求确认。':'安装并登录 CLI 后，在菜单中重新检测。';
  $('agent-trigger').title='选择 Agent 和模型 · '+$('agent-summary').textContent+' · '+(available?'本机 CLI 可用':'未检测到本机 CLI');
  $('agent-trigger').setAttribute('aria-label',$('agent-trigger').title);
  const key=JSON.stringify([agentPrefs,data.agents,data.models]);
  if(key===agentKey)return;agentKey=key;
  const list=$('agent-list');list.replaceChildren();
  for(const [id,name] of Object.entries(providerNames)){
    const b=element('button',null,'agent-option');b.dataset.agent=id;b.disabled=!data.agents[id];b.setAttribute('aria-pressed',String(id===agent));
    const word=element('span');word.append(element('strong',name),element('small',data.agents[id]?'已检测到本机 CLI':'未安装或未找到'));
    b.append(word);if(id===agent)b.append(icon('check'));
    b.onclick=()=>{agentPrefs={model:'',effort:'',...readLocal('options:'+id,{}),agent:id};storeAgent();list.querySelector('[aria-pressed="true"]')?.focus();};list.append(b);
  }
  const catalog=data.models?.[agent]||[];
  $('model-picker').firstElementChild.textContent=model||'CLI 默认模型';
  const custom=model && !catalog.some(m=>m.name===model);
  $('model').hidden=!custom;$('model').value=model||'';
  const levels=catalog.find(m=>m.name===model)?.efforts||['low','medium','high'];
  const choices=[...new Set(['',...levels,effort||''])],group=$('effort');group.replaceChildren();
  for(const level of choices){
    const b=element('button',effortNames[level]||level);b.dataset.effort=level;b.setAttribute('aria-pressed',String(level===(effort||'')));
    b.onclick=()=>{agentPrefs.effort=level;storeAgent();group.querySelector('[aria-pressed="true"]')?.focus();};group.append(b);
  }
  drawModels();
}
function drawModels(){
  const host=$('model-results'),query=$('model-search').value.trim().toLowerCase(),catalog=data.models?.[agentPrefs.agent]||[];host.replaceChildren();
  for(const name of ['',...catalog.map(m=>m.name),'@custom']){
    const label=name==='@custom'?'自定义模型…':name||'CLI 默认模型';
    if(name!=='@custom' && query && !label.toLowerCase().includes(query))continue;
    const b=element('button',label);b.dataset.model=name;b.setAttribute('aria-pressed',String((agentPrefs.model||'')===name));b.onclick=()=>{
      $('model-browser').hidden=true;$('model-picker').setAttribute('aria-expanded','false');
      if(name==='@custom'){$('model').hidden=false;$('model').value=agentPrefs.model||'';$('model').focus();return;}
      agentPrefs.model=name;agentPrefs.effort='';storeAgent();$('model-picker').focus();
    };host.append(b);
  }
}
$('model-picker').onclick=()=>{const open=$('model-browser').hidden;$('model-browser').hidden=!open;$('model-picker').setAttribute('aria-expanded',String(open));if(open){$('model-search').value='';drawModels();$('model-search').focus();}};
$('model-search').oninput=drawModels;
$('model').onchange=e=>{agentPrefs.model=e.target.value.trim();agentPrefs.effort='';storeAgent();};

function drawThread(){
  const r=current(),key=JSON.stringify([selected,data.job?.info?.token||data.job?.token,data.job?.phase]);
  if(key===threadKey)return;threadKey=key;const host=$('thread-content');host.replaceChildren();
  if(!activeEntry)return;
  let root=r;const chain=[],seen=new Set();
  while(root && !seen.has(root.id)){chain.unshift(root);seen.add(root.id);root=data.revisions.find(v=>v.id===root.parent);}
  const first=chain[0];
  if(first?.sample){
    const origin=element('div',null,'request-origin');
    origin.append(element('h3','初始需求'),element('small','内置示例'));
    host.append(origin,element('p',first.description,'original-request'));
  }
  for(const v of chain.filter(v=>!v.sample)){
    const message=element('div',null,'thread-message');
    message.append(element('small','你'),element('p',v.change||v.description,'user-message'));host.append(message);
    const refs=element('div',null,'past-references');
    for(const [index,ref] of (v.references||[]).entries()){
      const reuse=element('button');reuse.title='再次引用 '+ref.name;reuse.setAttribute('aria-label',reuse.title);reuse.disabled=!!data.job;
      if(ref.thumbnail){const img=element('img');img.src=ref.thumbnail;img.alt=ref.name;reuse.append(img);}else reuse.append(element('span',ref.name));
      reuse.onclick=async()=>{
        const id=selected;
        try{
          if(ref.kind==='image'){const data=await window.studio.reference(v.id,index);if(id===selected)addRef({kind:'image',name:ref.name,data});}
          else if(await window.studio.inspect(id,'locate',ref)){if(id===selected)addRef(ref);}
          else notice('当前版本已没有这个元素，请重新选取。');
        }catch(e){notice(e.message);}
      };refs.append(reuse);
    }
    if(refs.childElementCount)host.append(refs);
    const result=element('p',(v.agent==='manual'?'已保存样式':(providerNames[v.agent]||'Agent')+(v.parent?' 已更新页面':' 已生成页面'))+' · ','agent-message');
    const version=element('button',revisionLabel(v));version.disabled=!!data.job;version.onclick=()=>selectVersion(v.id);result.append(version);host.append(result);
  }
  if(data.job)host.append(element('p',data.job.phase==='checking'?'正在检查页面…':'正在处理本轮修改…','agent-message'));
  if(!data.job && r?.sample){
    const group=element('details',null,'prompt-suggestions');
    group.append(element('summary','修改建议'));
    const suggestions=[
      ['调整页面层级','把页面的主操作放到更明显的位置，降低次要信息的视觉权重。'],
      ['优化手机布局','在手机上重新安排信息顺序，确保主要操作单手可达。']
    ];
    for(const [label,text] of suggestions){
      const b=element('button');
      b.append(element('span',label),icon('prompt'));b.onclick=()=>usePrompt(text);group.append(b);
    }
    host.append(group);
  }
  if(chain.some(v=>!v.sample))$('thread').scrollTop=$('thread').scrollHeight;
}
function drawReferences(){
  const host=$('attachments');host.replaceChildren();$('selection-context').hidden=!picked||references.some(ref=>ref.selector===picked.selector);
  references.forEach((ref,index)=>{
    const chip=element('div',null,'ref-chip');if(ref.kind==='image'){const img=element('img');img.src=ref.data;img.alt=ref.name;chip.append(img);}else chip.append(icon('select'));
    chip.append(element('span',ref.name));const remove=element('button');remove.append(icon('close'));remove.title='移除 '+ref.name;remove.setAttribute('aria-label',remove.title);remove.disabled=!!data.job;remove.onclick=()=>{references.splice(index,1);saveReferences();};chip.append(remove);host.append(chip);
  });
}
function addRef(ref){
  if(data.job)return;
  if(references.length>=8){notice('每条消息最多可带 8 项参考');return;}
  if(ref.kind==='element' && references.some(r=>r.selector===ref.selector))return;
  references.push(ref);saveReferences();focusComposer();
}
async function addFiles(files){
  const key=refsKey();
  for(const file of files){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){notice('请选择 PNG、JPEG 或 WebP 图片');continue;}
    try{
      const bitmap=await createImageBitmap(file);const f=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*f));canvas.height=Math.max(1,Math.round(bitmap.height*f));
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      if(refsKey()===key)addRef({kind:'image',name:file.name||'粘贴的截图',data:canvas.toDataURL('image/jpeg',.86)});
    }catch{notice('这张图片暂时无法读取');}
  }
}
$('attach').onclick=()=>{closeMenus();$('image-input').click();};
$('image-input').onchange=async e=>{await addFiles([...e.target.files]);e.target.value='';};
$('compose').addEventListener('paste',e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();void addFiles(files);}});
$('compose').ondragover=e=>{e.preventDefault();$('drop-zone').classList.add('drag-over');};
$('compose').ondragleave=()=>$('drop-zone').classList.remove('drag-over');
$('compose').ondrop=e=>{e.preventDefault();$('drop-zone').classList.remove('drag-over');void addFiles([...e.dataTransfer.files]);};
function frameRect(){const frame=$('preview').getBoundingClientRect(),canvas=$('canvas').getBoundingClientRect();const x=Math.max(frame.x,canvas.x),y=Math.max(frame.y,canvas.y);return {x,y,width:Math.min(frame.right,canvas.right)-x,height:Math.min(frame.bottom,canvas.bottom)-y};}
const cropLayer=$('crop-layer'), cropBox=$('crop-box');
let cropSession=null;
function stopCrop(){
  const pointer=cropSession?.pointer;
  cropSession=null;
  if(pointer!=null && cropLayer.hasPointerCapture(pointer))cropLayer.releasePointerCapture(pointer);
  cropLayer.hidden=true;cropBox.hidden=true;delete $('frame-clip').dataset.crop;
  $('capture').setAttribute('aria-pressed','false');
}
$('capture').onclick=()=>{
  if(!current()||data.job)return;
  closeMenus();setPicking(picking==='crop'?'':'crop');
};
function cropPoint(event,bounds){
  return {x:Math.max(bounds.x,Math.min(bounds.x+bounds.width,event.clientX)),
    y:Math.max(bounds.y,Math.min(bounds.y+bounds.height,event.clientY))};
}
function dragRect(event,session){
  const end=cropPoint(event,session.bounds),start=session.start;
  return {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};
}
cropLayer.onpointerdown=event=>{
  const session=cropSession;
  if(!session || session.reading || session.pointer!=null || !event.isPrimary || event.button!==0)return;
  event.preventDefault();session.bounds=frameRect();session.start=cropPoint(event,session.bounds);
  session.pointer=event.pointerId;cropLayer.setPointerCapture(event.pointerId);
};
cropLayer.onpointermove=event=>{
  if(cropSession?.pointer!==event.pointerId)return;
  const rect=dragRect(event,cropSession),layer=cropLayer.getBoundingClientRect();
  Object.assign(cropBox.style,{left:rect.x-layer.x+'px',top:rect.y-layer.y+'px',width:rect.width+'px',height:rect.height+'px'});
  cropBox.hidden=false;$('frame-clip').dataset.crop='dragging';
};
cropLayer.onpointerup=async event=>{
  const session=cropSession;
  if(session?.pointer!==event.pointerId)return;
  const rect=dragRect(event,session);session.pointer=null;
  cropLayer.releasePointerCapture(event.pointerId);cropBox.hidden=true;
  if(rect.width<3 || rect.height<3){$('frame-clip').dataset.crop='ready';return;}
  session.reading=true;$('frame-clip').dataset.crop='reading';
  try{
    // Paint the unobstructed preview before Electron reads its compositor surface.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(cropSession!==session)return;
    const image=await window.studio.capture(rect);
    if(cropSession===session)addRef({kind:'image',name:'框选截图 · '+devices[view][2],data:image});
  }catch(error){if(cropSession===session)notice(error.message);}
  finally{if(cropSession===session)setPicking('');}
};
function cancelCrop(){if(picking==='crop')setPicking('');}
cropLayer.onpointercancel=cancelCrop;
cropLayer.onlostpointercapture=e=>{if(cropSession?.pointer===e.pointerId)cancelCrop();};
cropLayer.onwheel=e=>e.preventDefault();
window.addEventListener('blur',cancelCrop);
window.addEventListener('resize',cancelCrop);
$('canvas').addEventListener('scroll',cancelCrop);
function renderEditor(){
  const busy=!!data.job,has=!!current()&&previewState==='ready';if(busy)setPicking('');
  for(const id of ['pick','start-pick','pick-chat','capture','mode-preview'])$(id).disabled=!has||busy;
  for(const id of ['attach','save-edit','discard','cite','capture-element','parent','deselect'])$(id).disabled=busy;
  $('selection-context').hidden=!picked||references.some(ref=>ref.selector===picked.selector);
  if(picked)$('selection-context').replaceChildren(icon('reference'),element('span','引用选区 · '+picked.label));
  $('selection-context').disabled=busy;$('style-fields').querySelectorAll('input,select').forEach(input=>input.disabled=busy);
  $('edit-actions').hidden=!editList().length;updateFileStatus();
  $('pick-layer').hidden=!picking||picking==='crop';
  $('selected-outline').hidden=!picked;if(picked)updateOutline();$('page-properties').hidden=!!picked;$('element-properties').hidden=!picked;
}
function setPicking(mode){
  stopCrop();picking=mode;++hoverSequence;
  if(mode==='crop'){cropSession={pointer:null};cropLayer.hidden=false;$('frame-clip').dataset.crop='ready';$('capture').setAttribute('aria-pressed','true');}
  $('pick-layer').hidden=!mode||mode==='crop';$('highlight').hidden=true;
  $('pick-chat').setAttribute('aria-pressed',String(mode==='chat'));
  $('pick').setAttribute('aria-pressed',String(mode==='style'||mode==='chat'));
  $('mode-preview').setAttribute('aria-pressed',String(!mode&&!!current()));
  previewStatus();
}
function beginPick(mode){
  if(!current()||data.job)return;
  closeMenus();
  if(mode==='style' && (!railPrefs.right || document.body.classList.contains('focus'))){
    const temporary=!railPrefs.right;
    showPanel('right',true,false);
    inspectorOpenedBySelection=temporary;
  }
  selectTab('compose');setPicking(mode);
}
function leaveSelection(){
  picked=null;
  setPicking('');
  if(inspectorOpenedBySelection)showPanel('right',false,false);
  renderEditor();
}
$('start-pick').onclick=()=>beginPick('style');
$('mode-preview').onclick=()=>{leaveSelection();$('preview').focus();};
$('pick').onclick=()=>picking==='style'?leaveSelection():beginPick('style');
$('selection-context').onclick=()=>{cite();$('selection-context').hidden=true;};
$('pick-chat').onclick=()=>picking==='chat'?setPicking(''):beginPick('chat');
function position(e){
  const rect=$('preview').getBoundingClientRect(),[w,h]=devices[view];return {x:(e.clientX-rect.x)*w/rect.width,y:(e.clientY-rect.y)*h/rect.height};
}
function paintBox(result){
  const box=$('highlight');box.hidden=!result||!picking;if(box.hidden)return;
  const factor=$('preview').getBoundingClientRect().width/devices[view][0],r=result.rect;
  Object.assign(box.style,{left:r.x*factor+'px',top:r.y*factor+'px',width:r.width*factor+'px',height:r.height*factor+'px'});box.firstElementChild.textContent=result.tag;
}
async function refreshHighlight(){if(!picked||!picking)return;const id=selected;try{const r=await window.studio.inspect(id,'locate',picked);if(id===selected)paintBox(r);}catch{}}
$('pick-layer').onpointermove=async e=>{const n=++hoverSequence;try{const target=await window.studio.inspect(selected,'pick',position(e));if(n===hoverSequence)paintBox(target);}catch{}};
$('pick-layer').onpointerleave=()=>{++hoverSequence;$('highlight').hidden=true;};
$('pick-layer').onwheel=e=>{e.preventDefault();window.studio.inspect(selected,'scroll',{...position(e),dx:e.deltaX,dy:e.deltaY}).catch(()=>{});};
function cite(){if(picked)addRef({kind:'element',name:picked.tag+' · '+picked.label,selector:picked.selector});}
$('cite').onclick=cite;
$('pick-layer').onclick=async e=>{
  const mode=picking,id=selected;
  try{const result=await window.studio.inspect(id,'pick',position(e));if(!result||!mode||mode!==picking||id!==selected)return;
    picked=result;if(mode==='chat'){setPicking('');cite();}else paintBox(null);drawFields();renderEditor();
  }catch(err){notice(err.message);}
};
$('parent').onclick=async()=>{try{const parent=await window.studio.inspect(selected,'parent',picked);if(parent){picked=parent;drawFields();renderEditor();}else notice('已到页面最外层');}catch(e){notice(e.message);}};
$('deselect').onclick=leaveSelection;
function applyDraft(){const id=selected;return id?window.studio.inspect(id,'style',editList()):Promise.resolve();}
function changeProperty(key,value){
  const values=edits[picked.selector]||{};
  if(value===null)delete values[key];else values[key]=value;
  if(Object.keys(values).length)edits[picked.selector]=values;else delete edits[picked.selector];
  localStorage.setItem(editKey(),JSON.stringify(edits));updateFileStatus();
  $('edit-actions').hidden=!editList().length;applyDraft().catch(e=>notice(e.message));
}
function propertyInput(key,label,max){
  const wrap=element('label'),unit=element('div',null,'unit-input'),input=element('input');
  wrap.append(element('span',label));input.dataset.property=key;input.setAttribute('aria-label',label);
  const draft=edits[picked.selector]?.[key],current=picked.values[key];
  if(!max){
    const color=element('input');color.type='color';color.setAttribute('aria-label','选择'+label);
    input.type='text';input.value=draft??current;input.maxLength=11;color.value=input.value.startsWith('#')?input.value.slice(0,7):'#ffffff';
    color.oninput=()=>{input.value=color.value;changeProperty(key,color.value);};
    input.onchange=()=>{const v=input.value.trim();if(!v||/^(#[a-f0-9]{6}([a-f0-9]{2})?|transparent)$/i.test(v)){changeProperty(key,v||null);input.value=v||current;color.value=input.value.startsWith('#')?input.value.slice(0,7):'#ffffff';}else{notice('请输入六位或八位十六进制颜色，或 transparent');input.value=edits[picked.selector]?.[key]??current;}};
    unit.classList.add('color-input');unit.append(color,input);
  }else{
    input.type='number';input.min='0';input.max=max;input.step='any';
    input.value=draft?.number??draft??(typeof current==='number'?current:'');input.placeholder=String(current);
    const units=element('select');units.setAttribute('aria-label',label+'单位');
    for(const value of (['width','height'].includes(key)?['px','%','rem']:['px','rem']))units.append(new Option(value,value));
    units.value=draft?.unit||'px';
    const update=()=>{if(input.validity.valid)changeProperty(key,input.value===''?null:units.value==='px'?input.valueAsNumber:{number:input.valueAsNumber,unit:units.value});};
    input.oninput=update;units.onchange=update;unit.append(input,units);
  }
  wrap.append(unit);return wrap;
}
function drawFields(){
  const host=$('style-fields');host.replaceChildren();if(!picked)return;
  $('element-type').textContent='<'+picked.tag+'>';$('element-name').textContent=picked.label;
  $('element-path').textContent=picked.ancestry.join(' › ');$('element-path').title=picked.selector;
  $('selected-outline').dataset.tag=picked.tag;
  for(const [title,fields] of properties){
    const section=element('section',null,'property-section'),grid=element('div',null,'input-grid');
    for(const [key,label,max] of fields)grid.append(propertyInput(key,label,max));
    section.append(element('h3',title),grid);host.append(section);
  }
  const section=element('section',null,'property-section'),list=element('dl',null,'interaction-data');
  for(const [name,value] of Object.entries(picked.interaction))list.append(element('dt',name),element('dd',value));
  section.append(element('h3','交互'),list);host.append(section);
}
$('discard').onclick=async()=>{try{edits={};localStorage.removeItem(editKey());await applyDraft();if(picked)picked=await window.studio.inspect(selected,'locate',picked);drawFields();renderEditor();}catch(e){notice(e.message);}};
$('save-edit').onclick=async()=>{try{await window.studio.saveEdit({base:selected,edits:editList()});}catch(e){notice(e.message);}};
$('frame-clip').addEventListener('load',async event=>{
  if(event.target!==$('preview'))return;
  if(selected&&editList().length)try{await applyDraft();}catch(e){notice(e.message);}
},true);

async function selectionRect(){
  if(!picked)return null;
  const id=selected,selector=picked.selector,result=await window.studio.inspect(id,'bounds',{selector});
  if(selected!==id||picked?.selector!==selector||!result)return null;
  const frame=$('preview').getBoundingClientRect(),scale=frame.width/devices[view][0],r=result.rect;
  return {x:r.x*scale,y:r.y*scale,width:r.width*scale,height:r.height*scale};
}
async function updateOutline(){
  const box=$('selected-outline');
  try{const r=await selectionRect();box.hidden=!r||picking==='crop';if(!box.hidden){
    box.classList.toggle('at-top',r.y<16);
    Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
  }}catch{box.hidden=true;}
}
setInterval(()=>{if(picked && !document.hidden)void updateOutline();},350);
$('capture-element').onclick=async()=>{
  const id=selected,target=picked;
  $('frame-clip').classList.add('capturing-element');
  try{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!target||picked!==target||selected!==id)return;
    const r=await selectionRect();if(!r)return;
    const frame=$('preview').getBoundingClientRect(),visible=frameRect();
    const x=Math.max(visible.x,frame.x+r.x),y=Math.max(visible.y,frame.y+r.y);
    const width=Math.min(visible.x+visible.width,frame.x+r.x+r.width)-x,height=Math.min(visible.y+visible.height,frame.y+r.y+r.height)-y;
    const data=await window.studio.capture({x,y,width,height});if(id===selected)addRef({kind:'image',name:'选区截图 · '+target.label,data});
  }catch(e){notice(e.message);}
  finally{$('frame-clip').classList.remove('capturing-element');}
};
const railWidths=readLocal('rail-widths',{});
function railLimits(side){
  const other=side==='left'?'.inspector':'.library';
  const windowWidth=document.documentElement.clientWidth,small=windowWidth<=1120;
  const min=side==='left'?(small?222:272):(small?208:244);
  const cap=side==='left'?(small?windowWidth*.26:312):(small?windowWidth*.24:304);
  const available=windowWidth-document.querySelector(other).getBoundingClientRect().width-352;
  return {min,max:Math.max(min,Math.min(cap,available))};
}
function resizeRails(side,width){
  const {min,max}=railLimits(side);
  const value=Math.max(min,Math.min(max,width));
  document.documentElement.style.setProperty('--'+side+'-rail',value+'px');
  railWidths[side]=value;localStorage.setItem('rail-widths',JSON.stringify(railWidths));
}
for(const divider of document.querySelectorAll('.rail-resize')){
  const side=divider.dataset.rail;
  const direction=()=>physicalSide(side)==='left'?1:-1;
  new ResizeObserver(()=>{
    const {min,max}=railLimits(side);
    divider.setAttribute('aria-valuemin',String(min));divider.setAttribute('aria-valuemax',String(Math.round(max)));
    divider.setAttribute('aria-valuenow',String(Math.round(divider.parentElement.getBoundingClientRect().width)));
  }).observe(divider.parentElement);
  if(railWidths[side])resizeRails(side,railWidths[side]);
  divider.onpointerdown=e=>{
    const start=e.clientX,width=divider.parentElement.getBoundingClientRect().width,sign=direction();divider.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    divider.onpointermove=move=>resizeRails(side,width+sign*(move.clientX-start));
    divider.onlostpointercapture=()=>{divider.onpointermove=null;document.body.classList.remove('resizing');};
  };
  divider.onkeydown=e=>{if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();resizeRails(side,divider.parentElement.getBoundingClientRect().width+direction()*(e.key==='ArrowLeft'?-12:12));}};
}
