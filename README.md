# SurfaceLive · Live Engine

SurfaceLive 是基于 Electron 的本机前端创作工具。桌面应用使用 Live Engine 的知识检索和艺术指导，调用已登录的 Codex CLI 或 Claude Code，生成可操作的 HTML、CSS 和 JavaScript 页面。

## 使用桌面应用

在本机 Mac 上双击 `dist/SurfaceLive-darwin-arm64/SurfaceLive.app`。标题栏中的每个标签对应一件作品。点击 ＋ 新建，点击 × 关闭标签。新标签的项目对话里可重新打开已有作品和有内容的草稿。在标签之间切换时，当前页面的输入和预览状态会保留，重启后恢复上次打开的标签。

在对话中输入使用者、业务场景和主要操作。“自动判断”会结合描述选择终端，也可在检查器的页面属性中指定桌面、平板或手机。生成后可在实时预览中实际操作，切换视口，查看设计依据，或继续描述修改。每次成功保存一个版本。从旧版本或内置示例出发修改时，会保留原件。

左侧是项目对话。输入框支持粘贴、拖入或选择参考图片。点击输入框下方的「框选截图」，在预览中拖出矩形，松开即可将该区域加入对话，按 Esc 可取消，旁边的「引用」可以点选一个页面元素。底部的 Agent 菜单可切换本机 CLI、搜索模型并选择推理强度。发送时，图片作为视觉输入交给所选模型。

点击预览上方的「选择元素」，再点页面里的按钮、输入框或文字。检查器显示选中对象的层级、实际尺寸、颜色、字号、内距和交互属性，也可选择父元素。修改立即反映在页面上。「保存样式版本」会将修改写入 CSS，「撤销调整」会还原本轮手调。点击「项目对话」旁的历史图标可切换版本。

右上角齿轮打开工作台设置。在「通用」中可以切换浅色、深色或跟随系统，也可以将项目对话放到左侧或右侧。检查器随对话移动到另一侧。侧栏标题上的开关可收起面板，预览工具栏同侧的开关可将它展开。拖动分隔线或使用方向键可调整宽度。预览缩放菜单内有适应窗口、100%、10%–300% 自定义缩放和专注预览。

首次打开时可以直接体验两个作品：在桌面版「招聘复核工作台」中比较候选人，在手机版「巷口放映」中切换日期、查看余位并报名。后者来自桌面应用使用本机 Codex 的真实生成记录。

本机 CLI 的登录、模型权限和费用沿用对应服务的设置。界面的检测表示找到了可执行文件，认证与额度由实际生成请求确认。模型设置留空会使用 CLI 当前的默认模型。使用自定义 CLI 路径时可在启动环境中设置 `SURFACELIVE_CODEX_EXEC` 或 `SURFACELIVE_CLAUDE_EXEC`。

在「设置 → 通用 → 存储位置」可以查看并打开作品保存目录，macOS 默认使用 `~/Library/Application Support/SurfaceLive/revisions/`。点击「打开当前版本」可直接找到这个版本的 `index.html`、`styles.css` 和 `app.js`。项目对话旁的版本记录也有这个入口。内置示例位于应用包中，从示例生成或手动保存的版本写入作品目录。

「更改…」使用系统文件夹选择器。之后生成或手动保存的版本写入选定目录，已有版本留在原处，重启后仍可从工作台打开。「以前的保存位置」列出已使用的目录。右上角的导出图标可将当前版本的源码另存一份。

桌面、平板和手机预览使用各自的浏览器视口。Live Engine 在生成中记录场景依据、实际检索的知识和艺术方向，用桌面与手机的真实截图比较候选，并检查主要业务操作。可在作品的版本目录中打开 `design-trace.json` 查看各阶段的输入、输出、截图和修复。人工盲评与模型判断分别记录。[桌面链路审计](docs/LIVE_ENGINE_BATCH_1_AUDIT.md) · [设计、验证与反馈](docs/LIVE_ENGINE_DESIGN_PIPELINE.md)

## 从源码运行

~~~sh
npm ci
npm run desktop
~~~

打包当前系统的应用可运行 `npm run desktop:package`。构建脚本将引擎代码、已审核知识数据和内置示例复制到应用中。知识工厂更新后重新构建即可使用新快照。当前 Mac 构建使用本地 ad-hoc 签名，供本机运行。

开发测试使用 `npm test`。打包后可运行 `node desktop/tests/editor.mjs` 验证选区、截图草稿、手调和导出，运行 `node desktop/tests/smoke.mjs` 验证桌面生成流程；它会在 runs 下建立隔离测试资料。添加 `--live` 将调用本机 Codex 生成一份真实作品，使用模型配额。测试脚本默认寻找当前项目的 macOS ARM64 构建，其他路径可用 `SURFACELIVE_TEST_APP` 指定可执行文件。

## B1 知识工厂

本批结果见 [B1 实测记录](docs/B1_RESULTS.md)。当前可运行入口是 [采集、复核与检索手册](live-engine/ingestion/README.md)。已新增十份有来源和 SHA-256 的视觉观察，以及逐份提炼的十条规则。运行 `npm ci`、`npm test` 和 `npm run knowledge:check` 可复核工程及索引。后文描述起步包交付时的基线。

## 起步包的实验基线

- 复用设计知识的原始卡片、来源、已检查的 OpenFilm 视觉范例和检索逻辑（原样保留于 `live-engine/knowledge`）。
- 为三个真实场景固定任务、用户、状态及反例：招聘工作台 / coRoof / 附近事项。
- 生成 A0、A1、A2 三种输入：**相同功能契约、不同设计知识强度**。
- 使用当前电脑上**已安装并获得授权**的 Claude Code/Codex CLI，分别生成 `index.html / styles.css / app.js`，每组独立目录。
- 实施源码结构静态检查；可选 `playwright-core` 在真实浏览器测试桌面/移动布局、脚本异常及主按钮状态反馈，并保存截图。
- 保留提示词、输出文件、执行状态、审计结果和人工盲评模板；没有截图或人工评审时绝不声称达到高审美或生产级。

**没完成**：大量视觉案例采集、审美盲评、视觉批评 Agent、局部框选编辑、统一 Interface Document、React/Vue 多框架无损导出。这些放在后续 Batch，详见文档。

## 环境

- Node.js 22.16+（建议 22.18+）。本包在旧版 Node 22 上使用 `--experimental-strip-types`，可能出现实验特性警告。
- macOS/Windows/Linux 任一系统；使用者安装、登录 Claude Code 或 Codex CLI，并授权当前实验运行。
- 真实截图需要 Chrome/Chromium 和 `playwright-core`；可设置 `CHROME_BIN=/绝对路径`。
- 模型不一定在本机离线计算；调用可能产生订阅配额/API 费用。**测试/plan 模式默认不花模型费用**。

## 操作顺序（在工程根目录）

```bash
npm test
npm run knowledge:check
npm run knowledge:bench

# 1. 只生成 3 个实验提示词，不调用模型
npm run bench:plan -- --scenario recruiting --variant all

# 2. 检验调度和输出文件流程；mock 不是 AI，也不会生成优质 UI
npm run bench:mock -- --scenario recruiting --variant all

# 3. 已登录 Claude Code CLI 后，手动开启真实 A0/A1/A2 生成
npm install
npm run bench:run -- --scenario recruiting --variant all --agent claude --browser

# 或选择已登录的 Codex CLI
npm run bench:run -- --scenario recruiting --variant all --agent codex --browser
```

其他场景：`--scenario coroof` 或 `--scenario neighborhood`。
只跑单组：`--variant A0`、`--variant A1`、`--variant A2`；所有组：`--variant all`。输出到 `runs/<场景>-<时间>-<随机值>/`（每次全新，不覆盖）。

**注意**：`npm install` 需要网络；如果未安装 `playwright-core` 或没有可启动的浏览器，状态会明确标为 `not-run` 或 `failed`，不伪装成已验收。某些系统上需要手工在终端 `claude -p 'hi'` 或 `codex exec 'hi'` 检查登录，实际调用需要真实用户授权。V0.2 的 OpenFilm 式桌面程序发现/ACP 连接实验仍保留在独立旧 PoC，不在本实验重复扩充。

## 如何判断是否真的改善审美

运行一次 `--variant all` 后，将 A0/A1/A2 的截图**匿名重命名**并交给不知道条件的评审者：

- 先验收任务路径、真实交互和错误状态是否成立，否则直接不合格。
- 再按层级、构图、字体、色彩、场景契合、原创性与动效进行成对盲评。
- 记录首选哪一版、原因和显著问题。不能用模型给自己的 90 分证明有效。
- 统计至少三个不同业务场景和多次不同随机运行的胜率。单次页面看起来漂亮只是案例，不能证明引擎优越。

## 目录结构

```text
live-engine/knowledge/  原有知识数据、检索器、测试与一张已检视觉范例
experiments/scenarios.ts  三个真实固定场景
experiments/prompts.ts    A0/A1/A2 生成条件
experiments/agent.ts      实际本机 Claude/Codex CLI 调用
experiments/verification.ts  静态+可选真实浏览器检查
experiments/runner.ts     运行、隔离、报告、盲评模板
experiments/cli.ts        plan / mock / run 命令
experiments/tests/       可运行的流程断言
docs/                    工程顺序、数据架构和 Codex 下一批任务书
runs/                    本机执行产物（不纳入源码分发）
```

完整路线：`docs/DEV_ROADMAP.md`；直接复制给 Codex 的后续任务：`docs/CODEX_BATCH_01.md`。
