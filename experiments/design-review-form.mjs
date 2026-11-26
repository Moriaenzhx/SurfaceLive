// This offline form receives public case information and anonymous labels, never the organizer key.
export function reviewForm(packet,scenarios){
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const sections=scenarios.map((s,index)=>{
    const versions=['X','Y','Z'].map(label=>{
      const path=esc(s.id)+'/'+label+'/';
      return '<tr><th>'+label+'</th><td><a href="'+path+'index.html">操作作品</a></td><td><a href="'+path+'desktop.png">桌面</a> · <a href="'+path+'mobile.png">手机</a></td></tr>';
    }).join('');
    const pairs=[['X','Y'],['Y','Z'],['Z','X']].map(([l,r])=>`<fieldset data-scene="${esc(s.id)}" data-left="${l}" data-right="${r}"><legend>${l} 与 ${r}</legend>
      <div><label>首选 <select name="winner"><option value="">待比较</option><option>${l}</option><option>${r}</option><option>平局</option></select></label>
      <label>三步任务 <select name="task"><option value="">请选择</option><option value="true">两份都完成</option><option value="false">存在阻断</option></select></label></div>
      <label>具体理由 <textarea name="reason" rows="2" placeholder="哪一步更容易完成，或哪处信息更容易辨认？"></textarea></label></fieldset>`).join('');
    return '<details'+(index===0?' open':'')+'><summary>'+esc(s.name)+'</summary><p>'+esc(s.brief)+'</p><ol>'+
      s.steps.map(step=>'<li>'+esc(step.action)+'</li>').join('')+'</ol><table><thead><tr><th>作品</th><th>实际交互</th><th>同视口截图</th></tr></thead><tbody>'+versions+'</tbody></table>'+pairs+'</details>';
  }).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>作品盲评</title>
<style>:root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif}body{max-width:48rem;margin:2rem auto;padding:0 1rem 3rem}h1{font-size:1.7rem;margin:.5rem 0}details{margin:1rem 0;border-top:1px solid #8887;padding:.65rem 0}summary{font-weight:650;cursor:pointer}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.3rem .5rem;border-bottom:1px solid #8884}fieldset{border:0;border-top:1px solid #8885;margin:1rem 0 0;padding:.5rem 0}legend{font-weight:600}fieldset div{display:flex;gap:1rem;flex-wrap:wrap}label{display:block;margin:.2rem 0}select,textarea,button{font:inherit}textarea{display:block;width:100%;box-sizing:border-box}button{margin-right:.75rem;padding:.35rem .75rem}a:focus-visible,:is(button,textarea,select,summary):focus-visible{outline:2px solid #5381c9;outline-offset:2px}</style>
<main><h1>作品盲评</h1><p>每个场景的三个字母独立打乱。按任务操作作品，返回本页查看截图并填写比较。可只提交已完成的比较。</p>
<form data-packet="${esc(packet)}">${sections}<button type="submit">保存匿名评审表</button><output aria-live="polite"></output></form></main>
<script>
const form=document.querySelector('form'),packet=form.dataset.packet,store='surface-blind-'+packet;
const groups=[...form.querySelectorAll('fieldset')],status=form.querySelector('output');
let reviewer=crypto.randomUUID();
function collect(){return groups.map(g=>({scene:g.dataset.scene,left:g.dataset.left,right:g.dataset.right,
  winner:g.elements.winner.value||null,reason:g.elements.reason.value.trim(),
  taskVerified:g.elements.task.value===''?null:g.elements.task.value==='true'}))}
try{const saved=JSON.parse(sessionStorage.getItem(store));if(saved){
  reviewer=saved.reviewer;for(const [i,v] of saved.comparisons.entries()){const g=groups[i];if(!g||v.scene!==g.dataset.scene||v.left!==g.dataset.left||v.right!==g.dataset.right)continue;
  g.elements.winner.value=v.winner||'';g.elements.reason.value=v.reason;g.elements.task.value=v.taskVerified===null?'':String(v.taskVerified);}
}}catch{}
form.addEventListener('input',()=>{try{sessionStorage.setItem(store,JSON.stringify({reviewer,comparisons:collect()}))}catch{}});
form.addEventListener('submit',e=>{e.preventDefault();const comparisons=collect().filter(c=>c.winner||c.reason||c.taskVerified!==null);
  if(!comparisons.length||comparisons.some(c=>!c.winner||!c.reason||c.taskVerified===null)){status.textContent='请为参与比较的每一对填写选择、任务结果和理由。';return}
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({packet,reviewer,comparisons},null,2)],{type:'application/json'}));
  link.href=url;link.download='blind-review-'+reviewer+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='已导出 '+comparisons.length+' 个判断。将文件交给组织者即可计入结果。';
});</script></html>`;
}
