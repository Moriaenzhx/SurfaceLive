// Read-only browser replay of a K-03A business receipt. Captures the actual post-action viewport.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {readRevisionContract} from '../desktop/design-trace.mjs';

const dir=resolve(process.argv[2]),receipt=JSON.parse(await readFile(join(dir,'receipt.json')));
assert(['READY','FUNCTIONAL_FAILURE'].includes(receipt.status));
const attempt=join(dir,'attempt'),trace=JSON.parse(await readFile(join(attempt,'design-trace.json')));
const ref=trace.contracts.find(r=>r.id===trace.code.contractId);
const contract=await readRevisionContract({folder:attempt,designContract:ref});
const hash=data=>createHash('sha256').update(data).digest('hex');
const content={};
for(const name of ['index.html','styles.css','app.js']){
  content[name]=await readFile(join(attempt,name));
  assert.equal(hash(content[name]),trace.code.files[name].sha256);
}
const out=await mkdtemp(join(resolve(process.argv[3]??'runs/K-03A'),'replay-'+receipt.scenario+'-'));
const report={scenario:receipt.scenario,runId:trace.attemptId,contractId:ref.id,sourceVersion:trace.code.sourceVersion,views:[]};
const milestone={zhishi:'run-query',recruiting:'open-evidence'}[receipt.scenario];
assert(contract.evaluationPlan.journey.some(s=>s.id===milestone));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const {device,width,height} of contract.evaluationPlan.viewports){
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await ctx.newPage(),view={device,width,height,steps:[],errors:[]};report.views.push(view);
    page.setDefaultTimeout(3500);
    page.on('pageerror',error=>view.errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error')view.errors.push(msg.text());});
    await ctx.route('**/*',async route=>{
      const url=new URL(route.request().url()),name=url.pathname.slice(1);
      if(url.origin!=='https://k03a.test'||!Object.hasOwn(content,name))return route.abort();
      return route.fulfill({body:content[name],contentType:{'index.html':'text/html; charset=utf-8','styles.css':'text/css','app.js':'application/javascript'}[name]});
    });
    try{
      await page.goto('https://k03a.test/index.html');await page.evaluate(()=>document.fonts.ready);
      const primary=page.locator('[data-testid="primary-action"]');
      const primaryState=async()=>({inDOM:await primary.count(),visibleLabels:await page.locator('[data-testid="primary-action"]:visible').allInnerTexts()});
      view.primaryAtLoad=await primaryState();
      for(const step of contract.evaluationPlan.journey){
        const log={id:step.id,expected:step.contains};view.steps.push(log);
        const control=page.locator('[data-task="'+step.id+'"]:visible').first();
        const states=page.locator('[data-state="'+step.state+'"]:visible');
        const before=await states.allInnerTexts();
        try{
          if(!await control.count()&&step.opener)await page.locator('[data-task="'+step.opener.id+'"]:visible').first().click();
          if(step.operation==='fill')await control.fill(step.value);
          else if(step.operation==='select'){
            const value=await control.locator('option').evaluateAll((options,target)=>options.find(o=>o.value===target||o.label===target)?.value,step.value);
            assert(value!==undefined,'missing option '+step.value);
            await control.selectOption(value);
          }else await control.click();
          const result=states.filter({hasText:step.contains}).first();
          await result.waitFor({state:'visible'});
          log.observed=(await result.innerText()).trim().slice(0,250);
          log.changed=JSON.stringify(before)!==JSON.stringify(await states.allInnerTexts());
          log.passed=!step.requireChange||log.changed;
          if(step.id===milestone){
            const rect=await result.boundingBox();
            const file=device+'-after-'+milestone+'.png',bytes=await page.screenshot({path:join(out,file)});
            view.afterAction={file,sha256:hash(bytes),state:step.state,rect,primary:await primaryState(),
              ...await page.evaluate(()=>({scrollY,scrollWidth:document.documentElement.scrollWidth,
                visibleHeadings:[...document.querySelectorAll('h1,h2,h3')].filter(h=>{
                  const b=h.getBoundingClientRect();return b.height>0&&b.bottom>0&&b.top<innerHeight;
                }).map(h=>h.innerText.trim())}))};
          }
          if(!log.passed)break;
        }catch(error){
          log.passed=false;log.error=error.message.slice(0,350);
          const file=device+'-at-failure.png';
          log.screenshot={file,sha256:hash(await page.screenshot({path:join(out,file)}))};
          break;
        }
      }
    }finally{await ctx.close();}
    view.passed=view.steps.length===contract.evaluationPlan.journey.length&&view.steps.every(s=>s.passed)&&!view.errors.length;
  }
}finally{await browser.close();}
await writeFile(join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(out,report.views.map(v=>[v.device,v.passed]));
if(report.views.some(v=>!v.passed))process.exitCode=1;
