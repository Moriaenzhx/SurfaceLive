import {BrowserWindow,session} from 'electron';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {primaryAction,businessJourney,functionalPass} from './interaction-check.mjs';
import {inspectContract} from './contract-check.mjs';
import {devices} from './engine.mjs';
import {sourceFiles} from './library.mjs';

const studioFiles={'index.html':'text/html','studio.js':'text/javascript','studio.css':'text/css','editor.js':'text/javascript','editor.css':'text/css','action-icons.js':'text/javascript','project-tabs.js':'text/javascript','settings.js':'text/javascript','settings.css':'text/css'};
const mime={...studioFiles,'styles.css':'text/css','app.js':'text/javascript'};
const pageCSP="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
const studioCSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src surface-page:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

// Installed only in the running preview. The saved project and exported HTML stay byte-identical.
function previewDiagnostics(){
  function report(source,message){
    parent.postMessage({type:'surfacelive-preview-error',id:location.hostname,source,message},'surface-studio://studio');
  }
  addEventListener('error',event=>{
    const url=event.filename||event.target?.src||event.target?.href;
    if(url || event.message)report((url||'index.html').split('/').pop()+(event.lineno?':'+event.lineno:''),event.message||'资源加载失败');
  },true);
  addEventListener('unhandledrejection',event=>report('app.js',event.reason?.message||String(event.reason)));
  addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!event.isTrusted||event.isComposing||document.querySelector(':modal'))return;
    // Let the running page consume Escape before handing it to the workspace.
    setTimeout(()=>{if(!event.defaultPrevented)parent.postMessage({type:'surfacelive-preview-escape'},'surface-studio://studio');},0);
  });
}
function monitoredHTML(data){
  const html=data.toString(),script='<script>('+previewDiagnostics.toString()+')();</script>';
  if(/<head(?:\\s[^>]*)?>/i.test(html))return html.replace(/<head(?:\\s[^>]*)?>/i,head=>head+script);
  return html.replace(/^(\\s*<!doctype[^>]*>)?/i,doctype=>doctype+script);
}
export function configureSession(ses,{library,pending,ui,studio,reportPreview}){
  ses.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
  ses.setPermissionCheckHandler(()=>false);
  ses.on('will-download',event=>event.preventDefault());
  ses.webRequest.onBeforeRequest((details,done)=>{
    const url=new URL(details.url);
    done({cancel:!['surface-page:','data:','about:','blob:',...(studio?['surface-studio:']:[])].includes(url.protocol)});
  });
  if(studio)ses.protocol.handle('surface-studio',async req=>{
    const u=new URL(req.url),file=u.pathname.slice(1);
    if(u.host!=='studio'||!Object.hasOwn(studioFiles,file))return new Response(null,{status:404});
    return new Response(await readFile(join(ui,file)),{headers:{'Content-Type':mime[file]+'; charset=utf-8','Content-Security-Policy':studioCSP}});
  });
  ses.protocol.handle('surface-page',async req=>{
    const url=new URL(req.url),id=url.hostname,name=url.pathname.slice(1);
    if(!Object.hasOwn(sourceFiles,name))return new Response(null,{status:404});
    try{
      const data=pending.has(id)?pending.get(id)[sourceFiles[name]]:await readFile(join(library.require(id).folder,name));
      return new Response(studio&&name==='index.html'?monitoredHTML(data):data,{headers:{'Cache-Control':'no-store','Content-Type':mime[name]+'; charset=utf-8','Content-Security-Policy':pageCSP,'X-Content-Type-Options':'nosniff'}});
    }catch{reportPreview?.(id,name,'无法读取版本中的源文件');return new Response(null,{status:404});}
  });
}
export function lockContents(wc){
  wc.setWindowOpenHandler(()=>({action:'deny'}));
  wc.on('will-attach-webview',event=>event.preventDefault());
  wc.on('will-navigate',event=>event.preventDefault());
  wc.on('will-frame-navigate',event=>{
    if(event.isMainFrame || !/^surface-page:\/\/(sample(?:-[a-z]+)?|[a-f0-9-]{36})\/index\.html$/.test(event.url))event.preventDefault();
  });
}
async function measurePage(){
  await document.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};
}
export async function inspectPage(id,device,resources,signal,trace,steps=[],prepareStep,contract){
  // Each viewport gets a clean session so its validation click never alters the user's page.
  const ses=session.fromPartition('audit-'+id+'-'+device);
  configureSession(ses,{...resources,studio:false});
  const {width,height}=devices[device];
  const win=new BrowserWindow({show:false,width,height,useContentSize:true,enableLargerThanScreen:true,
    webPreferences:{session:ses,sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  const wc=win.webContents;lockContents(wc);
  const result={device,requestedViewport:{width,height},viewport:null,fits:false,action:false,screenshot:null,errors:[],journey:[]};
  wc.on('console-message',event=>{
    if(event.level==='error'&&result.errors.length<20)result.errors.push({kind:'console',message:event.message.slice(0,500),
      source:event.sourceId,line:event.lineNumber});
  });
  wc.on('did-fail-load',(_event,code,message,url)=>{
    if(result.errors.length<20)result.errors.push({kind:'load',code,message,url});
  });
  let timer,closed=false;
  const stop=()=>{closed=true;if(!win.isDestroyed())win.destroy();};
  signal.addEventListener('abort',stop,{once:true});
  try{
    const check=async()=>{
      signal.throwIfAborted();
      await win.loadURL('surface-page://'+id+'/index.html');
      result.viewport=await wc.executeJavaScript('('+measurePage.toString()+')()');
      result.fits=result.viewport.scrollWidth<=result.viewport.width+2;
      if(trace){
        try{
          const image=await wc.capturePage(undefined,{stayHidden:true,stayAwake:true});
          if(image.isEmpty())throw Error('浏览器返回空截图');
          if(closed)return;
          result.screenshot=await trace.screenshot(device,image.toPNG());
        }catch(error){result.screenshotError=error.message;}
      }
      if(closed)return;
      if(contract?.experiencePlan.states[0]?.primaryAction){
        const capture=async label=>trace.screenshot(label,(await wc.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
        const checked=await inspectContract(wc,contract,device,capture,signal);
        result.contractCheck=checked;
        result.action=checked.passed;
        result.label=checked.states[0]?.expectedName;
        result.before=checked.states[0]?.before?.text;
        result.after=checked.states[0]?.result?.text;
        if(!checked.passed)result.reason=checked.error??'契约一致性门禁失败';
      }else Object.assign(result,await primaryAction(wc));
      result.afterViewport=await wc.executeJavaScript('('+measurePage.toString()+')()');
      result.fits=result.fits&&result.afterViewport.scrollWidth<=result.afterViewport.width+2;
      if(steps.length){
        await ses.clearStorageData();
        await win.loadURL('surface-page://'+id+'/index.html');
        result.journey=await businessJourney(wc,steps,prepareStep);
        const last=await wc.executeJavaScript('('+measurePage.toString()+')()');
        result.fits=result.fits&&last.scrollWidth<=last.width+2;
        if(trace?.screenshotAfter){
          const image=await wc.capturePage(undefined,{stayHidden:true,stayAwake:true});
          if(!image.isEmpty())result.resultScreenshot=await trace.screenshotAfter(device,image.toPNG());
        }
      }
    };
    const contractTime=contract?.experiencePlan.states[0]?.primaryAction?contract.experiencePlan.states.length*7000:0;
    await Promise.race([check(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('检查超时')),15000+steps.length*6000+contractTime);})]);
  }catch(error){result.error=error.message;}
  finally{clearTimeout(timer);signal.removeEventListener('abort',stop);stop();ses.protocol.unhandle('surface-page');}
  result.functionalPass=functionalPass(result)&&result.journey.length===steps.length;
  return result;
}
