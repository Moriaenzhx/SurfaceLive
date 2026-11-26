// Independent semantic replay of the two frozen K-03B first drafts; no contract/test-hook locators.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename,join,resolve} from 'node:path';
import {chromium} from 'playwright-core';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path));
const input=resolve(process.argv[2]),root=resolve('runs/K-03B');
assert.equal(input.startsWith(root+'/'),true,'K-03B experiment receipt required');
const receipt=await json(join(input,'receipt.json')),scene=receipt.scenario;
assert(['zhishi','recruiting'].includes(scene));
const attempt=join(input,'attempt'),output=await mkdtemp(join(root,'business-'+scene+'-'));
const report={kind:'independent frozen-source business replay',receipt:basename(input)+'/receipt.json',
  scenario:scene,runId:receipt.runId,model:receipt.model,effort:receipt.effort,originalStatus:receipt.status,
  scriptSha256:digest(await readFile(new URL(import.meta.url))),startedAt:new Date().toISOString(),views:[]};
let browser;
try{
  const trace=await json(join(input,receipt.trace));
  assert.equal(trace.attemptId,receipt.runId);
  if(!trace.code)throw Error('No generated source in the frozen receipt');
  report.contractId=trace.code.contractId;report.sourceVersion=trace.code.sourceVersion;
  const files={};report.files={};
  for(const name of ['index.html','styles.css','app.js']){
    files[name]=await readFile(join(attempt,name));report.files[name]=digest(files[name]);
    assert.equal(report.files[name],trace.code.files[name].sha256,name);
  }
  assert.equal(digest(JSON.stringify(report.files)),report.sourceVersion);
  browser=await chromium.launch({channel:'chrome',headless:true});
  report.browserVersion=browser.version();
  for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',
      locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage(),view={device,width,height,steps:[],screenshots:[],errors:[]};
    report.views.push(view);page.setDefaultTimeout(4500);
    page.on('pageerror',e=>view.errors.push(e.message));
    page.on('console',msg=>{if(msg.type()==='error')view.errors.push(msg.text());});
    const origin='https://surface-replay.test';
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url()),name=url.pathname.slice(1);
      if(url.origin!==origin||!Object.hasOwn(files,name))return route.abort();
      await route.fulfill({body:files[name],contentType:{'index.html':'text/html; charset=utf-8','styles.css':'text/css','app.js':'application/javascript'}[name]});
    });
    const shot=async state=>{
      const animation=await page.evaluate(async()=>{
        await document.fonts.ready;
        const paint=()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
        await paint();
        const playing=document.getAnimations().filter(a=>{
          const target=a.effect?.target;
          return target?.checkVisibility({contentVisibilityAuto:true})&&
            Number.isFinite(a.effect.getComputedTiming().endTime)&&a.playState==='running';
        });
        let settled=true;
        if(playing.length){
          let handle;
          settled=await Promise.race([Promise.allSettled(playing.map(a=>a.finished)).then(()=>true),
            new Promise(done=>{handle=setTimeout(()=>done(false),2500);})]);
          clearTimeout(handle);
        }
        await paint();
        const openDetails=Array.from(document.querySelectorAll('details[open] blockquote'))
          .filter(e=>e.checkVisibility({contentVisibilityAuto:true})).map(e=>{
            const rect=e.getBoundingClientRect();let effectiveOpacity=1;
            for(let node=e;node;node=node.parentElement)effectiveOpacity*=Number(getComputedStyle(node).opacity);
            return {quote:e.innerText.trim(),effectiveOpacity,top:rect.top,bottom:rect.bottom};
          });
        return {visibleFiniteAnimations:playing.length,settled,openDetails};
      });
      assert(animation.settled,'finite entry animation exceeded screenshot deadline');
      const file=device+'-'+state+'.png',bytes=await page.screenshot({path:join(output,file)});
      view.screenshots.push({state,file,animation,sha256:digest(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),
        ...await page.evaluate(()=>({scrollY,scrollWidth:document.documentElement.scrollWidth,
          visibleHeadings:[...document.querySelectorAll('h1,h2,h3,h4')].filter(el=>{
            const b=el.getBoundingClientRect();return b.width&&b.height&&b.bottom>0&&b.top<innerHeight;
          }).map(el=>el.innerText.trim()).slice(0,24)}))});
    };
    const step=async(name,action)=>{
      const item={name,passed:false};view.steps.push(item);
      item.observed=await action();item.passed=true;
    };
    try{
      await page.goto(origin+'/index.html');assert.equal(await page.evaluate(()=>localStorage.length),0);
      view.startingStorage='fresh empty origin';
      await shot('opening');
      await (scene==='zhishi'?timing:recruiting)(page,step,shot);
      view.passed=view.steps.length>0&&view.steps.every(s=>s.passed)&&!view.errors.length;
    }catch(error){
      view.passed=false;view.error=error.message.slice(0,1500);
      view.accessibilityAtFailure=(await page.locator('body').ariaSnapshot()).slice(0,12000);
      await shot('failure');
    }finally{await context.close();}
  }
  report.status=report.views.every(v=>v.passed)?'PASS':'BUSINESS_FAILURE';
}catch(error){report.status='BLOCKED';report.error=error.message;}
finally{
  await browser?.close();report.endedAt=new Date().toISOString();
  await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(report.status,output);
}
if(report.status!=='PASS')process.exitCode=1;

function button(page,pattern){return page.getByRole('button',{name:pattern}).first();}
function normalized(s){return s.replace(/\s+/gu,' ').trim();}
async function waitText(page,pattern){const node=page.getByText(pattern).filter({visible:true}).first();await node.waitFor();return normalized(await node.innerText());}
async function text(page){return normalized(await page.locator('body').innerText());}
async function timing(page,step,shot){
  await step('从用户档案进入事项、日期条件',async()=>{
    await button(page,/使用当前资料/).click();return waitText(page,/事项与日期/);
  });
  await step('查询后辨认候选日期、起止时刻和理由入口',async()=>{
    await button(page,/查询候选/).click();const entry=button(page,/12月8日.*09:00.*11:00.*理由/);
    await entry.waitFor();await shot('results');return {entry:await entry.getAttribute('aria-label')||await entry.innerText(),text:(await text(page)).slice(0,1300)};
  });
  await step('查看该时段的民俗理由与参考边界',async()=>{
    await button(page,/12月8日.*09:00.*11:00.*理由/).click();await waitText(page,/民俗依据/);
    const reason=page.getByRole('region',{name:/12月8日.*09:00.*11:00/});
    const observed=await reason.innerText();assert.match(observed,/巳时/);assert.match(observed,/搬家/);assert.match(observed,/民俗参考/);
    await shot('reason');return observed.slice(0,1500);
  });
  await step('保存当前时段，核对回执中的时刻',async()=>{
    await button(page,/保存此时段/).click();await waitText(page,/已保存/);
    const observed=await text(page);assert.match(observed,/12月8日/);assert.match(observed,/09:00\s*[-–—至]\s*11:00/);
    await shot('saved');return observed.slice(0,1300);
  });
  await step('比较两个时段并核实不同的候选项',async()=>{
    await button(page,/比较两个时段/).click();await waitText(page,/时间与理由对照/);
    const observed=await text(page),slots=await page.locator('dl > div').filter({has:page.getByText('时间',{exact:true})}).locator('dd').allInnerTexts();
    assert.equal(slots.length,2);assert.match(slots[0],/12月8日.*09:00–11:00/);assert.match(slots[1],/12月9日.*15:00–17:00/);
    await shot('comparison');return {slots:[...new Set(slots)],text:observed.slice(0,1400)};
  });
  await timingExtras(page,step,shot);
}
async function recruiting(page,step,shot){
  await step('在候选名单中选择陈澄，确认对象与缺口',async()=>{
    const before=await candidateRow(page,'陈澄');assert.match(before,/待复核/);
    await button(page,/查看陈澄/).click();await page.getByRole('heading',{name:'陈澄',exact:true}).waitFor();const gap=await waitText(page,/缺口：跨部门上线证据不足/);
    assert.match(await text(page),/陈澄/);await shot('selected');return {name:'陈澄',gap};
  });
  await step('展开对应证据，核对简历页码与缺口',async()=>{
    await button(page,/展开匹配证据/).click();const observed=await waitText(page,/简历第\s*2\s*页.*项目经历/);
    const block=page.locator('details[open]').filter({hasText:'跨部门上线经验'});assert.match(await block.innerText(),/联合数据工程、运营团队/);await shot('evidence');return {source:observed,block:normalized(await block.innerText())};
  });
  await step('选择待补证，验证拟保存和已保存可以区分',async()=>{
    const select=page.getByRole('combobox',{name:'复核结论'});await select.selectOption({label:'待补证'});
    const observed=await waitText(page,/拟保存.*待补证/);await shot('pending');return observed;
  });
  await step('保存人工复核并回到名单核对同一人',async()=>{
    await button(page,/保存复核/).click();const saved=await waitText(page,/已保存.*待补证/);
    await shot('saved');await button(page,/回到名单/).click();
    const row=await candidateRow(page,'陈澄');assert.match(row,/待补证/);await shot('returned-list');return {saved,row};
  });
  await hiringExtras(page,step,shot);
}

async function candidateRow(page,name){
  const row=page.locator('tr').filter({has:page.getByRole('button',{name:'查看'+name,exact:true})});
  await row.waitFor();assert.equal(await row.count(),1);
  return normalized(await row.innerText());
}

async function timingExtras(page,step,shot){
  await step('刷新重新打开保存项，核对保存的日期、时间、事项',async()=>{
    await page.reload();await button(page,/查看保存项/).click();
    const item=page.getByRole('listitem').filter({hasText:'2026年12月8日'});
    await item.waitFor();const actual=normalized(await item.innerText());
    assert.match(actual,/09:00–11:00/);assert.match(actual,/搬家/);await shot('reopened-save');return actual;
  });
  await step('改为签约和12月15日至17日，按日期分组核对两个结果和新事项的理由',async()=>{
    await button(page,/返回资料/).click();await button(page,/使用当前资料/).click();
    await page.getByLabel('事项类型').selectOption({label:'签约'});
    await page.getByLabel('开始日期').fill('2026-12-15');
    await page.getByLabel('结束日期').fill('2026-12-17');
    await button(page,/查询候选/).click();await page.getByRole('heading',{name:'候选时段',exact:true,level:1}).waitFor();
    const records=[];
    for(const [date,time] of [['12月15日','09:00–11:00'],['12月17日','15:00–17:00']]){
      const day=page.locator('section').filter({has:page.getByRole('heading',{name:date,exact:true})});
      const article=day.locator(':scope > article').filter({has:page.getByText(time,{exact:true})});
      assert.equal(await article.count(),1);await article.waitFor();records.push(normalized(await article.innerText()));
    }
    assert.equal(await page.getByRole('heading',{name:'12月8日',exact:true}).count(),0);
    await shot('changed-range');await button(page,/12月17日.*15:00.*17:00.*理由/).click();
    const region=page.getByRole('region',{name:/12月17日.*15:00.*17:00/});
    const reason=normalized(await region.innerText());assert.match(reason,/签约/);assert.match(reason,/民俗参考/);
    await shot('changed-reason');return {start:'2026-12-15',end:'2026-12-17',matter:'签约',records,reason};
  });
}

async function hiringExtras(page,step,shot){
  await step('重载后重新打开陈澄，核实待补证状态和历史之前之后的结论',async()=>{
    await page.reload();const row=await candidateRow(page,'陈澄');assert.match(row,/待补证/);
    await button(page,/查看陈澄/).click();await page.getByText(/复核历史（1）/).click();
    const history=await waitText(page,/待复核\s*→\s*待补证/);await shot('reopened-history');
    await button(page,/返回候选名单/).click();return {row,history};
  });
  await step('按姓名搜索林若宁，核对其独立证据、原文和仍待复核的状态',async()=>{
    await page.getByRole('searchbox',{name:'搜索候选人'}).fill('林若宁');
    const row=await candidateRow(page,'林若宁');assert.match(row,/待复核/);assert.match(row,/指标治理范围待核实/);
    assert.equal(await button(page,/查看陈澄/).count(),0);
    await button(page,/查看林若宁/).click();await page.getByRole('heading',{name:'林若宁',exact:true}).waitFor();
    await button(page,/展开匹配证据/).click();const block=page.locator('details[open]').filter({hasText:'跨部门上线经验'});
    const quote=normalized(await block.innerText());assert.match(quote,/林若宁在近期岗位/);assert.match(quote,/简历第 1 页/);assert.match(quote,/指标治理范围待核实/);
    await shot('alternate-evidence');await block.getByRole('button',{name:'查看简历原文'}).click();
    const dialog=page.getByRole('dialog',{name:/林若宁.*简历原文/}),source=normalized(await dialog.innerText());
    assert.match(source,/林若宁在近期岗位/);assert.match(source,/简历第 1 页/);await shot('alternate-source');
    return {row,quote,source};
  });
}
