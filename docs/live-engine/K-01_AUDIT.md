# SurfaceLive · K-01 调用链审计

审计对象为仓库当前 Electron 源码和从它单独构建的运行时。本文中的“已实现”表示有可达的实现；实跑范围另列。四格实验、生成端哈希、截图、运行回执和人工待评事项见[基线报告](K-01_BASELINE.md)。本目录向上两级为含 package.json 的产品根目录。产品根及上一级均无 Git 元数据，版本核对使用 SHA-256。

## 从发送消息到保存版本

| 环节 / 状态 | 实际调用关系及代码 | 输入 → 输出、证据与边界 |
|---|---|---|
| 工作台启动 / 已实现 | [构建入口](../../desktop/build.mjs) 将包的 main 指向 [main.mjs](../../desktop/main.mjs)；app.whenReady → Library.load、availableAgents、modelCatalog、configureSession、openWindow | 读取当前 profile 的保存位置、版本、可执行文件和模型目录，载入 surface-studio://studio/index.html。CLI 存在只证明可执行。 |
| 输入与预览建议 / 已实现 | [studio.js](../../desktop/ui/studio.js) 的 brief.oninput → scheduleDirection → showDirection → preload.direction → main 的 direction handler → [engine.direction](../../desktop/engine.mjs) | 文本和终端 → detectScene、factoryHits、retrieve → 左右栏展示的场景与设计依据。预输入和 start 校验都会做词法查询，不能拿这批命中代表最终提交给模型的知识。 |
| 提交 / 已实现 | #generate.onclick 或快捷键 → studio.start → [preload.cjs](../../desktop/preload.cjs) 的 IPC → main.handle('start') → run → beginTrace | 文本、终端、Agent/模型/强度、父版本、编辑和参考图 → 校验、任务 UUID、独立工作目录。修改时合并父需求、变更摘要和当前请求，取父源码及待应用 CSS；图片和元素选区分开处理。没有独立的 PRD 文档编译环节。 |
| 语义场景 / 已实现 | run → [prepareTurn](../../desktop/prepare-turn.mjs) → direction → [designStage](../../desktop/design-stage.mjs) → [scenePrompt / validateScene](../../live-engine/design/scene.mjs) → interpretedDirection | 本机 CLI 根据原文输出八个维度、逐字引文、explicit/inferred、品牌、领域标签、未知项与假设。不匹配知识目录时允许空标签。置信度是定性陈述；没有校准概率。角色/任务在 dimensions，信息组织在后续策略，不能从 quick.confidence 推断语义质量。 |
| 检索 / 已实现 | prepareGeneration → [directorBriefWithEvidence / retrieve](../../live-engine/knowledge/src/live-knowledge.ts) → [factoryHits / indexed](../../live-engine/ingestion/retrieval.ts)；prepareTurn 再查询 confirmed preferences 和跨场景案例 | 初稿查询为原始需求；修改查询为 description 加当前 change，配合语义 catalog。种子规则按场景、类别优先级、关键词加分，逐条扣同类和同源分，取 8；工厂仅从经过校验的 indexed 来源中按标签、词项重叠、ID 和类型名额取卡。返回规则、观察、约束和来源。跨域候补以目标设备的宽高方向取卡。 |
| 独立艺术指导 / 已实现 | prepareTurn → designStage → [directorPrompt、strategySchema、validateStrategies](../../live-engine/design/director.mjs) → promptFor | 输入业务、场景、可引用 ID、文字观察和适用范围 → 2–3 个结构选项、信息架构、焦点、字阶、操作路径、取舍、被选方案、缺口和共享验收步骤。校验引用和各选项字符串是否不同。新建普通作品由导演规划 1–4 步；允许一次结构化回答纠正。布局和排版有字段，色彩、反面约束未形成逐项强制的策略字段。 |
| 生成 / 已实现 | run → trace.prepared → [generate → askStructured → parseProduct](../../desktop/agent.mjs) → 已安装 CLI | promptFor(selected) 加选区说明，附用户参考图 → 结构化 title/html/css/js。Codex 用 exec、ephemeral、read-only、JSON schema、stdin；Claude 使用原有 -p 和结构化协议。子进程继承既有认证。代码由宿主写入。可交付的是离线原生 HTML/CSS/JS 三文件；没有 npm 工程或框架编译步骤。 |
| 渲染与交互 / 部分实现 | [renderCandidate](../../desktop/visual-review.mjs) 或 inspectAndSave → [inspectPage](../../desktop/preview.mjs) → [primaryAction、businessJourney、functionalPass](../../desktop/interaction-check.mjs) | 在隔离 Electron 浏览器会话用 surface-page://〈UUID〉/index.html 实际载入；测量宽度、记录控制台错误、截取初态、点击主动作，按步骤操作并读取可见反馈。目标视口、桌面、手机去重后逐一验收。宽度及文本检查无法覆盖组件遮挡、全部按钮或刷新持久性。 |
| 视觉评价 / 部分实现 | 默认 run → [reviewAndRepair / compare](../../desktop/visual-review.mjs) → [judgePrompt / validateJudgment](../../live-engine/design/judge.mjs) → designStage | 新建时先渲染首稿，再生成另一方向；修改时拿父版比较。校验截图哈希，将两候选各桌面/手机四张 JPEG 随机标 X/Y 交同一 Agent，返回相对偏好、分项观察、区域、严重性及不确定项。没有独立真人评分或经校准的绝对质量线。本批首稿预算在二次生成前截止。 |
| 修复与退化处理 / 部分实现 | reviewAndRepair → codeCandidate('repair') → differences → 可选 repair-review → inspectAndSave | 一次定向源码修复；逐像素阈值差分仅标记变化，功能失败时可优先选健康候选或阻止保存。修改时旧版胜出可标记 needs-human，仍可发布功能合格的新版本。没有跨项目的长期视觉回归基准，也没有保证旧版胜出即自动恢复旧版的规则。 |
| 文件与版本 / 已实现 | inspectAndSave → DesignTrace.source → [Library.commit / export / source](../../desktop/library.mjs) → applyState → selectVersion | 源码与截图先落私有 attempt，检查后写 revision.json，再 rename 发布 UUID 目录；失败保留诊断。成功版本有 project、parent、trace id、检查和源码哈希。历史选择改变当前基线，导出仅拷贝三份源码。源码回退和视觉优劣判断为两个不同动作。 |
| 用户修改 / 已实现 | [editor.js](../../desktop/ui/editor.js) → main 的 inspect/capture/save-edit 或带 base 的 start → inspectAndSave；[inspector.mjs](../../desktop/inspector.mjs) 校验选择器和样式 | 手动改属性保存子版本；选元素或框图可进入下一轮自然语言修改。手动编辑会比较父子截图并重测；未保存调整可撤销。对话修改保留 request、parent、references、differences。 |
| 偏好 / 部分实现 | [feedback-cli.mjs](../../live-engine/design/feedback-cli.mjs) → [recordPreference](../../live-engine/design/preferences.mjs) 写 SQLite；生产 prepareTurn → matchingPreferences → directorPrompt / promptFor | 显式票据含选择、否定、理由、范围、编辑证据、双端验证和人工确认。读取 local-owner 下确认且范围匹配的最近最多六条。工作台的历史选择、样式保存、聊天发送均未调用 recordPreference。静态 USR-* 出自打包 JSON，不能当作本轮用户学习。两个干净实验 profile 均不引入真人反馈。 |
| 可复查观测 / 已实现 | [DesignTrace](../../desktop/design-trace.mjs) 和 [DesignAudit](../../desktop/design-audit.mjs)；askStructured 将实际提交文本的哈希与 CLI 回执关联 | 沿用已有 attemptId 作为 run_id。原有内部轨迹与版本提交共用目录，不宜关闭其内部工作文件。新增审计索引由 SURFACELIVE_DESIGN_AUDIT=1 开启，默认关闭；观测写入失败不影响生成。交互检验、失败回执和普通版本仍按原路径工作。 |

## 哪些知识到了模型

43 个打包来源对应 53 条种子规则，另有 6 条打包偏好和 1 个已检查的种子视觉案例。工厂数据库有 10 个 indexed 来源、20 张卡（10 规则、10 视觉案例），另 3 个来源仅发现链接、无卡。语料检查和库查询见[检查记录](../../runs/K-01/corpus.log)。工厂虽支持 InteractionCase 和 PreferencePair，这个快照没有这两类 indexed 实例。索引中的 reviewed 表示有流程记录，数据库内所列审核者是 Codex，不能读成人工设计师签核。

种子规则的 decision、avoid、check 和来源 URL 首先组成带 ID 的文本。工厂卡输出 ID、类型、标题及 summary，不会自动带上每个源文件、完整案例、原始像素或采集过程。种子视觉例按 sceneTypes 和 image-inspected 筛；单一 OpenFilm 种子仅适用于 creative-editor。无同域视觉命中时，prepareTurn 只按截图横竖方向，从 indexed 顺序取前三张视觉卡作类比。艺术指导可看到全部入围类比，源码阶段只追加被所选方向引用的类比及确认偏好；基础规则和同域工厂卡仍整体拼接。视觉案例在这两个阶段均以文字为主。正式路径中实际传图发生在用户给图和生成后的截图评审。

逐轮证据以[基线](K-01_BASELINE.md)中的 design-audit.json 为入口。candidates 给出当前可检索全集、来源、状态、分数或排序条件、排除原因；calls[].present 给出该调用完整 prompt 内命中 ID 的 UTF-16 偏移。原始请求、模型解释和每步输出可在同一私有目录核对。命中、进入艺术指导、进入首稿、模型声称引用、最终实现是不同证据；输出不能反推某张卡对像素有因果效果。标签不符、配额外、未审核、未选类比、未确认或作用域不符的偏好均可能被排除。私有偏好库中未授权给当前范围的行不会为审计另行导出。

### 两个首稿的案例去向

- **知时。** 场景分析给出空目录标签并明确择时知识缺口。导演收到 vis-drawer、vis-nearby、vis-topread 三张类比文字；选中的「时段清单」只引用 vis-nearby，源码输入也只保留了这张类比。另两张被排除在首稿调用之外。该方案明确借用列表内相邻信息的组织方式。记录能证明传入和引用，实际视觉贡献仍须盲评。[本轮轨迹](../../runs/K-01/zhishi/A-current/attempt/design-trace.json)
- **招聘复核。** 工厂命中两组规则与案例，即 rule-calc、vis-calc、rule-gnucash、vis-gnucash。被选的「候选表与证据侧栏」没有引用视觉案例 ID；另外两个备选分别引用 Calc 和 GnuCash。四张卡仍随基础知识文本传入源码模型。入选方向、收到参考摘要和使用具体视觉机制可以分别查证。[本轮轨迹](../../runs/K-01/recruiting/A-current/attempt/design-trace.json)

## 证据边界与下一批决策

现有实现已超过单次 Prompt + RAG。场景、策略、生成和截图比较有各自的实际调用；知识影响首稿的主要通道仍是文本拼接。值得保留的边界是本地 CLI 适配器、独立的场景与策略结果、经审核工厂、干净浏览器会话、不可变父子版本、失败留档和真人确认后才生效的偏好。

- **领域与参考形式。** 知时的空目录命中走竖屏类比，招聘工作台走通用 B 端标签。前者没有民俗择时专例，后者从表格与财经界面借结构。设计师对目标任务状态、版式和取舍的观察无法由相同屏幕方向补足。下一批先用这两个场景测案例覆盖、适用边界与选中理由。
- **验收覆盖。** 主动作只须改变一段文字，导演最多定义四步；首稿可能满足局部钩子而漏掉整个业务承诺。像素差分没有“更好”方向，截图裁判同源且未用人工排序校准。先用同一批冻结源码重放业务全路径、记录失败区域，再做人工盲评。
- **反馈入口。** 浏览器结果和历史版本已留存，但工作台上接受或否定一个具体版本没有形成有范围、带理由的确认票据。可先复用现有反馈协议收集这些盲评，不宜从点击、历史选择或一次修改自动归纳通用偏好。

历史运行只用于查明评审能力是否曾实跑。本次重新打开两份旧 trace，核查各自的真实 CLI 标识、pair-review、repair、repair-review 与候选 PNG 哈希。旧格式没有保存所有送评 JPEG 的可读路径；缺失核验记为 null。这些记录未纳入四份本批样本。[原件核验](../../runs/K-01/prior-trace-check.json)

**本地隐私边界。** 原有工作文件保存用户输入、局部源码、原始参考图、提示词和浏览器截图，以便继续修改和回放；它们位于当前用户可读的私有版本/失败目录，不是可公开分发的匿名日志。新索引通过哈希、受控枚举和本地引用关联自由文本，不复制提示词、截图、偏好理由、子进程环境或 CLI 输出尾部。原始工作文件没有应用层加密。只用本任务公开给出的需求和合成业务样例建立基线；没有读取用户历史或个人偏好数据。两次真实 attempt 目录权限均为 0700，私有提示词和执行记录为 0600。对本批 57 份文本做了常见凭据签名检查，未命中；这项检查不能识别任意私人信息。选定一个共享保存位置会改变原件的保密边界。[本批检查记录](../../runs/K-01/privacy-check.json)
