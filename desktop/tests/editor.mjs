import {acquireDesignClient} from '../../experiments/desktop-lock.mjs';
import {openProject} from './controls.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright-core';
const clientLock=process.env.SURFACELIVE_BACKGROUND_CHECKS?acquireDesignClient():null;
const root=fileURLToPath(new URL('../../',import.meta.url)),live=process.argv.includes('--live');
const dir=await mkdtemp(join(root,'runs','editor-'+(live?'vision-':'manual-')));
const profile=join(dir,'profile'),out=join(dir,'export');
const exe=process.env.SURFACELIVE_TEST_APP||join(root,'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive');
const seed='be35885c-e072-4a1e-a748-aa3447ae4b9c',folder=join(profile,'revisions',seed);
const env={...process.env};await mkdir(folder,{recursive:true});await mkdir(out);
const seedSource={
  'index.html':'<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><main><h1>今日放映</h1><p>周末邻里电影报名</p><button id="book" data-testid="primary-action">预订座位</button><p data-testid="action-feedback">尚未预订</p></main><script src="app.js"></script></body></html>',
  'styles.css':'body{font:16px system-ui;background:#f3f4ef}main{margin:28px}button{background:#30413c;color:white;padding:10px 14px;border:0;border-radius:6px}',
  'app.js':'document.querySelector("button").onclick=()=>document.querySelector("[data-testid=action-feedback]").textContent="已预订座位"',
  'revision.json':JSON.stringify({id:seed,project:seed,parent:null,title:'今日放映',createdAt:new Date().toISOString(),description:'社区电影报名页',target:'mobile',agent:'codex',checks:[],direction:{scene:'local-consumer',label:'邻里与本地生活',device:'mobile',evidence:[]}})
};
for(const [file,value] of Object.entries(seedSource))await writeFile(join(folder,file),value);
const app=await electron.launch({executablePath:exe,args:['--user-data-dir='+profile,'--workbench-acceptance',...(process.env.SURFACELIVE_BACKGROUND_CHECKS?['--background-design-check']:[])],env,timeout:45000});
console.log(dir);
try{
  const page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>console.error('renderer:',e.message));
  const frame=page.frameLocator('#preview');
  async function point(locator){
    const inner=await locator.evaluate(e=>{const b=e.getBoundingClientRect();return {x:(b.x+b.width/2)/innerWidth,y:(b.y+b.height/2)/innerHeight};});
    const outer=await page.locator('#preview').evaluate(e=>e.getBoundingClientRect().toJSON());
    return {x:outer.x+inner.x*outer.width,y:outer.y+inner.y*outer.height};
  }
  async function project(name){
    await openProject(page,name);
  }
  await page.waitForFunction(()=>document.querySelector('[role=tab][aria-selected=true]')?.textContent==='今日放映');
  await project('招聘复核工作台');await frame.getByTestId('primary-action').waitFor();await page.waitForTimeout(750);
  await page.screenshot({path:join(dir,'studio.png')});
  await page.click('#agent-trigger');await page.locator('.agent-option').filter({hasText:'Codex'}).click();
  await page.screenshot({path:join(dir,'agents.png')});await page.click('#agent-trigger');
  await page.click('#pick');const target=await point(frame.getByTestId('primary-action'));await page.mouse.click(target.x,target.y);
  const width=page.locator('[data-property="width"]'),font=page.locator('[data-property="font-size"]');
  await width.fill('176');await font.fill('20');
  assert.equal(await frame.getByTestId('primary-action').evaluate(e=>getComputedStyle(e).fontSize),'20px');
  await page.click('#cite');await page.click('#capture-element');
  await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===2);
  const bounds=await page.locator('#preview').boundingBox();
  const crop={x:Math.round(bounds.x+bounds.width*.28),y:Math.round(bounds.y+bounds.height*.35),width:160,height:86};
  const baseline=(await page.screenshot({clip:crop,scale:'css'})).toString('base64');
  await page.click('#capture');await page.mouse.click(crop.x,crop.y);
  assert.equal(await page.locator('.ref-chip').count(),2);
  await page.mouse.down();await page.mouse.move(crop.x+50,crop.y+30);await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('.ref-chip').count(),2);assert.equal(await page.locator('#crop-layer').isVisible(),false);
  await page.click('#capture');await page.mouse.move(crop.x+crop.width,crop.y+crop.height);await page.mouse.down();
  await page.mouse.move(crop.x,crop.y,{steps:5});await page.screenshot({path:join(dir,'crop-selection.png')});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===3);
  const diff=await page.locator('.ref-chip img').last().evaluate(async(img,{baseline,width,height})=>{
    await img.decode();const expected=new Image();expected.src='data:image/png;base64,'+baseline;await expected.decode();
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
    function pixels(src){ctx.drawImage(src,0,0,width,height);return ctx.getImageData(0,0,width,height).data;}
    const a=pixels(img),b=pixels(expected);
    return {w:img.naturalWidth,h:img.naturalHeight,dpr:devicePixelRatio,error:a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length};
  },{baseline,...crop});
  assert([1,diff.dpr].some(f=>Math.abs(diff.w-crop.width*f)<2 && Math.abs(diff.h-crop.height*f)<2),JSON.stringify(diff));
  assert(diff.error<5,JSON.stringify(diff));
  console.log('Crop matched preview:',JSON.stringify(diff));
  await page.screenshot({path:join(dir,'selected.png')});
  await page.click('#save-edit');await page.waitForFunction(()=>document.querySelector('#preview').src.indexOf('//sample/')===-1);
  await frame.getByTestId('primary-action').waitFor();
  const manual=(await page.evaluate(()=>window.studio.state())).revisions.find(r=>r.agent==='manual');assert(manual);assert.equal(manual.parent,'sample');
  await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},out);
  await page.click('#export');await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('源码已导出到 '));
  const path=(await page.locator('#notice').textContent()).slice('源码已导出到 '.length);
  assert.match(await readFile(join(path,'styles.css'),'utf8'),/font-size: 20px !important/);
  // Select an actual search field, change its enclosing label, then discard the edits.
  await page.click('#pick');const field=await point(frame.locator('input[type=search]'));await page.mouse.click(field.x,field.y);
  await page.waitForFunction(()=>!document.querySelector('#element-properties').hidden && document.querySelector('#element-type').textContent==='<input>');
  await page.click('#parent');await page.waitForFunction(()=>document.querySelector('#element-type').textContent==='<label>');
  await page.locator('[data-property="height"]').fill('64');
  assert.equal(await frame.locator('label.search').evaluate(el=>getComputedStyle(el).height),'64px');
  await page.click('#discard');assert.notEqual(await frame.locator('label.search').evaluate(el=>getComputedStyle(el).height),'64px');
  await project('今日放映');await frame.locator('#book').waitFor();
  await page.click('#pick-chat');const p=await point(frame.locator('#book'));await page.mouse.click(p.x,p.y);
  await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===1);
  // The nonce only appears in the pixels. The request text and filename contain no answer.
  const nonce=String(Math.floor(1000+Math.random()*9000));
  await page.evaluate(async nonce=>{
    const c=document.createElement('canvas');c.width=540;c.height=220;const ctx=c.getContext('2d');ctx.fillStyle='#263f54';ctx.fillRect(0,0,c.width,c.height);ctx.font='bold 70px sans-serif';ctx.fillStyle='white';ctx.fillText('TIDE '+nonce,40,136);
    const blob=await new Promise(resolve=>c.toBlob(resolve));const dt=new DataTransfer();dt.items.add(new File([blob],'reference.png',{type:'image/png'}));
    document.querySelector('#brief').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:dt}));
  },nonce);
  await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===2);
  await page.click('#agent-trigger');await page.click('#model-picker');await page.fill('#model-search','6.2-sol');await page.click('[data-model="gpt-6.2-sol"]');await page.click('[data-effort="low"]');await page.click('#agent-trigger');
  const request='只改引用的按钮，把它的显示文字改成参考图片中白色的英文单词和数字，其他内容、布局、功能保持。';
  await page.fill('#brief',request);
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===2);
  assert.equal(await page.locator('#brief').inputValue(),request);assert.match(await page.locator('#agent-summary').textContent(),/gpt-6.2-sol/);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1100,700));
  await page.screenshot({path:join(dir,'compact.png')});
  if(live){
    await page.click('#generate');const deadline=Date.now()+760000;let state;
    await page.waitForFunction(async()=>(await window.studio.state()).job?.phase==='generating');
    await page.screenshot({path:join(dir,'agent-editing.png'),scale:'css'});
    do{await new Promise(r=>setTimeout(r,400));state=await page.evaluate(()=>window.studio.state());}while(!state.outcome && Date.now()<deadline);
    assert.equal(state.outcome?.kind,'ready',state.outcome?.message);
    const rev=state.revisions.find(r=>r.id===state.outcome.id);assert.equal(rev.parent,seed);assert.equal(rev.references.length,2);
    await frame.getByTestId('primary-action').waitFor();const result=await frame.getByTestId('primary-action').innerText();
    assert.match(result,new RegExp('TIDE\\s*'+nonce,'i'));await page.screenshot({path:join(dir,'vision.png')});
    await writeFile(join(dir,'verification.json'),JSON.stringify({result,nonce,revision:rev.id,agent:rev.agent,model:rev.model,effort:rev.effort,references:rev.references.map(r=>r.kind),manual:manual.id},null,2));console.log(result);
  }else{
    const traceFile=join('profile','revisions',manual.id,'design-trace.json');
    const trace=JSON.parse(await readFile(join(dir,traceFile),'utf8'));
    const delta=JSON.parse(await readFile(join(dir,'profile','revisions',manual.id,trace.differences),'utf8'));
    assert(delta.some(d=>d.changedPixels>0),'No observed pixels changed after the manual edit');
    await writeFile(join(dir,'verification.json'),JSON.stringify({mode:'real-editor-regression',case:'bundled recruiting example',
      parent:manual.parent,revision:manual.id,trace:traceFile,crop:diff,exported:path,
      changed:delta.map(d=>({device:d.device,pixels:d.changedPixels})),checks:trace.browser.map(c=>({device:c.device,passed:c.functionalPass}))},null,2));
  }
  console.log('Editor checks passed');
}finally{try{await app.close();}finally{clientLock?.close();}}
