# K-03A · DesignContract 1.0

真实定义由 ESM 模块导出。`designContractSchema` 描述持久化对象，`directionDetailSchema` 是同一组字段在导演回答中的输入形状；`validateContract(value)` 返回通过校验的原对象或抛错。所有声明的键必填，未知键拒收。版本字符串为 `1.0`。[类型与字段](../../live-engine/design/contract-schema.mjs) · [组装与跨字段校验](../../live-engine/design/contract.mjs)

| 顶层字段 | 内容与约定 |
|---|---|
| `schemaVersion`, `id`, `runId`, `directionId` | 版本、契约 UUID、运行 UUID、导演方向 ID。同一运行的候选有各自的契约 UUID。 |
| `requirements` | `brief` 保留本轮上下文；`explicit[]` 保存可定位的原文，`tokenLocks[]` 每项为 `{token,value,quote}`；`host[]` 为工程要求，`uncertainties[]`、`assumptions[]` 记录未知项与待验证假设。 |
| `experiencePlan` | `audience[]`、`productGoals[]`、`tasks[]` 每项有 `value/evidence/source`；另有 `pageGoal`、`entities[]`、`informationArchitecture`、`states[]`、`transitions[]`、`layouts.desktop/mobile`、`preservedFunctions[]`。 |
| `artDirection` | `concept/rationale/selection` 交代概念和选择；`composition/focalPoint/typography/interactionPath/motionDirection` 描述实现意图。其他字段为 `brandTone/colorIntent/surfaceTone/headingScale/density/componentLanguage`、`antiPatterns[]`、`caseDecisions[]`、`rules[]`、`preferences[]`、`evidenceGaps[]`。 |
| `designSystem` | `tokens`、`iconLanguage`、`componentStates`、`motion`、`responsiveRule`、`creativeFreedom`。Token 值由每个方向独立给出。 |
| `evaluationPlan` | `viewports[]`、`checks[]`、`journey[]`、`brandConsistency`、`accessibility`、`responsive`、`antiPatterns[]`、`humanQuestions[]`。计划在源码调用之前保存。 |
| `provenance` | `sceneStage/directorStage` 指向阶段，`adoptedKnowledgeIds[]` 记录实际采用的规则、案例和偏好，`parentContractId` 可为空；`decisionSources[]` 记录契约字段路径、来源类别和对应引文位置、方向或证据 ID。 |

## 状态与设备

状态含 `id/purpose/taskEvidence/priority[]/controls[]`。必须有 `initial` 和至少一个后续状态，转换 `{from,to,action}` 形成从初始状态可达的图。每个状态引用本轮真实任务引文，并按已声明实体排序。至少两个状态的首要实体不同。设备布局各含 `structure/order[]`。桌面与手机必须写出各自的布局行为，也允许两端共享合适的阅读顺序。

宿主按目标设备加桌面和手机去重展开视口。当前桌面为 1440×900，手机为 390×844；目标为平板时另有 834×1112。每个状态和视口恰有一条 `{state,viewport,visible[],controls[],primaryEntity,firstViewport[],success}`。导演分别指定桌面、手机首屏；平板复用该状态的可见信息清单。对应状态的首要实体及控件必须一致。浏览器旅程沿用既有 `click/fill/select` 协议、实际控件和预期结果；其 `state` 是页面上的 `data-state` 定位键，业务状态图使用独立 ID。[视口来源](../../desktop/engine.mjs) · [可执行旅程](../../live-engine/design/journey.mjs)

## 工程 Token 与约束强度

| 语义字段 | 当前值域或检查 |
|---|---|
| `color.brand.primary`、`color.surface.base`、`color.text.primary`、`color.action.primary` | 十六进制 RGB；正文对底色的计算对比度至少 4.5。使用相对亮度 0.35 作为本引擎定向检查的明暗分界。 |
| `type.family.body`、`type.size.body`、`type.size.heading`、`type.weight.body`、`type.lineHeight.body` | 字体族为文本，字号为正 px/rem，比较时按根字号 16px 换算；标题相对正文字阶与 `headingScale` 一致。字重为 1–1000，行高为正数、无单位。 |
| `space.component.md`、`radius.control` | 非负 px/rem 或零。 |
| `border.control`、`shadow.surface`、`motion.feedback` | 非空工程值。组合 CSS 表达式与动效实效仍需在页面上检查。 |

用户锁要求有同时证明语义角色和字面取值的原话。已识别的品牌色、操作主色、页面底色与正文色即使被场景提取遗漏，宿主也能从明确的中文色值声明补回。示例、建议与否定语境不能作为肯定锁定值。父版锁与新值冲突时保留证据并停止。没有用户取值的设计 Token 为导演建议，`creativeFreedom` 说明可调整范围。明确的自然语言功能或品牌条款随原话下发；当前确定性校验覆盖可表示的规则，开放语义仍靠实际成果验收。

## 来源与使用

场景事实分为 `user`、`scene-inference` 和缺失维度时的 `director-inference`。字段级来源区分 `user/scene/art-director/knowledge-rule/visual-case/confirmed-preference/bundled-guidance`。每个入围案例都要有 `{id,adopt,mechanism,boundary}`。勾选采用的 ID 必须与方向自己的 `visualCaseIds` 完全一致；被拒案例的理由可进入编码说明，采用清单只收采用项。规则与偏好按检索结果解析。来源链接、一手截图哈希等原始材料仍在同一运行的知识和步骤记录中。

契约哈希基于实际写盘字节（两个空格缩进并带末尾换行的 UTF-8 JSON）。编码输入的哈希涵盖最终送往 Agent 的文本，加入修改引用后再计算。源码版本为三份文件按 `index.html/styles.css/app.js` 顺序建立的文件名到 SHA-256 的 JSON 对象的 SHA-256。[存储与核验](../../desktop/design-trace.mjs)

三份可离线读取与测试的示例附有来源清单，其中补全决策为编写的样例。真实运行的完整原件和回执列在测试报告。[知时](examples/k03a/zhishi.json) · [招聘](examples/k03a/recruiting.json) · [模糊官网](examples/k03a/ambiguous.json) · [样例来源](examples/k03a/manifest.json) · [运行结果](K-03A_TEST_REPORT.md)
