# 标签、侧栏与外观

在 macOS ARM64 上打开同一份招聘复核工作台，窗口设为 1555 × 992，预览使用桌面视口与适应窗口。两张浅色图都展开了两侧面板。[改动前](before.png) · [浅色与顶部标签](light.png) · [深色与侧栏互换](dark-swapped.png) · [打开工作台设置](dark-settings.png) · [导出悬停提示](export-tooltip.png)

标题栏显示打开的作品。＋ 新建独立草稿，× 关闭标签。新标签内可以重新打开已有作品和有内容的草稿。切换打开的标签时，已载入页面的表单和交互状态随标签保留。重启会恢复打开的作品、当前版本、草稿和显示偏好。对话与检查器各有面板开关，收起后可从预览工具栏同侧展开。专注预览位于缩放菜单。

右上角齿轮可调整项目对话的位置和工作台外观。两个面板一起换位，拖动和方向键调宽跟随实际位置。浅色、深色用于工作台。生成页面继续使用自身的样式。导出图标支持悬停和键盘焦点提示。

## 实机验证

- 在真实招聘页输入搜索词，切到手机放映单，再返回，搜索词和草稿都保留。验证了新建、关闭、重开、方向键切换、多个独立草稿、全部关闭、旧资料升级和重启恢复。960px 窗口中连续新增 12 个标签后，仍可操作 ＋ 和设置。[专项验收脚本](../../desktop/tests/tabs.mjs)
- 验证了左右换位与恢复、面板双向调宽、浅色与深色切换、换肤前后作品的计算样式与颜色偏好，以及源码导出。导出的招聘页 HTML 与原文件逐字节一致。[编辑验收](../../desktop/tests/editor.mjs) · [生成、导出与重启记录](../../runs/desktop-smoke-LQhXBr/verification.json)
- 现有工作台验收覆盖 19 个状态，密度检查覆盖 11 个状态。窗口覆盖 960、1280、1555 和 1920 像素宽度。未发现被测面板溢出。预览故障用例主动注入错误并验证重载恢复。[工作台测量](../../runs/workbench-tabs/workbench/metrics.json) · [面板测量](../../runs/workbench-tabs/density/metrics.json)
- 核心测试 21 项、附件协议测试 1 项、TypeScript 类型检查、桌面构建与 macOS 严格签名校验通过。本轮生成回归使用本地测试 Agent。

## 改动文件

- [窗口结构](../../desktop/ui/index.html)、[工作台样式](../../desktop/ui/studio.css)、[编辑区样式](../../desktop/ui/editor.css)、[动作图标](../../desktop/ui/action-icons.js)
- [项目标签和草稿](../../desktop/ui/project-tabs.js)、[工作台状态与设置](../../desktop/ui/studio.js)、[对话和属性编辑](../../desktop/ui/editor.js)、[工作台资源加载](../../desktop/preview.mjs)
- [新增专项验收](../../desktop/tests/tabs.mjs)、[测试操作入口](../../desktop/tests/controls.mjs)、[工作台回归](../../desktop/tests/workbench.mjs)、[密度回归](../../desktop/tests/density.mjs)、[编辑回归](../../desktop/tests/editor.mjs)、[生成导出回归](../../desktop/tests/smoke.mjs)、[使用说明](../../README.md)
