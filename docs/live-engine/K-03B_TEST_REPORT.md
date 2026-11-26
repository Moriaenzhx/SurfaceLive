# K-03B · 工程回归与真实首稿验收

## 对照条件

两次独立桌面生成使用 K-03A 的需求原文、同一个本机 Codex 配置（`gpt-6.2-sol`、`low`），知时以手机为目标，招聘以桌面为目标。两者都验收 1440×900 和 390×844 CSS 像素。每场景最多生成一份源码，导演可按既有上限修正一次结构化回答。隔离的作品库、浏览器存储和日志使两组无法读到彼此的首稿。[原始需求与配置](../../experiments/k01-cases.mjs) · [实际桌面入口脚本](../../experiments/k03a-smoke.mjs)

K-03A 知时选中 `time-list`，实发编码指令 16,027 字节，整轮耗时 638.5 秒，CLI 共回报 68,200 Token；招聘选中 `comparison-ledger`，依次为 17,005 字节、684.0 秒、91,248 Token。本轮增加了候选设计原则和逐状态验收。可比较同一任务在相同视口的行为，耗时与用量需结合实际调用次数及指令长度解释。[K-03A 原始统计](../../runs/K-03A/verification.json)

## 真实设计与编码输入

| 场景 | 选中的方向与权衡 | 选中契约 / 实发编码输入 SHA-256 前 16 位 | 输入变化 |
|---|---|---|---|
| 知时 | **按日读时段**。展开理由时保留日期与相邻候选，较长区间需要滚动。备选“逐项审阅”给长解释留出单独空间。 | `6b59fc66d29b5765` / `dbdb35d1a04065be`。[选中契约](../../runs/K-03B/zhishi-56Umty/attempt/contracts/4c9bc501-9b19-47c1-a1ad-7c0c5e617fb2.json) · [备选契约](../../runs/K-03B/zhishi-56Umty/attempt/contracts/00354f30-6693-4361-9c32-2e602e4757a1.json) | 21,490 字节，比 K-03A 多 5,463 字节。导演看过两个 Seed 的 4,902 字节摘要；编码输入列入日序读本的 4 条原则、7 个状态。[实际指令](../../runs/K-03B/zhishi-56Umty/attempt/prompt.md) |
| 招聘 | **名单与证据双栏**。保留名单位置，方便连续复核和切换人选。备选“候选人复核档案”给长证据更多阅读空间。 | `9ca67c1b94b4d6be` / `0c7297450ac1637f`。[选中契约](../../runs/K-03B/recruiting-WjJUpA/attempt/contracts/5056f428-4886-4d7c-9e7e-69f3d3b3ec19.json) · [备选契约](../../runs/K-03B/recruiting-WjJUpA/attempt/contracts/6c5add1c-a9db-44d2-a124-09f179b6862c.json) | 19,507 字节，比 K-03A 多 2,502 字节。导演看过 5,097 字节种子摘要；编码输入列入证据对照册的 4 条原则、5 个状态。[实际指令](../../runs/K-03B/recruiting-WjJUpA/attempt/prompt.md) |

两次场景和导演回答均一次通过。两个备选方向都保存了结构化契约，源码预算只用于选中方向。引用关系可下钻到原则，例如招聘采用的种子用 GnuCash 说明主记录与明细相邻，但导演对本轮直接检索案例另行判断。[四个方向的来源与决策](K-03B_DESIGN_LANGUAGE.md)

## 首稿原始回执

2026-11-24 北京时间 23:20 发起。两条轨迹的场景、导演、编码共六次调用，回执的 `override=false`，实际回报模型均为 `gpt-6.2-sol`。推理强度 `low` 来自发起配置。CLI 的美元费用字段均为空。[逐调用会话、时间、资源、哈希及两端检查](../../runs/K-03B/verification.json)

| 场景 / run ID | 状态与证据 | 总用时 / Token（场景＋导演＋编码） |
|---|---|---|
| 知时 · `422bd60d-ca26-47fb-a8e8-4d56c147b475` | **FUNCTIONAL_FAILURE**。两端均通过资料、查询、理由、保存四步；在另一条状态检查中，两处理由入口共用操作 ID，结果态动作未通过，主操作计 3/7。源码版本 `98181bc59f1376d4…`。[源码](../../runs/K-03B/zhishi-56Umty/attempt/index.html) · [Trace](../../runs/K-03B/zhishi-56Umty/attempt/design-trace.json) · [桌面结果](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop-state-results.png) · [手机结果](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-results.png) | **715.5 秒 / 95,865**（23,417＋38,202＋34,246） |
| 招聘 · `cd3a1ed0-1e7d-4f9a-9973-07b97c8480bc` | **READY**。两端各通过 5/5 个状态动作和 4/4 个业务步骤。先选陈澄，再看出处、选择“待补证”、保存并返回名单。源码版本 `35d9261a4a69fa1b…`。[源码](../../runs/K-03B/recruiting-WjJUpA/attempt/index.html) · [Trace](../../runs/K-03B/recruiting-WjJUpA/attempt/design-trace.json) · [桌面选中候选](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-selected.png) · [手机首屏](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile.png) | **730.7 秒 / 95,523**（23,172＋36,776＋35,575） |

两份首稿在两端均能加载，控制台错误计数为 0，所测页面没有横向溢出。原始 22 张 PNG 按状态与契约关联。知时手机结果页把日期、时段、理由入口和民俗参考说明放进同一首屏。招聘桌面同时可见候选列表与证据区，手机详情保留候选身份和缺口。原始招聘手机证据截图中，已展开的正文区显示为空白；DOM 此时已有出处，源码给正文设置从透明开始的入场动效。这个原件不宜用于评价正文可读性。[知时手机结果](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-results.png) · [招聘原始手机证据图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-evidence.png) · [招聘样式](../../runs/K-03B/recruiting-WjJUpA/attempt/styles.css)

浏览器还记录了软性偏差，包括动效、部分间距和招聘标题的字号观测。它们需要结合对应组件判断。此次首稿实验没有运行视觉模型比较或收集真人投票。[原始状态图与逐状态截图](K-03B_EXPERIENCE_PATTERNS.md)

## 同一份源码的独立业务回放

Chrome 为每种视口创建空存储环境，先验三份源码的 SHA-256，再按用户实际能识别的名称、日期组、表格行与详情操作。截图记录操作状态、CSS 视口、滚动位置、PNG 哈希和可见入场动画的等待结果。刷新发生在同一视口的同一用户会话内。[可重跑脚本](../../experiments/k03b-business-check.mjs)

| 场景 | 两端实测 | 可复查的状态 |
|---|---|---|
| 知时 | 桌面、手机各 **7/7**。查看理由、保存、比较两个不同时间；刷新仍能辨认已保存的日期、时间和事项。改为“签约”及 12 月 15–17 日后，分组日期和理由随之改变。判断限于本地示例流程，民俗依据的准确性另需领域审查。 | [业务测试](../../runs/K-03B/business-zhishi-sv7HvJ/results.json) · [手机比较](../../runs/K-03B/business-zhishi-sv7HvJ/mobile-comparison.png) · [不同条件的结果](../../runs/K-03B/business-zhishi-sv7HvJ/desktop-changed-range.png) |
| 招聘 | 桌面、手机各 **6/6**。选择陈澄，核对简历出处，从草稿到保存“待补证”，刷新后能核对状态与历史。按姓名搜索林若宁，能看到另一人的简历内容，且其复核状态独立。两端稳定帧可读到陈澄的原文、出处和待核实结论。 | [业务测试](../../runs/K-03B/business-recruiting-vkkwg4/results.json) · [手机证据](../../runs/K-03B/business-recruiting-vkkwg4/mobile-evidence.png) · [桌面复核历史](../../runs/K-03B/business-recruiting-vkkwg4/desktop-reopened-history.png) |

早期两次回放停在测试脚本初始化，另一次等待了收起区域内的动画而超时。原件分别记录了 `Cannot access 'normalized' before initialization` 和 `finite entry animation exceeded screenshot deadline`。修正测试驱动，重新从相同源码、空存储开始。[知时初始化失败](../../runs/K-03B/business-zhishi-lHabk2/results.json) · [招聘初始化失败](../../runs/K-03B/business-recruiting-QMoYo2/results.json) · [动画等待超时](../../runs/K-03B/business-recruiting-bZf63j/results.json)

## 修正后的宿主门禁

最终验收器在当前状态、同类操作 ID 内按浏览器可访问角色和完整名称查找唯一目标，继续检查禁用状态、真实点击和目标区域的变化。稳定态截图等当前区域实际可绘制的有限动效，最多等 700ms；超预算的图片标为不确定，处理中状态单独留证。12 组真实 Electron 专项均符合预期，覆盖不同名称可选中第二行、同名有歧义和禁用时被拦截、入场像素等于同图静态参考，以及超时图的标记。早期绝对 RGB 断言受显示色域影响，失败原件保留。[首次像素断言](../../runs/K-03B/browser-contract-t9NErp/results.json) · [12 组最终结果](../../runs/K-03B/browser-contract-K0bVMT/results.json)

最终构建重新走生产 `inspectPage`，读取原契约和原始三文件哈希，不调用 Agent、不写入作品库。四个视口均通过；知时分别 **7/7** 个状态动作，招聘分别 **5/5**。四个视口的原有四步旅程也都通过，控制台错误均为 0。两份原始生成收据继续保留当时的发布判定。[门禁复查 JSON](../../runs/K-03B/contract-recheck-srV545/results.json) · [知时手机比较](../../runs/K-03B/contract-recheck-srV545/zhishi-mobile-state-comparison.png) · [招聘手机证据稳定帧](../../runs/K-03B/contract-recheck-srV545/recruiting-mobile-state-evidence.png)

## 分批运行

| 阶段 | 实际命令 | 结果 |
|---|---|---|
| 实施前 | `git rev-parse --show-toplevel`、`git status --short --branch`、`npm test` | 工程及上层工作目录无 Git 元数据；保留文件快照。原有 42/42 项通过。[原测试](../../runs/K-03B/tests-before.log) · [源文件清单](../../runs/K-03B/source-before.json) |
| A | `node --experimental-strip-types --test desktop/tests/state-action.test.mjs desktop/tests/design-contract.test.mjs` | 15/15。覆盖已知任务的状态图、部分需求、未知场景、主操作和边的关联，以及旧契约。Chrome 另对冻结知时、招聘各回放两端。[单测](../../runs/K-03B/batch-a-tests.log) · [知时回放](../../runs/K-03B/replay-zhishi-Zddxkh/results.json) · [招聘回放](../../runs/K-03B/replay-recruiting-joWYWi/results.json) |
| B | `node --experimental-strip-types --test desktop/tests/design-language.test.mjs` | 3/3。核验来源与许可、匹配与拒绝、采纳与组合。种子提供可组合原则。[专项日志](../../runs/K-03B/batch-b-seeds.tap) |
| C | `npm test` | 50/50。随后补测仅改状态键、字段排序或颜色的候选不能冒充结构不同的方案，该用例计入最终测试。[接入日志](../../runs/K-03B/batch-c-tests.log) · [导演校验](../../desktop/tests/director-judge.test.mjs) |
| D | `npm test`、`node_modules/.bin/electron desktop/tests/k03b-browser.mjs` | 52/52。专项使用真实 Electron DOM 与截图，1 组有效状态链通过，4 组按预期拦下错误可访问名称、禁用操作、静态目标反馈、锁定色实际渲染不符。早期一次夹具窗口生命周期中断，另一次首帧截取返回 UnknownVizError；稳定首帧后重新执行。[全量日志](../../runs/K-03B/batch-d-tests.log) · [原始首帧错误](../../runs/K-03B/browser-contract-sExX2b/results.json) · [五组最终结果](../../runs/K-03B/browser-contract-qWrezt/results.json) |
| E | `node desktop/build.mjs --isolated`，分别执行 `node experiments/k03a-smoke.mjs zhishi K-03B` 与 `node experiments/k03a-smoke.mjs recruiting K-03B` | 正式 preload/IPC 进入同一份隔离构建，首稿限定模式。每次的回执记录运行时模块 SHA-256。[构建路径](../../runs/K-03B/runtime-path.txt) |
| 工作台 | `node runs/K-03B/desktop-regressions.mjs` | 产生两份真实首稿的构建六组均通过，涵盖初稿、备选、修复、旧作品编辑、父版继承、导出重开、设置、会话切换及窗口尺寸。自动化夹具仅用于这些回归。首次设置测试把合法的隐藏轨迹目录误计为作品；工作台断言期待原始 stderr，实际用户收到经清理的错误。更新两个测试后独立重跑。[首次结果](../../runs/K-03B/desktop-regressions-KdlJaW/results.json) · [生成时构建的复测](../../runs/K-03B/desktop-regressions-QXss5P/results.json) |
| 最终检查 | `npm test`、`npm run knowledge:check`、`npm run knowledge:bench` | 52/52 通过；知识校验 43 个来源、53 张卡、0 项问题，3 个检索用例完成。[全量测试](../../runs/K-03B/tests-final.log) · [知识校验](../../runs/K-03B/knowledge-check.log) · [检索基准](../../runs/K-03B/knowledge-bench.log) |

生成时构建 `desktop-build-8paoqu` 与最终复查构建 `desktop-build-nHFQnS` 各有 52 个运行时文件，逐文件 SHA-256 仅 `desktop/contract-check.mjs` 有差异。两次生成的编码输入、源码及 Agent Bridge 可直接与初次原件核对。最终构建复跑全量单测 52/52。[逐文件构建比较](../../runs/K-03B/final-regressions-h8t0_r_1/runtime-diff.json) · [最终单测](../../runs/K-03B/final-regressions-h8t0_r_1/npm-test.log)

最终构建第一次整组回归有 5/6 组通过，单独复跑标签页时也在“导出”悬停提示处超时。窗口已聚焦；诊断记录显示 macOS 指针事件在单次浏览器 hover 后移出了按钮，提示有 250ms 延迟。测试改为在隔离窗口内维持真实指针悬停并等待可见提示，未改变工作台 CSS。随后全量单测 **52/52**，全部六组 GUI 回归同轮通过。[原批次及失败日志](../../runs/K-03B/final-regressions-h8t0_r_1/results.json) · [单独复跑超时](../../runs/K-03B/final-regressions-h8t0_r_1/tabs-retry.log) · [指针诊断](../../runs/K-03B/final-regressions-h8t0_r_1/tabs-diagnostic.log) · [最终六组结果](../../runs/K-03B/final-regressions-retest-mppagedr/results.json) · [全量单测日志](../../runs/K-03B/final-regressions-retest-mppagedr/npm-test.log)

## 离线复核

在工程根目录可从模型原始回答重组候选契约，核对实发文本、会话、源码版本、两端业务状态和 PNG 字节哈希。对历史文件的检查逐一核对路径集合和文件内容。

```sh
node --experimental-strip-types experiments/k03a-verify.mjs | cmp - runs/K-03A/verification.json
node --experimental-strip-types experiments/k03b-verify.mjs runs/K-03B/zhishi-56Umty/receipt.json runs/K-03B/recruiting-WjJUpA/receipt.json
node_modules/.bin/electron experiments/k03b-contract-recheck.mjs runs/desktop-build-nHFQnS runs/K-03B/zhishi-56Umty/receipt.json runs/K-03B/recruiting-WjJUpA/receipt.json
node experiments/k03b-business-check.mjs runs/K-03B/zhishi-56Umty
node experiments/k03b-business-check.mjs runs/K-03B/recruiting-WjJUpA
node experiments/k03b-integrity.mjs
```
