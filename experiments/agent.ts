import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, join, isAbsolute } from 'node:path';
import { platform } from 'node:os';

export type AgentType = 'codex' | 'claude';
export type RunResult = { exitCode: number; stdout: string; stderr: string; durationMs: number; command: string };

/** We deliberately rely on the user's supported installed CLI, not GUI scraping. */
export async function findAgent(type: AgentType, env=process.env): Promise<string | null> {
  const override = env[`SURFACELIVE_${type.toUpperCase()}_EXEC`];
  if (override) {
    if (!isAbsolute(override)) throw new Error('显式指定的 Agent 可执行文件必须使用绝对路径');
    await access(override, platform()==='win32' ? constants.F_OK : constants.X_OK);
    return override;
  }
  const sep = platform()==='win32'?';':delimiter;
  const pathEntries = (env.PATH||'').split(sep).filter(Boolean);
  const names = platform()==='win32' ? [`${type}.exe`,`${type}.cmd`,type] : [type];
  for (const dir of pathEntries) for (const n of names) {
    const p = join(dir,n);
    try { await access(p, platform()==='win32' ? constants.F_OK : constants.X_OK); return p; } catch { /* next */ }
  }
  return null;
}

export async function runInstalledAgent(type: AgentType, cwd: string, prompt: string, timeoutMs=10*60_000, model?:string): Promise<RunResult> {
  const exe = await findAgent(type);
  if(!exe) throw new Error(`找不到 ${type} CLI。请先安装/登录，或设置 SURFACELIVE_${type.toUpperCase()}_EXEC`);
  const modelArgs=model?['--model',model]:[];
  const args = type==='codex'
    ? ['exec','--ephemeral','--skip-git-repo-check','--sandbox','workspace-write','-c','approval_policy="never"','-c','model_reasoning_effort="medium"',...modelArgs,prompt]
    : ['-p','--permission-mode','dontAsk','--tools','Write','--allowedTools',
      'Write(./index.html) Write(./styles.css) Write(./app.js)','--strict-mcp-config',
      '--no-session-persistence','--disable-slash-commands',...modelArgs,'--',prompt];
  const started = Date.now();
  return await new Promise((resolve, reject)=>{
    const child=spawn(exe,args,{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',done=false;
    const finish=(error?:Error, code=0)=>{
      if(done)return;
      done=true;clearTimeout(timeout);
      if(error) reject(error);
      else resolve({exitCode:code,stdout:stdout.slice(-100000),stderr:stderr.slice(-20000),durationMs:Date.now()-started,command:type});
    };
    let timedOut=false;
    let forceKill:ReturnType<typeof setTimeout>|undefined;
    const timeout=setTimeout(()=>{
      timedOut=true;stderr+='\nAgent timeout';child.kill('SIGTERM');
      forceKill=setTimeout(()=>child.kill('SIGKILL'),2000);
    },timeoutMs);
    child.stdout.on('data',c=>{stdout=(stdout+String(c)).slice(-180000);});
    child.stderr.on('data',c=>{stderr=(stderr+String(c)).slice(-40000);});
    child.on('error',e=>finish(e));
    child.on('close',code=>{clearTimeout(forceKill);finish(undefined,timedOut?124:code??-1);});
  });
}
