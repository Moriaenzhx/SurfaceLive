// Electron-only contract regression with an isolated profile; never invokes a model.
import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {PNG} from 'pngjs';
import {inspectContract} from '../contract-check.mjs';

const root=resolve('runs/K-03B');
mkdirSync(root,{recursive:true});
const dir=mkdtempSync(join(root,'browser-contract-')),profile=join(dir,'profile');
mkdirSync(profile);app.setPath('userData',profile);
if(process.platform==='darwin'){app.setActivationPolicy('prohibited');app.dock?.hide();}
app.on('window-all-closed',()=>{});
const states=['initial','pending','evidence'].map((id,i)=>({id,purpose:['从名单选择','等待加载','复核证据'][i],
  priority:[['候选名单','进度','证据'][i]],controls:[['查看证据','加载中','保存复核'][i]],prerequisites:[],
  primaryAction:{id:['open','load','save'][i],operation:i===1?'wait':'click',value:null,
    nextState:['pending','evidence','initial'][i],expectedText:['读取证据','Kafka','候选名单'][i]}}));
const contract={id:'browser-fixture',directionId:'fixture',experiencePlan:{states},designSystem:{tokens:{'color.brand.primary':'#123456'}},
  requirements:{explicit:['品牌色 #123456'],tokenLocks:[{token:'color.brand.primary',value:'#123456'}]}};
const results={};
const repeated=new Set(['row-second','row-duplicate','row-duplicate-disabled','row-only-match-disabled','row-wrong-role']);
const valid=new Set(['valid','row-second','row-wrong-role','enter','slow-enter']);
function openControls(scenario){
  const mainDisabled=['disabled','row-only-match-disabled'].includes(scenario);
  const primary='<button id="open" data-experience-action="open" aria-label="'+
    (scenario==='bad-name'?'其它动作':'查看证据')+'" '+(mainDisabled?'disabled':'')+'>展开第二行</button>';
  if(!repeated.has(scenario))return primary;
  const duplicate=['row-duplicate','row-duplicate-disabled'].includes(scenario);
  const other=scenario==='row-wrong-role'
    ?'<div role="heading" aria-level="3" aria-label="查看证据" data-experience-action="open">第一行</div>'
    :'<button data-experience-action="open" aria-label="'+(duplicate?'查看证据':'查看其它候选人证据')+'" '+
      (scenario==='row-duplicate-disabled'?'disabled':'')+'>展开第一行</button>';
  // Hidden lookalikes and an incorrect action ID must not affect the match.
  return '<div hidden><button data-experience-action="open">查看证据</button></div>'+
    '<button data-experience-action="archive">查看证据</button>'+other+primary;
}
async function run(){
try{
  await app.whenReady();
  for(const scenario of ['valid','bad-name','bad-role-color','disabled','static-target',...repeated,'enter','slow-enter']){
    const win=new BrowserWindow({show:false,useContentSize:true,width:390,height:844,webPreferences:{sandbox:true,backgroundThrottling:false}});
    try{
      const animated=scenario==='enter'||scenario==='slow-enter';
      const animationStyles=animated?'@keyframes appear{from{opacity:0}to{opacity:1}} #chip,#reference{width:80px;height:30px;background:#007944}#chip{animation:appear '+
        (scenario==='enter'?'350ms':'5s')+' linear} aside,details p{animation:appear 30s}.parked{animation:appear 20s paused}':'';
      const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>'+animationStyles+':root{--color-brand-primary:#123456}body{font:16px system-ui}h1{color:'+
        (scenario==='bad-role-color'?'red':'var(--color-brand-primary)')+'}</style><h1 data-design-token="color.brand.primary">复核</h1>'+
        '<section data-experience-state="initial"><h2 data-primary-information="initial">候选名单</h2>'+openControls(scenario)+'</section>'+
        '<aside data-experience-state="unrelated"><button data-experience-action="open">查看证据</button></aside>'+
        '<section data-experience-state="pending" '+(scenario==='static-target'?'':'hidden')+'><p data-primary-information="pending">读取证据</p></section>'+
        '<section data-experience-state="evidence" hidden><p data-primary-information="evidence">Kafka 原文</p><div id="chip"></div><div id="reference"></div><details><summary>其它</summary><p>暂未展开</p></details><i class="parked">旁注</i><button id="save" data-experience-action="save">保存复核</button></section>'+
        '<script>const show=i=>document.querySelectorAll("section").forEach((s,k)=>s.hidden=i!==k);document.getElementById("open").onclick=()=>{show(1);setTimeout(()=>show(2),520)};document.getElementById("save").onclick=()=>show(0)</script>';
      await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
      await win.webContents.executeJavaScript('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
      const result=await inspectContract(win.webContents,contract,'mobile',async label=>{
        const file=scenario+'-'+label+'.png',bytes=(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG();
        await writeFile(join(dir,file),bytes);
        if(scenario==='enter'&&label==='mobile-state-evidence'){
          const centers=await win.webContents.executeJavaScript('["chip","reference"].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [(r.left+r.width/2)/innerWidth,(r.top+r.height/2)/innerHeight]})');
          const png=PNG.sync.read(bytes);
          const [animatedColor,referenceColor]=centers.map(([x,y])=>{
            const offset=(Math.floor(y*png.height)*png.width+Math.floor(x*png.width))*4;
            return [...png.data.subarray(offset,offset+4)];
          });
          assert(referenceColor[1]>referenceColor[0]*1.4&&referenceColor[3]===255,'visible green reference swatch');
          assert.deepEqual(animatedColor,referenceColor,'animated swatch reaches the adjacent static swatch color in the screenshot');
        }
        return {file,sha256:createHash('sha256').update(bytes).digest('hex'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
      },AbortSignal.timeout(25_000));
      results[scenario]=result;
      assert.equal(result.passed,valid.has(scenario),scenario+': '+JSON.stringify(result));
      const first=result.states[0];
      if(repeated.has(scenario))assert.equal(first.actionMatch.visible,2,scenario);
      if(valid.has(scenario)){
        assert.deepEqual(result.states.map(s=>s.stateId),['initial','pending','evidence']);
        assert.equal(first.accessibility.name,'查看证据');
        assert.equal(first.accessibility.role,'button');
        assert.equal(first.actionMatch.matching,1);
        assert.equal(first.control,'展开第二行');
        assert.equal(first.result.stateId,'pending');
        assert(result.states.every(s=>s.passed));
      }
      if(animated){
        const evidence=result.states.find(s=>s.stateId==='evidence');
        assert.equal(result.states[1].captureTiming?.status,'transient');
        assert.equal(first.captureTiming.status,'settled');
        assert(evidence.captureTiming.finiteAnimations>=1);
        if(scenario==='enter'){
          assert.equal(evidence.captureTiming.status,'settled');assert(evidence.screenshot?.sha256);
        }else{
          assert.equal(evidence.captureTiming.status,'timeout');assert(evidence.captureUncertain?.sha256);
          assert.equal(evidence.screenshot,undefined);
        }
      }
      if(['row-duplicate','row-duplicate-disabled'].includes(scenario)){
        assert.equal(first.actionMatch.matching,2);assert.match(result.error,/多个/);
      }
      if(['disabled','row-only-match-disabled'].includes(scenario)){
        assert.equal(first.actionMatch.matching,1);assert.match(result.error,/已禁用/);
      }
      if(scenario==='bad-name')assert.equal(first.actionMatch.matching,0);
      if(repeated.has(scenario)&&!valid.has(scenario))assert.equal(first.control,undefined);
      if(scenario==='bad-role-color')assert(result.findings.some(f=>f.severity==='block'&&f.token==='color.brand.primary'));
    }finally{win.destroy();}
  }
  console.log('PASS',dir);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{await writeFile(join(dir,'results.json'),JSON.stringify(results,null,2)+'\n');app.exit(process.exitCode??0);}
}
void run();
