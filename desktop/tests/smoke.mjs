import {acquireDesignClient} from '../../experiments/desktop-lock.mjs';
import {openProject} from './controls.mjs';
// Run against the packaged application. --live spends one request on the user's Codex CLI.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,chmod,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright-core';
const clientLock=process.env.SURFACELIVE_BACKGROUND_CHECKS?acquireDesignClient():null;
const root=fileURLToPath(new URL('../../',import.meta.url));
const resume=process.argv.find(arg=>arg.startsWith('--resume='))?.slice(9);
const live=Boolean(resume)||process.argv.includes('--live');
const dir=resume?resolve(resume):await mkdtemp(join(root,'runs',live?'desktop-live-':'desktop-smoke-'));
const profile=join(dir,'profile');
const executablePath=process.env.SURFACELIVE_TEST_APP||join(root,'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive');
const env={...process.env};
const out=join(dir,'export');await mkdir(out,{recursive:true});
if(!live){
  const script=join(dir,'fixture.cjs');
  await copyFile(join(root,'desktop/tests/design-agent-fixture.cjs'),script);
  await chmod(script,0o755);env.SURFACELIVE_CODEX_EXEC=script;
}
let app;
async function launch(){
  app=await electron.launch({executablePath,args:['--user-data-dir='+profile,'--workbench-acceptance',...(process.env.SURFACELIVE_BACKGROUND_CHECKS?['--background-design-check']:[])],env,timeout:45000});
  const page=await app.firstWindow();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>console.error('Renderer:',e.message));
  await page.getByRole('tab',{selected:true}).waitFor();
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);
  return page;
}
const productPrompt='给附近居民做一个手机周末放映单，列出三场虚构的社区电影。可以按日期筛选、查看剩余名额，并完成一次报名。';
let lastToken;
async function settle(page,kind){
  const deadline=Date.now()+(live?6*750000:75000);
  while(Date.now()<deadline){
    const state=await page.evaluate(()=>window.studio.state());
    if(!state.job && state.outcome && state.outcome.token!==lastToken){
      lastToken=state.outcome.token;
      assert.equal(state.outcome.kind,kind,state.outcome.message);
      return state;
    }
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error('Timed out waiting for '+kind);
}

try{
  let page=await launch();
  const initialCount=(await page.evaluate(()=>window.studio.state())).revisions.length;
  assert.equal(await page.evaluate(async()=>(await window.studio.direction('桌面作品，请改为手机端','auto')).device),'mobile');
  let s,revision;
  if(resume){
    s=await page.evaluate(()=>window.studio.state());
    revision=s.revisions.find(r=>!r.sample && r.description===productPrompt);
    assert(revision,'No generated screening page found in the existing profile');
    await openProject(page,revision.title);
    await page.frameLocator('#preview').getByTestId('primary-action').evaluate(()=>{localStorage.clear();});
    await page.reload();
    await page.frameLocator('#preview').getByTestId('primary-action').waitFor();
  }else{
    const frame=page.frameLocator('#preview');
    await frame.getByTestId('primary-action').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({path:join(dir,'studio.png')});
    await page.click('[data-view="mobile"]');
    assert.equal(await frame.locator('html').evaluate(()=>innerWidth),390);
    assert.equal(await frame.locator('html').evaluate(()=>typeof window.studio),'undefined');
    await openProject(page,'巷口放映');
    const sunday=frame.getByRole('button',{name:'11.22 周日'});
    await sunday.waitFor();await pressInFrame(sunday);
    assert.equal(await frame.locator('.screening:visible').count(),1);
    assert.equal(await frame.locator('.seats:visible').textContent(),'余 12 席');
    await pressInFrame(frame.getByTestId('primary-action'));
    assert.match(await frame.getByTestId('action-feedback').textContent(),/报名成功/);
    assert.equal(await frame.locator('.seats:visible').textContent(),'余 11 席');
    await page.click('#new');await page.fill('#brief',productPrompt);
    if(!await page.locator('.inspector').isVisible())await page.click('#toggle-right');
    await page.click('[data-tab="evidence"]');await page.waitForFunction(()=>document.querySelector('#cards article')&&document.querySelector('#scene-summary').textContent.includes('手机'));
    await page.click('[data-tab="compose"]');
    await page.click('#agent-trigger');await page.locator('.agent-option').filter({hasText:'Codex'}).click();
    if(live){await page.click('#model-picker');await page.fill('#model-search','6.2-sol');await page.click('[data-model="gpt-6.2-sol"]');}
    await page.click('#agent-trigger');
    await page.click('#generate');
    console.log('Generation started:',dir);
    s=await settle(page,'ready');
    revision=s.revisions.find(r=>r.id===s.outcome.id);
  }
  assert.equal(revision.direction.device,'mobile');
  const visiblePage=page.frameLocator('#preview');
  const button=visiblePage.getByTestId('primary-action').first();await button.waitFor();
  await page.screenshot({path:join(dir,'generated.png')});
  const before=await visiblePage.getByTestId('action-feedback').first().textContent().catch(()=>null);
  async function pressInFrame(locator){
    const point=await locator.evaluate(el=>{
      let r=el.getBoundingClientRect();
      if(r.top<0 || r.bottom>innerHeight){el.scrollIntoView({block:'center',behavior:'instant'});r=el.getBoundingClientRect();}
      return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight};
    });
    const frameBounds=await page.locator('#preview').evaluate(el=>el.getBoundingClientRect().toJSON());
    const x=frameBounds.x+point.x*frameBounds.width/point.w,y=frameBounds.y+point.y*frameBounds.height/point.h;
    await page.mouse.click(x,y);
  }
  await pressInFrame(button);
  const feedback=visiblePage.getByTestId('action-feedback').first();
  await page.waitForTimeout(350);
  const after=await feedback.textContent();
  assert.notEqual(after,before);
  if(live)assert.match(after,/报名成功|已报名|预留|预约成功/);
  await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},out);
  await page.click('#export');await page.getByRole('status').filter({hasText:'源码已导出到'}).waitFor();
  const exportNotice=await page.locator('#notice').textContent();const exported=exportNotice.slice('源码已导出到 '.length);
  assert(exported.startsWith(out+'/'));
  for(const name of ['index.html','styles.css','app.js'])assert((await readFile(join(exported,name))).length>0);
  await page.click('[data-view="tablet"]');assert.equal(await visiblePage.locator('html').evaluate(()=>innerWidth),834);
  if(!live){
    await page.click('#capture');const region=await page.locator('#crop-layer').boundingBox();
    await page.mouse.move(region.x+45,region.y+50);await page.mouse.down();
    await page.mouse.move(region.x-25,region.y-20,{steps:4});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelectorAll('.ref-chip').length===1);
    await page.fill('#brief','调整列表');await page.click('#generate');
    s=await settle(page,'ready');let second=s.revisions.find(r=>r.id===s.outcome.id);
    assert.equal(second.project,revision.project);assert.equal(second.parent,revision.id);
    assert.equal(second.references[0].original,true);
    await page.locator('.past-references button').last().click();
    await page.waitForFunction(()=>document.querySelectorAll('.ref-chip img').length===1);
    assert.match(await page.locator('.ref-chip img').getAttribute('src'),/^data:image\/jpeg;base64,/);
    await page.click('#history-menu');await page.locator('.version').last().click();
    assert((await page.locator('#preview').getAttribute('src')).includes(revision.id));
    await page.fill('#brief','FAIL_FIXTURE');await page.click('#generate');await settle(page,'error');
    await page.fill('#brief','WAIT_FIXTURE');await page.click('#generate');await page.click('#cancel');await settle(page,'cancelled');
    assert.equal((await page.evaluate(()=>window.studio.state())).revisions.length,initialCount+2);
  }
  await app.close();app=null;page=await launch();
  assert((await page.locator('#preview').getAttribute('src')).includes(revision.id));
  const final={kind:live?'real Codex':'fixture',title:revision.title,id:revision.id,device:revision.direction.device,
    checks:revision.checks,before,after,exported,reopened:true};
  if(!live&&process.argv.includes('--check-contract-inheritance')){
    const id=await page.evaluate(base=>window.studio.saveEdit({base,edits:[{selector:'h1',values:{'font-size':26}}]}),revision.id);
    const readTrace=async rev=>JSON.parse(await readFile(join(profile,'revisions',rev,'design-trace.json'),'utf8'));
    const original=await readTrace(revision.id),manual=await readTrace(id);
    assert.equal(manual.parent,revision.id);assert.equal(manual.code.contractId,original.code.contractId);
    assert.equal(manual.code.contractSha256,original.code.contractSha256);
    assert.equal(manual.code.application,'inherited-manual-edit');
    assert.notEqual(manual.code.sourceVersion,original.code.sourceVersion);
    assert.equal(manual.invocations,undefined);assert(manual.browser.every(c=>c.functionalPass));
    final.manual={id,parent:manual.parent,contractId:manual.code.contractId,sourceVersion:manual.code.sourceVersion};
  }
  if(!live&&process.argv.includes('--check-contract-repair')){
    await page.evaluate(()=>window.studio.start({text:'社区活动报名 CONTRACT_REPAIR_FIXTURE',agent:'codex',model:'fixture-only',
      effort:'low',target:'mobile',base:null,edits:[],references:[]}));
    const result=await settle(page,'ready');
    const record=JSON.parse(await readFile(join(profile,'revisions',result.outcome.id,'design-trace.json'),'utf8'));
    assert(record.invocations.every(call=>call.override));
    assert.equal(record.steps['pair-review'].status,'validated');
    assert.equal(record.steps['repair-review'].status,'validated');
    assert.equal(record.automaticRepair.accepted,true);
    assert.equal(record.chosenCandidate,'repair');
    const bindings=record.sourceInputs;
    assert.notEqual(bindings.alternative.contractId,bindings.source.contractId);
    assert.equal(bindings.repair.contractId,bindings.source.contractId);
    assert.equal(record.code.promptSha256,bindings.repair.promptSha256);
    assert.equal(record.code.sourceVersion,bindings.repair.sourceVersion);
    assert.equal(record.candidates.initial.passed,false);assert.equal(record.candidates.repair.passed,true);
    final.repair={id:result.outcome.id,contractId:record.code.contractId,sourceVersion:record.code.sourceVersion};
  }
  await writeFile(join(dir,'verification.json'),JSON.stringify(final,null,2));console.log(JSON.stringify(final));
}finally{try{await app?.close();}finally{clientLock?.close();}}
