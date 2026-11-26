// One Dock-hidden Electron process replays every accepted version under the same final browser checks.
import {app,BrowserWindow,nativeImage,protocol} from 'electron';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {decisionSource,inventory,sha256} from './design-evidence.mjs';
import {acquireDesignClient} from './desktop-lock.mjs';
import {inspectPage} from '../build/desktop/desktop/preview.mjs';
import {openIfNeeded} from '../build/desktop/desktop/interaction-check.mjs';
import {sourceFiles} from '../build/desktop/desktop/library.mjs';

if(process.platform==='darwin'){app.setActivationPolicy('prohibited');app.dock?.hide();}
protocol.registerSchemesAsPrivileged([{scheme:'surface-page',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.on('window-all-closed',()=>{});
const lock=acquireDesignClient();
const root=resolve(process.argv[2]||'.');
const dir=mkdtempSync(join(root,'verification-')),transient=join(dir,'profile');mkdirSync(transient);
app.setPath('userData',transient);
const out={startedAt:new Date().toISOString(),suite:'isolated final Electron replay',electron:process.versions.electron,chromium:process.versions.chrome,cases:[]};
async function replayViews(product,folder,resources,signal,steps,prepareStep){
  await mkdir(folder,{recursive:true});
  const screenshot=async(name,bytes)=>{
    const file=name+'.png';await writeFile(join(folder,file),bytes);
    return {file,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  };
  const sink={screenshot};
  if(prepareStep)sink.screenshotAfter=(device,bytes)=>screenshot(device+'-result',bytes);
  const id=randomUUID(),checks=[];
  resources.pending.set(id,product);
  try{
    for(const device of ['desktop','mobile'])checks.push(await inspectPage(id,device,resources,signal,sink,steps,prepareStep));
  }finally{resources.pending.delete(id);}
  return checks;
}
async function verifyOne(s,g,resources,signal){
  const started=Date.now(),sample=g.decision,folder=join(dir,s.id,g.variant);await mkdir(folder,{recursive:true});
  const source=await decisionSource(sample);
  const product={};
  for(const [file,key] of Object.entries(sourceFiles)){
    const bytes=await readFile(join(source.folder,file));
    if(sha256(bytes)!==source.files[file].sha256)throw Error('源码指纹变化 '+file);
    product[key]=bytes.toString('utf8');
  }
  const checks=await replayViews(product,folder,resources,signal,s.steps);
  let serviceJourney;
  if(s.id==='nearby'){
    const beforeSlot=(wc,step)=>step.id==='slot-afternoon'?openIfNeeded(wc,'[data-task="slot-afternoon"]',
      'button[aria-label*="晴川保洁"], a[aria-label*="晴川保洁"]'):null;
    const more=await replayViews(product,join(folder,'service-details'),resources,signal,s.steps,beforeSlot);
    serviceJourney={directory:'service-details',passed:more.every(v=>v.functionalPass),checks:more};
  }
  const passed=sample.status==='ready'&&checks.every(c=>c.functionalPass);
  const judgeImages=[];
  for(const [stage,pictures] of Object.entries(sample.trace.comparisons??{})){
    for(const pic of pictures){
      const png=await readFile(join(sample.revision,pic.file));
      if(sha256(png)!==pic.pngSha256)throw Error('送审 PNG 与原始记录不同');
      const jpeg=pic.submittedImage?await readFile(join(sample.revision,pic.submittedImage)):
        nativeImage.createFromBuffer(png).resize({width:pic.device==='desktop'?1440:390}).toJPEG(90);
      if(sha256(jpeg)!==pic.submittedJpegSha256)throw Error('送审 JPEG 指纹复核失败');
      const file=[stage,pic.label,pic.device].join('-')+'.jpg';
      await writeFile(join(folder,file),jpeg);
      judgeImages.push({stage,device:pic.device,label:pic.label,file,sha256:pic.submittedJpegSha256});
    }
  }
  const record={scene:s.id,variant:g.variant,attemptId:sample.trace.attemptId,revision:source.revision,
    files:source.files,releaseStatus:sample.status,passed,checks,serviceJourney,judgeImages,elapsedMs:Date.now()-started};
  await writeFile(join(folder,'checks.json'),JSON.stringify(record,null,2)+'\n');
  return {scene:s.id,variant:g.variant,attemptId:record.attemptId,passed,checks:s.id+'/'+g.variant+'/checks.json'};
}
async function run(){
  let code=0;
  try{
    const cases=await inventory(root);
    if(!cases.every(c=>c.groups.every(g=>g.decision)))throw Error('同题对照仍有未取得终态的组');
    out.verifier={};
    for(const file of ['build/desktop/desktop/preview.mjs','build/desktop/desktop/interaction-check.mjs','live-engine/design/benchmark.json'])
      out.verifier[file]=sha256(await readFile(new URL('../'+file,import.meta.url)));
    await app.whenReady();
    const pending=new Map(),resources={pending,library:{require(){throw Error('Unknown revision');}}},signal=new AbortController().signal;
    for(const {scenario,groups} of cases)for(const group of groups){
      let result;
      try{result=await verifyOne(scenario,group,resources,signal);}
      catch(error){result={scene:scenario.id,variant:group.variant,attemptId:group.decision.trace.attemptId,passed:false,error:error.message};}
      if(!result.passed)code=1;
      out.cases.push(result);
    }
    out.endedAt=new Date().toISOString();
    out.visibleWindows=BrowserWindow.getAllWindows().filter(w=>w.isVisible()).length;
    out.dockVisible=app.dock?.isVisible()??null;
    await writeFile(join(dir,'manifest.json'),JSON.stringify(out,null,2)+'\n');
    const tmp=join(root,'.verification-'+randomUUID());
    await writeFile(tmp,JSON.stringify({manifest:dir.slice(root.length+1)+'/manifest.json'},null,2)+'\n');
    await rename(tmp,join(root,'verification.json'));console.log('Browser recheck',out.cases.filter(c=>c.passed).length,'/',out.cases.length,dir);
  }catch(error){console.error(error.message);code=1;}
  finally{lock.close();app.exit(code);}
}
// The Electron ready event is dispatched after its ESM entry finishes evaluating.
void run();
