import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { findAgent } from '../experiments/agent.ts';

const schema={type:'object',additionalProperties:false,required:['title','html','css','js'],properties:Object.fromEntries(['title','html','css','js'].map(k=>[k,{type:'string'}]))};
export async function agentEnvironment(){
  const home=homedir(), nvm=join(home,'.nvm','versions','node');
  const installed=await readdir(nvm).catch(()=>[]);
  const dirs=[process.env.PATH||'',join(home,'.local','bin'),'/opt/homebrew/bin','/usr/local/bin',
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS',
    '/Applications/Codex.app/Contents/Resources',...installed.sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>join(nvm,v,'bin'))];
  return {...process.env,PATH:dirs.join(delimiter)};
}
export async function availableAgents(){
  const env=await agentEnvironment();
  const result={};
  for(const type of ['codex','claude']) result[type]=Boolean(await findAgent(type,env).catch(()=>null));
  return result;
}
export async function modelCatalog(){
  let models=[];
  try{
    const cache=JSON.parse(await readFile(join(process.env.CODEX_HOME||join(homedir(),'.codex'),'models_cache.json'),'utf8'));
    models=cache.models.filter(m=>m.visibility==='list' && typeof m.slug==='string').map(m=>({name:m.slug,efforts:(m.supported_reasoning_levels||[]).map(e=>e.effort)}));
  }catch{}
  return {codex:models,claude:['sonnet','opus','haiku'].map(name=>({name,efforts:['low','medium','high','max']}))};
}
export function parseProduct(value){
  for(const k of schema.required) if(typeof value?.[k]!=='string' || !value[k].trim()) throw new Error('模型返回的作品缺少 '+k);
  if(!/<html[\s>]/i.test(value.html) || !/<script\b[^>]*\bsrc=["'](?:\.\/)?app\.js["']/i.test(value.html)
     || !/<link\b[^>]*\bhref=["'](?:\.\/)?styles\.css["']/i.test(value.html)) throw new Error('生成页面缺少 HTML 文档或本地 CSS / JS 引用，请重试');
  return {title:value.title.trim().slice(0,64),html:value.html,css:value.css,js:value.js};
}
export async function askStructured({type,model,effort,prompt,cwd,signal,images=[],outputSchema,onInvocation,operation='source'}){
  if(!['codex','claude'].includes(type)) throw new Error('请选择有效 Agent');
  const env=await agentEnvironment(), exe=await findAgent(type,env);
  if(!exe) throw new Error('找不到 '+type+'，请安装并登录本机 CLI 后刷新。');
  const schemaFile=join(cwd,'schema.json'), outFile=join(cwd,'result.json');
  await writeFile(schemaFile,JSON.stringify(outputSchema));
  const modelArgs=model?['--model',model]:[];
  const imageArgs=[];
  if(type==='codex')for(const [i,image] of images.entries()){
    const file=join(cwd,'reference-'+(i+1)+(image.mime==='image/png'?'.png':'.jpg'));await writeFile(file,image.bytes);imageArgs.push('--image',file);
  }
  const args=type==='codex'
    ? ['exec','--ephemeral','--skip-git-repo-check','--sandbox','read-only','-c','approval_policy="never"',...modelArgs,...imageArgs,...(effort?['-c','model_reasoning_effort='+JSON.stringify(effort)]:[]),'--output-schema',schemaFile,'-o',outFile,'-']
    : ['-p','--permission-mode','dontAsk','--tools','','--strict-mcp-config','--no-session-persistence','--disable-slash-commands','--output-format',images.length?'stream-json':'json','--json-schema',JSON.stringify(outputSchema),...modelArgs,...(effort?['--effort',effort]:[]),...(images.length?['--input-format','stream-json','--verbose']:[])];
  signal.throwIfAborted();
  const started=Date.now();
  let header='',reportedModels=[],reportedBy=null,completed=false;
  let sessionId=null,totalTokens=null,costUsd=null,usage=null,exitCode=null;
  const child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,force;
  const stop=()=>{child.kill('SIGTERM');force=setTimeout(()=>child.kill('SIGKILL'),1800);};
  const timeout=setTimeout(()=>{timedOut=true;stop();},12*60_000);
  signal.addEventListener('abort',stop,{once:true});
  const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',c=>{stdout=(stdout+c).slice(-4_000_000);});
  child.stderr.on('data',c=>{stderr=(stderr+c).slice(-12_000);if(header.length<4096)header=(header+c).slice(0,4096);});
  child.stdin.on('error',()=>{});const input=type==='claude' && images.length?JSON.stringify({type:'user',message:{role:'user',content:[...images.map(image=>({type:'image',source:{type:'base64',media_type:image.mime||'image/jpeg',data:image.bytes.toString('base64')}})),{type:'text',text:prompt}]}})+'\n':prompt;
  child.stdin.end(input);
  try{
    const code=await closed; exitCode=code;
    signal.throwIfAborted();
    if(timedOut) throw new Error('生成超过 12 分钟，可缩小任务范围后重试。');
    if(code!==0){
      const detail=(stderr+'\n'+stdout).trim();
      if(/insufficient.balance|HTTP 402|余额不足/i.test(detail)) throw new Error(type+' 账户余额不足，可更换 Agent 或充值后重试。');
      const cause=/unauthorized|401|authentication|not logged in/i.test(detail)?'认证失败':
        /403|forbidden/i.test(detail)?'访问被拒绝':
        /model.{0,40}(unsupported|unavailable|not supported|not found)/i.test(detail)?'模型不可用':
        /operation not permitted|permission denied/i.test(detail)?'本地权限不足':
        /disconnect|connect|dns|network|timed out/i.test(detail)?'连接未完成':'CLI 未成功返回结构化结果';
      throw new Error(type+' 调用失败（'+code+'）。'+cause);
    }
    let raw;
    if(type==='claude' && images.length){
      for(const line of stdout.trim().split('\n').reverse()){
        try{const event=JSON.parse(line);if(event.type==='result'){raw=event;break;}}catch{}
      }
      if(!raw)throw Error('Claude Code 未返回完整的图像修改结果');
    }else raw=JSON.parse(type==='codex'?await readFile(outFile,'utf8'):stdout);
    if(type==='claude'){
      if(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw.session_id))sessionId=raw.session_id;
      costUsd=Number.isFinite(raw.total_cost_usd)?raw.total_cost_usd:null;
      usage=Object.fromEntries(Object.entries(raw.usage||{}).filter(([k,v])=>
        ['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens'].includes(k)&&Number.isSafeInteger(v)));
    }
    if(type==='claude' && raw.is_error)throw new Error('Claude Code 返回错误结果');
    const value=type==='codex'?raw:(raw.structured_output??JSON.parse(raw.result||'null'));
    if(type==='claude'&&raw.modelUsage&&typeof raw.modelUsage==='object'){
      reportedModels=Object.keys(raw.modelUsage).filter(name=>/^[a-zA-Z0-9_.:/-]{1,130}$/.test(name));
      if(reportedModels.length)reportedBy='cli-model-usage';
    }
    completed=true;return value;
  }finally{
    clearTimeout(timeout);clearTimeout(force);signal.removeEventListener('abort',stop);
    if(onInvocation){
      if(type==='codex'){
        const intro=header.match(/OpenAI Codex v[^\n]*\n-+\r?\n([\s\S]*?)\r?\n-+\r?\n/);
        const name=intro?.[1].match(/^model:\s*([a-zA-Z0-9._/-]+)\s*$/m)?.[1];
        sessionId=intro?.[1].match(/^session id:\s*([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\s*$/im)?.[1]??null;
        const count=stderr.match(/(?:^|\n)tokens used\r?\n([0-9,]+)\s*$/i);
        if(count)totalTokens=Number(count[1].replaceAll(',',''));
        if(name){reportedModels=[name];reportedBy='cli-startup-header';}
      }
      await onInvocation({operation,agent:type,requestedModel:model||null,reportedModels,reportedBy,
        promptSha256:createHash('sha256').update(prompt).digest('hex'),startedAt:new Date(started).toISOString(),
        sessionId,totalTokens,usage,costUsd,exitCode,toolsObserved:null,
        executable:basename(exe),override:Boolean(env['SURFACELIVE_'+type.toUpperCase()+'_EXEC']),elapsedMs:Date.now()-started,
        outcome:completed?'returned':signal.aborted?'cancelled':timedOut?'timed-out':'failed'},prompt);
    }
  }
}

export async function generate(options){
  return parseProduct(await askStructured({...options,outputSchema:schema}));
}
