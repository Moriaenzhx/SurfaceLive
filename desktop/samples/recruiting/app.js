const $ = id => document.getElementById(id);
const paths = {
  brand:'<path d="M4 17l5-5 4 3 7-9M15 6h5v5M4 8h6M4 21h16"/>',
  people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
  brief:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13h18m-11 0v2h4v-2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  filter:'<path d="M3 5h18l-7 8v5l-4 2v-7z"/>',
  check:'<path d="m5 12 4 4 10-9"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  warning:'<path d="M12 3 2 20h20L12 3zm0 6v4m0 3v.5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  file:'<path d="M6 3h8l4 4v14H6zm8 0v5h4m-9 4h6m-6 4h6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icon(el.dataset.icon);});

const candidates = [
  {id:1,name:'林清越',org:'云帆科技',city:'上海',years:8,score:96,reason:'主导 B2B SaaS 从 0 到 1',gap:'待核实 · 团队管理规模',source:'人才库',initial:'pending',tags:'企业协作 产品路线图',evidence:'2022–2025 年负责企业协作平台立项、试点及商业化，覆盖采购、审批与权限模块。',ref:'人才库档案 · 项目经历第 1 节',follow:'核对带领的团队人数及直接汇报关系。'},
  {id:2,name:'陈昱',org:'矩阵数据',city:'上海',years:7,score:92,reason:'负责企业级数据产品与商业化',gap:'待核实 · 到岗时间',source:'员工推荐',initial:'pending',tags:'数据平台 商业化',evidence:'负责数据治理平台的付费版本，从客户访谈推进到计费方案上线。',ref:'员工推荐记录 · 项目摘要',follow:'确认离职交接周期和预计到岗日期。'},
  {id:3,name:'许一诺',org:'合流软件',city:'杭州',years:6,score:88,reason:'供应链 SaaS 与客户交付经验',gap:'待核实 · 上海办公意愿',source:'官网投递',initial:'pending',tags:'供应链 客户交付',evidence:'负责供应商协同模块，和实施团队完成三家企业客户的首批交付。',ref:'官网投递简历 · 项目经历第 2 节',follow:'确认上海办公安排。'},
  {id:4,name:'顾言',org:'北辰互联',city:'上海',years:9,score:85,reason:'企业工作流与权限系统经验',gap:'待核实 · 定价经验',source:'人才库',initial:'shortlisted',tags:'工作流 RBAC',evidence:'负责多租户审批工作流和角色权限模型两次主要版本迭代。',ref:'人才库档案 · 项目经历第 2 节',follow:'核对是否负责过收费版本的产品定价。'},
  {id:5,name:'周予安',org:'启明数智',city:'苏州',years:5,score:82,reason:'有客户访谈与需求优先级经验',gap:'缺口 · 缺少独立产品线经历',source:'员工推荐',initial:'pending',tags:'客户访谈 需求管理',evidence:'作为产品小组成员维护需求池，参与重点客户访谈与季度路线图规划。',ref:'员工推荐记录 · 推荐人摘要',follow:'确认曾独立负责的模块及决策范围。'},
  {id:6,name:'Alexandra 顾晓宁',org:'智桥云服务',city:'上海',years:10,score:78,reason:'做过企业平台和跨团队交付',gap:'缺口 · 缺少 SaaS 商业化证据',source:'人才库',initial:'held',tags:'平台产品 项目交付',evidence:'负责内部运营平台和跨部门交付，档案未提供外部订阅产品经历。',ref:'人才库档案 · 工作经历第 1 节',follow:'确认是否有对外产品和订阅业务经历。'},
  {id:7,name:'宋可',org:'未提供公司',city:'城市未填',years:5,score:74,reason:'具备产品分析与指标体系经验',gap:'待核实 · 最近任职信息缺失',source:'人才库',initial:'pending',tags:'埋点 数据分析',evidence:'档案含指标体系案例，最近工作单位和城市字段缺失。',ref:'人才库档案 · 项目附件摘要',follow:'补核任职时间、公司和工作地点。'},
  {id:8,name:'贺明远',org:'青藤创研',city:'深圳',years:4,score:68,reason:'有产品上线与版本迭代经历',gap:'缺口 · 未达到 5 年经验要求',source:'官网投递',initial:'rejected',tags:'功能迭代 用户调研',evidence:'在消费产品团队有四年产品工作记录，负责用户反馈与版本迭代。',ref:'官网投递简历 · 工作经历',follow:'若工作年限记录有更新，可复核原决定。'}
];
const statusNames = {pending:'待复核',shortlisted:'已入围',held:'待补充',rejected:'不推进'};
const tabs = {all:'全部',...statusNames};
const storageKey = 'xunxu-demo-review-v1';
let reviews = {};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) reviews = saved;
} catch {}
let activeTab = 'all';
let direction = 'descending';
let visible = [];
let detailId = null;
let reviewQueue = [];
let lastOpen = null;
const dialog = $('detail');

const statusOf = c => Object.hasOwn(statusNames,reviews[c.id]?.status) ? reviews[c.id].status : c.initial;
const statusTag = c => `<span class="status ${statusOf(c)}">${statusNames[statusOf(c)]}</span>`;
const score = c => `<span class="score">${c.score}<em>%</em></span>`;
const avatar = c => `<span class="avatar a${(c.id-1)%4}" aria-hidden="true">${c.name.match(/^[A-Z]/) ? 'AG' : c.name.slice(0,1)}</span>`;
const person = c => `<div class="person">${avatar(c)}<div><div class="person-name">${c.name}</div><span class="sub">${c.org} · ${c.years} 年</span></div></div>`;
const evidence = c => `<span class="reason">${c.reason}</span><span class="gap">${c.gap}</span>`;
const detailButton = c => `<button class="text-button open-detail" data-candidate="${c.id}" aria-label="复核 ${c.name}">复核<span aria-hidden="true"> ›</span></button>`;
function report(message) { $('feedback').textContent = message; }

function renderList() {
  const query = $('query').value.trim().toLowerCase();
  const source = $('source').value;
  const threshold = Number($('threshold').value);
  const tabFocus = document.activeElement?.dataset.tab;
  const counts = candidates.reduce((acc,c) => {
    acc[statusOf(c)] = (acc[statusOf(c)] || 0) + 1;
    return acc;
  }, {all:candidates.length});
  $('tabs').innerHTML = Object.entries(tabs).map(([key,label]) =>
    `<button class="tab" data-tab="${key}" aria-pressed="${activeTab===key}">${label}<span class="tab-count">${counts[key] || 0}</span></button>`).join('');
  if (tabFocus) $('tabs').querySelector(`[data-tab="${tabFocus}"]`)?.focus();
  visible = candidates.filter(c =>
    (activeTab==='all' || statusOf(c)===activeTab) &&
    (!source || c.source===source) && c.score>=threshold &&
    query.split(/\s+/).every(word => [c.name,c.org,c.tags,c.reason,c.city].join(' ').toLowerCase().includes(word))
  ).sort((a,b) => direction==='descending' ? b.score-a.score : a.score-b.score);

  $('rows').innerHTML = visible.map(c => `<tr><th scope="row" class="candidate-name">${person(c)}</th><td>${score(c)}<span class="mini-track" aria-hidden="true"><i style="width:${c.score}%"></i></span></td><td>${evidence(c)}</td><td><span class="source-chip">${c.source}</span></td><td>${statusTag(c)}</td><td>${detailButton(c)}</td></tr>`).join('');
  $('mobile-rows').innerHTML = visible.map(c => `<article class="candidate-card">${person(c)}${score(c)}<div>${evidence(c)}</div><div><span class="source-chip">${c.source}</span></div><div>${statusTag(c)}</div>${detailButton(c)}</article>`).join('');
  $('total').textContent = `共 ${candidates.length} 位示例人选`;
  $('result-count').textContent = `显示 ${visible.length} 位 · 匹配度${direction==='descending' ? '降序' : '升序'}`;
  $('range').textContent = visible.length ? `第 1–${visible.length} 位 / 共 ${visible.length} 位` : '0 位候选人';
  $('score-head').setAttribute('aria-sort',direction);
  $('sort').querySelector('span').textContent = direction==='descending' ? '↓' : '↑';
  $('mobile-sort').value = direction;
  $('reset').hidden = !(query || source || threshold || activeTab!=='all');
  $('empty').hidden = visible.length>0;
  document.querySelector('.pool table').hidden = !visible.length;
}
function resetFilters() {
  $('query').value = $('source').value = $('threshold').value = '';
  activeTab = 'all';
  renderList();
  $('query').focus();
}
$('query').addEventListener('input',renderList);
['source','threshold'].forEach(id => $(id).addEventListener('change',renderList));
['reset','empty-reset'].forEach(id => $(id).addEventListener('click',resetFilters));
$('tabs').addEventListener('click',event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) { activeTab = tab.dataset.tab; renderList(); }
});
$('sort').addEventListener('click',() => {
  direction = direction==='descending' ? 'ascending' : 'descending';
  renderList();
});
$('mobile-sort').addEventListener('change',event => {direction = event.target.value; renderList();});
document.querySelector('.pool').addEventListener('click',event => {
  const opener = event.target.closest('[data-candidate]');
  if (!opener) return;
  lastOpen = Number(opener.dataset.candidate);
  reviewQueue = visible.map(c => c.id);
  showDetail(lastOpen);
  dialog.showModal();
});

function showDetail(id) {
  detailId = id;
  const c = candidates.find(candidate => candidate.id===id);
  const record = reviews[c.id];
  const index = reviewQueue.indexOf(id);
  $('detail-content').innerHTML = `
    <header class="detail-head"><h2 id="detail-title">候选人复核</h2><button id="detail-close" class="icon-button" autofocus aria-label="关闭候选人详情">${icon('close')}</button></header>
    <div class="detail-body">
      <div class="detail-profile">${avatar(c)}<div><h3>${c.name}</h3><span class="sub">${c.org} · ${c.city} · ${c.years} 年</span></div><div class="detail-score">${score(c)}</div></div>
      <section class="detail-card"><h3>职位匹配 · 高级产品经理</h3><p><strong>${c.reason}</strong></p><p>${c.evidence}</p><p class="sub">示例证据 · ${c.ref}</p></section>
      <section class="detail-card"><h3>待核实项</h3><p class="gap">${c.gap}</p><p>${c.follow}</p></section>
      <section class="detail-card"><h3>人工复核 ${statusTag(c)}</h3><p class="sub" id="review-log"></p><label for="review-note">复核备注（选填）</label><textarea id="review-note" maxlength="300" placeholder="记录判断依据或下次跟进事项"></textarea><p class="sub">选择下方决定以保存备注。</p></section>
      <div class="detail-nav detail-next"><span class="detail-position">本次打开时的列表顺序 · ${index+1} / ${reviewQueue.length}</span><button class="text-button" id="next" ${index+1>=reviewQueue.length?'hidden':''}>下一位 ›</button></div>
    </div>
    <footer class="detail-foot"><button class="button secondary" data-decision="rejected">不推进</button><button class="button secondary" data-decision="held">待补充</button><button class="button primary" data-decision="shortlisted">加入入围</button></footer>`;
  $('review-note').value = record?.note || '';
  $('review-log').textContent = record?.at ? `本地复核记录 · ${new Date(record.at).toLocaleString('zh-CN')}` : '示例初始状态';
  $('detail-close').focus();
}
dialog.addEventListener('click',event => {
  if (event.target===dialog || event.target.closest('#detail-close')) {dialog.close();return;}
  if (event.target.closest('#next')) {showDetail(reviewQueue[reviewQueue.indexOf(detailId)+1]);return;}
  const decision = event.target.closest('[data-decision]')?.dataset.decision;
  if (!decision) return;
  const c = candidates.find(candidate => candidate.id===detailId);
  reviews[c.id] = {status:decision,note:$('review-note').value.trim(),at:new Date().toISOString()};
  let persisted = true;
  try { localStorage.setItem(storageKey,JSON.stringify(reviews)); } catch { persisted = false; }
  renderList();
  dialog.close();
  report(`已将 ${c.name} 标为「${statusNames[decision]}」。${persisted ? '已保存在此浏览器。' : '当前浏览器仅支持本次会话保存。'}`);
});
dialog.addEventListener('close',() => {
  const button = [...document.querySelectorAll(`[data-candidate="${lastOpen}"]`)].find(el=>el.getClientRects().length);
  (button || $('query')).focus();
});

let task = {state:'partial', completed:8, run:1};
let sourceState = 'failed';
let timer;
const sourceNames = [['人才库','layers',4],['员工推荐','people',2],['官网投递','file',2]];
const steps = [
  ['读取候选人快照','载入 8 份本地示例档案'],
  ['整理匹配依据','比较职位要求与档案字段'],
  ['生成复核队列','更新本轮模拟任务状态']
];

function renderAgent() {
  const {state,completed,run} = task;
  const isActive = state==='running' || state==='paused';
  const stage = completed<2 ? 0 : completed<8 ? 1 : isActive ? 2 : 3;
  const stateLabels = {partial:'部分完成',running:'执行中',paused:'已暂停',done:'已完成'};
  $('task-state').className = `task-state ${state}`;
  $('task-state').innerHTML = `<i></i>${stateLabels[state]}`;
  $('task-id').textContent = `DEMO-${String(run).padStart(3,'0')} · 本地模拟任务`;
  $('progress-label').textContent = '已处理候选人';
  $('progress-count').textContent = `${completed} / ${candidates.length}`;
  $('progress').value = completed;
  $('timeline').innerHTML = steps.map(([title,desc],index) => {
    const current = index===stage;
    return `<li ${current?'aria-current="step"':''}><span class="step-icon ${current?'current':index>stage?'pending':''}">${icon(index<stage?'check':'clock')}</span><div><strong>${title}</strong><small>${current ? (state==='paused'?'已暂停 · ':'执行中 · ') : index>stage?'待处理 · ':''}${desc}</small></div></li>`;
  }).join('');
  $('pause').hidden = !isActive;
  $('pause').textContent = state==='paused' ? '继续模拟' : '暂停模拟';
  $('start').setAttribute('aria-disabled',String(isActive));
  $('start-label').textContent = isActive ? '模拟进行中' : '模拟匹配';
}

function renderSources() {
  $('source-list').innerHTML = sourceNames.map(([name,glyph,count]) => {
    const impacted = name==='官网投递' && sourceState!=='ok';
    return `<li><span class="source-icon">${icon(glyph)}</span><strong>${name}</strong><span class="source-result ${impacted?'fail':''}">${impacted?(sourceState==='retrying'?'重试中':'同步失败'):`可用 · ${count} 位`}</span></li>`;
  }).join('');
  document.querySelectorAll('.nav-alert').forEach(el => {el.hidden = sourceState==='ok';});
  const warning = $('warning');
  warning.classList.toggle('success',sourceState==='ok');
  warning.innerHTML = sourceState==='ok'
    ? `${icon('check')}<div><strong>模拟重试完成</strong><p>官网投递来源已恢复为可用状态。</p></div>`
    : `${icon('warning')}<div><strong>官网投递同步失败</strong><p>示例错误 · 请求超时。当前可复核上次快照中的 2 位人选。</p><button class="text-button" id="retry" ${sourceState==='retrying'?'disabled':''}>${sourceState==='retrying'?'模拟重试中…':'模拟重试 ›'}</button></div>`;
}
$('warning').addEventListener('click',event => {
  if (!event.target.closest('#retry') || sourceState!=='failed') return;
  sourceState = 'retrying';
  renderSources();
  $('agent').focus();
  report('正在模拟重试官网投递来源。');
  setTimeout(() => {
    sourceState = 'ok';
    if (task.state==='partial') task.state = 'done';
    renderSources();
    renderAgent();
    report('官网投递模拟重试完成，3 个示例来源均可用。');
  },1400);
});
function tick() {
  if (task.completed<candidates.length) {
    task.completed++;
  } else {
    clearInterval(timer);
    task.state = sourceState==='ok' ? 'done' : 'partial';
    report(task.state==='done' ? '模拟匹配完成，已处理 8 位示例人选。' : '模拟匹配已处理 8 位人选，官网投递仍需重试，快照可复核。');
    if (document.activeElement===$('pause')) $('start').focus();
  }
  renderAgent();
}
function setAgent(open,focus = true) {
  $('agent').classList.toggle('is-open',open);
  $('mobile-agent').setAttribute('aria-expanded',String(open));
  if (open && focus) {
    $('agent').focus();
    $('agent').scrollIntoView({block:'nearest'});
  }
}
$('mobile-agent').setAttribute('aria-controls','agent');
$('mobile-agent').setAttribute('aria-expanded','false');
$('mobile-agent').addEventListener('click',() => setAgent(!$('agent').classList.contains('is-open')));
$('nav-agent').addEventListener('click',() => setAgent(true));
$('agent-close').addEventListener('click',() => {setAgent(false);$('mobile-agent').focus();});
$('nav-pool').addEventListener('click',() => {setAgent(false);$('query').focus();});
$('start').addEventListener('click',() => {
  if (task.state==='running' || task.state==='paused') return;
  task = {state:'running',completed:0,run:task.run+1};
  renderAgent();
  setAgent(true,false);
  report('模拟匹配已启动，正在读取 8 位示例人选。');
  timer = setInterval(tick,950);
});
$('pause').addEventListener('click',() => {
  if (task.state==='running') {
    clearInterval(timer);
    task.state='paused';
    report(`模拟已暂停，已处理 ${task.completed} 位。`);
  } else {
    task.state='running';
    timer=setInterval(tick,950);
    report('已继续模拟匹配。');
  }
  renderAgent();
});
renderList();
renderAgent();
renderSources();
