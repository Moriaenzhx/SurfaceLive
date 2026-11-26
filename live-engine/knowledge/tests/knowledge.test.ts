import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorBrief, detectScene, preferences, principles, retrieve, validateCorpus, visualExemplars } from '../src/live-knowledge.ts';

test('Every reference is HTTPS, every card is traceable, and classification has breadth', () => {
  const report = validateCorpus();
  assert.equal(report.valid, true, report.problems.join('\n'));
  assert.ok(report.counts.sources >= 35, JSON.stringify(report.counts));
  assert.ok(report.counts.cards >= 50, JSON.stringify(report.counts));
  assert.ok(report.counts.categories >= 13, JSON.stringify(report.counts));
});

test('Every rule carries use and non-use decisions, checks, and evidence', () => {
  for (const card of principles) {
    assert.ok(card.avoid.length >= 8, card.id);
    assert.ok(card.check.length >= 8, card.id);
    assert.ok(card.sources.length >= 1, card.id);
  }
});

test('Desktop recruiting Agent scenario retrieves table/workflow knowledge', () => {
  const result = retrieve('招聘 Agent 工作台：候选人表格、跨平台筛选、任务状态、人工复核');
  assert.equal(result.scene, 'b2b-workbench');
  assert.ok(result.hits.some(h => h.card.category === 'tables'), result.hits.map(h => h.card.id).join(','));
  assert.ok(result.hits.some(h => h.card.scenes.includes('b2b-workbench')));
});

test('Executive cockpit prioritizes decisions and data visualization', () => {
  const result = retrieve('coRoof 老板经营驾驶舱：营收、利润风险、各部门决策和趋势');
  assert.equal(result.scene, 'executive-dashboard');
  assert.ok(result.hits.some(h => h.card.category === 'data-viz'));
  assert.ok(result.hits.some(h => h.card.id === 'LAY-005' || h.card.id === 'BRD-005'));
});

test('Nearby neighborhood mobile scene differs and retrieves local patterns', () => {
  const result = retrieve('邻里生活 App：附近小区任务、周围两公里的事项发布和聊天');
  assert.equal(result.scene, 'local-consumer');
  assert.ok(result.hits.some(h => h.card.category === 'navigation'));
  const desk = new Set(retrieve('招聘 Agent 工作台：候选人表格、任务状态').hits.map(h => h.card.id));
  const overlap = result.hits.filter(h => desk.has(h.card.id)).length;
  assert.ok(overlap <= 8, `too many identical cards: ${overlap}/12`);
});

test('Director brief includes real source links and non-applicability tests', () => {
  const brief = createDirectorBrief('招聘 SaaS 候选人工作台');
  assert.match(brief, /https:\/\//);
  assert.match(brief, /不适用\/禁忌/);
  assert.match(brief, /可运行的前端/);
  assert.match(brief, /用户历史审美反馈/);
});

test('Inspected visual examples are distinct from unverified interaction claims', () => {
  assert.ok(visualExemplars.length >= 1);
  assert.ok(visualExemplars.every(item => item.observed.motion.includes('Not observable')));
  assert.ok(preferences.length >= 5);
});

test('Unknown scenes are not falsely classified as a specific business domain', () => {
  assert.equal(detectScene('一个有阅读体验的个人诗歌网站').scene, 'general');
});

test('Empty and abusive retrieval limits fail explicitly', () => {
  assert.throws(() => retrieve(''), /empty/);
  assert.throws(() => retrieve('ABC', 0), /limit/);
  assert.throws(() => retrieve('ABC', 100), /limit/);
});
