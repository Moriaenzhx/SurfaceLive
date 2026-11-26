# Live Engine 知识数据规格：先有真证据，再谈“学会审美”

## 1. 建议数据对象

### `SourceEvidence`

`id / canonicalUrl / publisher / pageTitle / capturedAt / versionHash / licenseOrTerms / rightsStatus / artifactKinds / sceneTags / reliability / inspectionStatus`。

- `rightsStatus` 明确区分 `link-only`、`analysis-permitted`、`licensed-reproduction`；禁止“网页能访问=图片可随意分发”。
- `inspectionStatus` 区分 `discovered`、`fetched`、`pixel-inspected`、`interaction-tested`、`reviewed`；不同状态不得混淆。

### `DesignRule`

`id / topic / decision / applicability / contraindications / examples / observableCheck / confidence / evidenceIds / reviewedAt`。

### `VisualExemplar`

`id / sourceId / screenshotPathOrLink / capturedViewport / pageState / visualHierarchy / layoutGrammar / typographyRhythm / colorRoles / density / focalPoint / transferablePrinciples / copyingRestrictions / humanReview`。

### `InteractionCase`

`id / sourceId / preconditions / userAction / visibleOutcome / failureStates / reducedMotion / testEvidence / review`。

### `PreferencePair`

`context / variantA / variantB / chosen / reviewerType / freeTextReason / taskSuccess / timestamp / confidence`。

## 2. 运行时检索

`SceneContract`（业务人群/任务/设备/内容密度/场景状态）→ 分别检索 DesignRule、VisualExemplar、InteractionCase、PreferencePair → 交叉处理矛盾 → 最终小上下文 DesignDNA（版式/字体/配色/行为/动效/品牌差异）。

**注意**：DesignDNA 是生成指导，不是完整页面的无损 AST；HTML/React/Vue 产物还需要后续独立的 Interface Document 才能实现精确编辑和多框架可靠转换。

## 3. 建议先使用的持久化

早期 50–200 条可以继续用已实现的 JSON 与脚本；一旦加入大量截图、版本、关系和审核流，迁移到 SQLite + FTS5 与本地资产目录。图像向量检索与 cross-encoder 精排属于后续真实检索效果不达标时再引入的技术，不因为“AI 产品”三个字就必须立刻上。

## 4. 可衡量数据完整性

每个通过审查的视觉案例必须有：`来源 + 权利记录 + 真实截图 + 视口 + 所处状态 + 视觉观察 + 可迁移规律 + 禁止复制边界`；缺项只能进入待审核区，不进入高置信提示词。

在录入量增长时，统计样本类别分布、重复率、可用权利状态、视觉检查覆盖率、被检索率和对最终审美改善的贡献。**“累计10000个链接”本身不是产品能力。**
