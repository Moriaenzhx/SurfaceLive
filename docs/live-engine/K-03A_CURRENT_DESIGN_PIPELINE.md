# K-03A 接入前的设计决策流程

本次先追踪工作区源码，再用 K-01 首稿的私有轨迹核对数据。桌面端由 studio.js 的 start 经 preload 发起 studio:start。main.run 取得当前请求、父版源码、临时样式和参考图，调用 prepareTurn。输入框中的词法建议和提交后的语义分析是两次不同的工作。[提交入口](../../desktop/ui/studio.js) · [宿主](../../desktop/main.mjs)

| 已运行的环节 | 已有数据与约束 | 接入前的缺口 |
|---|---|---|
| Scene | 同一台本机 Agent 提取产品、受众、任务、交互、设备、文化品牌、复杂度和风格。各条含原文引文及 explicit/inferred，另有未知项、假设和目录标签。 | 缺少可锁定到工程 Token 的用户原话，也没有阻止两条互斥需求同时下发的机制。 |
| Retrieval | prepareGeneration 使用领域标签检索种子规则与工厂卡。正式流程再查有范围且经确认的偏好，缺视觉卡时才用设备方向取跨域类比。 | 命中不等于采用。来源、卡片观察和案例边界可复用，毋须另建检索库。 |
| Art Director | 现有结构化调用提出 2–3 个方案，返回 selectedId、取舍、证据缺口和共享业务旅程。方案已有信息架构、焦点、字阶、流程以及规则、案例与偏好 ID。 | 单个焦点和一句结构描述不能表明提交后谁占首屏，也无法按设备查询阅读顺序。缺少语义 Token、状态化评价条件及硬软约束界线。 |
| Source | prepareTurn.promptFor 组合宿主输出协议、场景与检索文本、方向 JSON、案例、偏好及业务定位。main 追加真实选区文本和参考图，通过既有 Agent Bridge 取得 HTML/CSS/JS。 | 同一研究材料与实际交付指令混在一起。尚无经运行时校验的决策文档，也没有从选定决策到最终候选源码的独立身份。 |
| Review / Trace | 新建时产生备选，修改时比较父版，可定向修复一次。Trace 已记录每次调用文本哈希、候选源码和私有截图，宿主用真实浏览器核验主任务。 | 首屏截图早于业务操作。已有代码和输入版本标识可复用，状态检查及人类审美标准需先在编码前表达。 |

[场景结构](../../live-engine/design/scene.mjs) · [检索组装](../../desktop/engine.mjs) · [候选与选择校验](../../live-engine/design/director.mjs) · [生成准备](../../desktop/prepare-turn.mjs) · [候选与修复](../../desktop/visual-review.mjs) · [私有 Trace](../../desktop/design-trace.mjs)

知时的「时段清单」只引用 vis-nearby，迁移的是行内信息的邻接关系。招聘的 Calc、GnuCash 进入基础资料，选中的「候选表与证据侧栏」没有引用视觉案例。K-02A 匿名图中，知时结果的首屏可见性与初始品牌识别是两个问题。招聘手机证据页还要在不同阅读顺序下保留所选身份。以上观察界定契约必须能表达的问题。[知时原始方向](../../runs/K-01/zhishi/A-current/attempt/steps/art-direction/response.json) · [招聘原始方向](../../runs/K-01/recruiting/A-current/attempt/steps/art-direction/response.json) · [截图复核](K-02A_INDEPENDENT_VISUAL_REVIEW.md)

接入点选在原有导演回答通过校验之后、任何源码调用之前。沿用一次场景分析和一次导演决策，在同一导演回答中补充必要字段，由宿主组装并验证各候选的四部分契约。原件随既有私有 attempt 保存，初稿和备选各自取对应契约，修复沿用被修稿的契约。历史作品继续按原三文件读取，隔离的旧实验条件保留原语义。
