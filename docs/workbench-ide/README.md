# SurfaceLive 工作台实机评审

在 macOS ARM64 上运行项目内的 SurfaceLive.app。改动前后分别使用空白测试资料目录，打开同一份招聘工作台和周末放映单。两组截图中的业务页都可以实际操作。原生窗口图包含 macOS 窗口按钮。[打开客户端](../../dist/SurfaceLive-darwin-arm64/SurfaceLive.app) · [桌面原生窗口](after/desktop-native.png) · [手机作品及真实对话](after/conversation-native.png)

## 实际界面

除单独标注外，窗口为 1555 × 992 逻辑像素，缩放均为适应窗口。桌面页的 CSS 视口为 1440 × 900，手机页为 390 × 844。默认行体现两版各自的启动设置，接下来的两行固定检查器开关，便于比较。

| 操作状态 | 改动前 | 本版 | 预览显示宽度 |
| --- | --- | --- | --- |
| 桌面默认布局 | [截图](before/desktop-default.png) | [截图](after/desktop-default.png) | 918 → 1235 px |
| 桌面，检查器展开 | [截图](before/desktop-inspector.png) | [截图](after/desktop-inspector.png) | 918 → 955 px |
| 桌面，检查器收起 | [截图](before/desktop-preview.png) | [截图](after/desktop-preview.png) | 1198 → 1235 px |
| 选择“模拟匹配”按钮 | [截图](before/selected.png) | [截图](after/selected.png) | 918 → 955 px |
| 手机放映单，检查器收起 | [截图](before/mobile.png) | [截图](after/mobile.png) | 356 → 390 px |
| 桌面，1280 × 800，检查器收起 | [截图](before/desktop-1280.png) | [截图](after/desktop-1280.png) | 925 → 960 px |
| 桌面，1920 × 1080，检查器收起 | [截图](before/desktop-1920.png) | [截图](after/desktop-1920.png) | 1373 → 1440 px |
| 专注预览 | [截图](before/focus.png) | [截图](after/focus.png) | 1232 → 1357 px |
| 新建作品 | [截图](before/empty.png) | [截图](after/empty.png) | |
| Agent 与模型选择 | [截图](before/agent.png) | [截图](after/agent.png) | |

拖出矩形时可见选区和遮罩，松开后局部图像进入对话。另一项真实模型测试使用一个可复用的按钮引用和一张含随机字样的测试图片。本机 Codex 在测试作品中将按钮改为图中的 “TIDE 9209”。[框选过程](after/crop-selection.png) · [AI 修改中](after/ai-editing.png) · [实际结果](after/ai-result.png) · [模型与引用记录](after/ai-result.json)

## 设计取舍

- 参照 IntelliJ IDEA 将项目动作放在窗口标题栏、局部动作留在相应工具区的做法。左上显示当前项目、切换与新建，右侧是面板开关、专注与源码导出。工作区移除了自绘标志、重复字标、叠纸和引擎署名。macOS App Icon 继续使用现有资源。[IntelliJ IDEA 的工具栏图标](https://www.jetbrains.com/help/idea/icon-reference.html) · [官方标题栏实图](https://resources.jetbrains.com/help/img/idea/2026.3/new_ui_window_header.png)
- 操作图标使用 Microsoft Codicons 的 16px 图形。本地补绘了桌面、平板和矩形截图，适配设备切换与局部引用。工具按钮的点击区通常为 26–28px，常用的两个预览模式保留文字，支持悬停提示、键盘焦点、按下、选中和禁用状态。[VS Code 产品图标](https://code.visualstudio.com/api/references/icons-in-labels) · [项目内授权](../../desktop/ui/codicons-LICENSE.txt)
- 输入区沿用 OpenFilm 截图中的紧凑组织。输入与发送共用一行，多行内容自动增高，下方集中模型、附图、矩形截图和元素引用。菜单只显示本机能取得的 CLI 与模型信息。[OpenFilm 对话模型菜单源码](https://github.com/openfilm/openfilm/blob/a1b8d751f8979f0175902ddf113e5e14c5ea71c8/apps/desktop/chat/src/components/ModelPopover.tsx)
- 右侧属性跟随实际选区。它显示元素名、真实祖先节点和样式值，预览用同一个元素的边框与标签标记位置。主动打开检查器的偏好会保留，由选择模式临时展开的检查器在退出选择时收起。[Blender 属性栏实图](https://docs.blender.org/manual/en/latest/_images/editors_properties-editor_interface.png) · [选中态](after/selected.png)

## 验证

- 核心测试 21/21、附件协议测试 1/1、知识库校验、TypeScript no-emit、渲染脚本语法和桌面构建通过。TypeScript 按 ESNext 与 Bundler 模块解析检查了 experiments、knowledge 和 ingestion。
- 工作台脚本检查 19 个状态，密度脚本检查 11 个状态，另验证了真实生成作品的对话视图。三个目标窗口均为原生内容尺寸，另测 960 × 640、聚焦、100%、82.5% 自定义缩放与键盘调宽。所有测量的面板溢出列表为空。控制台记录中有一次测试刻意注入的页面故障，重载恢复通过。[工作台记录](../../runs/ide-workbench/verification/metrics.json) · [密度记录](../../runs/ide-workbench/density/after/metrics.json) · [对话记录](after/conversation-metrics.json)
- 手调、引用、草稿恢复、历史切换、取消、Agent 失败与离线、源码导出和重启回读通过。Retina 屏上拖出 160 × 86 的选区，所得图片为 320 × 172，逐通道像素平均绝对差为 0.28（0–255）。[编辑测试](../../runs/ide-workbench/editor.log) · [导出与重启](../../runs/desktop-smoke-l1kqQQ/verification.json)
- 与恢复基线的打包快照核对，22 个对应的非工作台文件字节一致，覆盖 Live Engine、知识数据、Agent 桥接、项目存储与两个内置业务页面。包内 App Icon 与原有 icns 字节一致。
- 本机磁盘余量不足以通过默认打包流程再次解压 Electron。交付包使用同一已安装的 Electron 45.4.1 ARM64 运行时和项目的 Electron Packager。在临时内存盘完成本机签名后，通过 `codesign --verify --deep --strict`。验收从交付的应用包启动。

## 文件

| 位置 | 改动 |
| --- | --- |
| [index.html](../../desktop/ui/index.html) · [studio.css](../../desktop/ui/studio.css) · [editor.css](../../desktop/ui/editor.css) | 窗口、输入区、预览、属性与各类按钮 |
| [studio.js](../../desktop/ui/studio.js) · [editor.js](../../desktop/ui/editor.js) | 设备与缩放、面板偏好、对话引用、菜单键盘操作及选区呈现 |
| [action-icons.js](../../desktop/ui/action-icons.js) · [codicons-LICENSE.txt](../../desktop/ui/codicons-LICENSE.txt) | 随应用离线加载的动作图标及授权 |
| [preview.mjs](../../desktop/preview.mjs) · [inspector.mjs](../../desktop/inspector.mjs) | 加载工作台图标、预览内退出专注、显示真实元素层级 |
| [workbench.mjs](../../desktop/tests/workbench.mjs) · [density.mjs](../../desktop/tests/density.mjs) · [editor.mjs](../../desktop/tests/editor.mjs) · [smoke.mjs](../../desktop/tests/smoke.mjs) | 改用实际入口，验收回焦、面板偏好、真实修改和导出 |
| [使用说明](../../README.md) · [截图脚本](../../runs/ide-workbench/capture.mjs) · 本目录 | 操作路径、复测脚本、原始截图与测量数据 |

当前 1280 × 800 窗口中，桌面页在单侧栏、适应窗口时是 66.7%。需要逐像素检查可使用专注预览及 100% 缩放。此次实机验收平台为 macOS ARM64，实际模型调用覆盖 Codex，Claude 的图像协议使用本地测试验证。[改动前测量](before/states.json) · [本版测量](after/states.json)
