const settingsDialog=$('settings-dialog');
const pageNames={general:'通用',agents:'智能体',keys:'键盘快捷键'};
const systemAppearance=matchMedia('(prefers-color-scheme: dark)');
const savedTheme=localStorage.getItem('workbench-theme');
let themeMode=['light','dark','system'].includes(savedTheme)?savedTheme:'light';
let settingsPage='general',storageRevision,storageRequest=0,storage=null,choosingFolder=false,detectingAgents=false;

function applyTheme(){
  rootElement.dataset.theme=themeMode==='system'?(systemAppearance.matches?'dark':'light'):themeMode;
}
applyTheme();
systemAppearance.addEventListener('change',()=>{if(themeMode==='system')applyTheme();});
for(const input of settingsDialog.querySelectorAll('input[type="radio"]')){
  const theme=input.name==='theme';
  input.checked=input.value===(theme?themeMode:rootElement.dataset.conversationSide);
  input.onchange=()=>{
    if(theme){themeMode=input.value;localStorage.setItem('workbench-theme',themeMode);applyTheme();return;}
    rootElement.dataset.conversationSide=input.value;localStorage.setItem('conversation-side',input.value);
    cancelCrop();layoutPanels();refreshHighlight();if(picked)updateOutline();
  };
}
$('send-shortcut').textContent=navigator.platform.startsWith('Mac')?'⌘ Enter':'Ctrl Enter';

function showSettingsPage(){
  const terms=$('settings-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  $('settings-heading').textContent=terms.length?'搜索结果':pageNames[settingsPage];
  for(const button of settingsDialog.querySelectorAll('[data-settings-page]')){
    if(!terms.length&&button.dataset.settingsPage===settingsPage)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  let total=0;
  for(const section of settingsDialog.querySelectorAll('[data-section]')){
    const page=section.dataset.section,title=pageNames[page]+' '+section.querySelector('h2').textContent;
    let count=0;
    for(const row of section.querySelectorAll('.settings-row')){
      const searchable=(title+' '+row.dataset.keywords+' '+row.textContent).toLowerCase();
      row.hidden=row.dataset.available==='false'||(terms.length?!terms.every(term=>searchable.includes(term)):page!==settingsPage);
      if(!row.hidden)count++;
    }
    section.hidden=!count;total+=count;
  }
  $('settings-no-results').hidden=!!total;
}
for(const button of settingsDialog.querySelectorAll('[data-settings-page]')){
  button.onclick=()=>{settingsPage=button.dataset.settingsPage;$('settings-search').value='';showSettingsPage();$('settings-content').scrollTop=0;};
}
$('settings-search').oninput=()=>{showSettingsPage();$('settings-content').scrollTop=0;};

function feedback(id,message,kind='info'){
  const target=$(id);target.textContent=message;target.dataset.kind=kind;target.hidden=!message;
}
function failureMessage(error){
  return String(error?.message||error).replace(/^Error invoking remote method 'studio:[^']+': (?:Error: )?/,'');
}
function capacity(bytes){
  if(bytes===null)return '磁盘可用空间当前无法读取';
  const [size,unit]=bytes>=1e9?[1e9,'GB']:bytes>=1e6?[1e6,'MB']:[1e3,'KB'];
  return '所在磁盘可用 '+new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(bytes/size)+' '+unit;
}
function storageButtons(){
  $('open-storage-root').disabled=!storage;
  $('open-storage-source').disabled=!storage?.current;
  $('change-storage').disabled=!window.studio?.chooseStorage||choosingFolder||!!data.job||submitting;
  $('change-storage').title=data.job?'当前任务完成后可更改保存位置':'选择新的作品保存文件夹';
}
function paintStorage(){
  const desktop=!!window.studio?.storageInfo;
  $('storage-root').textContent=storage?.root||'';
  $('disk-free').textContent=storage?capacity(storage.availableBytes):desktop?'正在读取保存位置…':'请在 SurfaceLive 桌面客户端中查看本机保存位置。';
  const source=storage?.current;
  $('storage-source').textContent=source?.folder||'';
  $('source-description').textContent=source?
    source.title+' · '+(source.sample?'应用内置示例':revisionLabel(current())):
    !desktop?'桌面客户端可打开版本的源码文件夹。':!storage?'':activeEntry?'此草稿尚未生成源码。':'打开作品后，可在这里查看当前版本的源码。';
  $('about-version').textContent=storage?'版本 '+storage.version:desktop?'':'桌面客户端';
  const previous=$('previous-folders');previous.replaceChildren();
  for(const location of storage?.previous||[]){
    const row=element('div',null,'previous-folder'),path=element('code',location.path,'storage-path');
    const button=element('button','打开');button.setAttribute('aria-label','打开以前的保存位置 '+location.path);
    button.onclick=()=>openFolder('previous',location.path);
    row.append(path,button);
    if(location.unavailable){path.append(element('small','文件夹当前不可用','folder-unavailable'));button.disabled=true;}
    previous.append(row);
  }
  $('previous-row').dataset.available=String(!!previous.childElementCount);
  storageButtons();showSettingsPage();
}
async function readStorage(){
  const token=++storageRequest;
  storageRevision=selected;storage=null;paintStorage();
  if(!window.studio?.storageInfo)return;
  try{
    const info=await window.studio.storageInfo(selected);
    if(token!==storageRequest||!settingsDialog.open)return;
    storage=info;paintStorage();
    if(info.settingsIssue)feedback('storage-feedback',info.settingsIssue,'error');
  }catch(error){
    if(token!==storageRequest||!settingsDialog.open)return;
    $('disk-free').textContent='无法读取保存位置';feedback('storage-feedback',failureMessage(error),'error');
  }
}
async function openFolder(kind,value){
  try{
    await window.studio.openFolder(kind,value);
  }catch(error){
    if(settingsDialog.open)feedback('storage-feedback',failureMessage(error),'error');
    else notice(failureMessage(error));
  }
}
$('open-storage-root').onclick=()=>openFolder('root');
$('open-storage-source').onclick=()=>{if(storage?.current)openFolder('revision',storage.current.id);};
$('open-version-folder').onclick=()=>{closeMenus();if(selected)openFolder('revision',selected);};
$('change-storage').onclick=async()=>{
  if($('change-storage').disabled)return;
  choosingFolder=true;storageButtons();feedback('storage-feedback','');
  try{
    if(await window.studio.chooseStorage()&&settingsDialog.open){
      await readStorage();
      if(storage)feedback('storage-feedback','作品保存位置已更新。');
    }
  }catch(error){feedback('storage-feedback',failureMessage(error),'error');}
  finally{choosingFolder=false;storageButtons();}
};

function syncSettings(){
  if(!settingsDialog.open)return;
  for(const name of ['codex','claude']){
    const state=$('settings-'+name),online=!!data.agents[name];
    state.textContent=!window.studio?'仅桌面客户端可检测':online?'已检测到本机 CLI':'未检测到本机 CLI';
    state.classList.toggle('online',online);
  }
  $('settings-refresh').disabled=!window.studio||detectingAgents||!!data.job;
  storageButtons();
  if(storageRevision!==selected)void readStorage();
}
$('settings-refresh').onclick=async()=>{
  detectingAgents=true;syncSettings();feedback('agent-settings-feedback','正在检测…');
  try{await window.studio.refresh();feedback('agent-settings-feedback','检测完成。');}
  catch(error){feedback('agent-settings-feedback',failureMessage(error),'error');}
  finally{detectingAgents=false;syncSettings();}
};
$('settings').onclick=()=>{
  closeMenus();settingsPage='general';storageRevision=undefined;
  $('settings-search').value='';$('previous-locations').open=false;
  feedback('storage-feedback','');feedback('agent-settings-feedback','');
  settingsDialog.showModal();$('settings').setAttribute('aria-expanded','true');
  showSettingsPage();syncSettings();$('settings-content').scrollTop=0;$('settings-heading').focus({preventScroll:true});
};
$('close-settings').onclick=()=>settingsDialog.close();
settingsDialog.addEventListener('close',()=>{
  ++storageRequest;$('settings').setAttribute('aria-expanded','false');$('settings').focus();
});
function onBackdrop(event){
  if(event.target!==settingsDialog)return false;
  const r=settingsDialog.getBoundingClientRect();
  return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
}
let pressedBackdrop=false;
settingsDialog.addEventListener('pointerdown',event=>{pressedBackdrop=onBackdrop(event);});
settingsDialog.addEventListener('click',event=>{if(pressedBackdrop&&onBackdrop(event))settingsDialog.close();pressedBackdrop=false;});
