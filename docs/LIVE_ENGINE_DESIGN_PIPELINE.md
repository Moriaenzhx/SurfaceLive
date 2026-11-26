# Live Engine 的设计、验证与反馈链路

桌面客户端的一次生成从现有的 `studio.start` 进入主进程。正式创作使用 A2。只有验收进程能切换到 A0 或 A1。三组共用相同的本机 Agent、离线源码协议、作品库和浏览器。首次审计和当时的真实提交单独归档。[改造前的链路审计](LIVE_ENGINE_BATCH_1_AUDIT.md) · [桌面入口](../desktop/main.mjs)

## 一次生成可以追到哪里

| 阶段 | 实际执行 | 如何核查 |
| --- | --- | --- |
| 场景理解 | 所选 Agent 分析产品、人群、业务任务、交互、设备、文化与品牌、复杂度、风格约束。各项引文逐字对照用户需求。资料库标签可以为空或多选。 | `steps/scene/` 收录输入、结构约束、回答和可能的一次纠错。Trace 记录缺失维度和待验证假设。 |
| 知识检索 | 按理解结果查询种子规则和已审核的资料。已核验的案例带来源、适用边界和视觉观察。题材缺少直接案例时，可借用同方向视口的结构观察，并标为跨领域。 | `knowledge` 记录本轮确实检出的规则、偏好、案例和出处。直接交给源码模型的文本在 `prompt.md`。第三方研究截图保存在采集缓存中，生成时使用审过的观察记录。 |
| 艺术指导 | 提出两至三个方向，逐个说明信息组织、视觉中心、字阶、操作路径、优势、代价和适用理由。生成前选一个方向，新作品再实现一个不同方向供比较。迭代已有作品时，以真实父版本做对照。 | `steps/art-direction/` 保存原始回答，`artDirection` 保存被选方向和理由。规则、偏好和案例各自使用本次检索允许的 ID。 |
| 业务验证 | 隔离 Chromium 分别运行桌面与手机视口，按元素位置点击真实控件，检查目标状态、水平溢出、控制台和加载错误。普通创作从需求规划主任务，已有工程沿用已记录的任务。设计需要进入详情时，任务可声明真实的前置入口；操作可直接点击时跳过入口。 | `candidates/<候选>/checks.json` 记录每步结果、实际使用的前置入口、CSS 视口和截图像素。真实截图在同目录。发布前另行核对最终源码。 |
| 视觉评审和返工 | 同一模型收到打乱顺序的两份作品各两张截图，比较层级、布局、字体、色彩、场景适配。遇到具体问题，至多定向修复一次，再运行原任务并重新评图。 | `comparisons` 保存 PNG 与送审 JPEG 的指纹，`steps/pair-review/` 和可能的 `steps/repair-review/` 保存回答。修前、修后和逐像素变化图可交叉检查。 |
| 版本与人工评审 | 功能门禁能阻止保存为通过版本。视觉证据不确定时，保存可操作候选并标出待人工评审。手动样式修改也保存父版与修改版的同视口截图和差异。 | `visualReview`、`automaticRepair`、`code.input`、`edits` 和可能的 `human-review.json`。每个模型调用单独记录请求型号、CLI 实际报告的型号、耗时和结果。 |

在客户端的「设置 → 通用」查看作品库的实际路径。一次成功生成的三个源码文件、`revision.json`、`design-trace.json` 与证据一同写入该库的版本目录。任务失败、取消和中断的原始阶段记录在 `.design-traces/<任务 ID>/`。源码导出继续交付可独立运行的 HTML、CSS 和 JavaScript。[Trace](../desktop/design-trace.mjs) · [生成与选择](../desktop/prepare-turn.mjs) · [视觉评审](../desktop/visual-review.mjs)

## 人工反馈如何影响下一次创作

匿名对照实验与个人偏好库分别存储。前者记录某次固定需求下评审者选了哪件作品。后者要求用户明确指定适用的项目、品牌或场景。检索时只把偏好编号、方案摘要、理由和已验证的视口交给模型。

在本机准备反馈 JSON，提供匿名或本地用户标识、适用范围、选中和拒绝的真实版本目录、理由，以及是否亲自验证业务任务。当前桌面用户标识为 `local-owner`。项目范围使用 Trace 中的 `code.project`，品牌依据需求中明确属于本项目的名称，场景使用可检索的标签或产品类型。下列字段说明用于填写真实评价。[反馈录入](../live-engine/design/feedback-cli.mjs)

| 字段 | 应填内容 |
| --- | --- |
| `scope` | `user` 必填，至少再填写 `project`、`brand`、`scene` 中的一项。同时填写的范围要全部匹配。 |
| `choice`、`rejected` | 一份选择与至少一份被拒的方案。每份给出 `folder`，若评价某个中间候选，再给 `candidate`。 |
| `reason`、`humanVerified` | 用户对具体设计取舍的原话，以及是否亲自完成了任务。 |
| `id` | 可选的稳定编号，便于重复导入同一条反馈。 |

```sh
node live-engine/design/feedback-cli.mjs "$HOME/Library/Application Support/SurfaceLive/design-preferences.sqlite" human-feedback.json
```

录入时核对三份源码和现有截图的 SHA-256，附上局部修改、差异和实际操作结果。只有显式人工核验、且选中版本在桌面和手机均有成功操作与截图的反馈，才进入后续适用范围的提示词。保留负例、理由和未验证记录，便于追查。[持久化和检索](../live-engine/design/preferences.mjs)

## 同题验收与盲评

四个固定需求、目标设备和三步业务任务已冻结。每个场景都使用完全相同的原文、测试钩子、Agent、模型和推理档位。复查时，收藏、确认入围、登记跟进和确认预约都要求可见结果从操作前的状态发生变化。A0 使用基础源码合同，A1 加入场景理解与检索，A2 进一步执行艺术指导、候选生成、截图比较与有依据的修复。A2 会消耗更多时间和模型调用，耗时直接取自提交回执。[固定场景与任务](../live-engine/design/benchmark.json)

```sh
npm run desktop:build
node experiments/desktop-matrix.mjs runs/design-comparison-20261121 A0 A1 A2
node_modules/.bin/electron experiments/recheck-design.mjs runs/design-comparison-20261121
node experiments/design-blind.mjs runs/design-comparison-20261121
```

运行矩阵时一次只启动一个隐藏客户端，逐项提交，资料写入隔离作品库。复查也只使用一个隐藏 Electron 进程，用同一套最终检查逐个打开原件。每个实际生成或失败尝试都有独立目录；真实功能失败计入实验结果。可以使用 `SURFACELIVE_TEST_APP` 指定已打包的客户端可执行文件。

只把输出的 `reviewer/` 交给人工评审。打开其中的 `index.html`，即可从同一标签页试用作品、对照截图和填写理由。每个场景独立打乱 X、Y、Z，评审者按三步任务试用作品，再选择两两胜负或平局。表格在本地分配匿名编号并导出 JSON。组织者私下保存映射。使用下列命令录入已填写的评审表，空白表不会产生票数。模型的比较另存在生成记录中。

```sh
node experiments/design-ballot.mjs <本次盲评包目录> <人工填写的评审表.json>
```

本轮已生成的十二份作品、截图、耗时、发布结果以及工程回归已归档。[四场景对照](../runs/design-comparison-20261121/RESULTS.md) · [工程与交互验收](../runs/design-comparison-20261121/QA.md)
