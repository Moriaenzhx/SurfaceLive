// Validate the deliverable, including its extracted offline form. Never submit a completed ballot.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {readJSON} from '../design-evidence.mjs';
const dir='runs/K-02A',zip=join(dir,'reviewer.zip');
const key=await readJSON(join(dir,'organizer/review-key.json'));
const expected=['index.html','feedback-template.json',...key.pairs.flatMap(p=>p.views.map(v=>'images/'+v.id+'.png'))].sort();
const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n').sort();
assert.deepEqual(entries,expected);
const folder=await mkdtemp(join(tmpdir(),'k02a-packet-'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const report={packet:key.packet,archiveSha256:hash(await readFile(zip)),pairs:[],network:[],errors:[]};
let browser;
try{
  execFileSync('unzip',['-q',zip,'-d',folder]);
  const template=await readJSON(join(folder,'feedback-template.json'));
  assert.equal(template.status,'PENDING');assert.equal(template.packet,key.packet);assert.equal(template.comparisons.length,8);
  for(const f of ['index.html','feedback-template.json'])assert.doesNotMatch(await readFile(join(folder,f),'utf8'),/A-current|\bA0\b|gpt-|Codex|Claude|K-01|K-02|organizer|\/Users\//i);
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('request',r=>{if(!r.url().startsWith('file:'))report.network.push(r.url());});
  page.on('pageerror',e=>report.errors.push(e.message));
  let downloads=0;page.on('download',()=>downloads++);
  await page.goto(pathToFileURL(join(folder,'index.html')).href);
  for(const [i,p] of key.pairs.entries()){
    const row=template.comparisons[i],section=page.locator('[data-pair="'+p.id+'"]');
    assert.deepEqual([row.left,row.right],p.views.map(v=>v.id));assert.equal(row.status,'PENDING');
    assert.equal(row.preference,null);
    assert.deepEqual(await section.locator('select option').evaluateAll(opts=>opts.map(o=>o.value)),['',row.left,row.right,'NO_PREFERENCE','BOTH_POOR']);
    assert.equal(await section.locator('textarea').count(),5);
    const dims=[];
    for(const [j,v] of p.views.entries()){
      const bytes=await readFile(join(folder,'images',v.id+'.png'));assert.equal(hash(bytes),v.sha256);
      let chunks=[];
      for(let n=8;n<bytes.length;n+=12+bytes.readUInt32BE(n))chunks.push(bytes.toString('ascii',n+4,n+8));
      assert(!chunks.some(t=>['tEXt','iTXt','zTXt','eXIf'].includes(t)));
      const img=section.locator('img').nth(j);
      const size=await img.evaluate(img=>[img.naturalWidth,img.naturalHeight]);
      assert.deepEqual(size,row.viewport);assert.equal(await img.getAttribute('src'),'images/'+v.id+'.png');dims.push(size);
    }
    const [left,right]=await Promise.all([section.locator('img').first().boundingBox(),section.locator('img').last().boundingBox()]);
    assert(left.x+left.width<=right.x+1&&Math.abs(left.y-right.y)<1);
    report.pairs.push({id:p.id,viewport:row.viewport,loaded:dims.length});
  }
  await page.getByRole('button',{name:'导出匿名记录'}).click();
  assert.match(await page.locator('output').innerText(),/尚未填写/);
  await page.locator('textarea').first().fill('表单必填项校验');
  await page.locator('button').click();assert.match(await page.locator('output').innerText(),/请完成 P01/);
  assert.equal(downloads,0);assert.deepEqual(report.network,[]);assert.deepEqual(report.errors,[]);
  report.status='PASS';report.humanReview='PENDING';report.ballotsCreated=0;
  await writeFile(join(dir,'tests/packet-check.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser?.close();await rm(folder,{recursive:true,force:true});}
