# K-03A · 实施记录

正式桌面入口在页面源码生成前建立 Design Contract 1.0。两个真实业务运行都沿用了原来的场景分析和导演调用。每次导演返回两个方向，宿主保存这两个方向的契约，首次源码调用只使用被选中的一份。模糊官网运行止于契约。三个运行的调用、哈希、源码和浏览器结论见测试报告。[桌面链路](K-03A_DESIGN_CONTRACT_ARCHITECTURE.md) · [产物与测试](K-03A_TEST_REPORT.md)

## 实际改变

| 范围 | 文件与作用 |
|---|---|
| 数据约定 | [contract-schema.mjs](../../live-engine/design/contract-schema.mjs) 定义四部分数据、版本、14 个语义 Token 和严格类型；[contract.mjs](../../live-engine/design/contract.mjs) 从真实分析和候选组装，校验用户锁、状态图、引用与设备检查，生成编码指令。 |
| 现有决策链 | [director.mjs](../../live-engine/design/director.mjs) 在原有候选结构中加入本轮设计决定。[prepare-turn.mjs](../../desktop/prepare-turn.mjs) 复用原 Scene、检索、偏好、导演和业务旅程；[engine.mjs](../../desktop/engine.mjs) 根据契约模式组合宿主指令。[live-knowledge.ts](../../live-engine/knowledge/src/live-knowledge.ts) 让内置偏好记录携带原有指导文本。 |
| 源码与父版 | [main.mjs](../../desktop/main.mjs) 将父契约、最终输入和源码关联；[design-trace.mjs](../../desktop/design-trace.mjs) 保存原件并确认输入、回执与三文件版本。手动保存注明继承，继续保留浏览器检查。[visual-review.mjs](../../desktop/visual-review.mjs) 将备选与修复绑定对应方向；[build.mjs](../../desktop/build.mjs) 将契约模块纳入现有构建。 |
| 可重复检查 | [契约测试](../../desktop/tests/design-contract.test.mjs)、[离线回答夹具](../../desktop/tests/design-agent-fixture.cjs)、[桌面冒烟](../../desktop/tests/smoke.mjs)、[旧版手动编辑回归](../../desktop/tests/editor.mjs)、[真实冒烟入口](../../experiments/k03a-smoke.mjs)、[断网可用的证据核验](../../experiments/k03a-verify.mjs)、[独立浏览器回放](../../experiments/k03a-replay.mjs)、[教学样例构造脚本](../../experiments/k03a-examples.mjs)。 |

从运行记录可以区分本次采用的案例、被拒案例和没有出现的人类偏好。知识库审核、检索排序和既有视觉比较在原模块工作。契约不增加新的模型角色或评审服务。

## 三份真实输出

| 本次实际输入 | 被选方向及可核对的设计决定 |
|---|---|
| 知时 · 传统文化移动应用 | **按日期浏览**。从查询条件切换到候选时段，理由和已保存项各有状态；手机把条件收为摘要。选用 `vis-nearby` 的行内邻接关系，拒用 `vis-drawer` 和 `vis-topread`。原始要求保留民俗参考边界。 [选中契约](../../runs/K-03A/zhishi-TF2IOX/attempt/contracts/9948096c-6c64-4480-a4ee-f166335c9d4b.json) |
| 招聘复核工作台 | **候选人比较表**。桌面冻结姓名与状态列，证据在候选人下展开；手机变成单列，保留来源、缺口及复核动作。本轮拒绝 `vis-calc`，采用 `vis-gnucash` 主行下嵌次行的机制，并记录适用边界。K-01 选中的招聘方向没有采用这两张视觉案例。 [本轮契约](../../runs/K-03A/recruiting-sHiGfI/attempt/contracts/f5ccbf52-c23d-483c-8669-07bfde499194.json) · [K-01 选择记录](../../runs/K-01/recruiting/A-current/attempt/steps/art-direction/response.json) |
| “做一个高级的 SaaS 产品官网。” | **先讲清采购审批，再看流程**。受众、行业、转化目标与品牌仍待确认。导演明确将采购审批设为示例；深青是可替换的设计选择，用户颜色锁为零。只验证规划。 [真实契约](../../runs/K-03A/ambiguous-iB9yLc/5ea63909-56be-4c2e-a6b8-40bd44659fcb/contracts/9467d10f-06c7-4639-be8b-edff09fdcbba.json) |

三份额外的离线样例用于讲解和回归。知时、招聘的旧场景和方向来自 K-01，新增字段为编写的示例；模糊官网样例完全为测试编写。其清单包含各自哈希和出处。[样例清单](examples/k03a/manifest.json)

## 验收边界

代码可以证明某条原文约束进入了哪份契约、某个候选采用了哪些证据、编码 Agent 收到了哪段文本，以及返回了哪一版代码。确定性检查还能发现不连通的状态、相反的明暗或字阶、缺失的引用和覆盖用户色值的方案。真实页面是否恰当落实全部自然语言设计决策，仍要用页面操作、目标视口和人的判断分别验证。

目前把桌面、手机布局写成不同的结构说明，并不足以判定两者的语义差异。自然语言案例理由也可能言之成理而不合业务。Token 对比度检查发生在契约层，生成后每个 DOM 元素的实际对比度需要另测。K-03B 的最小建议是将首屏主操作、详情中的业务动作及其前置步骤分别绑定到契约状态。先用本批两份冻结源码校准查询结果和招聘证据在两端的可达性、可见性。正式审美比较仍待 K-03E。
