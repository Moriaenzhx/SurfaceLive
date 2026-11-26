# 工作台设置与作品源码位置

在右上角齿轮打开「通用 → 存储位置」。「打开」进入当前的保存目录，「打开当前版本」直接进入正在看的页面源码目录。版本记录菜单也可以打开所选版本的文件夹。内置示例会标明「应用内置示例」，个人作品显示标题和版本号。

「更改…」选择之后生成及手动保存版本的目录。以前的版本保留在原位置，通过同一份版本记录读取。应用会记住使用过的目录，保存到断开的磁盘时会提示重新连接或更改位置。

## 实际客户端截图

| 状态 | 窗口 | 截图 |
| --- | --- | --- |
| 招聘工作台，原齿轮菜单 | 1555 × 992 | [修改前](before.png) |
| 同一招聘工作台，通用设置 | 1555 × 992 | [修改后](general.png) |
| 放映单已保存的第 2 版及其源码路径 | 1555 × 992 | [查看截图](saved-page.png) |
| 深色设置 | 1280 × 800 | [查看截图](dark-1280.png) |
| macOS 最小工作窗口 | 960 × 640 | [查看截图](small.png) |

截图取自打包后的 macOS ARM64 客户端。截图会话使用独立的应用资料，读取已有作品。换目录和写入回归使用单独的临时作品。

## 验证记录

- 在 Finder 中实际打开了放映单第 2 版的源码文件夹。「更改…」打开了 macOS 原生目录选择器，按 Esc 后保留了原目录。桌面回归验证了写入新目录、重启、读取旧版本、磁盘断开与重连。导出的三个源码文件逐字节匹配旧版本。[存储专项测试](../../desktop/tests/settings.mjs)
- 设置搜索、跟随系统、浅色与深色、侧栏换位、关闭设置后的键盘焦点通过。工作台检查覆盖 19 个状态，记录中各面板无横向溢出，预览错误来自主动注入的故障测试。[工作台测量](../../runs/workbench-settings/checks/metrics.json)
- 标签、元素选择、框选截图、手动保存与导出通过。生成和重新打开使用本地测试 Agent 验证。[生成回归记录](../../runs/desktop-smoke-hP5pfD/verification.json)
- TypeScript 检查、21 项引擎和知识库测试、1 项附件协议测试、知识库校验、桌面构建与应用签名校验通过。

## 修改文件

| 范围 | 文件 |
| --- | --- |
| 目录、版本索引、系统文件夹选择器与 Finder | [library.mjs](../../desktop/library.mjs)、[main.mjs](../../desktop/main.mjs)、[preload.cjs](../../desktop/preload.cjs) |
| 设置界面、工作台接入、样式与图标 | [index.html](../../desktop/ui/index.html)、[settings.js](../../desktop/ui/settings.js)、[settings.css](../../desktop/ui/settings.css)、[studio.js](../../desktop/ui/studio.js)、[studio.css](../../desktop/ui/studio.css)、[editor.js](../../desktop/ui/editor.js)、[action-icons.js](../../desktop/ui/action-icons.js)、[preview.mjs](../../desktop/preview.mjs) |
| 专项回归与使用说明 | [settings.mjs](../../desktop/tests/settings.mjs)、[项目说明](../../README.md) |
