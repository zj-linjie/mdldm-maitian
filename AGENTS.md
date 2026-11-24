# AGENTS.md

麦田（`mdldm-maitian`）：跑在常开电脑上的自媒体多平台发布中控。Node.js ≥ 22.5 的纯 ESM，没有打包、没有依赖安装、`package.json` 里没有 scripts。入口是 `node src/hub.mjs`（`bin` 名 `maitian`）。

三块分工，改代码前先分清该动哪一块：

| 部分 | 位置 | 做什么 |
|---|---|---|
| 发布 skill | `skills/maitian-publish/` | 看片、按平台规则写「发布素材.md」、生成并校验 `publish.json` |
| 麦田本体（本仓库） | `src/` | 调度、任务状态、防重、取链接、采数据、网页大屏、飞书通知 |
| 麦田发布助手 | 独立仓库 / Chrome 商店插件 `eaaipbilkhibicihiollecmbpneikpnj` | 各平台上传页的填写适配器。本仓库**不包含**填写逻辑 |

链路：成片 → skill 写发布素材 → `make-publish.mjs` 生成 `publish.json` → `validate.mjs` 校验 → `hub plan` 登记 → `hub run` 分批填写 → 国内平台停在「待你点发布」→ 守护进程到点取链接 → 每天采流量和粉丝 → `web.mjs` 大屏 + `feishu.mjs` 卡片。

## 命令

没有 lint，也没有 build。常用：

```bash
node --test tests/                              # 全部测试
node --test tests/site.test.mjs                 # 单个文件
node --test --test-name-pattern '启用判定' tests/site.test.mjs

node src/demo.mjs                               # 假数据大屏 http://localhost:8788/?key=demo
node src/init.mjs                               # 交互式安装向导（会改 config、装 launchd）
node src/hub.mjs doctor [--only a,b] [--quiet]  # 只检查登录态，不上传、不填写
node src/hub.mjs plan [工程目录]
node src/hub.mjs run <工程目录> [--only x,zsz] [--force] [--now]
node src/hub.mjs status [id] [--logs]
node src/hub.mjs sync <id> [--only a,b]
node src/hub.mjs mark <id> <平台> <状态> [备注] [--url 链接]
node src/hub.mjs adopt <工程目录>               # 登记已发过的期，不上传
node src/hub.mjs metrics [id]
node src/hub.mjs metrics-accounts [--skip a,b]
node src/hub.mjs followers
node src/hub.mjs review <id> [天数] [--notify]
node src/hub.mjs weekly [--notify]
node src/hub.mjs daemon                         # 常驻；launchd 装的就是它
node src/make-publish.mjs <发布素材.md> <工程目录>
node src/validate.mjs <工程目录>
```

`login`、`run`、`metrics`、`followers`、`doctor`、`daemon` 会调用选定浏览器并操作已登录的创作者后台。真实后台验收需要用户明确要求。

## 架构

`src/hub.mjs` 是 CLI 和守护进程。`daemon` 每 5 分钟醒一次：扫发布计划、提醒还没点发布的平台、到点 `sync` 取链接、头三天按 `sampleHours`（默认 6 小时）加密采样、每天 10 点后采近 30 天流量并出第 1/3/7 天复盘、`keepAlive` 平台保活、小鹅通销售同步。网页由守护进程拉起（`HUB_NO_WEB=1` 可关），默认 `http://localhost:8787/?key=<web.key>`。

状态在 SQLite（`node:sqlite`），默认 `data/hub.db`，可用 `MAITIAN_DB` 换路径。表在 `src/db.mjs`：`episodes` / `tasks`（平台状态机）/ `metrics` + `samples` / `snapshots`（发布时的 `publish.json`）/ `logs` / `meta`，以及站点转化、小鹅通订单、账号作品流量。已到位状态 `LOCKED`（`filled`、`awaiting_user`、`scheduled`、`published`）不允许再跑，这是防重。`config.disabled` 里的平台不登录、不体检、不发布、不采粉丝；`src/web.mjs` 改的是同一个 `config` 对象，守护进程不用重启。

配置从 `config.json` 读，路径可被 `MAITIAN_CONFIG` 覆盖。`src/feishu.mjs` 在 import 时就读配置，文件不存在会 `process.exit(1)`。因此测试必须在 import 任何 `src/*.mjs` **之前**把 `MAITIAN_CONFIG`（以及会写库的用例的 `MAITIAN_DB`）指到临时文件。`config.json`、`config.json.bak`（`config-admin.mjs` 保存前的备份）、`data/`、`chrome-profile/` 都在 `.gitignore` 里，不要提交。

浏览器入口在 `src/driver.mjs`。默认通过 `ego-browser` 使用 Ego Lite 的独立 Space。显式设置 `browser: chrome` 可用专用 Chrome（默认 CDP `9333`），也可连插件开发桥。发布助手由 `src/plugin.mjs` 加载，字段规则来自它的 `lib/bundle.js`。浏览器设置和升级说明见 [README 的安装与配置](README.md#一行装好)。

平台 id：`bilibili`、`douyin`、`xhs`、`channels`、`youtube`、`x`、`instagram`，自有站点是 `zsz`。`config.auto` 里的平台回读核对后自动提交一次；`config.manual`（国内四家）填完停在 `awaiting_user`，最后一下留给人点。`config.batches` 控制上传批次，一次传太多会抢带宽。账号作品流量（`account-*.mjs`、`hub metrics-accounts`）和发布工程是两套数据，采集不会创建待发布任务。B 站副号只在 `bilibiliAccounts` 里，不参与发布。

可选扩展：`src/*.local.mjs` 被 gitignore。`examples/wechat/` 是公众号接入示例（非官方，页面里直接调后台接口、只建草稿）。只有 `config.batches` 含 `wechat` 时，`hub.mjs` / `web.mjs` 才会把它登记进平台列表。复制示例后用 `node src/hub.local.mjs` 代替 `hub.mjs`。

小鹅通销售看板是 `config.site.provider = xiaoe` 时的另一条路（`src/xiaoe.mjs`、`src/sales.mjs`），销售模式下不参与课程发布。自有站点转化走 `src/site.mjs`，不配 `config.site` 整块关掉。

## 改代码时注意

- 一个改动只做一件事。平台规则要同时对上三处：发布助手的 `PLATFORMS`、本仓库 `make-publish.mjs` 的字段提取、`skills/maitian-publish/SKILL.md` 的写法。采集器在 `src/metrics.mjs` 的 `collectors` 和 `src/followers.mjs`；新平台还要登记 `hub.mjs` 的 `ALL_IDS` / `LOGIN_PAGES` 和 `db.mjs` 的 `NAMES`。
- 国内平台只填写、不点最终发布。小红书只读已渲染内容，不在页面里直接调它的接口。
- 网页改动在 `src/web.mjs`（路由和数据）和 `src/web/board.html`、`pages.html`、`mt.js`、`mt.css`。页面口令是 `web.key`，没有口令的请求一律 401。
- 测试用 `node:test` + `node:assert/strict`。会碰本机已装插件或真实 `config.json` 的用例，用临时 `MAITIAN_CONFIG` / `MAITIAN_DB` 隔开。
