export type Scenario = {
  id: string;
  title: string;
  description: string;
  audience: string;
  primaryTask: string;
  requirements: string[];
  states: string[];
  forbidden: string[];
  userGoal: string;
};

export const scenarios: Scenario[] = [
  {
    id: 'recruiting', title: '招聘 Agent 工作台',
    description: '面向猎头与HR的招聘智能体工作台。用户需要查询候选人、比较匹配度、查看Agent执行进度并逐人复核。',
    audience: '每天处理大量候选人的招聘顾问，使用桌面端高密度工作台',
    primaryTask: '从候选人池筛选合适人选，查看匹配理由，逐条做复核决策',
    requirements: ['可搜索和筛选候选人', '候选人应展示可比较的职位匹配信息和来源', '展示异步任务进度和异常', '能查看人选详情并做复核操作'],
    states: ['正常结果', '无搜索结果', 'Agent 执行中', '某个来源失败'],
    forbidden: ['大面积占空间的AI介绍文案', '只显示统计卡片却没有真实人选列表'],
    userGoal: '少量操作完成候选人审阅和决定，而不是浏览一张概念海报'
  },
  {
    id: 'coroof', title: 'coRoof 企业运行决策中心',
    description: '面向10—50人小企业老板的经营驾驶舱，展示部门进展、经营指标、异常风险、需要做决定的事项。',
    audience: '需要快速把握公司全局、少做重复管理工作的企业经营者',
    primaryTask: '先看到必须关注的经营异常，再下钻证据并做决策',
    requirements: ['全局状态与重要异常有清楚的信息等级', '可打开异常详情查看相关依据', '注明数据更新与可信状态', '能切换部门或时间范围'],
    states: ['正常', '数据延迟', '异常待决策', '没有可靠数据'],
    forbidden: ['把全部内容画成等权重KPI卡片', '让老板先面对海量待办'],
    userGoal: '拥有掌控全局的视觉感受，并清楚知道下一步该看什么'
  },
  {
    id: 'neighborhood', title: '附近事项移动端',
    description: '以周边距离为基础的邻里事项与任务产品。居民查看附近事项、筛选、参与沟通并发布任务。',
    audience: '普通居民，主要通过手机快速浏览并处理周边事务',
    primaryTask: '识别与自己相关的附近事项，并进入详情或发布任务',
    requirements: ['附近事项按真实场景展示距离与时间', '能筛选和查看事项详情', '支持任务发布入口', '底部导航应清楚且不与首页快捷入口重复'],
    states: ['正常信息流', '无附近事项', '需要实名才能互动', '任务已经关闭'],
    forbidden: ['绿色大块模板化卡片', '重复底部导航里的功能', 'AI确认类无意义卡片'],
    userGoal: '时尚、可信、简洁，打开即看到真正的附近信息'
  }
];

export function getScenario(id: string): Scenario {
  const item = scenarios.find(s => s.id === id);
  if (!item) throw new Error(`未知场景 ${id}；可选：${scenarios.map(s => s.id).join(', ')}`);
  return item;
}
