import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readJSON} from './design-evidence.mjs';

const [path,input]=process.argv.slice(2);
if(!path||!input)throw Error('Usage: node experiments/design-ballot.mjs <packet folder> <completed anonymous ballot>');
const dir=resolve(path),key=await readJSON(join(dir,'organizer-key.json')),vote=await readJSON(input);
if(!vote||vote.packet!==key.packet||typeof vote.reviewer!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(vote.reviewer)||
    !Array.isArray(vote.comparisons)||!vote.comparisons.length)throw Error('评审需填写本包的独立匿名编号和实际比较');
const seen=new Set(),results=[];
for(const c of vote.comparisons){
  if(c.winner===null&&!c.reason)continue;
  const mapping=key.cases[c.scene];
  if(!mapping||!Object.hasOwn(mapping,c.left)||!Object.hasOwn(mapping,c.right)||c.left===c.right||
    ![c.left,c.right,'平局'].includes(c.winner)||typeof c.reason!=='string'||!c.reason.trim()||typeof c.taskVerified!=='boolean')throw Error('比较结果、任务确认或理由缺失');
  const pair=c.scene+'/'+[c.left,c.right].sort().join('-');
  if(seen.has(pair))throw Error('重复的比较');seen.add(pair);
  results.push({...c,conditions:[mapping[c.left].variant,mapping[c.right].variant],winningCondition:c.winner==='平局'?null:mapping[c.winner].variant});
}
if(!results.length)throw Error('空白评审表不会计票');
const out=join(dir,'human-results');await mkdir(out,{recursive:true});
const file=join(out,vote.reviewer+'.json'),record={packet:key.packet,reviewer:vote.reviewer,results};
const bytes=JSON.stringify(record,null,2)+'\n';
try{await writeFile(file,bytes,{flag:'wx',mode:0o600});}
catch(e){if(e.code!=='EEXIST'||await readFile(file,'utf8')!==bytes)throw e;}
console.log(results.length+' 个人工比较已记录');
