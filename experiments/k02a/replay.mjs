// Run with Electron. Runtime and sources are frozen; only the checker differs between the two cohorts.
import {app, BrowserWindow, protocol} from 'electron';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const condition=process.argv[2];
assert(['original','corrected','diagnose'].includes(condition));
const temp=await mkdtemp(join(tmpdir(),'surface-k02a-'));
if(process.platform==='darwin'){app.setActivationPolicy('prohibited');app.dock?.hide();}
app.setPath('userData',join(temp,'profile'));
app.on('window-all-closed',()=>{});
protocol.registerSchemesAsPrivileged([{scheme:'surface-page',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const report={condition,startedAt:new Date().toISOString(),electron:process.versions.electron,views:[]};

async function replay(){
  const root='runs/K-01';
  const frozen=(await readFile(join(root,'runtime-path.txt'),'utf8')).trim();
  const runtime=join(temp,'runtime');
  const hashes=await json(join(root,'runtime-sha256.json'));
  for(const [file,digest] of Object.entries(hashes))assert.equal(sha(await readFile(join(frozen,file))),digest,file);
  await cp(frozen,runtime,{recursive:true});
  const checker='desktop/interaction-check.mjs';
  if(condition==='corrected')await cp(checker,join(runtime,checker));
  report.checkerSha256=sha(await readFile(join(runtime,checker)));
  if(condition==='diagnose'){
    // Sample only after the original journey has returned; do not insert a wait before the failing operation.
    const file=join(runtime,'desktop/preview.mjs'),js=await readFile(file,'utf8');
    const anchor='result.journey=await businessJourney(wc,steps,prepareStep);';
    assert(js.includes(anchor));
    const snapshot=()=>({ready:document.readyState,inputCount:document.querySelectorAll('#search').length,
      focus:document.activeElement.id,value:document.querySelector('#search').value,count:document.querySelector('#count').innerText,
      names:[...document.querySelectorAll('#rows .name')].map(b=>b.textContent),storageSize:localStorage.length});
    await writeFile(file,js.replace(anchor,anchor+'\nresult.terminalDOM=await wc.executeJavaScript('+JSON.stringify('('+snapshot.toString()+')()')+');'));
    report.previewProbeSha256=sha(await readFile(file));
  }
  const {inspectPage}=await import(pathToFileURL(join(runtime,'desktop/preview.mjs')));
  await app.whenReady();
  if(condition==='corrected'){
    const {matchesDatedSlot}=await import(pathToFileURL(join(runtime,checker)));
    const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
    try{
      await win.loadURL('about:blank');
      // Matcher-only controls in a separate empty window, never mixed with real-page evidence.
      report.controls=await win.webContents.executeJavaScript(`(()=>{
        document.body.innerHTML='<p>示例说明：11 月 26 日 09:00–11:00</p><section><h2>11 月 24 日</h2><article><time>13:00–15:00</time></article><article hidden><time>09:00–11:00</time></article></section><section><h2>11 月 25 日</h2><article><time>09:00–11:00</time></article></section><article><span>11 月 28 日</span> <span>07:00–09:00</span></article>';
        const match=${matchesDatedSlot.toString()};
        return [['24','13:00–15:00',true],['24','09:00–11:00',false],['25','09:00–11:00',true],['26','09:00–11:00',false],['28','07:00–09:00',true],['28','13:00–15:00',false]].map(([day,time,expected])=>{
          const actual=match(document.body,{date:'11 月 '+day+' 日',time});return {day,time,expected,actual};
        });
      })()`);
      assert(report.controls.every(v=>v.actual===v.expected));
    }finally{win.destroy();}
  }
  for(let round=1;round<=(condition==='diagnose'?12:3);round++){
    for(const scene of condition==='diagnose'?['recruiting']:['zhishi','recruiting']){
      const source=join(root,scene,'A-current/attempt'), t=await json(join(source,'design-trace.json'));
      const product={};
      for(const [name,key] of Object.entries({'index.html':'html','styles.css':'css','app.js':'js'})){
        const bytes=await readFile(join(source,name));assert.equal(sha(bytes),t.code.files[name].sha256);product[key]=bytes.toString();
      }
      for(const device of round%2?['desktop','mobile']:['mobile','desktop']){
        const id=randomUUID(),events=[],idOfRun=t.attemptId;
        const resources={pending:new Map([[id,product]]),library:{require(){throw Error('Unknown revision');}}};
        // Plain first and last passes preserve ordering without observer IPCs before input.
        const instrument=condition!=='diagnose'&&round===2&&scene==='recruiting';
        const before=instrument?async(wc,step)=>{
          if(step.id!=='candidate-search')return;
          wc.on('console-message',event=>{
            if(event.message.startsWith('K02A '))events.push(JSON.parse(event.message.slice(5)));
          });
          await wc.executeJavaScript(`(()=>{
            const state=(type,target)=>console.log('K02A '+JSON.stringify({type,target,ms:performance.now(),
              ready:document.readyState,focus:document.activeElement.id,value:document.querySelector('#search').value,
              inputCount:document.querySelectorAll('[data-task=candidate-search]').length,count:document.querySelector('#count').innerText,
              names:[...document.querySelectorAll('#rows .name')].map(b=>b.textContent),persistedReviews:localStorage.length}));
            state('before-fill','');
            for(const type of ['focusin','mousedown','mouseup','input'])document.addEventListener(type,e=>queueMicrotask(()=>state(type,e.target.id)));
            new MutationObserver(()=>state('results-updated','count')).observe(document.querySelector('#count'),{subtree:true,childList:true,characterData:true});
          })()`);
        }:undefined;
        const result=await inspectPage(id,device,resources,new AbortController().signal,{screenshot:async(_device,b)=>({sha256:sha(b)})},t.artDirection.journey,before);
        report.views.push({round,scene,device,idOfRun,instrument,events,result});
      }
    }
  }
}
async function run(){
  try{
    await replay();
  }catch(error){report.error=error.message;}
  finally{
    report.endedAt=new Date().toISOString();
    const dir=resolve('runs/K-02A/tests');await mkdir(dir,{recursive:true});
    const output=await mkdtemp(join(dir,condition+'-'));
    await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(output,report.views.filter(v=>v.result.functionalPass).length+'/'+report.views.length,report.error??'');
    const ok=!report.error&&report.views.length===(condition==='diagnose'?24:12)&&(condition!=='corrected'||report.views.every(v=>v.result.functionalPass));
    await rm(temp,{recursive:true,force:true}).catch(()=>{});
    app.exit(ok?0:1);
  }
}
void run();
