# K-02A · 业务验收与评测基线

知时的失败已定位到门禁断言。招聘首次桌面搜索的超时有原始日志，本轮在旧门禁手机端也遇到一次同类超时，触发条件仍未确定。修正门禁后，两个场景在每个视口连续三轮通过。独立 Chrome 对四份原始源码完成 16 次业务回放，共 76 个步骤。真人审美评测为 **PENDING，0 份投票**。

## 冻结范围

从工作区 surfacelive 及其产品子目录分别运行 `git rev-parse --show-toplevel`，均返回 128，向上没有找到 Git 仓库。采用 K-01 已有的 SHA-256 标识。四份源码各含 HTML、CSS、JS，逐文件对照原始清单；8 次 Agent 输入对照原提示词字节与回执，其中两次 A-current 首稿各有三个阶段。16 张评审截图逐一对照当时的截图哈希。目录内同时保留知识检索索引、方案选择、首次失败、宿主门禁截图与独立浏览器复查。两份 A-current 源码均取自当时被门禁拦下的 attempt。[K-01 清单](../../runs/K-01/verified-manifest.json)

| 场景 | A0 源码 SHA-256 前 12 位 | A-current 源码 SHA-256 前 12 位 |
|---|---|---|
| 知时 | [1bfcd9850a66](../../runs/K-01/zhishi/A0/source/index.html) | [42a87e7c6f11](../../runs/K-01/zhishi/A-current/attempt/index.html) |
| 招聘复核 | [ed88bbcca46e](../../runs/K-01/recruiting/A0/source/index.html) | [b74ec45768b6](../../runs/K-01/recruiting/A-current/attempt/index.html) |

冻结清单覆盖 runs/K-01 下的 95 个文件，归档 SHA-256 为 `219033853fe27851f27c8edd7d98e0626f3e216300964595039881bf25ce8d37`。复核脚本会检查原目录、归档和 K-01 已有哈希三者的一致性。K-01 外置运行时仍在原位置，每次宿主回放先核对其 46 个文件，再复制到临时目录。诊断和修正只作用于运行时副本。[逐文件哈希与 Git 探测](../../runs/K-02A/organizer/freeze.json) · [运行时清单](../../runs/K-01/runtime-sha256.json)

## 原始失败与独立复查

以下为 A-current 的 Electron 宿主门禁，通过数按完整业务旅程计算。知时检查提交查询、展开理由及保存，招聘检查搜索、证据和复核。桌面为 1440 × 900，手机为 390 × 844。三轮回放轮换先测的视口，使用临时预览环境。第二轮在招聘输入处记录事件，第一、三轮保留无前置探针的路径。

| 场景与视口 | K-01 首次 | K-02A 原门禁，通过 / 3 | 最终修正门禁，通过 / 3 | 对首次失败的判定 |
|---|---|---:|---:|---|
| 知时桌面 | 日期与时段断言失败 | 0/3 | 3/3 | 断言误拒可用结果 |
| 知时手机 | 同上 | 0/3 | 3/3 | 同一断言问题 |
| 招聘桌面 | 搜索后未观测到 1 人 | 3/3 | 3/3 | 偶发，桌面本轮未复现 |
| 招聘手机 | 通过 | 2/3 | 3/3 | 原门禁第三轮出现同类超时 |

[知时首次 Trace](../../runs/K-01/zhishi/A-current/attempt/design-trace.json) · [招聘首次 Trace](../../runs/K-01/recruiting/A-current/attempt/design-trace.json) · [K-01 招聘宿主复查](../../runs/K-01/recruiting/A-current/host-replay.json) · [K-02A 原门禁逐轮记录](../../runs/K-02A/tests/original-boXh08/results.json) · [最终修正门禁逐轮记录](../../runs/K-02A/tests/corrected-ZPO6MT/results.json)

### 知时的日期属于哪一个时段

原页面用一个 section 包住一个日期，h2 显示日期，多个 article 各自显示时段。首稿的 11 月 24 日组确实含有 09:00–11:00。旧断言在结果容器里查找一段连续文本，组标题与候选行之间的其他文字足以造成失败。[页面分组与行构造](../../runs/K-01/zhishi/A-current/attempt/app.js) · [K-01 独立 DOM 与业务复查](../../runs/K-01/zhishi/A-current/verification/results.json)

门禁现在对该月日加时段格式核验可见记录及其所属日期组，按该组内前面的可见标题定位日期；同一候选行内连续呈现的日期与时间也受支持。原有业务状态变化检查继续执行。6 个独立 DOM 对照覆盖正确组、同一时间出现在其他组、隐藏时段、说明文字中恰有整句，以及同一记录跨标签呈现等情况。6/6 与预期相符。对照在空白测试页运行，真实页面的通过数单独计算。[门禁实现](../../desktop/interaction-check.mjs) · [对照与真页回放脚本](../../experiments/k02a/replay.mjs)

### 招聘为何首检失败、回放通过

| 调查项 | 观察与判断 |
|---|---|
| 异步加载 | 候选列表来自首稿内的 8 条本地数据。search 的 input 监听同步调用 refreshFilter 和 buildRows。补充来源任务的进度更新有独立逻辑。观测轮输入前文档为 complete，列表已经显示 8 人。 |
| 定位器 | 观测轮的搜索入口唯一。鼠标事件命中 search，成功轮记录了获焦、输入「林岚」、计数变为 1；独立业务回放还打开了匹配人选的证据。 |
| 等待与焦点 | 旧门禁发送按下、抬起后立即执行 selectAll 和 insertText，随后只轮询结果。旧版失败轮只能证明在期限内没有观察到预期计数，缺少失败瞬间的焦点、输入值和行内容。输入焦点交接是可检验的解释，尚未证实为根因。新版等待目标实际获焦，并记录输入值是否匹配，再按原有结果条件等待。 |
| 状态残留 | 首稿将复核结论保存在本地。K-02A 观测轮开始时持久化记录为 0、查询值为空；独立 Chrome 每次新建上下文并检查存储为空。额外 24 次旧门禁招聘回放只在旅程结束后读取 DOM，两端各 12/12 通过。失败没有稳定跟随桌面、搜索词或先测顺序。 |

对这两个事件，已确认一项测试断言缺陷，另有一项偶发超时，没有证据将其归为候选搜索功能失效。若再现招聘超时，优先在失败时留存活动元素、输入值是否匹配、结果计数及行数，才能进一步区分输入未送达与回读失败。[首稿搜索与持久化代码](../../runs/K-01/recruiting/A-current/attempt/app.js) · [24 次诊断回放](../../runs/K-02A/tests/diagnose-hgdXWw/results.json)

## 独立业务验收与真人评审

Chrome 从已校验的本地源码载入，阻止外部资源，每版每端新建上下文运行两次。四个场景与组别组合各通过 4/4，共计 16/16、76 个业务步骤，无记录到的页面或控制台错误。知时涵盖实际输入、换日期范围、候选及理由、保存与刷新回读，A0 另测两项比较。招聘涵盖岗位、按人名筛到唯一结果、打开证据、筛选排序、人工复核与刷新回读、搜索任务状态。业务端点与视口限定了本次结论的范围。[全部业务步骤及实际观测值](../../runs/K-02A/tests/business-eJnzk3/results.json)

评审包用 16 张 K-01 原图组成 8 对，每对的场景、视口和任务阶段一致。匿名图片与原图哈希逐一相等，解压后的离线表单检查通过。两稿原有的样例文案、查询资料和手机滚动位置有差异。交付给评价者的只有 ZIP，映射由组织者单独保管。比较项、记录口径及待补知识见另两份报告。[真人评审包](../../runs/K-02A/reviewer.zip) · [离线检查](../../runs/K-02A/tests/packet-check.json) · [使用指南](K-02A_HUMAN_REVIEW_GUIDE.md) · [设计知识缺口](K-02A_KNOWLEDGE_GAPS.md)

## 复核命令与变更边界

在含 package.json 的 SurfaceLive_LiveEngine_DevStart 目录执行下列命令。宿主需要本机 Electron，独立业务与评审包检查使用本机 Chrome。回放命令将结果写入新的运行目录；冻结脚本对已存在的封存只做核验。

```sh
git rev-parse --show-toplevel
python3 experiments/k02a/freeze.py
node_modules/.bin/electron experiments/k02a/replay.mjs original
node_modules/.bin/electron experiments/k02a/replay.mjs diagnose
node_modules/.bin/electron experiments/k02a/replay.mjs corrected
node experiments/k02a/business-check.mjs
python3 experiments/k02a/review.py
node experiments/k02a/check-packet.mjs
npm test
```

运行路径中仅修改 desktop/interaction-check.mjs 的验收逻辑。实验脚本位于 experiments/k02a，证据位于 runs/K-02A，三份文档位于 docs/live-engine。最终门禁文件 SHA-256 为 `bf78e2220240c51e71b90f344197c6a0da14d3e0971b4ec3d5e5264128ba727c`，两次开发中途的回放也分别保留。现有自动化套件 32/32 通过。未重新生成页面，没有改动工作台界面、用户项目、检索权重或历史实验记录，也未提交、推送或部署。[自动化测试日志](../../runs/K-02A/tests/npm-test.log)
