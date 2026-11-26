# K-03A · 设计契约在桌面生成链中的位置

一份契约对应本次运行的一个设计方向。场景分析提供需求依据，原有检索提供可用证据，Art Director 同时提出并选择方向。宿主据此装配契约，校验后才允许编码。备选也可能赢得后续比较，所以每个可提交编码的方向都保存一份原件。[接入前审计](K-03A_CURRENT_DESIGN_PIPELINE.md)

| 时点 | 调用与产物 | 谁做决定 |
|---|---|---|
| 用户提交 | `studio.js` → preload 的 `start` → `studio:start` → `main.run`。宿主合并本轮文字、父版、终端、编辑与引用。 | 用户指定需求、修改范围和目标终端。老作品仍可从原 HTML、CSS、JS 开始修改。 |
| 场景分析 | `prepareTurn` 沿用 `scenePrompt` 和 `validateScene`，在正式路径增加逐字引用的硬要求、Token 锁和冲突对。输出保留八维事实、索引标签、缺项和假设。 | Scene 区分用户原话与推断。宿主处理可识别的保留品牌与整体更换冲突，并在修改时承接父契约。 |
| 取证 | `prepareGeneration` 查设计规则、案例与经过审核的卡片，并按原有作用域取得已确认偏好。缺少视觉案例时沿用已有的跨域类比。 | 检索决定导演能看见哪些证据。确认偏好与内置指导在契约中有各自来源。 |
| 提案与选择 | `designStage('art-direction')` 同一次结构化回答给出 2–3 个方向、各方向的状态/设备/系统/评价字段、共享业务旅程及 `selectedId`。 | 本机 Agent 担任导演并陈述取舍。每个入围视觉案例在每个方向都有采用决定、机制与适用边界。 |
| 组装与校验 | `assembleContract` 把状态与宿主视口交叉展开，把 ID 解析为本轮规则/偏好，并写入原文和来源。`validateContract` 检查图、Token、来源和评价覆盖；`storeContracts` 保存通过校验的各方向。 | 宿主能拒绝不一致的方案。新字段和旧方向共用现有的一次纠正机会。 |
| 编码 | `promptFor` 按目标、状态、艺术、工程、约束、验收组织指令，附上共享的可执行旅程。宿主再加入用户的选区或引用；`contractInput` 检查完整契约指令，绑定最终文本的 SHA-256。 | 编码 Agent 得到真实控件、结果和创作空间。原有生成返回 `title/html/css/js`。 |
| 输出与选版 | `generated` 核对 Bridge 实发的回执，把该操作绑定到三文件版本。正常路径运行已有浏览器与比较流程，再由 `trace.source` 对最终字节核对，交给 `Library.commit` 保存。 | 新建作品的备选取自己的契约；修复取被修候选的契约。用户修改沿用父版上下文。 |

[桌面入口](../../desktop/main.mjs) · [生成准备](../../desktop/prepare-turn.mjs) · [导演](../../live-engine/design/director.mjs) · [契约组装](../../live-engine/design/contract.mjs) · [实际调用及回执](../../desktop/agent.mjs) · [比较与修复](../../desktop/visual-review.mjs)

## 一个版本如何还原

1. 从版本元数据的 `designContract` 或失败 attempt 的 `design-trace.json` 找到 `contracts/<id>.json`；对文件原始字节核对 SHA-256。
2. `selectedContractId` 是编码前选中的方向。查最终 `code.contractId`、`sourceInputs` 和 `finalSourceInput` 可以还原最后交付的候选。沿同一操作名查 `invocations`，核对输入 SHA-256。图像引用另有内容哈希。
3. 从 `code.files` 复算三份代码的字节哈希，然后按宿主顺序计算 `sourceVersion`。父版通过 ID、Schema 版本、运行 ID 与内容哈希恢复。手动改样式沿用父契约，轨迹明确标记 `inherited-manual-edit`，不产生编码调用回执。

私有 attempt 放在当前作品库的 `.design-traces/<runId>/`。契约目录权限为 `0700`，契约与原始提示词为 `0600`。成功的作品随现有原子保存机制一起归档，失败的材料留在 attempt。用户导出沿用原有三文件格式。本地 CLI 的模型、认证、传输方式和图像传递方式沿用已有实现。[Trace 与父版读取](../../desktop/design-trace.mjs) · [保存与导出](../../desktop/library.mjs)

## 错误与兼容路径

可确定的品牌保留冲突在调用 Scene 前停止。本轮及已确认的 Token 取值互斥、引文无法成立或两次导演回答均不合格时，保存阶段和错误，结束本次生成。CLI 调用本身失败时沿用已有错误处理。每个设计阶段最多一次回答纠正，源码调用沿用现有生成预算。实验专用 A0、A1 保持原语义，普通桌面提交使用完整路径。历史版本没有契约字段时，读取器返回空值，首次正常的 Agent 修改可为新版本建立契约。[阶段重试](../../desktop/design-stage.mjs) · [回归用例](../../desktop/tests/design-contract.test.mjs)

验收计划可以逐状态查桌面与手机的首屏要求及人工问题。目前实际执行的是既有浏览器旅程、视口与功能检查。自然语言首屏要求、文化适切性、全部组件的键盘行为和艺术原创性仍需独立观察。[Schema 说明](K-03A_SCHEMA_SPEC.md) · [测试结果](K-03A_TEST_REPORT.md)
