import {toggleFocusPreview} from './controls.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright-core';
import executablePath from 'electron';
const stage=process.argv[2]||'batch5',root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,process.env.SURFACELIVE_QA_DIR||join('runs','workbench-ux-20261120',stage));
await mkdir(out,{recursive:true});const profile=await mkdtemp(join(out,'profile-'));
const packaged=process.env.SURFACELIVE_TEST_APP||(stage==='batch5'?join(root,'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive'):null);
const app=await electron.launch({executablePath:packaged||executablePath,args:[...(packaged?[]:[join(root,'build/desktop')]),'--workbench-acceptance','--user-data-dir='+profile],timeout:45000});
const errors=[],measurements=[];
try{
  const page=await app.firstWindow();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const preview=page.frameLocator('#preview');
  await preview.getByTestId('primary-action').waitFor();
  const cdp=await page.context().newCDPSession(page);
  let nativeSize;
  async function resize(width,height){
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await app.evaluate(({BrowserWindow},[w,h])=>BrowserWindow.getAllWindows()[0].setContentSize(w,h),[width,height]);
    await page.waitForTimeout(250);
    const actual=await page.evaluate(()=>[innerWidth,innerHeight]);
    nativeSize=actual;
    if(actual[0]!==width||actual[1]!==height)await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[width,height]);
  }
  async function shot(name){
    await page.waitForTimeout(300);
    if(name==='preview-loading'){
      const bitmap=await app.evaluate(async({BrowserWindow})=>{
        const win=BrowserWindow.getAllWindows()[0],size=win.getContentSize();
        const image=await win.webContents.capturePage();
        return image.resize({width:size[0],height:size[1]}).toPNG({scaleFactor:1}).toString('base64');
      });
      await writeFile(join(out,name+'.png'),Buffer.from(bitmap,'base64'));
      assert.equal(await page.locator('#canvas-status').innerText(),'正在载入');
    }else await page.screenshot({path:join(out,name+'.png'),scale:'css'});
    const state=await page.evaluate(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round);};
      return {window:[innerWidth,innerHeight],preview:rect(document.querySelector('#preview')),left:rect(document.querySelector('.library')),right:rect(document.querySelector('.inspector')),scale:document.querySelector('#scale').textContent,overflow:document.body.scrollWidth>innerWidth};
    });
    const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('.library,.inspector,.workspace-toolbar,.panel-head,.composer-area,#properties,#evidence,.canvas-footer')).filter(e=>e.clientWidth && e.scrollWidth>e.clientWidth+2).map(e=>e.id||e.className));
    measurements.push({name,nativeSize,...state,panelOverflow:overflow});assert.equal(state.overflow,false);assert.deepEqual(overflow,[]);
  }
  for(const [w,h] of [[1555,992],[1280,800],[1920,1080]]){await resize(w,h);await shot('workspace-'+w);}
  if(stage.startsWith('batch5')){
    assert(!await page.locator('.inspector').isVisible());await page.click('#toggle-right');
    await resize(960,640);await shot('minimum-both-panels');
    await page.click('#toggle-right');assert(!await page.locator('.inspector').isVisible());
    await page.click('#toggle-right');
    await page.click('#toggle-left');assert.equal(await page.locator('.library').isVisible(),false);await page.click('#toggle-left');
    await resize(1555,992);await page.locator('.library .rail-resize').focus();const before=(await page.locator('.library').boundingBox()).width;await page.keyboard.press('ArrowRight');
    assert.equal((await page.locator('.library').boundingBox()).width,before+12);await page.keyboard.press('ArrowLeft');
    assert.equal((await page.locator('.library').boundingBox()).width,before);
  }
  await resize(1555,992);
  if(stage==='batch5'){
    for(const [device,width] of [['tablet',834],['mobile',390],['desktop',1440]]){
      await page.click('[data-view="'+device+'"]');assert.equal(await preview.locator('html').evaluate(()=>innerWidth),width);
      if(device!=='desktop')await shot(device);
    }
  }
  await toggleFocusPreview(page);await shot('focus');await toggleFocusPreview(page);
  if(stage.startsWith('batch5')||['batch3','batch4'].includes(stage)){
    async function clickPreview(locator){
      await page.waitForTimeout(300);
      const p=await locator.evaluate(el=>{const r=el.getBoundingClientRect();return [(r.x+r.width/2)/innerWidth,(r.y+r.height/2)/innerHeight];});
      const outer=await page.locator('#preview').evaluate(el=>el.getBoundingClientRect().toJSON());
      const x=outer.x+p[0]*outer.width,y=outer.y+p[1]*outer.height;
      const under=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,[x,y]);
      assert(['preview','pick-layer'].includes(under),'Unexpected hit target '+under+' at '+x+','+y);
      await page.mouse.click(x,y);
    }
    const primary=preview.getByTestId('primary-action'),before=await preview.getByTestId('action-feedback').innerText();
    await clickPreview(primary);await page.waitForTimeout(550);
    assert.notEqual(await preview.getByTestId('action-feedback').innerText(),before);
    await preview.locator('input[type=search]').fill('林');await shot('live-search');await preview.locator('input[type=search]').fill('');
    await page.click('#pick');await page.waitForTimeout(150);await clickPreview(primary);
    await page.locator('[data-property=width]').waitFor();await page.click('#cite');await page.fill('#brief','保留按钮位置，降低它的视觉权重。');
    await page.getByLabel('宽度单位',{exact:true}).selectOption('%');await page.locator('[data-property=width]').fill('32');
    await preview.locator('style[data-surfacelive-draft]').waitFor({state:'attached'});
    assert.match(await preview.locator('style[data-surfacelive-draft]').textContent(),/32%/);
    await page.getByLabel('宽度单位',{exact:true}).selectOption('px');await page.locator('[data-property=width]').fill('172');await page.locator('[data-property=color]').fill('#ddecff');await page.locator('[data-property=color]').press('Tab');
    assert.equal(await primary.evaluate(el=>getComputedStyle(el).width),'172px');
    assert.equal(await primary.evaluate(el=>getComputedStyle(el).color),'rgb(221, 236, 255)');
    assert.equal(await page.locator('#save-state').innerText(),'样式未保存');await shot('selection');
    await page.click('#mode-preview');await page.click('#zoom');await page.fill('#zoom-value','82.5');await page.locator('#zoom-value').press('Enter');
    assert.equal(await primary.evaluate(()=>innerWidth),1440);
    let rect=await page.locator('#preview').boundingBox();assert(Math.abs(rect.width-1440*.825)<1);
    await shot('custom-zoom');
    if(stage==='batch5'){
      if(!await page.locator('.inspector').isVisible())await page.click('#toggle-right');
      await page.click('[data-tab="evidence"]');await page.locator('#cards article').first().waitFor();await shot('evidence');await page.click('[data-tab="compose"]');
    }
    await toggleFocusPreview(page);await page.click('#zoom');await page.click('[data-zoom="100"]');await shot('focus-100');
    rect=await page.locator('#preview').boundingBox();assert.equal(rect.width,1440);await toggleFocusPreview(page);
    const exportDir=join(out,'export');await mkdir(exportDir,{recursive:true});
    await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},exportDir);
    await page.click('#export');await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('源码已导出到 '));
    const dir=(await page.locator('#notice').innerText()).slice('源码已导出到 '.length);
    assert.match(await readFile(join(dir,'styles.css'),'utf8'),/color: #ddecff !important/);
    assert.equal(await readFile(join(dir,'index.html'),'utf8'),await readFile(join(root,'desktop/samples/recruiting/index.html'),'utf8'));await shot('export');
  }
  if(stage.startsWith('batch5')||stage==='batch4'){
    const revision=await page.evaluate(()=>(new URL(document.querySelector('#preview').src)).hostname);
    const script=join(profile,'revisions',revision,'app.js'),original=await readFile(script);
    if(stage==='batch5'){
      // Delay this disposable revision to observe the real loading state.
      await writeFile(script,"const end=performance.now()+4500;while(performance.now()<end){};"+original.toString());
      try{
        await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#canvas-status').textContent==='正在载入');
        await shot('preview-loading');await preview.getByTestId('primary-action').waitFor();
      }finally{await writeFile(script,original);}
    }
    await writeFile(script,"throw new Error('WORKBENCH_PREVIEW_CHECK');");
    await page.reload();
    try{
      await page.waitForFunction(()=>!document.querySelector('#retry-preview').hidden);
      assert.match(await page.locator('#preview-detail').innerText(),/app.js.*WORKBENCH_PREVIEW_CHECK/);await shot('preview-error');
    }finally{await writeFile(script,original);}
    await page.click('#retry-preview');await preview.getByTestId('primary-action').waitFor();
    await page.waitForFunction(()=>document.querySelector('#canvas-status').textContent==='交互预览');
  }
  await page.click('#new');await shot('empty');
  if(stage.startsWith('batch5')||stage==='batch4'){
    const brief=page.getByRole('textbox',{name:'给 Agent 的消息'});
    assert.equal(await page.getByRole('heading',{name:'示例需求'}).count(),0);
    assert.equal(await brief.inputValue(),'');
    assert(await brief.evaluate(el=>el===document.activeElement));
    await brief.fill('给陶艺教室做一个手机预约页，学员能选择时段、填写人数并查看预约结果。');
    const fixture=join(profile,'test-agent');
    await writeFile(fixture,'#!/bin/sh\nsleep 2\necho "QA provider unavailable" >&2\nexit 2\n',{mode:0o755});
    async function switchProvider(path){
      await app.evaluate((_electron,file)=>{process.env.SURFACELIVE_CODEX_EXEC=file;process.env.SURFACELIVE_CLAUDE_EXEC=file;},path);
      await page.click('#agent-trigger');await page.click('#refresh');await page.waitForTimeout(200);await page.click('#agent-trigger');
    }
    await switchProvider(fixture);await page.click('#generate');await page.locator('#progress').waitFor();await shot('generation-loading');
    const errorNotice=page.locator('#notice[data-kind="error"]');
    await errorNotice.filter({hasText:'CLI 未成功返回结构化结果'}).waitFor();
    const outcome=await page.evaluate(async()=>(await window.studio.state()).outcome);
    assert.equal(outcome.kind,'error');
    assert.equal(await errorNotice.textContent(),outcome.message);
    assert(!outcome.message.includes('QA provider unavailable'));
    await shot('agent-error');
    await switchProvider(join(profile,'missing-cli'));assert(await page.locator('#generate').isDisabled());await shot('agent-offline');
  }
  assert.deepEqual(errors.filter(e=>!e.includes("WORKBENCH_PREVIEW_CHECK")),[]);console.log(JSON.stringify(measurements));
}finally{await writeFile(join(out,'metrics.json'),JSON.stringify({measurements,errors},null,2));await app.close();}
