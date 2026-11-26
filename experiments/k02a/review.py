"""Build a byte-preserving offline review packet once; rebuild only from the saved private assignment."""
import hashlib
import json
import secrets
import struct
import zipfile
from pathlib import Path

src=Path('runs/K-01')
out=Path('runs/K-02A')
keyfile=out/'organizer'/'review-key.json'
sealed=json.loads((out/'organizer'/'freeze.json').read_text())['files']
dst=out/'reviewer'
dst.mkdir(exist_ok=True)
(dst/'images').mkdir(exist_ok=True)
states={'zhishi':('知时','首次打开择时查询','提交出行条件后查看候选时段'),
        'recruiting':('招聘复核','首次打开复核工作台','按姓名检索一人，查看其匹配证据')}
devices={'desktop':(1440,900),'mobile':(390,844)}
dimensions={'layout':'布局与信息层级','type_color':'字体、色彩与构图','craft':'产品专业感与原创性','fit':'业务场景适配'}
cases=[(s,d,k) for s in states for d in devices for k in (0,1)]
def new_key():
    order=['A0']*4+['A-current']*4
    secrets.SystemRandom().shuffle(order)
    pairs=[]
    for i,((scene,device,task),left) in enumerate(zip(cases,order),1):
        views=[]
        for group in (left,'A0' if left=='A-current' else 'A-current'):
            file=f"{scene}/{group}/verification/{device}{'-task' if task else ''}.png"
            views.append(dict(id='S-'+secrets.token_hex(4).upper(),source=file,sha256=sealed[file],group=group))
        pairs.append(dict(id=f'P{i:02}',scene=scene,device=device,task=task,views=views))
    return dict(packet='R-'+secrets.token_hex(6).upper(),pairs=pairs)
if not keyfile.exists():
    with keyfile.open('x') as f: json.dump(new_key(),f,indent=2)
keyfile.chmod(0o600)
key=json.loads(keyfile.read_text())
sections=[]
ballot={'packet':key['packet'],'reviewer':None,'status':'PENDING','comparisons':[]}
for pair in key['pairs']:
    scene,device=pair['scene'],pair['device']
    title=states[scene][0]; state=states[scene][1+pair['task']]
    w,h=devices[device]
    pairid=pair['id']; cards=[]; ids=[]
    for side,v in zip(('左','右'),pair['views']):
        sample=v['id']; ids.append(sample); file=f'images/{sample}.png'
        data=(src/v['source']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==v['sha256']==sealed[v['source']]
        assert struct.unpack('>II',data[16:24])==(w,h)
        (dst/file).write_bytes(data)
        cards.append(f'<figure><figcaption>{side} · {sample}</figcaption><a href="{file}" target="_blank"><img src="{file}" width="{w}" height="{h}" alt="{side}图，{title}，{state}"></a></figure>')
    choices=f'<option value="">待填写</option><option value="{ids[0]}">左 · {ids[0]}</option><option value="{ids[1]}">右 · {ids[1]}</option><option value="NO_PREFERENCE">无明显偏好</option><option value="BOTH_POOR">两者都不好</option>'
    fields=''.join(f'<label>{label}<textarea name="{key}" rows="2"></textarea></label>' for key,label in dimensions.items())
    sections.append(f'<section data-pair="{pairid}"><h2>{pairid}　{title} · {state}</h2><p>{w} × {h} 像素　点图可查看原尺寸</p><div class="scroll"><div class="pair">{"".join(cards)}</div></div><fieldset><legend>此组记录</legend><label>整体选择<select name="preference">{choices}</select></label><div class="notes">{fields}</div><label>简短选择理由<textarea name="reason" rows="2"></textarea></label></fieldset></section>')
    ballot['comparisons'].append(dict(pair=pairid,scene=title,viewport=[w,h],state=state,left=ids[0],right=ids[1],preference=None,**dict.fromkeys(dimensions),reason=None,status='PENDING'))
template=json.dumps(ballot,ensure_ascii=False,indent=2)
(dst/'feedback-template.json').write_text(template+'\n')
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>界面成对评阅</title>
<style>
*{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;color:#202326;background:#fff;margin:0 auto;padding:1.5rem;max-width:1600px}header,fieldset{max-width:70rem}section{margin:2.5rem 0 3.5rem;border-top:2px solid #68737b}h2{font-size:1.25rem}p{margin:.5rem 0}figure{margin:0;text-align:center;min-width:0}figcaption{font-weight:600;margin:.4rem}img{max-width:100%;height:auto;vertical-align:top;outline:1px solid #ddd}.scroll{overflow-x:auto}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:580px;gap:1rem}fieldset{margin:1.4rem auto 0;padding:1rem;border:1px solid #bbb}legend{font-weight:bold}label{display:block;margin:.4rem 0}select,textarea,button{font:inherit}select,textarea{display:block;width:100%;padding:.35rem}.notes{display:grid;grid-template-columns:1fr 1fr;gap:0 1rem}button{padding:.4rem 1rem}output{margin-left:1rem}@media(max-width:600px){body{padding:.75rem}.notes{display:block}}
</style><header><h1>界面成对评阅</h1><p>按每组给出的业务状态对照左右图。每组独立排位，点击图片可放大。请评价可见的设计，用一处具体区域说明理由。样例人物、文案、输入资料和滚动位置可能不同。</p>
<p>整体可选左、右、无明显偏好、两者都不好。愿意评价的组请填全四项判断和理由；未评的组留空。完成后在页底导出 JSON。整页离线，关闭页面前请导出记录。</p></header><form id="form">''' + ''.join(sections) + '''<button type="submit">导出匿名记录</button><output role="status"></output></form><script type="application/json" id="template">''' + template + '''</script><script>
const form=document.querySelector('form'),status=form.querySelector('output');
const reviewer=crypto.randomUUID();
form.addEventListener('submit',e=>{
  e.preventDefault();const result=JSON.parse(document.querySelector('#template').textContent);
  let filled=0;
  for(const [i,section] of [...form.querySelectorAll('section')].entries()){
    const row=result.comparisons[i];
    const fields=[...section.querySelectorAll('select,textarea')];
    if(fields.every(f=>!f.value.trim()))continue;
    const missing=fields.find(f=>!f.value.trim());
    if(missing){status.textContent='请完成 '+row.pair+' 的选择、四项判断与理由。';missing.focus();return;}
    for(const f of fields)row[f.name]=f.value.trim();
    row.status='REVIEWED';filled++;
  }
  if(!filled){status.textContent='尚未填写评价，记录仍为待评。';return;}
  result.reviewer=reviewer;result.status=filled===result.comparisons.length?'REVIEWED':'PARTIAL';
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
  link.href=url;link.download='review-'+reviewer+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已导出 '+filled+' 组评价。';
});</script></html>'''
(dst/'index.html').write_text(html)
assets=[dst/'index.html',dst/'feedback-template.json',*sorted((dst/'images').glob('*.png'))]
assert len(assets)==18
with zipfile.ZipFile(out/'reviewer.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in assets:
        info=zipfile.ZipInfo(p.relative_to(dst).as_posix())
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
print('8 pairs, 16 anonymous PNGs; PENDING')
