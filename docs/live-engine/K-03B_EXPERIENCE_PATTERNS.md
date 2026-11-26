# K-03B · 从当前状态找到下一步操作

招聘工作台把“保存复核”放在候选人详情中有业务依据。顾问在名单中先选人，在证据中判断缺口，形成结论后才保存。知时在提交前需要帮助用户确定事项和日期，提交后需要让候选时段及其理由进入阅读主线。

## 冻结源码的对照

在 1440×900 与 390×844 各用独立 Chrome 上下文运行 K-03A 的三份静态工程文件，执行前核对原始源码 SHA-256。招聘的首页没有旧协议的主操作标识；搜索、打开周宁的证据，再保存“待补证”全部成功。知时查询后出现候选时段，保存成功。这些结果来自原文件的独立回放，本批数据存储在单独目录。[招聘回放](../../runs/K-03B/replay-recruiting-joWYWi/results.json) · [知时回放](../../runs/K-03B/replay-zhishi-Zddxkh/results.json)

| 场景 | 任务状态图（业务语义） | 应观察的结果 |
|---|---|---|
| 知时 | 初始资料 → 事项和日期 → 执行查询 → 候选时段 → 展开理由 → 保存与比较 | 日期组与时段对应，理由指向所选时段，编辑条件和返回路径可用。 |
| 招聘 | 名单 → 选中候选人 → 匹配证据 → 人工复核或待补证 → 保存结论 | 姓名与证据保持关联，确认后出现真实反馈，再次查看能认回状态。 |

## Batch E 两份首稿的原始验收

### 知时

首稿选中“按日读时段”，原始验收为 `FUNCTIONAL_FAILURE`。[已选 Contract](../../runs/K-03B/zhishi-56Umty/attempt/contracts/4c9bc501-9b19-47c1-a1ad-7c0c5e617fb2.json) · [运行收据](../../runs/K-03B/zhishi-56Umty/receipt.json) · [完整 Trace](../../runs/K-03B/zhishi-56Umty/attempt/design-trace.json)

按契约主操作走完一圈为 `initial` → `criteria` → `querying` → `results` → `reason` → `saved` → `comparison` → `results`。

| 当前状态 | 用户任务与首要信息 | 主操作 → 下一状态 | 桌面 1440×900 | 手机 390×844 |
|---|---|---|---|---|
| `initial` | 核对或维护正在使用的八字。<br>**基础资料** | 使用当前资料 → `criteria` | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop-state-initial.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-initial.png) |
| `criteria` | 为本次事项确认类型和日期范围。<br>**查询条件** | 查询候选 → `querying` | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop-state-criteria.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-criteria.png) |
| `querying` | 执行查询并展示提交快照。<br>**本次查询** | 正在查询候选 → `results` | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop-state-querying.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-querying.png) |
| `results` | 按日期扫读候选并打开目标时段的理由。<br>**候选时段** | 查看 12月8日 09:00–11:00 的理由 → `reason` | 已到达，检查器未执行主操作 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop-state-results.png) | 已到达，检查器未执行主操作 · [现场截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile-state-results.png) |
| `reason` | 核对该时段的依据和使用边界并保存。<br>**民俗依据** | 保存此时段 → `saved` | 本状态路径未走到 | 本状态路径未走到 |
| `saved` | 确认新增保存项并选择两段比较。<br>**保存项** | 比较两个时段 → `comparison` | 本状态路径未走到 | 本状态路径未走到 |
| `comparison` | 比较两段的具体时间与民俗依据。<br>**比较项** | 返回候选 → `results` | 本状态路径未走到 | 本状态路径未走到 |

两端各通过 3/7 项状态动作，独立业务旅程均通过了使用资料、查询候选、查看理由和保存时段四步。[桌面初始截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/desktop.png) · [手机初始截图](../../runs/K-03B/zhishi-56Umty/attempt/evidence/mobile.png)

知时列表的两个“查看理由”按钮携带同一个 `ledger-reason` 标记，分别对应 12 月 8 日和 12 月 9 日。原检查器要求标记唯一，两端都记录到 `actionCount=2`，没有选取其中一个继续状态旅程。另一条业务测试确实打开第一条理由并保存了时段。比较功能在原验收中尚无交互证据。两端滚动位置都是 0，“候选时段”距视口上缘约 122 像素。[生成的控件代码](../../runs/K-03B/zhishi-56Umty/attempt/app.js) · [原始浏览器记录](../../runs/K-03B/zhishi-56Umty/attempt/design-trace.json)

### 招聘复核工作台

首稿选中“名单与证据双栏”，原始验收为 `READY`。[已选 Contract](../../runs/K-03B/recruiting-WjJUpA/attempt/contracts/5056f428-4886-4d7c-9e7e-69f3d3b3ec19.json) · [运行收据](../../runs/K-03B/recruiting-WjJUpA/receipt.json) · [完整 Trace](../../runs/K-03B/recruiting-WjJUpA/attempt/design-trace.json)

按契约主操作走完一圈为 `initial` → `selected` → `evidence` → `review` → `saved` → `initial`。

| 当前状态 | 用户任务与首要信息 | 主操作 → 下一状态 | 桌面 1440×900 | 手机 390×844 |
|---|---|---|---|---|
| `initial` | 在岗位上下文中缩小名单并选择候选人。<br>**候选人名单** | 查看陈澄 → `selected` | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-initial.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-initial.png) |
| `selected` | 确认当前候选人与岗位，定位主要缺口。<br>**候选人** | 展开匹配证据 → `evidence` | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-selected.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-selected.png) |
| `evidence` | 逐项核对岗位要求、原文出处与待确认信息。<br>**匹配证据** | 复核结论 → `review` | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-evidence.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-evidence.png) |
| `review` | 确认待补证草稿及经办身份。<br>**复核记录** | 保存复核 → `saved` | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-review.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-review.png) |
| `saved` | 核验实际保存的结论与名单反馈。<br>**复核记录** | 回到名单 → `initial` | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop-state-saved.png) | 已到达，动作通过 · [现场截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile-state-saved.png) |

两端各通过 5/5 项状态动作，也通过了独立业务旅程的选择陈澄、展开证据、选择结论和保存复核四步。[桌面初始截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/desktop.png) · [手机初始截图](../../runs/K-03B/recruiting-WjJUpA/attempt/evidence/mobile.png)

状态表里的“动作通过”要求实际控件操作后出现契约约定的目标内容。“未走到”表示前一步失败或检查未执行。时长短于截图采集的处理中状态可用浏览器 DOM 观察核对。各状态的前后文本、目标 ID、截图摘要与控制台错误已归档。[逐项核验记录](../../runs/K-03B/verification.json)

## 修正检查器后重放原件

重新核对两份契约与六个源码文件的 SHA-256，由宿主加载同一首稿。知时结果态有两个可见同类操作；其中一个可访问名称完全等于“查看 12月8日 09:00–11:00 的理由”。浏览器选中这个按钮后，真实出现对应的民俗依据，随后可保存、比较两个时段，再返回候选。招聘证据图在可见有限动画结束、两帧完成后采集，可以读到简历原文、页码和仍待核实的事项。初次收据仍对应原检查器。[独立重放的状态、操作、截图和哈希](../../runs/K-03B/contract-recheck-srV545/results.json)

| 场景 | 桌面 1440×900 | 手机 390×844 |
|---|---|---|
| 知时 | 7/7 状态动作，4/4 业务步骤。[展开理由](../../runs/K-03B/contract-recheck-srV545/zhishi-desktop-state-reason.png) | 7/7 状态动作，4/4 业务步骤。[比较时段](../../runs/K-03B/contract-recheck-srV545/zhishi-mobile-state-comparison.png) |
| 招聘 | 5/5 状态动作，4/4 业务步骤。[展开证据](../../runs/K-03B/contract-recheck-srV545/recruiting-desktop-state-evidence.png) | 5/5 状态动作，4/4 业务步骤。[展开证据](../../runs/K-03B/contract-recheck-srV545/recruiting-mobile-state-evidence.png) |

另用全新 Chrome 会话验证了更换查询条件、刷新保存项、切换候选和回看复核历史。[知时语义回放](../../runs/K-03B/business-zhishi-sv7HvJ/results.json) · [招聘语义回放](../../runs/K-03B/business-recruiting-vkkwg4/results.json)

