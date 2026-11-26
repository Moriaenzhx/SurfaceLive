import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright-core';

const root=fileURLToPath(new URL('../../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'surfacelive-tab-tests-'));
const evidence=process.env.SURFACELIVE_TAB_SHOTS;
if(evidence)await mkdir(evidence,{recursive:true});
const executablePath=process.env.SURFACELIVE_TEST_APP || join(root,'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive');
const errors=[];
let app,page;
async function launch(){
  app=await electron.launch({executablePath,args:['--workbench-acceptance','--user-data-dir='+profile]});
  page=await app.firstWindow();page.setDefaultTimeout(8500);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1555,992));
  await page.waitForFunction(()=>document.querySelector('#project-tabs').childElementCount || document.querySelector('#blank-title').textContent==='尚未打开作品');
}
async function shot(name){
  if(!evidence)return;
  await page.waitForTimeout(200);
  const id=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getMediaSourceId().split(':')[1]);
  execFileSync('/usr/sbin/screencapture',['-x','-o','-l',id,join(evidence,name+'.png')]);
}
const tab=name=>page.getByRole('tab',{name,exact:true});
const active=()=>page.getByRole('tab',{selected:true}).textContent();
const close=name=>page.getByRole('button',{name:'关闭标签 · '+name,exact:true}).click();
const frame=()=>page.frameLocator('#preview');
const search=()=>frame().locator('input[type=search]');
async function settings(side,theme){
  await page.click('#settings');
  await page.locator('input[name=conversation-side][value='+side+']').check();
  await page.locator('input[name=theme][value='+theme+']').check();
}
const recruiting='招聘复核工作台',cinema='巷口放映 · 周末放映单';
try{
  await launch();
  await search().waitFor();
  assert.deepEqual(await page.getByRole('tab').allTextContents(),[recruiting,cinema]);
  assert.equal(await page.locator('.titlebar #focus,.titlebar .rail-toggle').count(),0);
  assert.equal(await page.locator('#export').innerText(),'');
  await page.click('#toggle-right');await page.locator('#inspector').waitFor();
  await page.mouse.move(6,4);await shot('light');
  const exportButton=page.locator('#export'),tooltip=page.getByRole('tooltip',{name:'导出'});
  const box=await exportButton.boundingBox();
  assert(box,'Export button is visible');
  // macOS can interleave native mouse motion with a single CDP hover during the tooltip's delay.
  // Hold the pointer inside this test window until the actual tooltip is visible.
  for(let i=0;i<60;i++){
    await page.mouse.move(box.x+box.width/2+i%2,box.y+box.height/2);
    if(await tooltip.isVisible())break;
    await page.waitForTimeout(18);
  }
  await tooltip.waitFor();
  if(evidence){
    await page.waitForTimeout(350);
    const tip=await page.locator('#export-tip').boundingBox();
    assert(tip && tip.width>20 && tip.height>10,JSON.stringify(tip));
    const bitmap=await app.evaluate(async({BrowserWindow})=>{
      const w=BrowserWindow.getAllWindows()[0],image=await w.webContents.capturePage({x:w.getContentSize()[0]-180,y:0,width:180,height:86});
      return image.toPNG().toString('base64');
    });
    await writeFile(join(evidence,'export-tooltip.png'),Buffer.from(bitmap,'base64'));
  }
  const exportTo=join(profile,'export');await mkdir(exportTo);
  await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},exportTo);
  await page.click('#export');await page.getByRole('status').filter({hasText:'源码已导出到'}).first().waitFor();
  const dir=(await page.locator('#notice').innerText()).slice('源码已导出到 '.length);
  assert.deepEqual(await readFile(join(dir,'index.html')),await readFile(join(root,'desktop/samples/recruiting/index.html')));

  // Switching tabs preserves the live document and its private composer.
  await search().fill('林');await page.fill('#brief','桌面作品草稿');
  await tab(cinema).click();await frame().getByTestId('primary-action').waitFor();
  assert.equal(await page.locator('#brief').inputValue(),'');
  assert.equal(await frame().locator('html').evaluate(()=>innerWidth),390);
  await tab(recruiting).click();assert.equal(await search().inputValue(),'林');
  assert.equal(await page.locator('#brief').inputValue(),'桌面作品草稿');
  await search().fill('');await page.locator('#brief').fill('');
  const pageAppearance=()=>frame().locator('body').evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el).color,matchMedia('(prefers-color-scheme: dark)').matches]);
  const original=await pageAppearance();
  await settings('right','dark');
  const rect=selector=>page.locator(selector).boundingBox();
  assert((await rect('#inspector')).x < (await rect('.workspace')).x);
  assert((await rect('#conversation')).x > (await rect('.workspace')).x);
  assert.deepEqual(await pageAppearance(),original);
  await page.keyboard.press('Escape');assert(await page.locator('#settings').evaluate(e=>e===document.activeElement));
  await page.click('#pick');
  const inner=await frame().getByTestId('primary-action').evaluate(el=>{const r=el.getBoundingClientRect();return [(r.x+r.width/2)/innerWidth,(r.y+r.height/2)/innerHeight];});
  const preview=await rect('#preview');await page.mouse.click(preview.x+preview.width*inner[0],preview.y+preview.height*inner[1]);
  await page.locator('[data-property=width]').waitFor();
  await page.click('#settings');await shot('dark-settings');await page.keyboard.press('Escape');
  await page.mouse.move(6,4);await shot('dark-swapped');
  await page.click('#mode-preview');
  for(const [button,edge,section] of [['toggle-right','left-edge','inspector'],['toggle-left','right-edge','conversation']]){
    await page.click('#'+button);assert(!await page.locator('#'+section).isVisible());
    assert.equal(await page.locator('#'+button).evaluate(e=>e.parentElement.id),edge);
    await page.click('#'+button);assert(await page.locator('#'+section).isVisible());
  }
  const divider=page.locator('.library .rail-resize');
  const initialWidth=(await rect('.library')).width;await divider.focus();await page.keyboard.press('ArrowLeft');
  assert.equal((await rect('.library')).width,initialWidth+12);await page.keyboard.press('ArrowRight');
  assert.equal((await rect('.library')).width,initialWidth);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(960,640));
  await page.waitForFunction(()=>innerWidth===960);
  const widths=await page.evaluate(()=>['.workspace-toolbar','.library','.inspector','.titlebar'].map(s=>{const e=document.querySelector(s);return [s,e.clientWidth,e.scrollWidth];}));
  assert.deepEqual(widths.filter(([,client,scroll])=>scroll>client+1),[],JSON.stringify(widths));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1555,992));

  // Closing a tab never deletes its project. Two unsent drafts have distinct storage.
  await close(cinema);assert.equal(await active(),recruiting);
  await page.click('#new');const firstDraft=await active();await page.fill('#brief','第一个新作品的需求');
  await page.click('#new');const secondDraft=await active();assert.notEqual(firstDraft,secondDraft);
  assert.equal(await page.locator('#brief').inputValue(),'');await page.fill('#brief','第二个新作品的需求');
  await close(firstDraft);assert.equal(await page.locator('#brief').inputValue(),'第二个新作品的需求');
  await page.locator('#projects').getByRole('button',{name:firstDraft,exact:true}).click();
  assert.equal(await page.locator('#brief').inputValue(),'第一个新作品的需求');
  await page.locator('#projects').getByRole('button',{name:cinema,exact:true}).click();
  await frame().getByTestId('primary-action').waitFor();assert.equal(await active(),cinema);
  await app.close();app=null;await launch();
  assert.equal(await active(),cinema);
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.dataset.theme,document.documentElement.dataset.conversationSide]),['dark','right']);
  await tab(secondDraft).click();assert.equal(await page.locator('#brief').inputValue(),'第二个新作品的需求');
  await tab(secondDraft).press('Home');assert.equal(await active(),recruiting);
  await tab(recruiting).press('ArrowRight');assert.equal(await active(),cinema);
  while(await page.getByRole('tab').count())await close(await active());
  assert(await page.locator('#blank-title').getByText('尚未打开作品').isVisible());
  assert(await page.locator('#export').isDisabled());
  await page.reload();await page.getByText('尚未打开作品').waitFor();assert.equal(await page.getByRole('tab').count(),0);
  await page.locator('#projects').getByRole('button',{name:recruiting,exact:true}).click();await search().waitFor();
  await settings('left','light');await page.keyboard.press('Escape');
  assert((await rect('#conversation')).x<(await rect('#inspector')).x);
  assert.deepEqual(await pageAppearance(),original);

  // Many tabs scroll within the strip while the new-tab and settings buttons stay in view.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(960,640));
  for(let i=0;i<12;i++)await page.click('#new');
  const strip=await page.locator('#project-tabs').evaluate(e=>({width:e.clientWidth,all:e.scrollWidth}));
  assert(strip.all>strip.width);
  const lastTab=await page.getByRole('tab',{selected:true}).boundingBox(),plus=await rect('#new');
  assert(lastTab.x>=0 && lastTab.x+lastTab.width<=plus.x && plus.x+plus.width<(await rect('#settings')).x);
  // A pre-tab profile can reopen the original ungenerated draft alongside both samples.
  await page.evaluate(()=>{
    localStorage.removeItem('workbench-project-tabs');localStorage.setItem('selection','');
    localStorage.setItem('draft:new',JSON.stringify({text:'升级前的草稿',target:'tablet'}));
  });
  await page.reload();await page.getByRole('tab',{name:'新作品',exact:true}).waitFor();
  assert.equal(await page.locator('#brief').inputValue(),'升级前的草稿');
  assert.equal(await page.locator('#target').inputValue(),'tablet');
  assert.equal(await page.getByRole('tab').count(),3);
  assert.deepEqual(errors,[]);
  console.log('Passed tabs, drafts, running preview, side placement, resize, two themes, settings persistence, tooltip and source export.');
}finally{await app?.close();}
