import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DesignAudit} from './design-audit.mjs';
import {sourceFiles} from './library.mjs';
import {contractInstruction,validateContract} from '../live-engine/design/contract.mjs';
import {journeyInstruction} from '../live-engine/design/journey.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
const timestamp=()=>new Date().toISOString();
const sourceVersion=product=>hash(JSON.stringify(Object.fromEntries(Object.entries(sourceFiles).map(([name,key])=>[name,hash(product[key])]))));

export async function readRevisionContract(base){
  const ref=base?.designContract;
  if(!ref)return null;
  if(!/^[a-f0-9-]{36}$/i.test(ref.id)||ref.file!=='contracts/'+ref.id+'.json')throw Error('父版契约引用无效');
  const bytes=await readFile(join(base.folder,ref.file));
  if(hash(bytes)!==ref.sha256)throw Error('父版契约内容哈希不符');
  const contract=validateContract(JSON.parse(bytes));
  if(contract.id!==ref.id||contract.runId!==ref.runId||contract.schemaVersion!==ref.schemaVersion||
    contract.directionId!==ref.directionId||JSON.stringify(contract.provenance.adoptedKnowledgeIds)!==JSON.stringify(ref.adoptedKnowledgeIds))throw Error('父版契约身份不符');
  return contract;
}

// The attempt directory is private until Library.commit publishes the entire version in one rename.
export class DesignTrace{
  static async begin(root,token,{base,request,target,agent,model,effort,edits}){
    await mkdir(root,{recursive:true,mode:0o700});
    const folder=join(root,token);
    await mkdir(folder,{mode:0o700});
    const trace=new DesignTrace(folder,{
      schemaVersion:1,attemptId:token,startedAt:timestamp(),events:[],
      kind:agent==='manual'?'inspector-edit':base?'agent-revision':'agent-generation',
      request,target,parent:base?.id??null,parentTraceId:base?.designTraceId??null,edits:edits||[],
      agent:agent==='manual'?null:{name:agent,requestedModel:model||null,reportedModel:null,effort:effort||null},
      scene:null,knowledge:null,references:[],prompt:null,code:null,browser:[],
      artDirection:{status:'not-observed',selected:null,rationale:null},
      visualReview:{status:'not-run',findings:null},automaticRepair:{status:'not-run'}
    });
    if(process.env.SURFACELIVE_DESIGN_AUDIT==='1')trace.audit=new DesignAudit(token,request);
    await trace.record('accepted');
    return trace;
  }
  constructor(folder,data){this.folder=folder;this.data=data;}
  async storeContracts(contracts,selectedId){
    const dir=join(this.folder,'contracts');await mkdir(dir,{mode:0o700});
    const refs=[];
    for(const contract of contracts){
      const file='contracts/'+contract.id+'.json',bytes=JSON.stringify(contract,null,2)+'\n';
      await writeFile(join(this.folder,file),bytes,{flag:'wx',mode:0o600});
      refs.push({id:contract.id,schemaVersion:contract.schemaVersion,runId:contract.runId,directionId:contract.directionId,
        file,sha256:hash(bytes),adoptedKnowledgeIds:contract.provenance.adoptedKnowledgeIds});
    }
    await this.record('contracts-validated',{contracts:refs,selectedContractId:refs.find(r=>r.directionId===selectedId).id});
  }
  async contractInput(operation,id,prompt){
    const ref=this.data.contracts?.find(r=>r.id===id);
    if(!ref)throw Error('源码输入缺少已验证的契约');
    const contract=await readRevisionContract({folder:this.folder,designContract:ref});
    if(!prompt.includes(contractInstruction(contract))||!prompt.includes(journeyInstruction(contract.evaluationPlan.journey)))throw Error('源码输入缺少已验证的完整契约指令');
    const entry={contractId:id,contractSha256:ref.sha256,promptSha256:hash(prompt)};
    if(contract.artDirection.language){
      entry.language={mode:contract.artDirection.language.mode,principles:contract.artDirection.principles.map(p=>({seedId:p.seedId,principleId:p.principleId,sourceIds:p.sourceIds})),
        stateIds:contract.experiencePlan.states.map(s=>s.id),instructionSha256:hash(contractInstruction(contract))};
    }
    await this.record('contract-input-prepared',{sourceInputs:{...this.data.sourceInputs,[operation]:entry}});
  }
  async generated(operation,product){
    const entry=this.data.sourceInputs?.[operation];
    if(!entry&&this.data.contracts)throw Error('源码缺少候选契约输入 '+operation);
    if(!entry)return;
    if(!this.data.invocations?.some(c=>c.operation===operation&&c.contractId===entry.contractId&&c.outcome==='returned'&&c.promptSha256===entry.promptSha256))throw Error('源码缺少实发契约回执');
    await this.record('contract-output-linked',{sourceInputs:{...this.data.sourceInputs,[operation]:{...entry,sourceVersion:sourceVersion(product)}}});
  }
  observe(action){
    if(!this.audit)return;
    try{action(this.audit);}catch{this.audit=null;console.warn('Design audit index unavailable');}
  }
  async record(stage,fields={}){
    Object.assign(this.data,fields,{stage});
    this.data.events.push({stage,at:timestamp()});
    const temp=join(this.folder,'.trace-'+randomUUID());
    await writeFile(temp,JSON.stringify(this.data,null,2)+'\n',{mode:0o600});
    await rename(temp,join(this.folder,'design-trace.json'));
    if(this.audit)await this.audit.save(this.folder,this.data).catch(()=>{console.warn('Design audit index write failed');});
  }
  async invocation(call,prompt){
    const binding=this.data.sourceInputs?.[call.operation];
    if(binding){
      if(binding.promptSha256!==call.promptSha256||hash(prompt)!==call.promptSha256)throw Error('Agent 实发文本与契约输入不一致');
      call={...call,contractId:binding.contractId,contractSha256:binding.contractSha256};
    }
    this.observe(audit=>audit.invocation(call,prompt));
    const calls=[...(this.data.invocations||[]),call];
    const names=[...new Set(calls.flatMap(c=>c.reportedModels))];
    const agent={...this.data.agent,reportedModel:names.length===1?names[0]:null};
    await this.record('cli-call-ended',{agent,invocations:calls});
  }
  async prepared(prompt,context,knowledge,refs){
    await writeFile(join(this.folder,'prompt.md'),prompt,{mode:0o600});
    const references=[];
    for(const [index,ref] of refs.entries()){
      if(ref.kind==='element'){references.push({kind:ref.kind,name:ref.name,selector:ref.selector});continue;}
      const file='reference-'+index+'.jpg';
      await writeFile(join(this.folder,file),ref.bytes,{mode:0o600});
      references.push({kind:'image',name:ref.name,file,sha256:hash(ref.bytes)});
    }
    await this.record('prompt-prepared',{scene:context,knowledge,references,
      prompt:{file:'prompt.md',sha256:hash(prompt),bytes:Buffer.byteLength(prompt)},
    });
  }
  async source(revision,product){
    const name=this.data.finalSourceInput?.candidate??'initial';
    const bound=this.data.sourceInputs?.[name==='initial'?'source':name],version=sourceVersion(product);
    const agentContract=this.data.contracts&&this.data.kind!=='inspector-edit';
    if((agentContract||this.data.sourceInputs)&&(!bound||bound.sourceVersion!==version))throw Error('最终源码与候选契约不一致');
    if(bound&&(this.data.finalSourceInput??this.data.prompt)?.sha256!==bound.promptSha256)throw Error('最终输入与候选回执不一致');
    const files={};
    for(const [name,key] of Object.entries(sourceFiles)){
      await writeFile(join(this.folder,name),product[key],{mode:0o600});
      files[name]={sha256:hash(product[key]),bytes:Buffer.byteLength(product[key])};
    }
    revision.designTraceId=this.data.attemptId;
    if(bound)revision.designContract=this.data.contracts.find(r=>r.id===bound.contractId);
    const ref=revision.designContract;
    await this.record('source-recorded',{code:{revision:revision.id,project:revision.project,parent:revision.parent,files,sourceVersion:version,
      ...(ref?{contractId:ref.id,contractSha256:ref.sha256}:{}),
      ...(bound?{promptSha256:bound.promptSha256}:ref?.application?{application:ref.application}:{}),
      input:this.data.finalSourceInput??this.data.prompt}});
  }
  async screenshot(device,bytes){
    const file='evidence/'+device+'.png';
    await mkdir(join(this.folder,'evidence'),{recursive:true});
    await writeFile(join(this.folder,file),bytes,{mode:0o600});
    return {file,sha256:hash(bytes),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),at:timestamp()};
  }
  async checked(check){
    this.data.browser.push(check);
    await this.record('browser-checked');
  }
  async finish(stage,fields={}){
    const endedAt=timestamp();
    await this.record(stage,{...fields,endedAt,elapsedMs:Date.parse(endedAt)-Date.parse(this.data.startedAt)});
  }
}
