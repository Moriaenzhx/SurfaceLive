# B1 设计知识工厂

在含有 package.json 的工程目录下运行以下命令。Node 22.16 或更高版本可直接运行 TypeScript 和内置 SQLite。截图来自公开的真实软件界面。旧版本软件的范例用于研究特定的信息组织方式，各条记录给出了适用场景和禁忌。

## 复核本批数据

~~~sh
npm ci
npm test
npm run knowledge:check
npm run factory -- check-cache
npm run factory -- show gnucash
node --experimental-strip-types live-engine/knowledge/cli.ts search '招聘候选人复核工作台'
npm run bench:plan -- --scenario recruiting --variant all
~~~

[data/registry.json](data/registry.json) 保存 10 个采集来源的文件描述页、原图地址、作者、许可说明及条款复核人。[data/cards](data/cards) 是可读的逐源标注。[data/factory.sqlite](data/factory.sqlite) 保存队列、当前索引和历次状态。原图保存在本机 .research/<sha256>.png，不随源码分发。原图缺失时可在允许联网的环境重新执行 capture。check-cache 会核对所有已索引截图的字节哈希。

| 场景 | 本批视觉证据 | 可检查的设计问题 |
|---|---|---|
| B 端工作台 | GnuCash 登记簿、LibreOffice Calc | 主记录与明细的归属、当前记录和字段的定位 |
| 决策驾驶舱 | Grafana、Search & Discovery、GnuCash 支出报表 | 时间窗、数据口径、类别金额是否可读 |
| 消费移动端 | Wikipedia Android 附近列表、导航菜单、阅读排行 | 距离、目的地与排名的扫读顺序 |
| 创意编辑器 | Shotcut、Audacity | 作品与工具的主次、轨道和时间轴的关系 |

视口记录注明 screenshot-raster，即发布截图的像素尺寸。操作系统缩放、浏览器内部 CSS 视口及原始拍摄设备未知。pixelInspectedBy 记录此次模型的像素检查，humanReview 保留 pending。静态图只支持对可见状态的观察。

## 新批次

1. 以已审查的目录页作为发现入口。命令会从同源链接中筛选指定路径和数量，去重后登记为 link-only。文件的许可需逐项确认。
2. 编辑来源 JSON，填写来源 ID、场景标签、文件页和 PNG 原图、许可依据、条款网址、复核时间与复核人。对于带图片的来源，analysis-permitted 表示已核准本机保存研究副本。仅允许引用、许可不明或不可抓取的素材使用 link-only。再次导入相同 ID 和网址可以更新许可，同名或重复网址会报错。
3. capture 先检查每个来源域及原图域的 robots.txt，跨进程按域限速，遇到 429/503 保留退避时间。未授权的跳转、拒绝访问、过大的响应、非法 PNG 或来源失效都会阻止入库。文件页只保留标题、哈希等元数据。网页内容不能给 Agent 下达命令。
4. 检查实际像素或行为记录后撰写卡片。distill 校验类别字段、来源、版本和截图哈希。review 与 index 是显式操作。新版本或失效来源退出当前索引，历史版本可查。若证据变化，先核对新版本许可，更新 rightsReviewedAt 并再次 discover。
5. 运行 search 或 bench:plan 检查 A2 的引用。只选择本场景审核通过的少量规则、视觉样本、行为或偏好。行为案例使用实际 DOM 状态变化作为证据。用 attach-trace 登记本地 JSON，填写 sourceId、versionHash、observedAt、userAction、before 和 after。命令返回 SHA-256；卡片的 testEvidence 使用 kind 为 dom-trace 和这个 sha256，userAction 与 visibleOutcome 必须与记录相符。复核时回看原始操作。偏好需要真实的 A/B 选择和理由。

~~~sh
npm run factory -- discover-links live-engine/ingestion/data/discovery.json --curl
npm run factory -- discover live-engine/ingestion/data/registry.json
npm run factory -- capture pending --curl
npm run factory -- show gnucash
npm run factory -- history gnucash
~~~

如来源许可和本机模型服务均允许图像处理，可显式运行 `npm run factory -- draft discovery gpt-6.2-sol`。此命令将该张已校验截图交给当前 Codex CLI，保存原始模型回复和结构化候选卡。它不会发布卡片。核对观察和适用范围后，可将输出的 cards.json 交给 distill，随后执行 review 与 index。此操作使用模型配额。

使用单个源 ID 可只抓一项，all 则重新检查所有有研究许可的来源。默认通过 Node fetch 访问；--curl 改用系统 curl 8.7+。两条路径执行相同的 robots、限速、版本和授权检查。

~~~sh
npm run factory -- distill gnucash live-engine/ingestion/data/cards/gnucash.json
# 版本哈希可以从 show 的 capture.versionHash 读取。
npm run factory -- review gnucash <复核人> <版本哈希>
npm run factory -- index gnucash
~~~

四类记录各自的必填字段见 [schema.ts](schema.ts)。本批入库的对象是 10 个 VisualExemplar 和 10 个 DesignRule。此前的 6 条用户反馈仍保存在种子库，未对它们补造投票或交互证据。

## 真实生成实验

~~~sh
npm run bench:run -- --scenario recruiting --variant all --agent codex --model gpt-6.2-sol --browser
npm run bench:blind -- <真实实验目录>
~~~

每轮创建独立目录。manifest.json 记录固定的模型、各组进度和耗时，每组保留实际提示词、模型日志、代码和审计。盲评打包器要求三个原始页面均通过静态与浏览器门槛。它打乱顺序，仅将三个匿名页面、对应截图及表格放进 reviewer 子目录。解盲键留给组织者。任务成功率和审美偏好由评审者分别填写。

若生成器超时但已经写出源码，可以使用 `npm run bench:verify -- <原始实验目录>` 在新目录中复核原始三文件。它保存每份源码哈希、原始退出状态、两种视口上的动作与截图。完整复核目录也可交给 bench:blind。
