import { createDirectorBrief, detectScene } from '../live-engine/knowledge/src/live-knowledge.ts';
import type { Scenario } from './scenarios.ts';

export type Variant = 'A0' | 'A1' | 'A2';
export const variants: Variant[] = ['A0','A1','A2'];

export function createPrompt(s: Scenario, v: Variant): string {
  const base = [
    `# 前端交付任务 — ${s.title}`,
    `场景：${s.description}`,
    `目标用户：${s.audience}`,
    `首要任务：${s.primaryTask}`,
    `用户期待：${s.userGoal}`,
    `必需功能：\n${s.requirements.map(x=>'- '+x).join('\n')}`,
    `必须有可验证的状态：\n${s.states.map(x=>'- '+x).join('\n')}`,
    `明确不要：\n${s.forbidden.map(x=>'- '+x).join('\n')}`,
    '## 固定交付契约（所有实验相同）',
    '在当前独立工作目录中直接写 index.html、styles.css、app.js。不要只回复文字或伪代码。',
    '不使用外部CDN、第三方付费图片或未经许可的字体。三文件在离线浏览器中可运行。',
    '必须提供 1440px 桌面与 390px 移动端布局，实际按钮、筛选、弹层或切换行为可以操作。',
    '首个业务主操作必须带 data-testid="primary-action"，其操作结果在 data-testid="action-feedback" 元素可读；不要伪造后端真实执行。',
    '所有模拟数据必须明确是示例数据，不冒充真实业务或生产连接。',
    '勿更改当前目录以外的文件，不读取个人主目录或配置秘钥，不安装全局依赖。',
    '浏览器验收由宿主在生成器退出后统一运行。写完三个文件并检查源码即可退出。',
    '完成后列明文件与已实现/未实现的功能边界。',
  ].join('\n\n');
  if (v === 'A0') return base;
  if (v === 'A1') {
    const {scene, matches, confidence} = detectScene(`${s.description} ${s.primaryTask}`);
    return base + '\n\n## 场景理解层（只补业务结构，不提供设计知识库）\n'
      + `识别类型：${scene}，置信：${confidence}，线索：${matches.join('、') || '不明确'}。\n`
      + `请先在内部考虑用户任务、业务字段、信息优先级、主要与异常状态，再据此实现。不要凭空增加业务流程。`;
  }
  return base + '\n\n## Live Engine 设计知识与艺术指导层\n'
    + createDirectorBrief(`${s.title}。${s.description} ${s.primaryTask}`, 14);
}
