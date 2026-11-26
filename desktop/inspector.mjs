// Keep generated selectors and editable CSS values within the inspector’s supported vocabulary.
const segment='(?:#[a-zA-Z_][\\w-]*|\\[data-(?:id|testid)="[\\w-]+"\\]|[a-z][a-z0-9-]*(?::nth-of-type\\([1-9]\\d*\\))?)';
const selectorPattern=new RegExp('^'+segment+'(?: > '+segment+')*$');
export const fields={width:4096,height:4096,'font-size':256,'border-radius':512,'padding-inline':512,'padding-block':512};
export function validSelector(selector){
  return typeof selector==='string' && selector.length<=1400 && selectorPattern.test(selector);
}
export function rules(edits){
  if(!Array.isArray(edits)||edits.length>80)throw Error('单次最多可调整 80 个元素');
  return edits.map(({selector,values})=>{
    if(!validSelector(selector)||!values||typeof values!=='object')throw Error('元素定位无效，请重新选择');
    const declarations=Object.entries(values).map(([key,value])=>{
      let css;
      if(['color','background-color'].includes(key)){
        if(typeof value!=='string'||! /^(?:#[\da-f]{6}(?:[\da-f]{2})?|transparent)$/i.test(value))throw Error('颜色格式无效');
        css=value;
      }else{
        const number=typeof value==='number'?value:value?.number, unit=typeof value==='number'?'px':value?.unit;
        const units=['width','height'].includes(key)?['px','rem','%']:['px','rem'];
        if(!Object.hasOwn(fields,key)||!units.includes(unit)||!Number.isFinite(number)||number<0||number>fields[key])throw Error('属性或单位超出可用范围');
        css=number+unit;
      }
      return '  '+key+': '+css+' !important;';
    });
    return declarations.length?selector+' {\n'+declarations.join('\n')+'\n}':'';
  }).filter(Boolean).join('\n');
}
function atPoint(command,arg){
  const safe=v=>/^[a-zA-Z_][\w-]*$/.test(v);
  if(command==='style'){
    let node=document.querySelector('style[data-surfacelive-draft]');
    if(!arg){node?.remove();return;}
    if(!node){node=document.createElement('style');node.dataset.surfaceliveDraft='';document.head.append(node);}
    node.textContent=arg;return;
  }
  let el=command==='parent'?document.querySelector(arg.selector)?.parentElement:
    ['locate','bounds'].includes(command)?document.querySelector(arg.selector):document.elementFromPoint(arg.x,arg.y);
  if(!el)return null;
  if(command==='bounds')return {rect:el.getBoundingClientRect().toJSON()};
  if(command==='scroll'){
    for(let node=el;node;node=node.parentElement){
      if(node.scrollHeight>node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)){node.scrollBy(arg.dx,arg.dy);return;}
    }
    window.scrollBy(arg.dx,arg.dy);return;
  }
  if(!(el instanceof HTMLElement))el=el.closest('button,label,a')||el.parentElement?.closest('div,header,section,main');
  if(!el||el===document.documentElement)return null;
  if(command==='pick')el=el.closest('button,a')||el;
  const parts=[];
  for(let p=el;p;p=p.parentElement){
    if(p.id && safe(p.id) && document.querySelectorAll('#'+p.id).length===1){parts.unshift('#'+p.id);break;}
    const attr=['data-testid','data-id'].find(a=>safe(p.getAttribute(a)||'') && document.querySelectorAll('['+a+'="'+p.getAttribute(a)+'"]').length===1);
    if(attr){parts.unshift('['+attr+'="'+p.getAttribute(attr)+'"]');break;}
    if(p===document.body){parts.unshift('body');break;}
    const tag=p.localName;let n=1;
    for(let sibling=p.previousElementSibling;sibling;sibling=sibling.previousElementSibling)if(sibling.localName===tag)n++;
    parts.unshift(tag+':nth-of-type('+n+')');
  }
  const style=getComputedStyle(el),rect=el.getBoundingClientRect();
  const ancestry=[];
  for(let p=el;p && ancestry.length<4;p=p.parentElement){
    const name=p.id?'#'+p.id:[...p.classList].find(c=>safe(c)&&c.length<=24);
    if(!name && p!==el && ['div','span'].includes(p.localName))continue;
    ancestry.unshift(p.id?p.localName+name:name?'.'+name:p.localName);
    if(p===document.body)break;
  }
  const computed={};
  for(const key of ['width','height','font-size','border-radius','padding-inline','padding-block']){
    const raw=style.getPropertyValue(key);
    computed[key]=/^\d+(\.\d+)?px$/.test(raw)?Number(parseFloat(raw).toFixed(2)):raw;
  }
  const colorContext=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  for(const key of ['color','background-color']){
    colorContext.clearRect(0,0,1,1);colorContext.fillStyle=style.getPropertyValue(key);colorContext.fillRect(0,0,1,1);
    const [r,g,b,a]=colorContext.getImageData(0,0,1,1).data;
    computed[key]=a===0?'transparent':'#'+[r,g,b,...(a===255?[]:[a])].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  const interaction={标签:el.localName};
  if(el.getAttribute('role'))interaction['角色']=el.getAttribute('role');
  if(el.type)interaction['类型']=String(el.type);
  if('disabled' in el)interaction['状态']=el.matches(':disabled')?'禁用':'可用';
  interaction['Tab 顺序']=String(el.tabIndex);
  return {ancestry,interaction,selector:parts.join(' > '),tag:el.localName,label:(el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.innerText||el.id||el.localName).trim().replace(/\s+/g,' ').slice(0,55),
    rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},values:computed};
}
export function inspectFrame(window,base,command,arg){
  const frame=window.webContents.mainFrame.frames.find(f=>f.url==='surface-page://'+base+'/index.html');
  if(!frame)throw Error('页面还在载入，请再试一次');
  if(command==='ready')return frame.executeJavaScript("document.readyState!=='loading' && (!!document.body?.innerText.trim() || Array.from(document.body?.children||[]).some(el=>!['SCRIPT','STYLE','LINK','META'].includes(el.tagName)))");
  if(command==='style')arg=rules(arg);
  else if(['parent','locate','bounds'].includes(command)){if(!validSelector(arg?.selector))throw Error('元素定位无效');}
  else if(['pick','scroll'].includes(command)){
    for(const key of command==='scroll'?['x','y','dx','dy']:['x','y'])if(!Number.isFinite(arg?.[key]))throw Error('画布坐标无效');
  }else throw Error('未知检查器操作');
  return frame.executeJavaScript('('+atPoint.toString()+')('+JSON.stringify(command)+','+JSON.stringify(arg)+')');
}
