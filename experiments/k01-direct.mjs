// One invocation per empty cell. The installed desktop adapter handles only the transport.
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generate} from '../desktop/agent.mjs';
import {cases, settings} from './k01-cases.mjs';
const id = process.argv[2], scenario = cases[id];
if (!scenario || process.env.SURFACELIVE_CODEX_EXEC) throw Error('Expected named scenario and installed CLI');
const dir = join('runs/K-01', id, 'A0');
await mkdir(join(dir,'..'), {recursive:true});
await mkdir(dir, {mode:0o700});
const cwd = await mkdtemp(join(tmpdir(), 'k01-direct-'));
const size = scenario.target === 'mobile' ? '390 × 844' : '1440 × 900';
const prompt = scenario.text + '\n目标视口 ' + size + '。交付可离线运行的 title、html、css、js，完整 HTML 引用 styles.css 和 app.js。仅返回结构化结果，不调用工具。';
const started = Date.now(), sha = data => createHash('sha256').update(data).digest('hex');
const record = {run_id:randomUUID(), ...settings, ...scenario, startedAt:new Date(started), promptSha256:sha(prompt), invocations:[]};
await writeFile(join(dir,'prompt.md'), prompt, {mode:0o600});
try {
  const product = await generate({type:settings.agent, ...settings, prompt, cwd, signal:new AbortController().signal,
    onInvocation:call => {record.invocations.push(call);}});
  const files = {'index.html':product.html, 'styles.css':product.css, 'app.js':product.js};
  await mkdir(join(dir,'source'));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir,'source',name),text);
  record.files = Object.fromEntries(Object.entries(files).map(([name,text]) => [name,sha(text)]));
  record.status = 'GENERATED';
} catch (error) {
  record.status = 'BLOCKED';
  record.error = error.message;
  process.exitCode = 1;
} finally {
  record.elapsedMs = Date.now()-started;
  await writeFile(join(dir,'receipt.json'),JSON.stringify(record,null,2)+'\n',{mode:0o600});
  await rm(cwd,{recursive:true,force:true});
  console.log(id,record.status);
}
