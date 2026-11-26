# SurfaceLive 工作台布局与密度验收

## 同条件实拍

窗口为 1555 × 992。每一行固定同一份页面源码、CSS 视口、适应窗口模式和检查器开关。桌面为招聘复核工作台，手机为巷口放映。普通对照由打包后的 macOS ARM64 客户端采集，PNG 为逻辑像素尺寸。原生窗口对照保留了系统按钮及 Retina 分辨率。

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 放映单原有对话，含一条相同的待发输入 | [原生窗口](before/conversation-native.png) | [原生窗口](after/conversation-native.png) |
| 上图输入区的同位置裁切 | [输入区](before/composer.png) | [输入区](after/composer.png) |
| 招聘复核，检查器收起 | [桌面预览](before/desktop-closed.png) | [桌面预览](after/desktop-closed.png) |
| 招聘复核，检查器打开 | [桌面与检查器](before/desktop-open.png) | [桌面与检查器](after/desktop-open.png) |
| 招聘复核，选中“模拟匹配”按钮 | [按钮属性](before/desktop-selection.png) | [按钮属性](after/desktop-selection.png) |
| 周末放映单，检查器收起 | [手机预览](before/mobile-closed.png) | [手机预览](after/mobile-closed.png) |
| 周末放映单，检查器打开 | [手机与检查器](before/mobile-open.png) | [手机与检查器](after/mobile-open.png) |
| 招聘复核，1280 × 800 | [较小窗口](before/desktop-1280.png) | [较小窗口](after/desktop-1280.png) |
| 招聘复核，1920 × 1080 | [较大窗口](before/desktop-1920.png) | [较大窗口](after/desktop-1920.png) |

对话截图回放的是此项目已有的本机 Codex 放映单生成记录。两次回放使用同一 Electron 版本、同一份原始版本文件和同一句草稿，分别载入修改前源码快照和最终构建。其余桌面和手机对照使用各自版本的 SurfaceLive.app。全部验收使用隔离测试资料。

## 实测比例

| 1555 × 992 | 修改前 | 修改后 |
| --- | --- | --- |
| 左栏默认宽度 | 288px | 288px，允许 272–312px |
| 右栏展开宽度 | 288px | 280px，允许 248–304px |
| 标题栏 / 预览工具栏 / 状态栏 | 46 / 42 / 25px | 48 / 42 / 24px |
| 单行输入框 / 底部整个输入区 | 106 / 155px | 38 / 81px |
| 收起检查器，桌面页面显示宽度 | 1243px，86.3% | 1251px，86.9% |
| 两侧展开，桌面页面显示宽度 | 955px，66.3% | 971px，67.4% |
| 手机视口 / 视觉缩放 | 390 × 844，99.9% | 390 × 844，100% |

双栏展开时中央工作区宽 987px，占窗口的 63.5%。收起检查器后为 1267px，占 81.5%。聚焦模式以实际大小检查 1440px 页面。最小 960px 窗口允许临时缩窄面板并独立折叠。[聚焦预览](after/focus-100.png) · [最小窗口](../../runs/density-20261120/workbench/minimum-both-panels.png) · [修改前测量](before/metrics.json) · [修改后测量](after/metrics.json)

## 退化定位与处理

此目录及其上层工程没有 Git 元数据，交付 ZIP 也没有桌面工作台源码。能追溯的资料为上次留存的截图、基线测量、本轮开始时的已打包客户端和与包内完全一致的五个工作台源码文件。本轮逐文件保存快照，使用 Git 的目录对比生成补丁。上次重构之前的逐提交归因无法验证。[早期截图](../workbench-ui/before-workspace-1555.png) · [上次交付截图](../workbench-ui/workspace-1555.png) · [本轮源码与测试差异](workbench.patch)

- **侧栏占宽。** 旧实现允许拖至 440px 并保存，宽度达到 1700px 会自动打开检查器，选择元素打开右栏也会写入可见性偏好。现在启动时进入交互预览，旧宽度按新范围收敛。选择模式打开属性，返回预览时关闭自动打开的检查器，显式打开的检查器保留。
- **输入区。** 原有文本框固定 66px，下方常驻三项引用工具和发送键。参考 OpenFilm 输入框实拍，把发送键放进单行输入右端，模型与加号放到下一行，长输入自然增高。加号提供参考图、矩形截图和元素引用。保留回车换行和 ⌘/Ctrl + Enter 发送。[引用菜单](after/reference-menu.png) · [Agent 与模型选择](after/agent-menu.png)
- **项目与对话。** 标题栏显示真实项目切换和新建，页面入口与对话标题共用一行。移除了各处重复的版本编号和大块消息底色。消息结果可点回对应版本，标题栏的时钟可单独查看全部版本和检查结果。[历史入口](after/history-menu.png)
- **属性。** 过去的检查器标题和视图标签叠占 81px，未选中时还常驻尺寸框、说明与历史列表。现在属性和设计依据共用一条 42px 工具栏。选中时才显示路径、尺寸、字体、颜色、间距和交互信息。切回预览或进入聚焦会释放选取层。
- **预览。** 真实 iframe 保持自身 CSS 视口，缩放计算读取实际可用空间。视口尺寸移到设备按钮旁，释放页面顶端一行。工作台使用现有字号体系。应用图标继续使用现有 icns，工作台内移除了品牌图形和字标。

## 功能与构建验证

| 检查 | 结果 |
| --- | --- |
| Electron 实机窗口与布局 | 1280 × 800、1555 × 992、1920 × 1080 的原生内容尺寸均与目标一致。另测 960 × 640、聚焦、面板折叠、键盘调整宽度、旧版 440px 偏好和退出选取。检查的面板均无水平溢出。 |
| 真实页面操作 | 招聘页点击模拟匹配并在搜索框输入；放映单筛选周日并报名，余位由 12 变为 11。桌面、平板与手机断点独立于 100% 和自定义缩放。 |
| 元素编辑与局部截图 | 修改按钮宽度、字号、颜色及父表单高度，验证页面实际计算样式，撤销、保存并导出。160 × 86 逻辑像素框选在 2× 屏上得到 320 × 172 图片，与对应原始区域平均通道差约 0.27/255。单击空框和 Esc 取消均未添加图片。[框选过程](../../runs/editor-manual-vgGVXC/crop-selection.png) · [选区与引用](../../runs/editor-manual-vgGVXC/selected.png) |
| Agent、历史与导出 | 检查本机模型选择、推理强度、带图草稿恢复。用测试 CLI 走通生成、引用复用、回到旧版本、取消、失败和重启恢复。导出目录含实际 HTML、CSS 和 JS，且可读回手调样式。[回归结果](../../runs/desktop-smoke-UHZqWY/verification.json) · [导出状态](../../runs/density-20261120/workbench/export.png) |
| 错误与控制台 | 同条件截图套件无 renderer 或控制台错误。19 个状态的既有验收仅记录了刻意注入的预览异常，能定位并重新载入。[运行记录](../../runs/density-20261120/workbench/metrics.json) |
| 自动化 | 核心测试 21/21，附件测试 1/1，知识库检查、TypeScript 5.9.3 no-emit、工作台 JS 语法、桌面构建通过。最终包内 UI 与构建目录逐文件一致，macOS 深度严格签名校验通过。 |

本轮未发起新的付费模型生成，验证范围是桌面编辑、引用和调用链路。新生成页面的审美质量不在这批验收范围。打包中途一次签名因本机可用磁盘空间紧张失败，复用相同 Electron 二进制、重签并复验后，最终应用已能正常启动。窗口风格由人工依据上述原图评审。

## 修改文件

| 文件 | 内容 |
| --- | --- |
| `desktop/ui/index.html` | 标题栏、页面入口、输入框、引用及版本菜单、检查器层级 |
| `desktop/ui/studio.css`、`desktop/ui/editor.css` | 工作台尺寸、滚动区、交互状态、输入与属性控件 |
| `desktop/ui/studio.js`、`desktop/ui/editor.js` | 预览缩放、面板状态、选区退出、宽度迁移和菜单交互 |
| `desktop/tests/density.mjs` | 同条件实拍、原生窗口对话回放、布局测量及交互断言 |
| `desktop/tests/editor.mjs`、`desktop/tests/smoke.mjs`、`desktop/tests/workbench.mjs` | 跟随新的入口执行原有流程，等待异步属性读取完成，独立保存本批结果 |
| `README.md` | 更新新建、截图、引用与版本入口的使用说明 |
| `docs/workbench-density/` | 本报告、差异补丁、前后原图和测量 JSON |

构建产物位于 `build/desktop` 和 `dist/SurfaceLive-darwin-arm64/SurfaceLive.app`。测试输出与修改前源码快照位于 `runs/density-20261120`，独立编辑和生成流程的结果链接见上表。
