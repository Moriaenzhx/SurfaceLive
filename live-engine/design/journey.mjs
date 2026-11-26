import {object,list,string} from './scene.mjs';

export const journeySchema=list(object({id:string,action:string,operation:{type:'string',enum:['click','fill','select']},
  value:string,state:string,contains:string,result:string,requireChange:{type:'boolean'},
  opener:{anyOf:[object({id:string,action:string}),{type:'null'}]}}));
const key=/^[a-z][a-z0-9-]{0,47}$/;
const validKey=value=>typeof value==='string'&&key.test(value);
export function validateJourney(flow){
  if(!Array.isArray(flow)||flow.length<1||flow.length>4)throw Error('请定义一至四个可复查的业务操作');
  const keys=new Set();
  for(const step of flow){
    if(!step||!validKey(step.id)||!validKey(step.state)||keys.has(step.id)||!['click','fill','select'].includes(step.operation)||
      typeof step.value!=='string'||step.value.length>120||(step.operation!=='click'&&!step.value.trim())||
      (step.requireChange!==undefined&&typeof step.requireChange!=='boolean')||
      (step.opener!=null&&(!validKey(step.opener.id)||step.opener.id===step.id||
        typeof step.opener.action!=='string'||!step.opener.action.trim()||step.opener.action.length>180))||
      ![step.action,step.result,step.contains].every(v=>typeof v==='string'&&v.trim()&&v.length<=250))
      throw Error('业务操作缺少有效定位、动作或可见结果');
    keys.add(step.id);
  }
  return flow;
}
export function journeyInstruction(flow){
  return ['用户主要任务的浏览器验收。将下述定位加在已有真实控件，结果标注在对应的可见业务内容。每一步应能按顺序完成。勿增加专为测试而设的按钮。',
    ...flow.map(s=>s.action+'：实际控件 data-task="'+s.id+'"，操作 '+(s.operation||'click')+(s.value?'，输入或选中 '+s.value:'')+
      '；'+s.result+'，可见内容 data-state="'+s.state+'"，应包含 '+s.contains+
      (s.opener?'。若本方向需要先'+s.opener.action+'，在真实入口上标记 data-task="'+s.opener.id+'"。':'')
    )].join('\n');
}
