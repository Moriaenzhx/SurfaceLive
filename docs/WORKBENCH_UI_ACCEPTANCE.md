# SurfaceLive 0.3 工作台验收

## 窗口与可读性

对同一份招聘复核工作台进行前后对照。每次以独立用户资料启动 Electron。生成页面使用原来的 HTML、CSS 和 JavaScript，默认桌面 CSS 视口始终是 1440 × 900。下表的比例表示一个页面 CSS 像素在预览窗口中的显示比例。

| 窗口 | 修改前 | 修改后 | 修改前截图 | 最终打包版截图 |
| --- | ---: | ---: | --- | --- |
| 1555 × 992 | 64% | 86.3% | [原工作区](workbench-ui/before-workspace-1555.png) | [新工作区](workbench-ui/workspace-1555.png) |
| 1280 × 800 | 51% | 67.2% | [原工作区](workbench-ui/before-workspace-1280.png) | [新工作区](workbench-ui/workspace-1280.png) |
| 1920 × 1080 | 89% | 91.7% | [原工作区](workbench-ui/before-workspace-1920.png) | [新工作区](workbench-ui/workspace-1920.png) |

最终三组验收均使用上述实际 Electron 内容区尺寸。基线的两组高窗口受 macOS 工作区 960px 高度限制，使用同一运行窗口的 Chromium 视口覆盖补足高度。截图为实时客户端内容，不含系统绘制的 macOS 交通灯。最终验收使用启动参数允许原生窗口超过当前显示器工作区，正常启动沿用系统窗口尺寸限制。[基线测量](workbench-ui/baseline-metrics.json) · [最终测量](workbench-ui/metrics.json)

## 审计与设计决定

- macOS 窗口使用 Electron 的 `hiddenInset` 与系统窗口按钮。保留原品牌标记，将标题栏统一到 46px，项目名兼作真实项目切换器。
- 原布局让两个侧栏常驻，预览盒在剩余高度内居中。1555 窗口的页面顶边原在 y=249，现在为 y=114。左侧通常为 288px；1700px 以下首次使用时收起检查器，宽屏默认展开。用户可独立调整、折叠两侧，工具栏「选择」会唤出检查器。
- 原有 `surface-page://` iframe 继续运行作品。桌面、平板、手机分别提供 1440、834、390 CSS 像素宽的视口。适应窗口、100% 和 10%–300% 自定义缩放只改变显示比例。大于可用区域时可滚动查看。
- 参考了 OpenFilm 的输入框与上下文检查器分工。左侧保留项目需求、真实版本消息、选区及图片引用，底部只有一个输入框。取消重复的页面大缩略图。右侧只显示当前版本或实际选区的信息。[OpenFilm 对话组件](https://github.com/openfilm/openfilm/tree/a1b8d751f8979f0175902ddf113e5e14c5ea71c8/apps/desktop/chat/src/components) · [OpenFilm 检查器](https://github.com/openfilm/openfilm/blob/a1b8d751f8979f0175902ddf113e5e14c5ea71c8/packages/openfilm/studio/ui/src/components/InspectorWorkspace.tsx)
- 使用冷灰工作区、白色面板与低对比分隔。沿用原来的线性图标，集中定义字体、颜色、间距、圆角、工具栏和底栏尺寸。品牌蓝用于交互重点和选区反馈。

## 能力与证据

| 实际任务 | 结果 |
| --- | --- |
| 聚焦查看大页面 | 关闭两侧，在 100% 下测得预览元素宽 1440px。82.5% 自定义缩放时是 1188px，此时 iframe 内仍宽 1440px。[聚焦原大](workbench-ui/focus-100.png) · [自定义缩放](workbench-ui/custom-zoom.png) |
| 操作招聘页面 | 触发模拟匹配后读取业务反馈，输入候选人姓氏并筛选。手机和平板切换直接改变 iframe 视口。[搜索](workbench-ui/live-search.png) · [手机](workbench-ui/mobile.png) · [平板](workbench-ui/tablet.png) |
| 选择、引用与微调 | 点选按钮，读取 DOM 祖先、实际颜色及尺寸。验证百分比和 px 宽度、文字颜色、引用加入消息、未保存提示。检查器支持布局、排版、外观、间距、只读交互信息。[选中并调整](workbench-ui/selection.png) · [独立设计依据](workbench-ui/evidence.png) |
| 新建与发送 | 唯一主要动作聚焦已有输入框，示例场景会填入同一个输入框。[旧空状态](workbench-ui/before-empty.png) · [新空状态](workbench-ui/empty.png) |
| 图片驱动的真实修改 | 独立电影报名页中，Codex 读取参考图上的随机字符串，将引用的按钮改为 TIDE 1693。未把该字符串写在请求文字中。[框选截图](workbench-ui/crop-selection.png) · [Agent 菜单](workbench-ui/agents.png) · [真实结果](workbench-ui/vision.png) · [调用记录](workbench-ui/vision-verification.json) |
| 保存、历史与导出 | 对未保存的样式执行导出，生成了有父版本的新版本与三份源码。核对了导出 CSS 中的颜色，导出 HTML 与原招聘页面字节相同。[导出完成](workbench-ui/export.png) |
| 异常与恢复 | 隔离版本的脚本异常定位到 app.js 行号，修复该版本后「重新载入」恢复。使用测试 CLI 制造等待与调用失败，再提供不存在的 CLI 测试离线。以上故障均限定在测试资料中。[页面载入](workbench-ui/preview-loading.png) · [运行错误](workbench-ui/preview-error.png) · [生成中](workbench-ui/generation-loading.png) · [调用失败](workbench-ui/agent-error.png) · [CLI 不可用](workbench-ui/agent-offline.png) |
| 窄窗口与键盘 | 在 960 × 640 下同时显示两侧，工具栏与面板未横向溢出。检查了分隔线方向键、输入框焦点、Enter 应用缩放及 Esc 取消截图。[最小窗口](workbench-ui/minimum-both-panels.png) |

## 分批记录

改动前先构建并启动原工程。Batch 1 至 Batch 4 每批均重新构建、启动、截图和检查后再进行下一批。Batch 5 验收实际打包应用。

| 阶段 | 验收截图 |
| --- | --- |
| Batch 1 布局、侧栏与缩放 | [1555 窗口](workbench-ui/batch1.png) |
| Batch 2 标题栏、设计变量与底栏 | [1920 窗口](workbench-ui/batch2.png) |
| Batch 3 选择、属性、引用及导出 | [真实选区](workbench-ui/batch3.png) |
| Batch 4 空状态与故障恢复 | [故障窗口](workbench-ui/batch4.png) |
| Batch 5 正式包验收 | [窗口与布局测量](workbench-ui/metrics.json) |

## 自动化与边界

- `npm test` 的 21 项测试全部通过。Claude 图片消息协议的 1 项独立测试通过。本次在线视觉修改验证使用 Codex。
- `npm run desktop:build`、`npm run desktop:package`、macOS 深度签名验证与 `npm run knowledge:check` 通过。正式包为 macOS Apple Silicon 本机 ad-hoc 签名版本。
- 使用 TypeScript 5.9.3 对 experiments 和 live-engine 的全部 TS 文件执行 `--noEmit --target ES2023 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types node --skipLibCheck`，通过。仓库没有 tsconfig 或固定版本的 TypeScript 编译器。另用 NodeNext 解析规则时，原 ingestion/capture.ts 的 robots-parser 导入仍有两处既有类型错误。桌面工作台是 JavaScript，其验证包括实际 Electron 构建、语法与运行验收。
- 现有桌面 smoke 流程通过，包括新建、版本切换、取消、失败、源码导出、附件复用和重启恢复。编辑流程验证了按钮与表单、框选截图、样式导出、草稿恢复和真实的图片修改。[桌面回归结果](workbench-ui/smoke-verification.json)
- 三个目标尺寸及最小窗口均检查工作台和面板横向溢出。正常路径未观察到未处理异常。测量 JSON 中的 WORKBENCH_PREVIEW_CHECK 是验收脚本主动写入隔离副本的已知错误。
- 招聘工作台三个源文件改前改后 SHA-256 一致。HTML 为 cd3b92ea38f5625ea8b8cf7239578007ada11bdfa3134b87247f97cb4a166b31，CSS 为 b9d47e3957b83a33416812eabd7adc4e4581de3da6f5652f82cab620c0538f14，JS 为 7683d3deed7b3270660aa2d3fe394a1a326d457df3ca85999ac66f83d2290938。
- 当前每个作品有一个真实页面入口及多个版本。元素点选和矩形截图已实现；区域多选、事件处理器编辑及多页面路由管理尚未实现。交互组读取元素可观察属性。CLI 检测代表本机找到了可执行文件，账户和额度由生成请求确认。
- 窄窗口双栏同时打开仍会降低适应比例。精读 1440px 页面时可收起侧栏或使用 100% 滚动查看。本轮未包含独立用户可用性研究或跨平台验收。

## 修改文件清单

| 文件 | 范围 |
| --- | --- |
| `desktop/ui/index.html` | 在原工作区内整理标题栏、项目入口、操作模式、缩放、属性、空态、错误态及状态栏 |
| `desktop/ui/studio.css`、`desktop/ui/editor.css` | 设计变量、布局、控件、大小适配、选区与交互反馈 |
| `desktop/ui/studio.js` | 面板、缩放、项目状态、预览诊断、导出及快捷操作 |
| `desktop/ui/editor.js` | 对话历史、真实选区、属性与单位、引用、手动样式草稿 |
| `desktop/inspector.mjs` | 基于现有元素映射读取层级、属性、边界和交互信息，验证 CSS 写入 |
| `desktop/preview.mjs`、`desktop/preload.cjs`、`desktop/main.mjs` | 预览运行诊断、错误通道、原生窗口尺寸与系统按钮位置 |
| `desktop/build.mjs` | 桌面应用版本 0.3.0 |
| `desktop/tests/workbench.mjs` | 新增分批真实窗口截图、尺寸、交互、异常与导出验收 |
| `desktop/tests/editor.mjs`、`desktop/tests/smoke.mjs` | 通过改版后的操作模式和检查器入口执行原有回归 |
| `README.md` | 更新工作台使用说明 |
| `docs/WORKBENCH_UI_ACCEPTANCE.md`、`docs/workbench-ui/` | 本报告、原始截图与测量证据 |
