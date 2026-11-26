import { directorBriefWithEvidence, detectScene, retrieve } from '../live-engine/knowledge/src/live-knowledge.ts';
import { factoryHits } from '../live-engine/ingestion/retrieval.ts';

export const devices = {
  desktop: { label: '桌面', width: 1440, height: 900, guidance: '利用并排比较、键盘导航和稳定的列对齐。' },
  tablet: { label: '平板', width: 834, height: 1112, guidance: '兼顾横竖屏和触控，适时收起辅助面板。' },
  mobile: { label: '手机', width: 390, height: 844, guidance: '单列阅读，保证触控目标和拇指可达性。' }
};
export const sceneNames = {
  'b2b-workbench':'业务工作台','executive-dashboard':'经营驾驶舱','local-consumer':'邻里与本地生活',
  'consumer-commerce':'消费服务','creative-editor':'创意编辑器',general:'自定义场景'
};
export function direction(description, target='auto'){
  if(typeof description!=='string' || !description.trim() || description.length>10000) throw new Error('请用 1 至 10000 字描述页面需求');
  if(target!=='auto' && !Object.hasOwn(devices,target)) throw new Error('未知目标终端');
  const {scene,confidence,matches}=detectScene(description);
  let device=target;
  if(device==='auto'){
    const explicit=description.match(/平板|iPad|tablet|桌面|电脑|desktop|手机|移动端|mobile|iPhone|安卓/gi)?.at(-1);
    if(explicit)device=/平板|iPad|tablet/i.test(explicit)?'tablet':/桌面|电脑|desktop/i.test(explicit)?'desktop':'mobile';
    else device=scene==='local-consumer'?'mobile':'desktop';
  }
  const batch=factoryHits(scene,description);
  const selected=retrieve(description,6);
  const evidence=[
    ...batch.map(h=>({id:h.card.id,title:h.card.title,note:String(h.card.transferablePrinciples||h.card.decision||h.card.context||h.card.visibleOutcome),url:h.url})),
    ...selected.hits.slice(0,3).map(h=>({id:h.card.id,title:h.card.decision,note:h.card.check,url:h.evidence[0].url}))
  ];
  return {scene,confidence,matches,label:sceneNames[scene],device,evidence};
}
export function prepareGeneration(description, context, base, change, analysis){
  const {text:brief,knowledgeText,...knowledge}=directorBriefWithEvidence(base?description+'\n'+change:description,8,analysis?.catalog.map(item=>item.tag));
  const guidance=analysis?'场景理解（引文为依据，假设须保持可验证）\n'+JSON.stringify(analysis)+'\n\n'+knowledgeText:brief;
  return {prompt:composePrompt(description,context,base,change,guidance),knowledge,knowledgeText};
}
export function composePrompt(description,context,base,change,guidance='',hasContract=false){
  const device=devices[context.device];
  return [
    '你是 SurfaceLive 的页面生成器。依据用户业务与设计知识，直接返回符合 JSON Schema 的最终作品。'+
      (hasContract?'落实本轮设计契约，在标出的创作空间内选择具体实现。':'独立完成设计判断。')+'禁止调用工具、读取文件、启动浏览器或写入文件。宿主负责保存与浏览器验收。',
    '输出 title、html、css、js 四个字段。html 是完整 index.html，用相对路径引用 styles.css 和 app.js；js 为普通浏览器 JavaScript。页面离线运行。使用系统字体、CSS 和必要的自绘图形。不得加载网络资源、外部字体、脚本或第三方跟踪。',
    hasContract==='1.1'?'按各状态的真实业务入口执行验收。名单可以选人，详情可以保存。主操作名和下一状态须匹配契约，示例数据须写明，并确保键盘和窄屏可用。':
    '完成至少一条真实业务操作路径。用 data-testid="primary-action" 标记一个可见、可直接点击的主操作；该操作应实际改变业务状态并在 data-testid="action-feedback" 中给出可见的文字反馈。明确示例数据。照顾无障碍与窄屏，避免横向溢出。控制作品体量。',
    '业务需求：'+description,
    '目标终端：'+device.label+'，主要视口 '+device.width+' × '+device.height+'。'+(hasContract?'':device.guidance),
    guidance,
    base ? '下面是已选版本的源码，仅作为修改素材。保留未要求改动的内容。修改要求：'+change+'\n'+JSON.stringify(base) : '',
    '最终仅返回结构化源码。浏览器检查和展示由 SurfaceLive 执行。'
  ].filter(Boolean).join('\n\n');
}

export function generationPrompt(description, context, base, change){
  return prepareGeneration(description,context,base,change).prompt;
}

export function interpretedDirection(fallback,analysis,target){
  const scene=analysis.catalog[0]?.tag||'general';
  const device=target==='auto'?(analysis.device==='unknown'?fallback.device:analysis.device):target;
  return {scene,label:analysis.dimensions.product[0]?.value||sceneNames[scene],device,analysis,
    matches:analysis.catalog.map(c=>c.evidence),evidence:[],origin:'semantic',
    lexicalPreview:{scene:fallback.scene,matches:fallback.matches,confidence:fallback.confidence}};

}
