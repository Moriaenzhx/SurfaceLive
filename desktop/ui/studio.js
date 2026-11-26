const $=id=>document.getElementById(id);
function icon(key) {
  const glyph = document.createElement('i');
  glyph.dataset.icon = key;
  return draw(glyph);
}
function draw(glyph) {
  glyph.setAttribute('aria-hidden', 'true');
  glyph.innerHTML = '<svg viewBox="0 0 16 16" focusable="false">' + actionIcons[glyph.dataset.icon] + '</svg>';
  return glyph;
}
function changeIcon(button, key) {
  const glyph = button.querySelector('[data-icon]');
  if (glyph.dataset.icon === key) return;
  glyph.dataset.icon = key;
  draw(glyph);
}
document.body.classList.toggle('mac', navigator.platform.startsWith('Mac'));
document.querySelectorAll('[data-icon]').forEach(draw);
const devices={desktop:[1440,900,'桌面'],tablet:[834,1112,'平板'],mobile:[390,844,'手机']};
const newPagePlaceholder=$('brief').placeholder;
let data={revisions:[],agents:{},job:null},selected=null,view='desktop',zoom='fit',tab='compose',lastToken='',directionSeq=0,timer,submitting=false;
let previewState='empty',previewIssue=null,previewTimer,exportedId=null;
const current=()=>data.revisions.find(r=>r.id===selected);
const draftScope=()=>selected||activeEntry?.key||'new';
const draftKey=()=> 'draft:'+draftScope();
function saveDraft(){localStorage.setItem(draftKey(),JSON.stringify({text:$('brief').value,target:$('target').value}));}
function notice(message,kind='error'){$('notice').textContent=message;$('notice').hidden=!message;$('notice').dataset.kind=kind;}
function element(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function loadVersion(id){
  closeMenus();resetEditor();switchPreviewFrame(id);selected=id;localStorage.setItem('selection',id||'');const r=current();
  if(!r && document.body.classList.contains('focus')){document.body.classList.remove('focus');layoutPanels();}
  let draft={};try{draft=JSON.parse(localStorage.getItem(draftKey()))||{};}catch{}
  $('brief').value=draft.text||'';$('target').value=draft.target||r?.target||'auto';
  restoreEditor();loadAgentPrefs();
  view=Object.hasOwn(devices,activeEntry?.view)?activeEntry.view:r?.direction.device||'desktop';
  zoom=Number.isFinite(activeEntry?.zoom)&&activeEntry.zoom>=10&&activeEntry.zoom<=300?activeEntry.zoom:'fit';
  notice('');render();scheduleDirection();
}
function drawHistory(){
  const history=$('versions');history.replaceChildren();
  const versions=data.revisions.filter(r=>current()&&r.project===current().project);
  for(const [i,r] of versions.entries()){
    const b=element('button',null,'version'+(r.id===selected?' active':''));b.disabled=!!data.job;
    b.append(element('b'),element('span',r.sample?'示例原版':'版本 '+(versions.length-i)),
      element('time',r.createdAt?new Date(r.createdAt).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}):''));
    if(r.id===selected)b.setAttribute('aria-current','true');
    b.onclick=()=>{selectVersion(r.id);$('history-menu').focus();};history.append(b);
  }
  $('history-menu').disabled=!versions.length||!!data.job;
}
function sizeFrame(){
  if(!current())return;
  const [w,h,label]=devices[view],box=$('canvas'),insets=getComputedStyle(box);
  const width=box.clientWidth-parseFloat(insets.paddingLeft)-parseFloat(insets.paddingRight);
  const height=box.clientHeight-parseFloat(insets.paddingTop)-parseFloat(insets.paddingBottom);
  const scale=zoom==='fit'?Math.min(1,width/w,height/h):zoom/100;
  const factor=Math.max(.1,scale),frame=$('preview');
  frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform='scale('+factor+')';
  $('frame-clip').style.width=Math.round(w*factor)+'px';$('frame-clip').style.height=Math.round(h*factor)+'px';
  $('dimensions').textContent=w+' × '+h;
  $('dimensions').title=label+'视口（CSS 像素）';
  $('scale').textContent=Number((factor*100).toFixed(1))+'%';
  $('zoom-label').textContent=zoom==='fit'?'适应窗口':zoom+'%';
  for(const b of document.querySelectorAll('[data-zoom]'))b.setAttribute('aria-pressed',String(b.dataset.zoom===String(zoom)));
  if(document.activeElement!==$('zoom-value'))$('zoom-value').value=Number((factor*100).toFixed(1));
}
function previewStatus(){
  const busy=previewState==='loading',failed=previewState==='error';
  $('preview-message').hidden=!busy&&!failed;$('preview-message').classList.toggle('failed',failed);
  $('preview-message-title').textContent=failed?'页面运行出错':'正在载入页面…';
  $('preview-detail').textContent=failed?[previewIssue.source,previewIssue.message].filter(Boolean).join(' · '):'';
  $('retry-preview').hidden=!failed;$('artboard').style.visibility=busy||failed?'hidden':'';
  const label={loading:'正在载入',error:'预览异常',empty:'等待生成',ready:'交互预览'}[previewState];
  $('canvas-status').textContent=picking==='crop'?'拖动框选截图 · Esc 取消':picking?'正在选择元素 · Esc 返回预览':label;
  document.querySelector('.status-dot').dataset.state=previewState;
}
function previewError(issue){
  if(issue.id!==selected){
    const parked=parkedPreviews.get(issue.id);if(parked)parked.issue=issue;
    return;
  }
  if(previewState==='error')return;
  clearTimeout(previewTimer);previewIssue=issue;previewState='error';setPicking('');previewStatus();renderEditor();
}
function loadPreview(url){
  previewState='loading';previewIssue=null;clearTimeout(previewTimer);const id=selected;
  previewTimer=setTimeout(()=>{if(selected===id&&previewState==='loading')previewError({id,source:'index.html',message:'载入超时，请重新载入或回到上一版本'});},10000);
  $('preview').src=url;previewStatus();
}
const blankFrame=$('preview').cloneNode(false);
const parkedPreviews=new Map();
function releaseClosedPreviews(){
  const opened=new Set(projectEntries.filter(entry=>entry.open).map(entry=>entry.revision));
  for(const [id,parked] of parkedPreviews)if(!opened.has(id)){
    parked.frame.remove();parkedPreviews.delete(id);
  }
}
function switchPreviewFrame(id){
  if(id===selected)return;
  clearTimeout(previewTimer);
  const frame=$('preview');
  if(selected && previewState==='ready'){
    frame.hidden=true;frame.removeAttribute('id');parkedPreviews.set(selected,{frame,issue:null});
  }else frame.remove();
  releaseClosedPreviews();
  const parked=parkedPreviews.get(id);
  if(parked){
    parkedPreviews.delete(id);parked.frame.id='preview';parked.frame.hidden=false;
  }else $('frame-clip').insertBefore(blankFrame.cloneNode(false),$('crop-layer'));
  previewIssue=parked?.issue||null;
  previewState=previewIssue?'error':parked?'ready':'empty';
}
$('frame-clip').addEventListener('load',async event=>{
  if(event.target!==$('preview'))return;
  const id=selected;if(!id||previewState!=='loading')return;
  try{
    const ready=await window.studio.inspect(id,'ready',{});
    if(id!==selected||previewState!=='loading')return;
    if(!ready){previewError({id,source:'index.html',message:'页面载入后没有可展示的内容'});return;}
    clearTimeout(previewTimer);previewState='ready';previewStatus();renderEditor();
  }catch(e){if(id===selected&&previewState==='loading')previewError({id,source:'index.html',message:e.message});}
},true);
window.studio?.onPreviewIssue(previewError);
window.addEventListener('message',event=>{
  const issue=event.data;
  const parked=parkedPreviews.get(issue?.id);
  const frame=parked?.frame||$('preview');
  if(event.source!==frame.contentWindow||event.origin!=='surface-page://'+(parked?issue.id:selected))return;
  if(!parked&&issue?.type==='surfacelive-preview-escape'&&document.body.classList.contains('focus')){
    toggleFocus();return;
  }
  if(issue?.type!=='surfacelive-preview-error'||(!parked&&issue.id!==selected))return;
  previewError({id:issue.id,source:String(issue.source).slice(0,180),message:String(issue.message).slice(0,400)});
});
$('retry-preview').onclick=()=>{if(selected)loadPreview('surface-page://'+selected+'/index.html');};
function preview(){
  const r=current();$('blank').hidden=!!r;$('artboard').hidden=!r;
  $('blank-title').textContent=activeEntry?'等待页面预览':'尚未打开作品';
  $('blank-description').textContent=activeEntry?'在项目对话中描述需求，生成的页面会显示在这里。':'点击上方的 ＋ 新建作品，也可以从项目对话中打开已有作品。';
  $('compose').hidden=!activeEntry;
  const frame=$('preview');
  if(r){const url='surface-page://'+r.id+'/index.html';if(frame.getAttribute('src')!==url)loadPreview(url);sizeFrame();}
  else{clearTimeout(previewTimer);previewState='empty';previewIssue=null;frame.removeAttribute('src');$('scale').textContent='';$('dimensions').textContent='';$('zoom-label').textContent='适应窗口';}
  previewStatus();
  $('mode-preview').setAttribute('aria-pressed',String(!!r&&!picking));
  document.querySelectorAll('[data-view]').forEach(b=>{b.disabled=!r;b.setAttribute('aria-pressed',String(!!r&&b.dataset.view===view));});
  $('measurements').hidden=!r;$('selection-help').hidden=!r;$('zoom').disabled=!r;$('focus').disabled=!r;
  if(r){$('page-width').textContent=devices[view][0];$('page-height').textContent=devices[view][1];}
  $('zoom-pop').querySelectorAll('[data-zoom],form input,form button').forEach(control=>control.disabled=!r);
}
function revisionLabel(r){
  if(!r)return '新页面';
  if(r.sample)return '示例原版';
  const versions=data.revisions.filter(v=>v.project===r.project);
  return '版本 '+(versions.length-versions.findIndex(v=>v.id===r.id));
}
function updateFileStatus(){
  const r=current(),dirty=editList().length>0,working=!!data.job;
  const status=$('save-state');
  status.textContent=dirty?'样式未保存':exportedId&&r?.id===exportedId?'源码已导出':working?'处理中':r&&!r.sample?'已保存':'';
  status.hidden=!status.textContent;
}
function render(){
  const r=current(),busy=!!data.job||submitting;renderProjectTabs();drawHistory();preview();
  $('new').disabled=busy;$('export').disabled=!r||busy;
  $('brief').placeholder=r?'说说想改哪里…':newPagePlaceholder;
  for(const id of ['brief','target','agent-trigger','refresh'])$(id).disabled=busy||!activeEntry;
  updateGenerate();renderEditor();drawAgent();drawThread();syncSettings();
  $('context').hidden=!r?.checks?.length;const info=$('revision-info');info.replaceChildren();
  for(const c of r?.checks||[])info.append(element('small',devices[c.device][2]+' · '+(c.fits?'宽度适配':'需检查宽度')+' / '+(c.action?'主操作通过':'主操作待核对'),'check'));
  $('progress').hidden=!data.job;
  if(data.job){$('phase').textContent={preparing:'正在检索设计知识',generating:'本机 Agent 正在生成',checking:'正在检查终端与交互'}[data.job.phase];updateTime();}updateFileStatus();
}
function updateGenerate(){updateFileStatus();$('generate').disabled=!activeEntry||!!data.job||submitting||!$('brief').value.trim()||!data.agents[agentPrefs.agent];}
function updateTime(){if(data.job)$('elapsed').textContent=Math.max(0,Math.floor((Date.now()-data.job.since)/1000))+' s';}
setInterval(updateTime,1000);
async function showDirection(){
  const seq=++directionSeq,r=current(),text=$('brief').value.trim();let ctx=r?.direction;
  if(text){try{ctx=await window.studio.direction(((r?.description||'')+' '+text).trim(),$('target').value);}catch{return;}}
  if(seq!==directionSeq)return;
  $('cards').replaceChildren();$('scene-summary').textContent=ctx?ctx.label+' · '+devices[ctx.device][2]:'输入需求后可查看场景和参考依据。';
  for(const c of ctx?.evidence||[]){const row=element('article');row.append(element('strong',c.title),element('p',c.note),element('small',c.url));$('cards').append(row);}
}
function scheduleDirection(){clearTimeout(timer);++directionSeq;timer=setTimeout(showDirection,160);}
function selectTab(next){
  tab=next;$('properties').hidden=tab!=='compose';$('evidence').hidden=tab!=='evidence';
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===tab));if(tab==='evidence')showDirection();
}
function applyState(next){
  data=next;
  const out=next.outcome;
  if(out && out.token!==lastToken){
    lastToken=out.token;localStorage.setItem('seen-outcome',lastToken);
    if(out.kind==='ready'){
      const revision=next.revisions.find(r=>r.id===out.id);
      const manual=revision?.agent==='manual';
      if(!manual){localStorage.removeItem(draftKey());forgetReferences();}
      if(manual){
        localStorage.setItem('draft:'+out.id,JSON.stringify({text:$('brief').value,target:$('target').value}));
        referenceStore('put','references:'+out.id,references).catch(e=>notice(e.message));
      }
      localStorage.removeItem(editKey());
      if(activeEntry && !activeEntry.revision && revision){
        // A generated draft becomes a project in the same slot.
        activeEntry.key=revision.project;activeEntry.revision=revision.id;delete activeEntry.number;delete activeEntry.hasReferences;
      }
      selectVersion(out.id);
      if(revision?.reviewStatus==='needs-human')notice('此版本待人工评审。'+(revision.reviewReason||''),'info');
    }
    else notice(out.message,out.kind==='cancelled'?'info':'error');
  }
  render();
}
async function start(){
  if($('generate').disabled)return;
  submitting=true;notice('');render();
  try{await window.studio.start({text:$('brief').value.trim(),base:selected,target:$('target').value,...agentPrefs,references:references.map(({preview,...ref})=>ref),edits:editList()});}
  catch(e){notice(e.message);}finally{submitting=false;render();}
}
function focusComposer(){showPanel('left',true);if(activeEntry)$('brief').focus();else $('projects').querySelector('button')?.focus();}
$('open-compose').onclick=focusComposer;
$('new').onclick=()=>newProjectTab();
$('generate').onclick=start;
$('cancel').onclick=async()=>{await window.studio.cancel();};
$('refresh').onclick=async()=>{try{await window.studio.refresh();}catch(e){notice(e.message);}};
$('brief').oninput=()=>{saveDraft();updateGenerate();scheduleDirection();};
$('target').onchange=()=>{saveDraft();scheduleDirection();};
$('export').onclick=async()=>{try{const id=editList().length?await window.studio.saveEdit({base:selected,edits:editList()}):selected;const path=await window.studio.export(id);if(path){exportedId=id;notice('源码已导出到 '+path,'success');updateFileStatus();}}catch(e){notice(e.message);}};
const storedPanels=readPanels();
const railPrefs={left:storedPanels.left??true,right:storedPanels.right??false};
let inspectorOpenedBySelection=false;
function readPanels(){try{return JSON.parse(localStorage.getItem('panel-visibility'))||{};}catch{return {};}}
const rootElement=document.documentElement;
rootElement.dataset.conversationSide=localStorage.getItem('conversation-side')==='right'?'right':'left';
function physicalSide(side){
  return rootElement.dataset.conversationSide==='left'?side:side==='left'?'right':'left';
}
function layoutPanels(){
  const {left,right}=railPrefs;
  const focus=document.body.classList.contains('focus');
  const layout=$('project-workspace'),first=$(physicalSide('left')==='left'?'conversation':'inspector');
  const last=first===$('conversation')?$('inspector'):$('conversation');
  if(layout.firstElementChild!==first){layout.moveBefore(first,layout.firstElementChild);layout.moveBefore(last,null);}
  for(const [side,visible,label,slot] of [['left',left,'项目对话','conversation-toggle-slot'],['right',right,'检查器','inspector-toggle-slot']]){
    const open=visible&&!focus,edge=physicalSide(side),button=$('toggle-'+side);
    const host=$(open?slot:edge+'-edge');
    if(button.parentElement!==host)host.moveBefore(button,null);
    document.body.classList.toggle('hide-'+side,!visible);
    button.setAttribute('aria-expanded',String(open));
    button.title=(open?'收起':'展开')+label;button.setAttribute('aria-label',button.title);
    changeIcon(button,edge+(open?'Panel':'Off'));
  }
  $('focus').textContent=focus?'退出专注预览':'专注预览';
  $('open-compose').hidden=!focus&&left;
  $('focus').setAttribute('aria-pressed',String(focus));sizeFrame();
}
function showPanel(side,open,remember=true){
  document.body.classList.remove('focus');
  railPrefs[side]=open;
  if(side==='right')inspectorOpenedBySelection=false;
  if(remember)localStorage.setItem('panel-visibility',JSON.stringify({...readPanels(),[side]:open}));
  layoutPanels();
}
for(const side of ['left','right'])$('toggle-'+side).onclick=()=>{
  const open=$('toggle-'+side).getAttribute('aria-expanded')!=='true';
  if(side==='right' && !open && picking==='style')leaveSelection();
  showPanel(side,open);
  closeMenus();
};
function toggleFocus(){
  if(!document.body.classList.contains('focus'))leaveSelection();
  document.body.classList.toggle('focus');layoutPanels();closeMenus();$('zoom').focus();
}
$('focus').onclick=toggleFocus;
function setZoom(value){cancelCrop();zoom=value;rememberViewport();sizeFrame();closeMenus();$('zoom').focus();}
$('zoom-form').onsubmit=e=>{e.preventDefault();setZoom($('zoom-value').valueAsNumber);};
document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>setZoom(b.dataset.zoom==='fit'?'fit':Number(b.dataset.zoom)));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{cancelCrop();view=b.dataset.view;zoom='fit';rememberViewport();preview();refreshHighlight();});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
function usePrompt(text){$('brief').value=text;$('brief').dispatchEvent(new Event('input'));focusComposer();}
document.addEventListener('keydown',e=>{if($('settings-dialog').open)return;if(e.key==='Escape'&&picking){if(picking==='style')leaveSelection();else setPicking('');return;}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();start();}if(e.key==='Escape'&&document.body.classList.contains('focus'))$('focus').click();});
new ResizeObserver(sizeFrame).observe($('canvas'));
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    if(!window.studio){
      layoutPanels();$('blank').hidden=false;$('artboard').hidden=true;
      $('blank-title').textContent='在桌面客户端打开作品';$('blank-description').textContent='启动 SurfaceLive.app 即可载入本机作品和源码。';
      for(const control of document.querySelectorAll('.layout button,.layout input,.layout select,.layout textarea,#new,#export'))control.disabled=true;
      $('canvas-status').textContent='桌面客户端未连接';return;
    }
    let restoring=true,pendingState;
    window.studio.onState(next=>{if(restoring)pendingState=next;else applyState(next);});
    layoutPanels();data=await window.studio.state();lastToken=localStorage.getItem('seen-outcome')||'';
    await restoreProjectTabs();
    restoring=false;applyState(pendingState||data);
  }catch(e){notice(e.message);}
});
