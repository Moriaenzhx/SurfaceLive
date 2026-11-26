# SurfaceLive · K-01 首稿基线

比较单位是每个场景一次真实首稿。两组均用本机 Codex、gpt-6.2-sol、low；模型由每次 CLI 启动信息确认。两个 A0 直接通过相同适配器的结构化传输层，不调用任何 Live Engine 检索、导演或优化。只增加离线三文件交付、目标尺寸与禁用工具的共同工程约束。A-current 在新 profile 中点击「新增作品」、设置终端和模型、填写相同业务需求、点击「发送消息」。所有模型工作目录独立，未输入任何其他组源码、截图或历史项目。

A-current 走默认 prepareTurn 分支，保留语义分析、正式偏好查询、导演、源码调用及保存前的双端交互门禁。只在后台验收实例加 --first-source-only，跳过正式新建流程中的第二候选、成对视觉评审和修复。两组各一次源码调用；当前引擎的设计阶段额外消耗模型调用和时间，不能据此推断等 token 预算的胜率。每个场景每组 n=1。

## 实际发送的业务需求

知时 · 传统文化移动应用
设计一款基于用户输入的八字、事项和时间范围，提供传统民俗择时参考的移动端应用。
核心能力：输入或维护基础资料；选择事项类型；选择时间范围；查看候选时段；查看推荐理由；保存或比较结果。
要求界面具有优秀的中文排版、独立视觉语言、清晰的任务路径和真实交互。不得将民俗推断包装成有科学保证的预测。不要强制采用国风绿金、山水、印章等常见视觉模板。

招聘复核工作台
为招聘顾问生成桌面端候选人复核工作台。
核心能力：查看岗位需求；查看候选人及匹配证据；搜索、筛选和排序；查看搜索任务执行状态；人工复核结果；保留不同复核状态。
需要体现 B 端产品的信息密度、层级、效率和专业感。

## 运行回执

以下为 2026-11-22 上海时间。耗时是各次驱动回执的墙钟时间，token 是 CLI 逐调用报告的 tokens used 之和；未取得收费金额、计费拆分或完整工具事件流。

| 场景 / 组 | 首稿生成时刻 | 回执耗时 | 调用 / token | 源码、运行证据及版本 |
|---|---|---:|---|---|
| 知时 / A0 | 22:14:25 | 218.1 s | 1 / 25,712 | [源码](../../runs/K-01/zhishi/A0/source/index.html) · [回执](../../runs/K-01/zhishi/A0/receipt.json) · [双端实测](../../runs/K-01/zhishi/A0/verification/results.json) · 1bfcd9850a66 |
| 知时 / A-current | 22:23:14 | 559.2 s | 3 / 81,209 | [源码](../../runs/K-01/zhishi/A-current/attempt/index.html) · [回执](../../runs/K-01/zhishi/A-current/receipt.json) · [双端实测](../../runs/K-01/zhishi/A-current/verification/results.json) · 42a87e7c6f11 |
| 招聘复核 / A0 | 22:15:32 | 272.6 s | 1 / 28,200 | [源码](../../runs/K-01/recruiting/A0/source/index.html) · [回执](../../runs/K-01/recruiting/A0/receipt.json) · [双端实测](../../runs/K-01/recruiting/A0/verification/results.json) · ed88bbcca46e |
| 招聘复核 / A-current | 22:33:30 | 612.3 s | 3 / 82,700 | [源码](../../runs/K-01/recruiting/A-current/attempt/index.html) · [回执](../../runs/K-01/recruiting/A-current/receipt.json) · [双端实测](../../runs/K-01/recruiting/A-current/verification/results.json) · b74ec45768b6 |

真实运行使用 Electron 的私有 surface-page 协议（A-current 内建检查）以及 Chrome 的离线 file URL（四份源码统一复测）。每份双端实测文件记录实际 URL、代码三文件哈希、截图哈希、生成时间、模型及视口。截图为 DPR 1 的同尺寸 PNG。宿主原始截图可能为 DPR 2，仅在各自 attempt/evidence 下保留。源码为原生三文件，安装依赖与打包步骤均不适用。对每份实际运行前核对文件哈希与 JS 解析，再检查浏览器加载、控制台、根宽度、局部文本裁切及业务结果。

## 首稿与任务复测

### 知时 · A0

run_id 为 `e99dd17c-2631-4683-9a17-d2b1e8b61285`。[桌面 1440 × 900](../../runs/K-01/zhishi/A0/verification/desktop.png) · [手机 390 × 844](../../runs/K-01/zhishi/A0/verification/mobile.png) · [目标视口操作态](../../runs/K-01/zhishi/A0/verification/mobile-task.png)。

![知时 A0 目标终端首屏](../../runs/K-01/zhishi/A0/verification/mobile.png)

宿主状态为 GENERATED。直接 Agent 的 prompt 不含引擎知识、候选策略和测试钩子，业务验收依据生成页面上真实可见的控件。[实际输入](../../runs/K-01/zhishi/A0/prompt.md)。

- 独立 desktop 回放，保存四柱并检查资料摘要 ✓；选择出行与时间范围，生成候选 ✓；查看推荐理由 ✓；比较两个不同结果 ✓；收藏结果刷新后仍可读取 ✓。控制台与脚本错误 0，根宽度 1440 → 1440，局部裁切探针 []。初始可点按钮 3 个，单击后未观测到差异的为「无」。

- 独立 mobile 回放，保存四柱并检查资料摘要 ✓；选择出行与时间范围，生成候选 ✓；查看推荐理由 ✓；比较两个不同结果 ✓；收藏结果刷新后仍可读取 ✓。控制台与脚本错误 0，根宽度 390 → 390，局部裁切探针 []。初始可点按钮 3 个，单击后未观测到差异的为「无」。

### 知时 · A-current

run_id 为 `fb2d8957-9b85-423d-96e7-39c0fd5b2937`。[桌面 1440 × 900](../../runs/K-01/zhishi/A-current/verification/desktop.png) · [手机 390 × 844](../../runs/K-01/zhishi/A-current/verification/mobile.png) · [目标视口操作态](../../runs/K-01/zhishi/A-current/verification/mobile-task.png)。

![知时 A-current 目标终端首屏](../../runs/K-01/zhishi/A-current/verification/mobile.png)

宿主结果为 **FUNCTIONAL_FAILURE**。内部方向选中「时段清单」。本轮语义标签为 空。[私有执行轨迹](../../runs/K-01/zhishi/A-current/attempt/design-trace.json) · [逐卡审计](../../runs/K-01/zhishi/A-current/attempt/design-audit.json)。

- scene 实际输入的知识 ID 共 0 个，分别为 空。本次耗时 144.7 s，CLI 报告 24,528 token。

- art-direction 实际输入的知识 ID 共 14 个，分别为 LAY-001, HIE-001, TYP-001, RSP-001, FRM-001, ACC-001, BRD-001, BRD-002, USR-001, USR-005, USR-006, vis-drawer, vis-nearby, vis-topread。本次耗时 182.1 s，CLI 报告 27,232 token。

- source 实际输入的知识 ID 共 12 个，分别为 LAY-001, HIE-001, TYP-001, RSP-001, FRM-001, ACC-001, BRD-001, BRD-002, USR-001, USR-005, USR-006, vis-nearby。本次耗时 222.4 s，CLI 报告 29,449 token。

- 宿主 mobile，functionalPass=False。query-times 预期的可见结果没有出现 [data-state="candidate-results"]。

- 宿主 desktop，functionalPass=False。query-times 预期的可见结果没有出现 [data-state="candidate-results"]。

- 独立 desktop 回放，核对生产门禁期望与初始查询的实际结果 ✓；编辑四柱、事项和时间范围，生成候选 ✓；展开理由与民俗参考边界 ✓；保存时段、刷新并读取原查询条件 ✓。控制台与脚本错误 0，根宽度 1440 → 1440，局部裁切探针 []。初始可点按钮 2 个，单击后未观测到差异的为「无」。

- 独立 mobile 回放，核对生产门禁期望与初始查询的实际结果 ✓；编辑四柱、事项和时间范围，生成候选 ✓；展开理由与民俗参考边界 ✓；保存时段、刷新并读取原查询条件 ✓。控制台与脚本错误 0，根宽度 390 → 390，局部裁切探针 []。初始可点按钮 2 个，单击后未观测到差异的为「无」。

### 招聘复核 · A0

run_id 为 `4b9743e5-406b-4b1a-bef6-d9c7a3b776b7`。[桌面 1440 × 900](../../runs/K-01/recruiting/A0/verification/desktop.png) · [手机 390 × 844](../../runs/K-01/recruiting/A0/verification/mobile.png) · [目标视口操作态](../../runs/K-01/recruiting/A0/verification/desktop-task.png)。

![招聘复核 A0 目标终端首屏](../../runs/K-01/recruiting/A0/verification/desktop.png)

宿主状态为 GENERATED。直接 Agent 的 prompt 不含引擎知识、候选策略和测试钩子，业务验收依据生成页面上真实可见的控件。[实际输入](../../runs/K-01/recruiting/A0/prompt.md)。

- 独立 desktop 回放，核对岗位需求 ✓；搜索并打开匹配证据 ✓；筛选并按匹配度升序排列 ✓；人工复核状态与备注刷新后可读 ✓；查看搜索任务并返回 ✓。控制台与脚本错误 0，根宽度 1440 → 1440，局部裁切探针 []。初始可点按钮 23 个，单击后未观测到差异的为「▤　候选人复核、全部8、陈 陈予安 云舟科技 · 8 年」。

- 独立 mobile 回放，核对岗位需求 ✓；搜索并打开匹配证据 ✓；筛选并按匹配度升序排列 ✓；人工复核状态与备注刷新后可读 ✓；查看搜索任务并返回 ✓。控制台与脚本错误 0，根宽度 390 → 390，局部裁切探针 []。初始可点按钮 23 个，单击后未观测到差异的为「▤　候选人复核、全部8、陈 陈予安 云舟科技 · 8 年」。

### 招聘复核 · A-current

run_id 为 `643354e1-3b4c-4eea-bd51-90546aa9ed5e`。[桌面 1440 × 900](../../runs/K-01/recruiting/A-current/verification/desktop.png) · [手机 390 × 844](../../runs/K-01/recruiting/A-current/verification/mobile.png) · [目标视口操作态](../../runs/K-01/recruiting/A-current/verification/desktop-task.png)。

![招聘复核 A-current 目标终端首屏](../../runs/K-01/recruiting/A-current/verification/desktop.png)

宿主结果为 **FUNCTIONAL_FAILURE**。内部方向选中「候选表与证据侧栏」。本轮语义标签为 b2b-workbench。[私有执行轨迹](../../runs/K-01/recruiting/A-current/attempt/design-trace.json) · [逐卡审计](../../runs/K-01/recruiting/A-current/attempt/design-audit.json)。

- scene 实际输入的知识 ID 共 0 个，分别为 空。本次耗时 141.1 s，CLI 报告 22,761 token。

- art-direction 实际输入的知识 ID 共 16 个，分别为 LAY-004, HIE-003, NAV-001, FRM-004, FDB-003, TBL-001, TBL-002, BRD-003, USR-001, USR-004, USR-005, USR-006, vis-calc, rule-calc, vis-gnucash, rule-gnucash。本次耗时 191.1 s，CLI 报告 28,237 token。

- source 实际输入的知识 ID 共 16 个，分别为 LAY-004, HIE-003, NAV-001, FRM-004, FDB-003, TBL-001, TBL-002, BRD-003, USR-001, USR-004, USR-005, USR-006, vis-calc, rule-calc, vis-gnucash, rule-gnucash。本次耗时 274.4 s，CLI 报告 31,702 token。

- 宿主 desktop，functionalPass=False。candidate-search 预期的可见结果没有出现 [data-state="search-results"]。

- 宿主 mobile，functionalPass=True。candidate-search 通过 → view-evidence-source 通过 → mark-needs-evidence 通过。

- 独立 desktop 回放，核对岗位需求 ✓；搜索并打开匹配证据 ✓；筛选待复核并按匹配度排序 ✓；人工复核并在刷新后核对状态 ✓；查看搜索进度并处理部分完成的任务 ✓。控制台与脚本错误 0，根宽度 1440 → 1440，局部裁切探针 []。初始可点按钮 20 个，单击后未观测到差异的为「岗位复核、清除、林岚」。

- 独立 mobile 回放，核对岗位需求 ✓；搜索并打开匹配证据 ✓；筛选待复核并按匹配度排序 ✓；人工复核并在刷新后核对状态 ✓；查看搜索进度并处理部分完成的任务 ✓。控制台与脚本错误 0，根宽度 390 → 390，局部裁切探针 []。初始可点按钮 20 个，单击后未观测到差异的为「岗位复核、清除、林岚」。

### 两次门禁拒绝的解释

知时首次检查在两个终端均未匹配日期与时段的连续字符串。招聘首次桌面检查在输入姓名后未观察到「1 位候选人」，同次手机检查通过全部三步。保留原始拒绝后，对冻结的招聘源码再次运行相同 Electron inspectPage，使用只读事件观测，桌面与手机均完成由 8 人筛至 1 人、展开简历原文、标记需补证。首次调用没有记录每个按键的焦点，现有证据无法确定首次失败的原因。独立 Chrome 同样通过业务操作及刷新持久性。[同引擎复核与输入事件](../../runs/K-01/recruiting/A-current/host-replay.json)

### 截图中可定位的差异

知时手机首屏中，A0 将资料维护折叠在入口内，A-current 直接露出四柱字段；两个首屏都能看到查询按钮和民俗参考文字。A-current 的结果态把日期设为组标题，理由紧邻时段。招聘桌面首屏中，A0 在左侧保留工作区导航，复核备注和按钮靠近屏幕下缘；A-current 用顶栏导航，在表内增加「主要缺口」列，右侧底部保留复核动作。招聘 A-current 手机图中，匹配度表头换行，搜索框提示语被截短。这些现象也说明根节点无水平溢出不足以判定阅读质量。截图中未发现空白首屏。对已选对象再次点击、清空本来为空的搜索均可能没有可见状态变化，详见按钮信息。

## 人工盲评与解释边界

[匿名评阅包](../../runs/K-01/blind/README.md) 按场景独立打乱 X/Y，提供两端首屏和业务操作态。仅向评阅者提供 blind 子目录，主持人另存分组键。没有真人评分或胜负结论。

记录知时的中文阅读节奏、首屏是否看得懂输入与民俗参考边界、候选日期与理由的关系；记录招聘的首屏有效信息量、从岗位条件追到证据和复核操作的路径、不同复核状态的可区分性。每项允许难分并要求给出具体屏幕区域。视觉截图和实际交互回执应分别解释。

知时 A-current 的自动门禁要求日期与时间在 innerText 中为一个连续子串。独立测试在同一日期组看到日期标题和候选行时间，确认单行完整字符串不匹配，并在新查询中完成保存和刷新回读。宿主双端拒绝保留；独立通过的业务步骤不覆盖原始失败。招聘 A0 点击已激活的导航、全部标签或已选候选人无状态变化，与初始选中状态一致。

发布门禁只覆盖导演计划的步骤。独立检查覆盖上述实际操作和初态可见可用按钮；同一按钮的所有上下文、读屏体验、长期复访、真实用户效率、实际历法准确性、招聘业务有效性都未验证。局部裁切探针只检查若干语义元素，不能证明所有像素无重叠。

## 环境、变更与命令

源目录不含 Git 元数据，保留原有 build、dist、用户保存位置和历史数据。[运行环境](../../runs/K-01/environment.json) · [实验构建的 46 份文件 SHA-256](../../runs/K-01/runtime-sha256.json) · [四格交叉校验](../../runs/K-01/verified-manifest.json)。

- desktop/design-audit.mjs 新增可选的逐知识、逐调用索引；desktop/design-trace.mjs、prepare-turn.mjs、agent.mjs 连接已有私有记录、真实输入哈希及 CLI 可得元数据。最终源码对模型给出的自由文本方向 ID 改用私有指针，并列出每次调用中入围后未出现的 ID。冻结运行时记录方向短名、逐卡全集和逐调用出现的 ID；可从这两列复核差集。仅审计索引字段有差异。
- desktop/main.mjs 在后台验收开关下限制首稿；desktop/build.mjs 增加隔离构建输出；desktop/tests/design-trace.test.mjs 增加隐私及知识定位回归。没有改工作台 UI、打包发布或模型协议。
- experiments/k01-cases.mjs、k01-direct.mjs、k01-current.mjs 固定需求与一次性执行；k01-verify.mjs、k01-journeys.mjs 重放页面；k01-evidence.mjs 核对输入、源码和截图后准备盲评。运行产物位于 runs/K-01，独立 Electron 编译目录记在 runtime-path.txt。
- 初次桌面预检因 /var 与 /private/var 的路径别名停止于提交之前，每个场景保留 preflight-profile-check/receipt.json。改为 realpath 核对后继续。模型预算没有因预检多消耗一次。没有使用测试替身生成基线。

以下命令已在产品根目录执行。真实生成驱动拒绝覆盖现有实验格；只做核验时执行 k01-verify 和 k01-evidence 即可。

```sh
node desktop/build.mjs --isolated > runs/K-01/runtime-path.txt
node --experimental-strip-types experiments/k01-direct.mjs zhishi
node --experimental-strip-types experiments/k01-direct.mjs recruiting
node experiments/k01-current.mjs
node experiments/k01-verify.mjs zhishi A0
node experiments/k01-verify.mjs zhishi A-current
node experiments/k01-verify.mjs recruiting A0
node experiments/k01-verify.mjs recruiting A-current
node_modules/.bin/electron runs/K-01/replay-search.mjs
node experiments/k01-evidence.mjs
npm run knowledge:check
npm run knowledge:bench
npm test
SURFACELIVE_TEST_APP="$PWD/runs/K-01/test-runtime" SURFACELIVE_BACKGROUND_CHECKS=1 node desktop/tests/smoke.mjs
```

自动化单测及集成测试 32/32 通过，语料校验通过，普通桌面回归覆盖新建、源码导出、带图修改、旧版重开、失败与取消。该软件回归使用仓库自带 fixture，与四格真实模型结果独立。[测试日志](../../runs/K-01/tests.log) · [语料日志](../../runs/K-01/corpus.log) · [桌面回归](../../runs/K-01/ui-regression.log)。
