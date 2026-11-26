import {app,BrowserWindow,dialog,ipcMain,protocol,session,Menu,nativeImage,shell} from 'electron';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {availableAgents,generate,modelCatalog} from './agent.mjs';
import {rules,validSelector,inspectFrame} from './inspector.mjs';
import {Library,newMetadata} from './library.mjs';
import {DesignTrace,readRevisionContract} from './design-trace.mjs';
import benchmark from '../live-engine/design/benchmark.json' with {type:'json'};
import {renderCandidate,differences,reviewAndRepair} from './visual-review.mjs';
import {prepareTurn} from './prepare-turn.mjs';
import {direction} from './engine.mjs';
import {configureSession,inspectPage,lockContents} from './preview.mjs';
const here=dirname(fileURLToPath(import.meta.url));
app.name='SurfaceLive';
const backgroundCheck=app.commandLine.hasSwitch('workbench-acceptance')&&app.commandLine.hasSwitch('background-design-check');
if(backgroundCheck&&process.platform==='darwin'){
  app.setActivationPolicy('prohibited');
  app.dock?.hide();
}
protocol.registerSchemesAsPrivileged(['surface-studio','surface-page'].map(scheme=>({scheme,privileges:{standard:true,secure:true,supportFetchAPI:true}})));
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
let window,library,job,agents={},models={},lastOutcome=null,choosingLocation=false;
const pending=new Map();
const resources=()=>({library,pending,ui:join(here,'ui')});
function snapshot(){return {revisions:library.list(),agents,models,job:job?.info||null,outcome:lastOutcome};}
function emit(){if(window && !window.isDestroyed())window.webContents.send('studio:state',snapshot());}
function handle(channel,fn){ipcMain.handle('studio:'+channel,(e,...args)=>{
  if(e.sender!==window?.webContents || e.senderFrame!==window.webContents.mainFrame || e.senderFrame.url!=='surface-studio://studio/index.html')throw Error('Invalid studio window');
  return fn(...args);
});}
function unpackReferences(input){
  const refs=input.references||[];
  if(!Array.isArray(refs)||refs.length>8)throw Error('每次最多可引用 8 项');
  return refs.map(ref=>{
    const name=String(ref.name||'参考图').slice(0,80);
    if(ref.kind==='element' && input.base && validSelector(ref.selector))return {kind:'element',name,selector:ref.selector};
    if(ref.kind!=='image'||typeof ref.data!=='string'||ref.data.length>3500000||!/^data:image\/(jpeg|png);base64,/.test(ref.data))throw Error('图片格式或大小不符合要求');
    const image=nativeImage.createFromDataURL(ref.data);
    if(image.isEmpty())throw Error('无法读取参考图');
    const bytes=image.toJPEG(88);
    return {kind:'image',name,bytes,thumbnail:image.resize({width:120}).toDataURL()};
  });
}
async function beginTrace(input,base){
  const details={...input,request:input.text,base};
  try{await library.checkSaveLocation();}
  catch(error){
    const trace=await DesignTrace.begin(join(app.getPath('userData'),'failed-design-traces'),job.info.token,details);
    await trace.finish('failed',{error:error.message});
    throw error;
  }
  return DesignTrace.begin(join(library.root,'.design-traces'),job.info.token,details);
}
async function inspectAndSave(revision,product,trace,signal,steps=[]){
  await trace.source(revision,product);
  const contract=await readRevisionContract({folder:trace.folder,designContract:revision.designContract});
  pending.set(revision.id,product);
  for(const device of new Set([revision.direction.device,'desktop','mobile'])){
    signal.throwIfAborted();
    const check=await inspectPage(revision.id,device,resources(),signal,trace,steps,undefined,contract);
    revision.checks.push(check);
    await trace.checked(check);
  }
  signal.throwIfAborted();
  const failure=revision.checks.find(c=>!c.functionalPass);
  if(failure){
    await trace.record('functional-gate-blocked',{releaseStatus:'blocked',failedDevice:failure.device});
    throw Error(failure.device+' 的浏览器验收失败，版本未通过。详见 Design Trace '+trace.data.attemptId);
  }
  revision.reviewStatus=trace.data.visualReview.status;
  if(revision.reviewStatus==='needs-human')revision.reviewReason=trace.data.visualReview.uncertainty;
  await library.commit(revision,product,[],trace);
}
async function recordFailure(trace,signal,error){
  if(!trace)return;
  try{await trace.finish(signal.aborted?'cancelled':'failed',{error:signal.aborted?'任务已取消':String(error.message)});}
  catch(writeError){console.error('Design Trace 写入失败',trace.data.attemptId,writeError.message);}
}
async function run(input,base,controller){
  const signal=controller.signal;
  const setPhase=phase=>{job.info.phase=phase;emit();};
  let dir,revision,trace;
  try{
    trace=await beginTrace(input,base);
    let description=base?.description||input.text;
    if(base && !base.sample && base.change)description=(description+'\n'+base.change).slice(-6000);
    const brief=base?description+'\n'+input.text:description;
    const trial=app.commandLine.hasSwitch('workbench-acceptance')?app.commandLine.getSwitchValue('design-condition'):'';
    const variant=['A0','A1'].includes(trial)?trial:'A2';
    const scenario=trial?benchmark.find(s=>s.id===app.commandLine.getSwitchValue('design-scenario')):null;
    await trace.record('condition',{variant,scenarioId:scenario?.id??null});
    const original=base?await library.source(base.id):null;
    const source=original?{...original}:null;
    if(source && input.editCSS)source.css+='\n'+input.editCSS;
    const refs=input.references, images=refs.filter(ref=>ref.kind==='image');
    const referenceList=refs.map(r=>r.kind==='element'?'画布选区 '+r.name+'，CSS 定位 '+r.selector:'随消息输入的参考图：'+r.name).join('\n');
    const jobs=join(app.getPath('userData'),'tasks');await mkdir(jobs,{recursive:true});
    dir=await mkdtemp(join(jobs,'job-'));setPhase('generating');
    const options={type:input.agent,model:input.model,effort:input.effort,cwd:dir,signal,onInvocation:(call,prompt)=>trace.invocation(call,prompt)};
    const knownSteps=scenario?.steps??base?.journey??[];
    const parentContract=variant==='A2'?await readRevisionContract(base):null;
    const prepared=await prepareTurn({description,source,input,options,trace,variant,brief,knownSteps,parentContract,
      preferenceContext:trial?null:{file:join(app.getPath('userData'),'design-preferences.sqlite'),project:base?.project??null}});
    const {context}=prepared,steps=prepared.steps??knownSteps;
    const referenceText=referenceList?'\n以下是本轮修改的参考内容，配合用户指令使用。\n'+referenceList:'';
    const prompt=prepared.prompt+referenceText;
    await trace.prepared(prompt,context,prepared.knowledge,refs);
    if(prepared.contractFor)await trace.contractInput('source',prepared.contractFor(prepared.selected).id,prompt);
    await trace.record('agent-requested');
    let product=await generate({...options,prompt,images});
    await trace.generated('source',product);
    await trace.record('agent-returned-source');
    signal.throwIfAborted();setPhase('checking');
    const firstOnly=backgroundCheck&&app.commandLine.hasSwitch('first-source-only');
    if(firstOnly)await trace.record('first-source-budget',{sourceLimit:1});
    if(variant==='A2'&&!firstOnly){
      product=await reviewAndRepair({name:'initial',product,prompt,strategy:prepared.selected.id},prepared,
        {trace,resources:resources(),options,device:context.device,steps,images,referenceText,brief,parentContract,baseProduct:original,baseSteps:base?.journey??[]});
    }
    revision=newMetadata({base,description,change:base?input.text:'',target:input.target,context,agent:input.agent,model:input.model},product.title);
    revision.journey=steps;
    revision.references=refs.map(({bytes,...summary})=>bytes?{...summary,original:true}:summary);
    revision.effort=input.effort||null;
    await inspectAndSave(revision,product,trace,signal,steps);lastOutcome={kind:'ready',id:revision.id,token:job.info.token};
  }catch(e){await recordFailure(trace,signal,e);lastOutcome={kind:signal.aborted?'cancelled':'error',message:signal.aborted?'生成已取消':String(e.message),token:job.info.token};}
  finally{
    if(revision)pending.delete(revision.id);
    if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});
    job=null;emit();
  }
}
function reportPreview(id,source,message){if(window && !window.isDestroyed())window.webContents.send('studio:preview-issue',{id,source,message:String(message).slice(0,400)});}
function openWindow(){
  window=new BrowserWindow({title:'SurfaceLive',width:1440,height:920,minWidth:960,minHeight:640,
    backgroundColor:'#f6f7f8',show:false,skipTaskbar:backgroundCheck,focusable:!backgroundCheck,enableLargerThanScreen:app.commandLine.hasSwitch('workbench-acceptance'),titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',trafficLightPosition:{x:16,y:15},
    webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false,backgroundThrottling:!backgroundCheck}});
  lockContents(window.webContents);
  window.webContents.on('console-message',event=>{
    if(event.level!=='error'||!event.frame?.url.startsWith('surface-page://')||!/(uncaught|unhandled)/i.test(event.message))return;
    const frame=new URL(event.frame.url),source=(event.sourceId||frame.pathname).split('/').pop();
    reportPreview(frame.hostname,source+(event.lineNumber?':'+event.lineNumber:''),event.message);
  });
  window.webContents.on('did-fail-load',(_e,code,message,url,main)=>{
    if(main||code===-3||!url.startsWith('surface-page://'))return;
    const page=new URL(url);reportPreview(page.hostname,page.pathname.slice(1),message);
  });
  if(!backgroundCheck)window.once('ready-to-show',()=>window.show());
  window.on('closed',()=>{window=null;});
  window.loadURL('surface-studio://studio/index.html');
}
if(single)app.whenReady().then(async()=>{
  const applicationFolder=app.isPackaged&&process.platform==='darwin'?resolve(dirname(app.getPath('exe')),'../..'):app.getAppPath();
  library=new Library(join(app.getPath('userData'),'revisions'),join(here,'samples'),applicationFolder);
  await library.load();[agents,models]=await Promise.all([availableAgents(),modelCatalog()]);
  configureSession(session.defaultSession,{...resources(),studio:true,reportPreview});
  handle('state',snapshot);
  handle('storage-info',async id=>{
    const count=library.revisions.size;
    await library.readLocations([...library.unavailable]);
    if(library.revisions.size!==count)emit();
    return {...await library.storageInfo(id),version:app.getVersion()};
  });
  handle('open-folder',async (kind,value)=>{
    const folder=await library.folderFor(kind,value);
    const error=await shell.openPath(folder);
    if(error)throw Error('打开文件夹失败：'+error);
  });
  handle('choose-storage',async ()=>{
    if(job||choosingLocation)throw Error('请等待当前操作完成后再更改保存位置');
    choosingLocation=true;
    try{
      const result=await dialog.showOpenDialog(window,{title:'选择作品保存位置',buttonLabel:'使用此文件夹',
        defaultPath:library.root,properties:['openDirectory','createDirectory']});
      if(result.canceled||!result.filePaths[0])return false;
      await library.changeRoot(result.filePaths[0]);emit();return true;
    }finally{choosingLocation=false;}
  });
  handle('refresh',async()=>{[agents,models]=await Promise.all([availableAgents(),modelCatalog()]);emit();return agents;});
  handle('direction',(desc,target)=>direction(desc,target));
  handle('reference',(id,index)=>library.reference(id,index));
  handle('inspect',(id,command,arg)=>{library.require(id);return inspectFrame(window,id,command,arg);});
  handle('capture',async rect=>{
    const [w,h]=window.getContentSize();
    if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('画布尚未显示');
    const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y));
    const width=Math.min(w-x,Math.round(rect.x+rect.width)-x),height=Math.min(h-y,Math.round(rect.y+rect.height)-y);
    if(width<1||height<1)throw Error('将选区滚动到可见范围后再截图');
    const img=await window.webContents.capturePage({x,y,width,height},backgroundCheck?{stayHidden:true,stayAwake:true}:{});
    return 'data:image/jpeg;base64,'+img.toJPEG(90).toString('base64');
  });
  handle('save-edit',async ({base:id,edits})=>{
    if(choosingLocation)throw Error('请先完成保存位置选择');
    if(job)throw Error('请等待当前任务完成');
    const css=rules(edits);if(!css)throw Error('尚未修改属性');
    const base=library.require(id),controller=new AbortController();
    const revision=newMetadata({base,description:base.description,change:'手动调整了 '+edits.length+' 个元素的样式',target:base.target,context:base.direction,agent:'manual'},base.title);
    revision.edits=edits;revision.journey=base.journey??[];job={controller,info:{token:crypto.randomUUID(),phase:'checking',since:Date.now(),base:id}};lastOutcome=null;emit();
    let trace;
    try{
      trace=await beginTrace({agent:'manual',text:revision.change,target:base.target,edits},base);
      await trace.record('parent-context',{scene:base.direction});
      const inherited=await readRevisionContract(base);
      if(inherited){
        await trace.storeContracts([inherited],inherited.directionId);
        revision.designContract={...trace.data.contracts[0],application:'inherited-manual-edit'};
        await trace.record('manual-contract-inherited',{inheritedContractId:inherited.id});
      }
      const original=await library.source(id),product={...original};
      product.css+='\n\n/* SurfaceLive · 元素调整 */\n'+css+'\n';
      const env={trace,resources:resources(),options:{signal:controller.signal},device:revision.direction.device,steps:revision.journey,parentContract:inherited};
      const before=await renderCandidate({name:'parent',product:original},env);
      const after=await renderCandidate({name:'manual',product},env);
      const diff=await differences(before,after,trace);
      await trace.record('manual-comparison',{differences:diff});
      await inspectAndSave(revision,product,trace,controller.signal,revision.journey);lastOutcome={kind:'ready',id:revision.id,token:job.info.token};
      return revision.id;
    }catch(e){await recordFailure(trace,controller.signal,e);lastOutcome={kind:controller.signal.aborted?'cancelled':'error',message:controller.signal.aborted?'保存已取消':e.message,token:job.info.token};throw e;}
    finally{pending.delete(revision.id);job=null;emit();}
  });
  handle('start',input=>{
    if(choosingLocation)throw Error('请先完成保存位置选择');
    if(job)throw Error('已有生成任务正在执行');
    if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>4000)throw Error('请输入 1–4000 字的需求');
    if(!Object.hasOwn(agents,input.agent)||!agents[input.agent])throw Error('所选 Agent 尚未安装');
    if(typeof input.model!=='string'||input.model.length>100)throw Error('模型名称无效');
    if(input.effort && !(input.agent==='claude'?['low','medium','high','max']:['minimal','low','medium','high','xhigh','max','ultra']).includes(input.effort))throw Error('推理强度无效');
    input.references=unpackReferences(input);input.editCSS=rules(input.edits||[]);
    direction(input.text,input.target);
    const base=input.base?library.require(input.base):null,controller=new AbortController();
    job={controller,info:{token:crypto.randomUUID(),phase:'preparing',since:Date.now(),base:base?.id||null}};
    lastOutcome=null;emit();void run(input,base,controller);return job.info.token;
  });
  handle('cancel',()=>{job?.controller.abort();});
  handle('export',async id=>{
    library.require(id);
    const result=await dialog.showOpenDialog(window,{title:'选择源码导出位置',properties:['openDirectory','createDirectory']});
    return result.canceled?null:await library.export(id,result.filePaths[0]);
  });
  if(process.platform==='darwin')Menu.setApplicationMenu(Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]));
  openWindow();
  app.on('activate',()=>{if(!window)openWindow();});
}).catch(e=>{dialog.showErrorBox('SurfaceLive 启动失败',String(e.message));app.quit();});
app.on('second-instance',()=>{if(!backgroundCheck&&window){if(window.isMinimized())window.restore();window.focus();}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>job?.controller.abort());
