import { resolve } from 'node:path';
import { runExperiment } from './runner.ts';
import { variants,type Variant } from './prompts.ts';

const [command,...raw]=process.argv.slice(2);
function flag(key:string,otherwise?:string){const at=raw.indexOf(`--${key}`);return at>=0?raw[at+1]:otherwise;}
if(!['plan','mock','run'].includes(command??'')){
  console.error('Usage: npm run bench:plan|bench:mock|bench:run -- --scenario recruiting --variant all [--agent claude|codex] [--browser]');
  process.exit(2);
}
const scenarioId=flag('scenario','recruiting')!;
const which=flag('variant',command==='run'?'A0':'all')!;
const selected:Variant[]=which==='all'?variants:[which.toUpperCase() as Variant];
const agent=flag('agent') as 'codex'|'claude'|undefined;
const output=resolve(flag('out','runs')!);
const browser=raw.includes('--browser');
try{
  const result=await runExperiment({scenarioId,mode:command==='run'?'execute':command as 'plan'|'mock',agent,model:flag('model'),variants:selected,root:output,browser});
  if(command==='run' && Object.values(result.manifest.variants).some((v:any)=>v.status!=='generated-static-passed' || (browser && v.browser!=='passed'))) process.exitCode=1;
  console.log(JSON.stringify({folder:result.folder,conditions:result.manifest.variants,notice:command==='plan'?'只生成计划与 prompt，未调用模型':command==='mock'?'本轮是模拟产物，不代表实际设计质量':'本轮是真实 Agent 请求；视觉质量仍需实测与真人评审'},null,2));
}catch(error){console.error(String((error as Error).message));process.exitCode=1;}
