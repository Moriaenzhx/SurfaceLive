import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPrompt, variants, type Variant } from './prompts.ts';
import { getScenario } from './scenarios.ts';
import { runInstalledAgent, type AgentType } from './agent.ts';
import { writeMockOutput } from './mock.ts';
import { audit } from './verification.ts';

export type Mode='plan'|'mock'|'execute';
export type ExperimentParams={scenarioId:string; mode:Mode; agent?:AgentType; model?:string; variants?:Variant[]; root:string;browser?:boolean};
export async function runExperiment(params:ExperimentParams){
  const scenario=getScenario(params.scenarioId);
  const selected=params.variants??variants;
  if(!selected.length||selected.some(v=>!variants.includes(v)))throw new Error('必须提供有效的 A0/A1/A2 组');
  if(params.mode==='execute'&&!params.agent)throw new Error('真实调用必须声明 --agent claude 或 codex');
  if(params.agent && !['claude','codex'].includes(params.agent)) throw new Error('未知 Agent');
  const folder=resolve(params.root, `${scenario.id}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomBytes(3).toString('hex')}`);
  await mkdir(folder,{recursive:true});
  const manifest:any={name:'SurfaceLive Live Engine first controlled experiment',schemaVersion:1,scenarioId:scenario.id,createdAt:new Date().toISOString(),mode:params.mode,model:params.model??null,browserRequested:!!params.browser,agent:params.agent??null,variants:{},warning:'审美质量尚未实证。模型调用需授权；文件构建成功也不代表生产就绪。'};
  const flush=async()=>await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  for(const v of selected){
    const target=join(folder,v);
    await mkdir(target,{recursive:true});
    const prompt=createPrompt(scenario,v);
    await writeFile(join(target,'prompt.md'),prompt);
    manifest.variants[v]={condition:v,status:'planned',promptBytes:Buffer.byteLength(prompt,'utf8'),path:v,browser:'not-run'};
  }
  await flush();
  if(params.mode!=='plan') for(const v of selected){
    const target=join(folder,v);
    manifest.variants[v].status='running';await flush();
    try{
      if(params.mode==='mock')await writeMockOutput(target,v);
      else{
        const prompt=await readFile(join(target,'prompt.md'),'utf8');
        const result=await runInstalledAgent(params.agent!,target,prompt,undefined,params.model);
        await writeFile(join(target,'agent-result.json'),JSON.stringify({...result,model:params.model??null},null,2));
        Object.assign(manifest.variants[v],{durationMs:result.durationMs,agentExitCode:result.exitCode});
        if(result.exitCode!==0)manifest.variants[v].error='Agent exit '+result.exitCode+' '+(result.stderr||result.stdout).slice(-750);
      }
      const report=await audit(target,{browser:!!params.browser && !manifest.variants[v].error});
      const staticPass=report.staticChecks.every(c=>c.passed);
      manifest.variants[v].status=manifest.variants[v].error?'failed':staticPass?'generated-static-passed':'generated-static-failed';
      manifest.variants[v].browser=report.browser.status;
      manifest.variants[v].productionReady=false;
    }catch(e){manifest.variants[v].status='failed';manifest.variants[v].error=String((e as Error).message).slice(0,1000);}
    await flush();
  }
  await writeFile(join(folder,'HUMAN_BLIND_REVIEW.md'),`# 人工双盲评测记录（待填写）\n\n比较图像前，请把 A0 / A1 / A2 的文件名随机改成 X / Y / Z，评价人不应知道条件名称。\n\n场景：${scenario.title}\n\n- 首选方案：\n- 为什么：\n- 第一眼视觉重心：\n- 是否有模板化 AI Demo 味：\n- 哪个任务实际更容易完成：\n- 缺陷与局部建议：\n- 审美维度：排版 / 字体 / 色彩 / 密度 / 原创性（每项 1-5，分别记录）\n- 是否有功能阻断：\n- 评测人是否参与生成：否 / 是\n\n**勿依据 Agent 自评分宣称审美超过普通水平。**\n`);
  return {folder,manifest};
}
