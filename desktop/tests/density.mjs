import {openProject, toggleFocusPreview} from './controls.mjs';
import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import devElectron from 'electron';
import {_electron as electron} from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const stage = process.argv[2];
assert(['before', 'after'].includes(stage), 'Pass before or after.');
const out = process.env.SURFACELIVE_QA_DIR || join(root, 'runs/ide-workbench/density', stage);
const scratch = process.env.SURFACELIVE_QA_DIR || join(root, 'runs/density-20261120');
await mkdir(out, {recursive:true});
await mkdir(scratch, {recursive:true});
const profile = await mkdtemp(join(scratch, stage + '-profile-'));
const executablePath = process.env.SURFACELIVE_TEST_APP || join(root,'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive');
const conversation = process.argv.includes('--conversation');
const args = ['--workbench-acceptance','--user-data-dir='+profile];
if (conversation) {
  // Replay the original locally generated cinema revision, with its real prompt and model metadata.
  const samples = JSON.parse(await readFile(join(root,'desktop/samples/catalog.json'),'utf8'));
  const [run,id] = samples.find(sample => sample.id === 'sample-cinema').source.split('/');
  const revision = join(profile,'revisions',id);
  await mkdir(revision,{recursive:true});
  for(const file of ['revision.json','index.html','styles.css','app.js']) {
    await copyFile(join(root,'runs',run,'profile/revisions',id,file),join(revision,file));
  }
  if(stage==='before')args.unshift(join(scratch,'baseline-app'));
}
const app = await electron.launch({executablePath:conversation && stage==='before' ? devElectron : executablePath, args});
const metrics = [], errors = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const frame = page.frameLocator('#preview');
  async function resize(w,h) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [w,h]);
    await page.waitForFunction(([w,h]) => innerWidth === w && innerHeight === h,[w,h]);
  }
  async function inspector(open) {
    if (await page.locator('.inspector').isVisible() !== open) await page.click('#toggle-right');
  }
  async function shot(name) {
    await frame.getByTestId('primary-action').waitFor();
    await page.waitForFunction(() => document.querySelector('#preview-message')?.hidden !== false);
    await page.mouse.move(8,3);
    await page.waitForTimeout(250);
    const measurements = await page.evaluate(() => {
      const size = selector => {
        const {width,height} = document.querySelector(selector).getBoundingClientRect();
        return [Math.round(width),Math.round(height)];
      };
      const widths = ['.library','.workspace','.inspector'].map(s => size(s)[0]);
      const heights = ['.titlebar','.workspace-toolbar','.canvas-footer','.composer','.composer-area'].map(s => size(s)[1]);
      const selectors = '.library,.workspace-toolbar,.inspector,.composer-area,.canvas-footer,#properties';
      const overflow = [...document.querySelectorAll(selectors)].filter(e => e.clientWidth && e.scrollWidth>e.clientWidth+2).map(e=>e.className);
      return {window:[innerWidth,innerHeight], widths, heights, rendered:size('#preview'), scale:document.querySelector('#scale').textContent, overflow};
    });
    const viewport = await frame.locator('html').evaluate(() => [innerWidth,innerHeight]);
    metrics.push({name,viewport,...measurements});
    assert.deepEqual(measurements.overflow,[]);
    assert(Math.abs(measurements.rendered[0]/viewport[0]*100-parseFloat(measurements.scale))<0.25);
    await page.screenshot({path:join(out,name+'.png'),scale:'css'});
  }
  await frame.getByTestId('primary-action').waitFor();
  await resize(1555,992);
  if(conversation) {
    await page.locator('.agent-message button').waitFor();
    await inspector(false);
    await page.fill('#brief','把报名按钮的文字再简短一些。');
    await page.locator('#brief').blur();
    await shot('conversation');
    if(process.argv.includes('--native')){
      const source = await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getMediaSourceId());
      const windowId = source.match(/^window:(\d+):/)[1];
      execFileSync('/usr/sbin/screencapture',['-x','-o','-l',windowId,join(out,'conversation-native.png')]);
    }
  } else {
    for (const [device,title,width] of [['desktop','招聘复核',1440],['mobile','巷口放映',390]]) {
      await openProject(page,title);
      await frame.getByTestId('primary-action').waitFor();
      assert.equal(await frame.locator('html').evaluate(()=>innerWidth),width);
      for (const opened of [false,true]) {
        await inspector(opened);
        await shot(device + (opened ? '-open' : '-closed'));
      }
    }
    await openProject(page,'招聘复核');
    await frame.getByTestId('primary-action').waitFor();
    const selectMode = await page.locator('#mode-select').isVisible() ? '#mode-select' : '#pick';
    await page.click(selectMode);
    const normalize = await frame.getByTestId('primary-action').evaluate(el => {
      const r=el.getBoundingClientRect(); return [(r.x+r.width/2)/innerWidth,(r.y+r.height/2)/innerHeight];
    });
    const r=await page.locator('#preview').boundingBox();
    await page.mouse.click(r.x+r.width*normalize[0],r.y+r.height*normalize[1]);
    await page.locator('[data-property="width"]').waitFor();
    await shot('desktop-selection');
    await page.click('#deselect');
    await inspector(false);
    for(const [w,h] of [[1280,800],[1920,1080]]) {
      await resize(w,h); await inspector(false); await shot('desktop-'+w);
    }
    if (stage === 'after') {
      await resize(1555,992);
      await page.click(selectMode);
      assert(await page.locator('.inspector').isVisible());
      await toggleFocusPreview(page);
      assert.equal(await page.locator('#pick-layer').isVisible(),false);
      await page.click('#zoom');
      await page.click('[data-zoom="100"]');
      await shot('focus-100');
      await frame.getByTestId('primary-action').focus();await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.body.classList.contains('focus'));
      await page.click('#zoom');await page.click('[data-zoom="fit"]');
      await page.click('#history-menu');await shot('history-menu');
      await page.keyboard.press('Escape');
      assert(await page.locator('#history-menu').evaluate(el=>el===document.activeElement));
      await page.click('#capture');
      assert(await page.locator('#crop-layer').isVisible());
      await shot('rectangle-capture');
      await page.keyboard.press('Escape');
      assert(!await page.locator('#crop-layer').isVisible());
      await page.click('#agent-trigger');
      await shot('agent-menu');
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        localStorage.setItem('rail-widths',JSON.stringify({left:440,right:440}));
        localStorage.setItem('panel-visibility',JSON.stringify({left:true,right:false}));
      });
      await page.reload(); await frame.getByTestId('primary-action').waitFor();
      assert.equal(await page.locator('.inspector').isVisible(), false);
      await inspector(true);
      await page.reload(); await frame.getByTestId('primary-action').waitFor();
      assert(await page.locator('.inspector').isVisible());
      const left = page.locator('.library .rail-resize');
      await left.focus();
      for(let i=0;i<8;i++) await page.keyboard.press('ArrowLeft');
      assert.equal((await page.locator('.library').boundingBox()).width,272);
      for(let i=0;i<8;i++) await page.keyboard.press('ArrowRight');
      assert.equal((await page.locator('.library').boundingBox()).width,312);
      assert((await page.locator('.inspector').boundingBox()).width<=304);
      await page.fill('#brief','第一行\n第二行\n第三行');
      assert((await page.locator('.composer').boundingBox()).height>55);
    }
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(join(out,conversation?'conversation-metrics.json':'metrics.json'),JSON.stringify({metrics, errors},null,2)+'\n');
  await app.close();
}
