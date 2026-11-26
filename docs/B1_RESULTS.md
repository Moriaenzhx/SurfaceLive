# B1 实测记录 · 2026-11-20

首次入库 10 份真实软件截图的视觉观察和 10 条原创规则。Codex 在同一招聘场景生成了 A0、A1、A2 三个离线前端。三份源码都通过了单独的浏览器复核。真人盲评尚待填写。

## 知识工厂

| 命令（工程根目录） | 退出码 | 核验结果 |
|---|---:|---|
| npm test | 0 | 起步包 14/14，本批完成后 21/21 |
| npm run knowledge:check | 0 | 种子 43 来源、53 规则卡；B1 新增 10 来源、20 对象 |
| npm run factory -- discover | 0 | 登记 10 个逐项核过许可的截图来源 |
| npm run factory -- capture all --curl | 1 | 部分来源连接超时，部分原图 URL 需要规范化；分项保留失败历史 |
| npm run factory -- capture pending --curl | 0 | 最后三个待重试来源成功 |
| npm run factory -- check-cache | 0 | 10/10 份已索引截图的本地文件哈希相符 |
| npm run factory -- discover-links live-engine/ingestion/data/discovery.json --curl | 0 | 从公开目录页发现 3 个只保留链接的后续候选 |
| npm run factory -- draft discovery gpt-6.2-sol | 0 | 实际 CLI 看图输出 VisualExemplar 和 DesignRule 草稿，已通过 schema 检查，未替换已发布记录 |
| node --experimental-strip-types live-engine/knowledge/cli.ts search '招聘候选人复核工作台' | 0 | 命中 GnuCash 登记簿和 LibreOffice Calc 的 2 份样本与 2 条对应规则 |
| npm run bench:plan -- --scenario recruiting --variant all | 0 | 三组提示词均可重新生成 |

查看[入库来源](../live-engine/ingestion/data/registry.json)、[逐源知识卡](../live-engine/ingestion/data/cards)、[采集与复核命令](../live-engine/ingestion/README.md)及[自动视觉提炼的实测草稿](../live-engine/ingestion/.research/drafts/discovery-097bES/cards.json)。原图按 SHA-256 存在本机研究缓存。每份视觉记录使用公开软件截图的实际像素尺寸，保留作者、许可与复制限制。此次像素检查由 Codex 完成，人工审核、真实用户偏好以及从这些截图推断动效均未计入实测结果。

## 招聘场景生成与浏览器复核

以下命令均在工程根目录执行，运行目录保留每组 prompt.md、三份源码及 agent-result.json。

~~~sh
npm run bench:run -- --scenario recruiting --variant all --agent claude --model claude-sonnet-4-6 --browser
npm run bench:run -- --scenario recruiting --variant all --agent codex --model gpt-6.2-sol --browser

run_dir=runs/recruiting-2026-11-20T03-10-19-725Z-765655
npm run bench:verify -- "$run_dir"
node "$run_dir/recruiting-task.mjs" A0 A1 A2
npm run bench:blind -- "$run_dir/verification-hvfVo0"
~~~

| 执行 | 退出码 | 实际结果 |
|---|---:|---|
| Claude / Sonnet 4.6 | 1 | 受限网络下 ENOTFOUND；联网重试均返回 HTTP 402 insufficient_balance，浏览器 not-run |
| Codex / gpt-6.2-sol，medium，三组共用设置 | 1 | 三组已写出 HTML、CSS、JS；每个子进程均在 600 秒期限退出 124，原始 manifest 如实记录 failed / browser not-run |
| bench:verify 对原始文件逐字节复制后独立检查 | 0 | 三组静态检查通过。1440×900、390×844 各一轮，六次均无水平溢出、无阻断脚本异常，主操作改变了可见反馈 |
| recruiting-task.mjs | 0 | 六次完成空结果搜索、来源筛选、单人定位、匹配证据查看及提交复核决定 |
| bench:blind | 0 | 三份页面及六张截图打乱为 X/Y/Z，已生成独立的评审表和组织者解盲键 |
| 人工偏好评测 | not-run | 尚无目标用户或设计师投票 |

- [原始 Codex 运行与提示词](../runs/recruiting-2026-11-20T03-10-19-725Z-765655/manifest.json)
- [Claude 余额错误记录](../runs/recruiting-2026-11-20T03-06-30-547Z-5d7c6f/manifest.json)
- [独立验收及三份源码哈希](../runs/recruiting-2026-11-20T03-10-19-725Z-765655/verification-hvfVo0/manifest.json)
- [六次招聘业务操作记录](../runs/recruiting-2026-11-20T03-10-19-725Z-765655/business-task-cOO60i/tasks.json)
- [匿名页面与评审表](../runs/recruiting-2026-11-20T03-10-19-725Z-765655/verification-hvfVo0/blind-xt357N/reviewer/REVIEW.md)

为保留初始基线，复核和盲评均使用隔离目录，已生成的页面未经过人工修饰。后续生成提示词已明确由宿主统一做浏览器验收。本次为单场景、每组一次生成，共享业务契约，但模型各自选择了示例职位与人选数据。因此本轮可以验证生成与任务链路，审美收益和跨场景稳定性仍待实测。
