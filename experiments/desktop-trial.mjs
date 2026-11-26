import {_electron as electron} from 'playwright-core';
import {createHash} from 'node:crypto';
import {acquireDesignClient} from './desktop-lock.mjs';
import {isFunctionalRejection,trialInput} from './design-evidence.mjs';
import {mkdir,mkdtemp,readdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import scenarios from '../live-engine/design/benchmark.json' with {type:'json'};

const root=fileURLToPath(new URL('../',import.meta.url));
async function writeJSON(file,document){
  const tmp=file+'.'+process.pid+'.tmp';
  await writeFile(tmp,JSON.stringify(document,null,2)+'\n',{mode:0o600});
  await rename(tmp,file);
}
async function completed(dir){
  for(const item of await readdir(dir).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
    let receipt;
    try{receipt=JSON.parse(await readFile(join(dir,item,'receipt.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')continue;throw error;}
    const trace=JSON.parse(await readFile(join(dir,item,receipt.version,'design-trace.json'),'utf8'));
    if(isFunctionalRejection(trace))return true;
    if(receipt.outcome.kind==='ready'){
      const validCondition=receipt.variant!=='A2'||['scene','art-direction','pair-review'].every(name=>trace.steps?.[name]?.status==='validated');
      if(validCondition&&trace.browser.every(c=>c.functionalPass))return true;
    }
  }
  return false;
}
async function runOne({s,variant},out,app,page,signal){
  const dest=join(out,s.id,variant);
  await mkdir(dest,{recursive:true});const dir=await mkdtemp(join(dest,'attempt-'));
  const revisions=join(dir,'profile','revisions');await mkdir(revisions,{recursive:true});
  await app.evaluate(({app,dialog},{variant,id,revisions})=>{
    for(const [key,value] of [['design-condition',variant],['design-scenario',id]]){
      app.commandLine.removeSwitch(key);app.commandLine.appendSwitch(key,value);
    }
    // Select an isolated evidence directory for this trial, without presenting a native dialog.
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[revisions]});
  },{variant,id:s.id,revisions});
  await page.evaluate(()=>window.studio.chooseStorage());
  const info=await page.evaluate(()=>window.studio.storageInfo());
  if(info.root!==revisions)throw Error('Unexpected trial output directory');
  const start=Date.now(),input=trialInput(s);
  await writeJSON(join(dir,'input.json'),input);signal.throwIfAborted();
  const token=await page.evaluate(input=>window.studio.start(input),input);
  await writeJSON(join(dir,'submission.json'),{token,caseId:s.id,variant,at:new Date(start).toISOString()});
  console.log(s.id,variant,'submitted',token);
  const deadline=start+100*60*1000;
  let outcome,cancelledAt;
  for(;;){
    const state=await page.evaluate(()=>window.studio.state());
    if(!state.job&&state.outcome?.token===token){outcome=state.outcome;break;}
    if(signal.aborted||Date.now()>=deadline){
      if(!cancelledAt){await page.evaluate(()=>window.studio.cancel());cancelledAt=Date.now();}
      if(Date.now()-cancelledAt>12000)throw Error('Wait for cancellation timed out');
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  const version=outcome.kind==='ready'?'profile/revisions/'+outcome.id:'profile/revisions/.design-traces/'+token;
  const trace=JSON.parse(await readFile(join(dir,version,'design-trace.json')));
  await writeJSON(join(dir,'receipt.json'),{caseId:s.id,variant,token,outcome,version,elapsedMs:Date.now()-start,
    taskResults:trace.browser.map(c=>({device:c.device,passed:c.functionalPass,steps:c.journey}))});
  console.log(s.id,variant,outcome.kind);
  return outcome.kind;
}
export async function runDesktopTrials(tasks,folder){
  if(process.env.SURFACELIVE_CODEX_EXEC||process.env.SURFACELIVE_CLAUDE_EXEC)throw Error('Trials require the installed CLI');
  const out=resolve(folder),queue=[];
  for(const task of tasks)if(!await completed(join(out,task.s.id,task.variant)))queue.push(task);
  if(!queue.length){console.log('All requested trials already have receipts');return;}
  const lock=acquireDesignClient();
  const abort=new AbortController(),stop=()=>abort.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let app;
  const report={startedAt:new Date().toISOString(),planned:queue.map(({s,variant})=>s.id+'/'+variant),finished:[]};
  try{
    await mkdir(out,{recursive:true});
    const profile=join(out,'.benchmark-profile');
    const executablePath=process.env.SURFACELIVE_TEST_APP;
    app=await electron.launch({executablePath,args:[...(executablePath?[]:[join(root,'build/desktop')]),'--user-data-dir='+profile,
      '--workbench-acceptance','--background-design-check'],timeout:45000});
    const page=await app.firstWindow();await page.getByRole('tab',{selected:true}).waitFor();
    const status=await app.evaluate(({app,BrowserWindow})=>({pid:process.pid,appPath:app.getAppPath(),version:app.getVersion(),profile:app.getPath('userData'),
      visibleWindows:BrowserWindow.getAllWindows().filter(w=>w.isVisible()).length,
      dockVisible:app.dock?.isVisible()??null}));
    if(status.profile!==profile||status.visibleWindows||status.dockVisible)throw Error('后台验收实例未通过隐藏状态检查');
    const files=['desktop/main.mjs','desktop/agent.mjs','desktop/engine.mjs','desktop/visual-review.mjs','desktop/prepare-turn.mjs',
      'desktop/preview.mjs','desktop/interaction-check.mjs','live-engine/design/scene.mjs','live-engine/design/director.mjs','live-engine/design/judge.mjs',
      'live-engine/design/benchmark.json','live-engine/knowledge/src/live-knowledge.mjs','live-engine/ingestion/data/factory.sqlite'];
    report.code={};
    for(const file of files)report.code[file]=createHash('sha256').update(await readFile(join(status.appPath,file))).digest('hex');
    report.client=status;await writeJSON(join(out,'background-run.json'),report);
    for(const task of queue){
      if(abort.signal.aborted)break;
      const state=await runOne(task,out,app,page,abort.signal);
      report.finished.push({scene:task.s.id,variant:task.variant,state});
      await writeJSON(join(out,'background-run.json'),report);
      if(state!=='ready')process.exitCode=1;
    }
  }finally{
    try{await app?.close();report.endedAt=new Date().toISOString();await writeJSON(join(out,'background-run.json'),report);
      await writeJSON(join(out,'background-run-'+report.startedAt.replace(/[:.]/g,'-')+'.json'),report);}
    finally{process.off('SIGTERM',stop);process.off('SIGINT',stop);lock.close();}
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [id,variant,out]=process.argv.slice(2),s=scenarios.find(row=>row.id===id);
  if(!s||!['A0','A1','A2'].includes(variant)||!out)throw Error('Usage: desktop-trial.mjs <scenario> <condition> <output>');
  await runDesktopTrials([{s,variant}],out);
}
