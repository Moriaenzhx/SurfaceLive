import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {askStructured} from './agent.mjs';

export async function designStage(name,options,trace,{prompt,schema,images=[],validate}){
  const work=join(options.cwd,name),folder=join(trace.folder,'steps',name),path='steps/'+name+'/';
  await mkdir(work,{recursive:true});await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'schema.json'),JSON.stringify(schema,null,2),{mode:0o600});
  const started=Date.now(),attempts=[];
  let instruction=prompt;
  try{
    for(const prefix of ['','correction-']){
      const promptFile=prefix+'prompt.md',responseFile=prefix+'response.json';
      await writeFile(join(folder,promptFile),instruction,{mode:0o600});
      await trace.record(name+'-requested');
      const raw=await askStructured({...options,operation:name+(prefix?'-correction':''),cwd:work,images,prompt:instruction,outputSchema:schema});
      await writeFile(join(folder,responseFile),JSON.stringify(raw,null,2),{mode:0o600});
      const receipt={prompt:path+promptFile,response:path+responseFile};
      attempts.push(receipt);
      let result;
      try{result=validate(raw);}
      catch(error){
        receipt.validationError=error.message;
        if(prefix)throw error;
        await trace.record(name+'-validation-rejected',{steps:{...trace.data.steps,[name]:{status:'retrying',attempts:[...attempts]}}});
        instruction=prompt+'\n\n上一次结构化回答未通过核对：'+error.message+'。必须使用本轮原文和实际证据 ID。仅修正有误的字段。\n'+JSON.stringify(raw);
        continue;
      }
      await trace.record(name+'-returned',{steps:{...trace.data.steps,[name]:{status:'validated',elapsedMs:Date.now()-started,...receipt,attempts}}});
      return result;
    }
  }catch(error){
    await trace.record(name+'-failed',{steps:{...trace.data.steps,[name]:{status:'failed',attempts,elapsedMs:Date.now()-started,error:error.message}}});
    throw error;
  }
}
