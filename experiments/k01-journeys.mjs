import assert from 'node:assert/strict';
export const journeys={};
journeys['zhishi/A0']=async(p,step)=>{
  await step('保存四柱并检查资料摘要',async()=>{
    await p.click('#profile');
    for(const select of await p.locator('#profile-form select').all())await select.selectOption('甲子');
    await p.click('#profile-form button');const summary=await p.innerText('#profile-summary');assert.match(summary,/甲子/);return summary;
  });
  await step('选择出行与时间范围，生成候选',async()=>{
    await p.locator('label').filter({hasText:'出行'}).click();await p.fill('#start','2026-12-01');await p.fill('#end','2026-12-07');
    await p.click('button[type=submit]');const text=await p.innerText('#result-summary');assert.match(text,/出行/);assert(await p.locator('#cards article').count()>=2);return text;
  });
  await step('查看推荐理由',async()=>{await p.locator('[data-action=reason]').first().click();
    const text=await p.innerText('#dialog-content');assert.match(text,/民俗/);await p.click('#close');return text;});
  await step('比较两个不同结果',async()=>{const boxes=p.locator('#cards input[type=checkbox]');
    await boxes.nth(0).check();await boxes.nth(1).check();await p.click('#compare');
    assert.equal(await p.locator('#dialog-content article').count(),2);await p.click('#close');return 2;});
  await step('收藏结果刷新后仍可读取',async()=>{await p.locator('[data-action=save]').first().click();await p.reload();await p.click('#saved');
    const text=await p.innerText('#dialog-content');assert.match(text,/出行/);return text;});
};
journeys['recruiting/A0']=async(p,step)=>{
  await step('核对岗位需求',async()=>{await p.click('#job-open');const text=await p.innerText('#job-dialog');assert.match(text,/必备条件/);await p.click('#job-dialog button');return '必备条件';});
  await step('搜索并打开匹配证据',async()=>{await p.fill('#query','周嘉宁');assert.equal(await p.locator('#rows .person').count(),1);
    await p.click('#rows .person');const text=await p.locator('.evidence').first().innerText();assert.match(text,/Java/);return text;});
  await step('筛选并按匹配度升序排列',async()=>{await p.fill('#query','');await p.selectOption('#threshold','90');await p.selectOption('#sort','low');
    const scores=await p.locator('#rows .score').allTextContents();assert.deepEqual(scores,['91%','93%','96%']);return scores;});
  await step('人工复核状态与备注刷新后可读',async()=>{await p.click('[data-candidate="2"]');await p.fill('#note','本地测试：核对库存迁移经历');
    await p.click('[data-state="hold"]');await p.reload();await p.click('[data-filter="hold"]');await p.click('[data-candidate="2"]');
    const state=await p.innerText('.detail-head');assert.match(state,/待补充/);assert.match(await p.inputValue('#note'),/迁移经历/);return state;});
  await step('查看搜索任务并返回',async()=>{await p.locator('.heading [data-page=tasks]').click();const text=await p.innerText('#tasks');assert.match(text,/已完成/);
    await p.locator('#tasks .primary').click();assert(await p.locator('#review').isVisible());return '已完成';});
};
journeys['zhishi/A-current']=async(p,step)=>{
  await step('核对生产门禁期望与初始查询的实际结果',async()=>{
    await p.click('[data-task=query-times]');const group=p.locator('#candidates .group').first();
    const date=await group.locator('h2').innerText(), time=await group.locator('.time').first().innerText();
    assert.equal(date,'11 月 24 日');assert.equal(time,'09:00–11:00');
    const literal=(await p.innerText('#results')).includes(date+' '+time);
    await p.click('#edit');return {date,time,exactContiguousMatch:literal};
  });
  await step('编辑四柱、事项和时间范围，生成候选',async()=>{
    await p.fill('[name=day]','甲子');await p.locator('label').filter({hasText:'出行'}).click();
    await p.fill('[name=start]','2026-12-01');await p.fill('[name=end]','2026-12-07');await p.click('[data-task=query-times]');
    const text=await p.innerText('#summary');assert.match(text,/出行.*2026-12-01.*甲子/);assert(await p.locator('.candidate').count()>0);return text;
  });
  await step('展开理由与民俗参考边界',async()=>{const card=p.locator('.candidate').first();await card.getByRole('button',{name:'查看理由'}).click();
    const text=await card.locator('.details').innerText();assert.match(text,/无法保证/);return text;});
  await step('保存时段、刷新并读取原查询条件',async()=>{await p.locator('.candidate').first().getByRole('button',{name:'保存时段'}).click();
    await p.reload();await p.click('#open-saved');const text=await p.innerText('#saved-list');assert.match(text,/出行.*甲子/);return text;});
};
journeys['recruiting/A-current']=async(p,step)=>{
  await step('核对岗位需求',async()=>{await p.click('#requirements');const text=await p.innerText('#modalBody');
    assert.match(text,/独立带队/);await p.click('#modal form button');return '独立带队';});
  await step('搜索并打开匹配证据',async()=>{await p.fill('#search','林岚');assert.equal(await p.innerText('#count'),'1 位候选人');
    await p.click('[data-task=view-evidence-source]');const text=await p.innerText('[data-state=evidence-source-open]');assert.match(text,/负责跨部门项目协调/);return text;});
  await step('筛选待复核并按匹配度排序',async()=>{await p.click('#clear');await p.selectOption('#filter','待复核');await p.click('[data-sort=score]');
    const scores=(await p.locator('#rows .rating').allTextContents()).map(Number);
    assert(scores.length>1);assert.deepEqual(scores,[...scores].sort((a,b)=>a-b));return scores;});
  await step('人工复核并在刷新后核对状态',async()=>{await p.click('[data-id=lin]');await p.click('#needs');
    assert.match(await p.innerText('#feedback'),/需补证.*已保存/);await p.reload();await p.selectOption('#filter','需补证');
    const row=await p.locator('#rows tr').filter({hasText:'林岚'}).innerText();assert.match(row,/需补证/);return row;});
  await step('查看搜索进度并处理部分完成的任务',async()=>{await p.click('#taskBrief');const before=await p.innerText('#modalBody');
    assert.match(before,/部分完成/);await p.click('[data-job=manual]');const after=await p.innerText('#modalBody');
    assert.match(after,/已转入人工核查/);return '补充来源搜索转入人工核查';});
};
