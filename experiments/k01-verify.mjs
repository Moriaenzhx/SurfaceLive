// Replay the frozen HTML in clean storage, with exactly the three local source files available.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Script} from 'node:vm';
import {chromium} from 'playwright-core';
import {journeys} from './k01-journeys.mjs';
const [scene,group]=process.argv.slice(2), key=scene+'/'+group;
if(!Object.hasOwn(journeys,key))throw Error('Expected a K-01 scene and group');
const dir=resolve('runs/K-01',scene,group);
const json=async p=>JSON.parse(await readFile(p));
const receipt=await json(join(dir,'receipt.json'));
const source=join(dir,group==='A0'?'source':'attempt');
const trace=group==='A0'?null:await json(join(source,'design-trace.json'));
const expected=receipt.files??trace.code.files;
const sha=value=>createHash('sha256').update(value).digest('hex');
const files={},urls=[];
for(const name of ['index.html','styles.css','app.js']){
  const file=join(source,name),data=await readFile(file);
  urls.push(pathToFileURL(file).href);files[name]=sha(data);
  assert.equal(files[name],expected[name].sha256??expected[name]);
  if(name==='app.js')new Script(data.toString());
}
const evidence=join(dir,'verification');
await mkdir(evidence,{recursive:true});
const calls=receipt.invocations??trace.invocations;
const report={scene,group,run_id:receipt.run_id,agent:receipt.agent,model:calls.find(c=>c.operation==='source')?.reportedModels,
  generatedAt:trace?.events.find(e=>e.stage==='agent-returned-source')?.at??new Date(Date.parse(receipt.startedAt)+receipt.elapsedMs),
  sourceVersion:sha(JSON.stringify(files)),files,url:urls[0],build:'static HTML/CSS/JS; verified file hashes and JS parse',views:[]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
  for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'zh-CN',timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
    const result={device,viewport:{width,height},errors:[],blockedRequests:[],steps:[]};
    report.views.push(result);
    await context.route('**/*',route=>{if(urls.includes(route.request().url()))return route.continue();
      result.blockedRequests.push(route.request().url().split(':')[0]);return route.abort();});
    const page=await context.newPage();
    page.setDefaultTimeout(3500);
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    async function measurement(){
      return page.evaluate(()=>({rootWidth:document.documentElement.scrollWidth,viewport:innerWidth,
        clipped:[...document.querySelectorAll('button,th,td,label,h1,h2,h3,p')].filter(e=>e.offsetWidth&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='visible')
          .slice(0,15).map(e=>e.textContent.trim().slice(0,55)),
        visibleText:document.body.innerText.trim().length,
        buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetWidth&&b.offsetHeight).slice(0,80).map(b=>b.textContent.trim().slice(0,45))}));
    }
    // Probe default-screen buttons from a reset state. An unchanged selected tab is expected.
    async function probeButtons(){
      async function reset(){
        await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(()=>document.fonts.ready);
      }
      await reset();
      const count=await page.locator('button').count();
      const response=()=>page.evaluate(()=>JSON.stringify({text:document.body.innerText,
        dialogs:[...document.querySelectorAll('dialog')].map(d=>d.open),
        states:[...document.querySelectorAll('[aria-expanded],[aria-pressed],input,select,textarea')].map(el=>
          [el.getAttribute('aria-expanded'),el.getAttribute('aria-pressed'),el.value,el.checked])}));
      const probes=[];
      for(let i=0;i<count;i++){
        await reset();
        const button=page.locator('button').nth(i);
        if(!await button.isVisible()||!await button.isEnabled())continue;
        const label=(await button.innerText()).trim();
        const before=await response();
        try{
          await button.click({timeout:1500});await page.waitForTimeout(150);
          probes.push({label,changed:before!==await response()});
        }catch(error){probes.push({label,error:error.message.slice(0,160)});}
      }
      return probes;
    }
    try{
      await page.goto(urls[0]);await page.evaluate(()=>document.fonts.ready);
      result.initial=await measurement();
      const shot=device+'.png';
      const bytes=await page.screenshot({path:join(evidence,shot),animations:'disabled'});
      result.screenshot={file:shot,sha256:sha(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
      const step=async(label,action)=>{
        try{
          const observed=await action();
          result.steps.push({label,passed:true,observed});
          if(label.includes('生成候选')||label.includes('搜索并打开匹配证据')){
            const name=device+'-task.png',image=await page.screenshot({path:join(evidence,name),animations:'disabled'});
            result.taskScreenshot={file:name,sha256:sha(image),step:label};
          }
        }
        catch(error){result.steps.push({label,passed:false,error:error.message.slice(0,400)});throw error;}
      };
      await journeys[key](page,step);
    }catch(error){result.issue=error.message.slice(0,400);}
    result.final=await measurement().catch(()=>null);
    result.initialButtons=await probeButtons().catch(error=>({error:error.message.slice(0,200)}));
    await context.close();
  }
}finally{
  await browser.close();
  await writeFile(join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n');
}
if(report.views.some(v=>v.issue||v.errors.length||v.blockedRequests.length||!v.steps.length||
  v.initial.rootWidth>v.initial.viewport+2||v.final.rootWidth>v.final.viewport+2||
  !Array.isArray(v.initialButtons)||v.initialButtons.some(b=>b.error)))process.exitCode=1;
console.log(key,report.views.map(v=>({device:v.device,steps:v.steps.map(s=>s.passed),issue:v.issue})));
