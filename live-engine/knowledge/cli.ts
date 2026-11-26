import {indexed,factoryHits} from '../ingestion/retrieval.ts';
import { createDirectorBrief, detectScene, principles, retrieve, sources, validateCorpus } from './src/live-knowledge.ts';

const [command, ...input] = process.argv.slice(2);
const samples = [
  '招聘 Agent 工作台：候选人表格、跨平台筛选、任务状态、人工复核，桌面端复杂 B 端 SaaS',
  'coRoof 老板经营驾驶舱：营收、风险、各部门动态、经营趋势，优先展示需决策的异常',
  '邻里生活 App：显示附近两公里的事项和任务，手机上聊天、发布、筛选，体现距离和时间'
];

if (command === 'check'){
  const seed=validateCorpus(), entries=indexed();
  const cards=entries.flatMap(e=>e.cards!);
  console.log(JSON.stringify({...seed,batch:{indexedSources:entries.length,objects:cards.length,visualExemplars:cards.filter(c=>c.kind==='VisualExemplar').length}},null,2));
  if(!seed.valid) process.exitCode=1;
}
else if (command === 'search') {
  const result = retrieve(input.join(' '));
  console.log(JSON.stringify({ scene: result.scene, signals: result.sceneSignals, factory:factoryHits(result.scene,input.join(' ')), cards: result.hits.map(h => ({ id: h.card.id, category: h.card.category, score: h.score, decision: h.card.decision, sources: h.evidence.map(e => e.url) })) }, null, 2));
} else if (command === 'brief') console.log(createDirectorBrief(input.join(' ')));
else if (command === 'bench') {
  const rows = samples.map(description => {
    const result = retrieve(description);
    return { description, scene: result.scene, topCardIds: result.hits.map(h => h.card.id), categories: [...new Set(result.hits.map(h => h.card.category))], sceneSpecificCount: result.hits.filter(h => h.card.scenes.includes(result.scene)).length };
  });
  const sets = rows.map(r => new Set(r.topCardIds));
  const overlap = rows.map((a, i) => rows.map((_, j) => i === j ? 1 : [...sets[i]].filter(id => sets[j].has(id)).length / 12));
  console.log(JSON.stringify({ corpus: { sources: sources.length, cards: principles.length }, benchmark: rows, overlapRatio: overlap }, null, 2));
} else if (command === 'scene') console.log(JSON.stringify(detectScene(input.join(' ')), null, 2));
else {
  console.error('Usage: node live-engine/knowledge/cli.ts <check | bench | scene | search | brief> [Chinese business scene]');
  process.exitCode = 2;
}
