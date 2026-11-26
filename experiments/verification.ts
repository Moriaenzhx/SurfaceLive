import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { platform, homedir } from 'node:os';

export type Check={name:string; passed:boolean; detail:string};
export type Audit={staticChecks:Check[];browser:{status:'passed'|'failed'|'not-run';checks:Check[];screenshots:string[];reason?:string};releaseStatus:'NOT_PRODUCTION_VERIFIED'};
const required=['index.html','styles.css','app.js'];
export async function auditFiles(dir:string):Promise<Check[]>{
  const files=await Promise.all(required.map(async name=>{try{return await readFile(join(dir,name),'utf8')}catch{return ''}}));
  const [html,css,js]=files;
  return [
    {name:'required-files',passed:files.every(s=>s.trim().length>0),detail:'index.html, styles.css, app.js 均非空'},
    {name:'viewport',passed:/name\s*=\s*["']viewport["']/i.test(html),detail:'响应式页面必须配置 viewport'},
    {name:'responsive',passed:/@media|@container/.test(css),detail:'需要实际移动端样式'},
    {name:'primary-action-test-hook',passed:/data-testid\s*=\s*(["'])primary-action\1/i.test(html+js),detail:'可测试的主操作元素'},
    {name:'action-feedback-test-hook',passed:/data-testid\s*=\s*(["'])action-feedback\1/i.test(html+js),detail:'可测试的操作结果'},
    {name:'interaction-script',passed:/addEventListener|onclick\s*=/.test(js+html),detail:'至少有真实前端交互事件'},
    {name:'no-placeholder',passed:!/(href=["']#["']|TODO:\s*implement)/i.test(html+js),detail:'不允许显式占位链接/未实现标记'},
  ];
}

function chromePath():string|undefined{
  const bin=process.env.CHROME_BIN;
  if(bin)return bin;
  const dirs=platform()==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',join(homedir(),'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')]:platform()==='win32'?[join(process.env.PROGRAMFILES||'','Google','Chrome','Application','chrome.exe')]:['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'];
  return dirs.find(x=>{try{return requireExists(x)}catch{return false}});
}
import { existsSync } from 'node:fs';
function requireExists(path:string):boolean{return existsSync(path);}

/** Browser checks are intentionally not replaced with an LLM's unverified claim. */
export async function auditBrowser(dir:string):Promise<Audit['browser']>{
  let chromium:any;
  try { ({ chromium } = await import('playwright-core')); }
  catch {return {status:'not-run',checks:[],screenshots:[],reason:'playwright-core 未安装；不能验证截图、交互与移动端'};}
  const executable=chromePath();
  if(!executable)return {status:'not-run',checks:[],screenshots:[],reason:'找不到 Chrome/Chromium；设置 CHROME_BIN'};
  let browser:any;
  const checks:Check[]=[];
  const screenshots:string[]=[];
  try{
    browser=await chromium.launch({executablePath:executable,headless:true,timeout:20000,args:platform()==='linux'&&process.getuid?.()===0?['--no-sandbox']:[]});
    await mkdir(join(dir,'evidence'),{recursive:true});
    for(const view of [{id:'desktop',width:1440,height:900},{id:'mobile',width:390,height:844}]){
      const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:1});
      await context.setOffline(true);
      const page=await context.newPage();
      const errors:string[]=[];
      page.on('pageerror',(e:Error)=>errors.push(e.message));
      const label=view.id;
      try{
        await page.goto(pathToFileURL(resolve(dir,'index.html')).href,{waitUntil:'load',timeout:15000});
        const shot=join('evidence',`${label}.png`);
        await page.screenshot({path:join(dir,shot),animations:'disabled',timeout:15000});
        screenshots.push(shot);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
        checks.push({name:`${label}-layout`,passed:!overflow&&errors.length===0,detail:overflow?'水平溢出':errors.length?errors.join('; ').slice(0,300):'无水平溢出或页面脚本异常'});
        const button=page.getByTestId('primary-action');
        const feedback=page.getByTestId('action-feedback');
        const actionLabel=await button.innerText({timeout:5000});
        const before=await feedback.count()?await feedback.textContent():null;
        await button.click({timeout:5000});
        await feedback.waitFor({state:'visible',timeout:5000});
        await page.waitForFunction(previous=>{const text=document.querySelector('[data-testid="action-feedback"]')?.textContent;return !!text?.trim() && text!==previous;},before,{timeout:5000});
        const after=await feedback.textContent({timeout:3000});
        await writeFile(join(dir,'evidence',label+'-action.json'),JSON.stringify({viewport:view,actionLabel,before,after,pageErrors:errors},null,2));
        checks.push({name:`${label}-interaction`,passed:before!==after && !errors.length,detail:errors.length?errors.join(' / '):before!==after?'点击后出现可观察的状态变更':'主操作未改变反馈区域'});
      }catch(e){checks.push({name:`${label}-runtime`,passed:false,detail:String((e as Error).message).slice(0,400)});}
      finally{await context.close();}
    }
    return {status:checks.every(x=>x.passed)?'passed':'failed',checks,screenshots};
  }catch(e){return {status:'failed',checks,screenshots,reason:String((e as Error).message).slice(0,400)};}
  finally{await browser?.close().catch(()=>{});}
}

export async function audit(dir:string,{browser=false}={}):Promise<Audit>{
  const staticChecks=await auditFiles(dir);
  const browserResult=browser?await auditBrowser(dir):{status:'not-run' as const,checks:[],screenshots:[],reason:'未开启 --browser；不声称完成视觉/交互验收'};
  const report:Audit={staticChecks,browser:browserResult,releaseStatus:'NOT_PRODUCTION_VERIFIED'};
  await writeFile(join(dir,'audit.json'),JSON.stringify(report,null,2));
  return report;
}
