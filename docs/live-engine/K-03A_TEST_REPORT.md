# K-03A · 测试与真实运行记录

2026-11-24，在本机安装的 Codex 上运行知时、招聘各一份首稿，并为模糊官网生成契约。三次均由 CLI 回报 `gpt-6.2-sol`，请求推理强度为 `low`。业务实验使用隔离的 Electron 作品库，从桌面 preload 的 `window.studio.start` 进入正式 IPC 链。范围限定为首稿，备选比较和修复由独立回归覆盖。[实发回执、会话、Token 与哈希核验总表](../../runs/K-03A/verification.json)

## 当次结果

| 需求与运行 ID | 源码与整体验收 | 耗时与 CLI 报告 Token |
|---|---|---|
| 知时 · `c0f101ca-7189-4353-9799-a8257e54d041` | **READY**。1 份首稿。手机与桌面均通过宿主门禁。 [源码](../../runs/K-03A/zhishi-TF2IOX/attempt/index.html) · [Trace](../../runs/K-03A/zhishi-TF2IOX/attempt/design-trace.json) | 638.5 秒，68,200。场景、导演、源码分别为 2,418、33,155、32,627。 |
| 招聘 · `55e40f34-3e94-4412-8de3-d1b1d8eebf41` | **FUNCTIONAL_FAILURE**。1 份首稿。两端均因初始主操作检查失败而未发布到实验作品库；失败 attempt 保留三份源码及截图。 [源码](../../runs/K-03A/recruiting-sHiGfI/attempt/index.html) · [原始失败 Trace](../../runs/K-03A/recruiting-sHiGfI/attempt/design-trace.json) | 684.0 秒，91,248。场景、导演、源码分别为 23,110、33,779、34,359。 |
| 模糊官网 · `5ea63909-56be-4c2e-a6b8-40bd44659fcb` | **VALIDATED_PLAN**。两份候选契约，选中采购审批示例，业务领域、配色均标为待确认或可调整。源码调用数为零。 [Trace](../../runs/K-03A/ambiguous-iB9yLc/5ea63909-56be-4c2e-a6b8-40bd44659fcb/design-trace.json) | 369.4 秒，54,288。场景、导演分别为 22,621、31,667。 |
| 品牌保留与整体更换冲突 · `290d857d-6c72-4beb-87f3-01e67594b177` | **CONFLICT_BLOCKED**。通过正式准备器复现，记录两句冲突原文。未进入 Scene、导演或源码调用。 [冲突轨迹](../../runs/K-03A/conflict-XncTCv/290d857d-6c72-4beb-87f3-01e67594b177/design-trace.json) | 0 次 CLI 调用。 |

上表三次完成规划的运行共收到 8 份成功 CLI 回执；费用字段均为空。知时另有一次中断在场景阶段，Electron 驱动过早读取尚为空的 outcome，退出时取消了运行 14 毫秒的 CLI。该次没有会话或 Token 回报，没有源码。修正为在宿主侧轮询同一 token 的终态后才取结果，原件仍保留。[中断收据](../../runs/K-03A/zhishi-OiDRHR/receipt.json) · [取消回执](../../runs/K-03A/zhishi-OiDRHR/interrupted-attempt/design-trace.json)

## 由契约到实际输入和源码

| 真实运行 | 选中契约 SHA-256 前 16 位 | 编码文本 SHA-256 前 16 位 | 三文件版本前 16 位 |
|---|---|---|---|
| 知时 **按日期浏览** | `2ecb019fb109ac2f` | `6bd9e83ebbd6ef12` | `405641768c05a837` |
| 招聘 **候选人比较表** | `00745e33b5544929` | `a2b0bbf36f003090` | `eb019f24332b9f1e` |
| 模糊官网 **先讲清采购审批，再看流程** | `0c28cff55cd8bd47` | 仅组装，规划结束 | 无源码 |

知时在 16:08:03.234 校验并保存契约，16:08:03.239 发起源码调用。招聘对应时刻为 16:08:14.798 和 16:08:14.805，均为北京时间。编码回执带有选中契约 UUID、契约哈希和实发文本哈希。验算脚本从原始场景、导演回答和知识记录重建全部 6 份候选，除每次新分配的 UUID 外逐字段一致。用原 UUID 重新渲染的两份源码指令与实际 CLI 回执字节哈希吻合；模糊官网只对已准备的文本核验。[知时实发指令](../../runs/K-03A/zhishi-TF2IOX/attempt/prompt.md) · [招聘实发指令](../../runs/K-03A/recruiting-sHiGfI/attempt/prompt.md) · [核验脚本](../../experiments/k03a-verify.mjs)

## 浏览器证据

| 状态 | 1440×900 桌面 | 390×844 手机 |
|---|---|---|
| 知时初始，Electron 原始门禁截图 | [桌面](../../runs/K-03A/zhishi-TF2IOX/attempt/evidence/desktop.png) | [手机](../../runs/K-03A/zhishi-TF2IOX/attempt/evidence/mobile.png) |
| 知时查询完成，独立 Chrome 回放 | [桌面结果](../../runs/K-03A/replay-zhishi-gSt0fC/desktop-after-run-query.png) | [手机结果](../../runs/K-03A/replay-zhishi-gSt0fC/mobile-after-run-query.png) |
| 招聘初始，Electron 原始门禁截图 | [桌面](../../runs/K-03A/recruiting-sHiGfI/attempt/evidence/desktop.png) | [手机](../../runs/K-03A/recruiting-sHiGfI/attempt/evidence/mobile.png) |
| 招聘已搜索并展开证据，独立 Chrome 回放 | [桌面证据](../../runs/K-03A/replay-recruiting-kBWXdO/desktop-after-open-evidence.png) | [手机证据](../../runs/K-03A/replay-recruiting-kBWXdO/mobile-after-open-evidence.png) |

Electron 原始 PNG 使用 2 倍设备像素，Chrome 操作态 PNG 使用 1 倍。回放先核对三份源码哈希，以独立浏览器上下文执行契约旅程。两次回放都通过两端的业务步骤。截图保留自然操作后的滚动位置。以下结论只覆盖这两份首稿。

- **知时**两端都完成事项、时间范围、查询、保存四步。前两步选择命中当前默认值，未观测到文本变化；查询出现“12月2日”，保存出现“已保存”。在手机查询结果截图中，条件收为摘要，首个日期组起点约为 y=292，首个完整时段与理由入口在首屏。两端无记录到的控制台错误或横向溢出。[独立回放记录](../../runs/K-03A/replay-zhishi-gSt0fC/results.json)
- **招聘**两端均完成搜索周宁、展开 Kafka 证据和保存“待补证”。首屏 `[data-testid="primary-action"]` 在 DOM 中有 **0** 个，展开目标候选人后有 **1** 个，对应“保存复核”。因此宿主要求的首屏可直接点击的主操作确实缺席。独立回放保留这项观测；业务旅程通过没有改写原始整体验收失败。手机证据区从 y=758 开始，证据正文需要继续向下阅读。两端无记录到的控制台错误或横向溢出。[独立回放记录](../../runs/K-03A/replay-recruiting-kBWXdO/results.json) · [首屏门禁](../../desktop/preview.mjs) · [生成的详情控件](../../runs/K-03A/recruiting-sHiGfI/attempt/app.js)

## 自动化与兼容性

| 实际执行 | 结果 |
|---|---|
| `npm test` | **42/42**，含 10 个新增契约测试。覆盖状态/设备、用户硬约束、模糊与冲突、虚构案例、限定纠正、A0/A1 兼容、实发输入与三文件版本篡改、父版与手动继承。[测试用例](../../desktop/tests/design-contract.test.mjs) · [最终日志](../../runs/K-03A/tests-complete.log) |
| `npm run knowledge:check` 和 `npm run knowledge:bench` | 均以 0 退出。知识完整性检查为 43 个来源、53 张卡，问题清单为空。[完整性](../../runs/K-03A/knowledge-check.log) · [检索基准](../../runs/K-03A/knowledge-bench.log) |
| 隔离 Electron 工作台，离线 Agent 夹具 + 真实浏览器 | 初稿、另一方向、引用截图修改、父版、导出重开、失败与取消通过。真实 `save-edit` 修改字体后保留同一契约与不同源码哈希。另一个夹具在初稿和备选中引入横向溢出；浏览器实际检测失败，宿主采用通过两端检查的修复版，最终源码哈希绑定到 `repair` 回执。夹具回执标记 `override=true`。[工作台结果](../../runs/desktop-smoke-EUDsHy/verification.json) · [完整修复轨迹](../../runs/desktop-smoke-EUDsHy/profile/revisions/d58e6695-c390-4414-b6d3-af3e88d1e819/design-trace.json) · [运行日志](../../runs/K-03A/desktop-complete.log) |
| 旧作品编辑器回归 | 在隔离资料库编辑没有契约字段的内置招聘项目，桌面/手机功能检查、框选、导出及像素差异均通过。[旧作品结果](../../runs/editor-manual-ZyjNtv/verification.json) |
| 历史文件核验 | K-01 的 95 个、K-02A 的 52 个文件，路径集合及全部 SHA-256 与实施前清单一致。新增真实运行仅使用本任务的业务输入，49 个实验文本文件未匹配常见密钥或令牌特征。本地私有原件仍可能包含用户主动输入的内容。[实施前清单](../../runs/K-03A/prior-evidence-sha256.json) · [核验结果](../../runs/K-03A/verification.json) |

真实调用使用隔离构建 `desktop-build-BHucx2`。最终隔离构建 `desktop-build-yHLVCI` 的两项运行时代码差异是契约来源校验，以及源码、旅程指令和手动继承的 Trace 核验。最终代码重组的契约与输入已对真实回答核对，最终构建另通过桌面回归。这两项加固没有触发新一轮模型生成。早期一次桌面夹具发现枚举型 Schema 误判，一次新增单测发现夹具没有可执行权限；两次原始测试日志均保留。[枚举失败](../../runs/K-03A/desktop-regression.log) · [夹具权限失败](../../runs/K-03A/tests-fixture-permission.log)

## 复查命令

在工程根目录执行下列只读核验或隔离回放。重复回放各自写入独立的新目录。

```sh
npm test
npm run knowledge:check
npm run knowledge:bench
node --experimental-strip-types experiments/k03a-verify.mjs | cmp - runs/K-03A/verification.json
node --experimental-strip-types experiments/k03a-replay.mjs runs/K-03A/zhishi-TF2IOX
node --experimental-strip-types experiments/k03a-replay.mjs runs/K-03A/recruiting-sHiGfI
SURFACELIVE_TEST_APP="$PWD/runs/K-03A/test-final-runtime" SURFACELIVE_BACKGROUND_CHECKS=1 node desktop/tests/smoke.mjs --check-contract-inheritance --check-contract-repair
SURFACELIVE_TEST_APP="$PWD/runs/K-03A/test-final-runtime" SURFACELIVE_BACKGROUND_CHECKS=1 node desktop/tests/editor.mjs
```

本批还实际执行了 `node desktop/build.mjs --isolated`、`node experiments/k03a-examples.mjs`、`node experiments/k03a-smoke.mjs conflict`，以及 `node experiments/k03a-smoke.mjs` 分别带 `zhishi`、`recruiting`、`ambiguous` 的真实调用。当前真实调用脚本对功能门禁失败返回非零；历史实验结果以保存的状态与浏览器回执为准。`git rev-parse --show-toplevel` 在工程及父目录找不到 Git 工作树，本批采用内容哈希标识版本。真人投票、完整可访问性审计及审美比较仍待后续执行。
