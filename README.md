<p align="center"><img src="docs/readme/banner.png" alt="麦田 · 给多平台博主的开源工作台" /></p>

<p align="center">
  <a href="https://maitian.mdldm.club/?utm_source=github&utm_medium=readme&utm_campaign=maitian-readme"><img src="https://img.shields.io/badge/官网-maitian.mdldm.club-7B5CFF" alt="官网" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows-1c1a16?logo=apple" alt="macOS | Windows" />
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2022.5-5FA04E?logo=nodedotjs&logoColor=white" alt="Node 22.5+" />
  <a href="https://chromewebstore.google.com/detail/eaaipbilkhibicihiollecmbpneikpnj"><img src="https://img.shields.io/badge/Chrome-麦田发布助手-F2B21B?logo=googlechrome&logoColor=white" alt="麦田发布助手" /></a>
  <a href="https://github.com/CzzzzzzJ/mdldm-maitian/stargazers"><img src="https://img.shields.io/github/stars/CzzzzzzJ/mdldm-maitian?style=social" alt="Stars" /></a>
</p>

<p align="center">
  <a href="#一行装好">一行装好</a> ·
  <a href="#看它跑一遍">看它跑一遍</a> ·
  <a href="#怎么配合">怎么配合</a> ·
  <a href="#各平台的坑实战总结">各平台的坑</a> ·
  <a href="docs/faq.md">常见问题</a> ·
  <a href="SHOWCASE.md">用户案例</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a> ·
  <a href="#作者">作者</a>
</p>

> **一句话**：麦田是 Agent 驱动的自媒体发布工作台——你对 AI 说一句「整理发布」，一期视频填好七个平台，数据每天自己回来。
> **一行装好**：`bash -c "$(curl -fsSL https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/scripts/install.sh)"`（Windows 见[下文](#一行装好)）· 用麦田做出了东西？[来晒案例](SHOWCASE.md)

一个人做内容，要发六七个平台，每个平台的文案、封面、发布形式都不一样；发完还想知道哪期起来了、哪个平台涨粉、哪个平台真的带来了付费。麦田就是我自己每天在用的那套工作台：

1. **发得出去**：一期视频分批填好 B站、抖音、小红书、视频号、YouTube、X、Instagram，提前排进「分发计划」，到点发布、自动取链接。
2. **看得清楚**：每期在每个平台的播放、互动，各平台粉丝，每天自动采、长期留存；手机上看大屏，飞书群推卡片。
3. **算得出钱**：接上你自己的站点，看哪一期、哪个平台带来了注册和收入。

> 跑在一台常开的 Mac 或 Windows 电脑上，用你自己登录好的浏览器操作各平台，**不存任何平台密码**。国内四家只填写不发布，最后一下由你自己点。

## 看它跑一遍

<p align="center"><img src="https://github.com/CzzzzzzJ/mdldm-maitian/releases/download/media/maitian-publish.gif" alt="一期视频的发布流程：Agent 写文案 → 进分发计划 → 插件分批填写各平台 → 国内平台你来点发布 → 到点回填链接" /></p>
<p align="center"><sub>一期视频从写文案到上线（47 秒，各平台发布页为示意，数据是作者第 4 期的真实文案和封面）· <a href="https://github.com/CzzzzzzJ/mdldm-maitian/releases/download/media/maitian-publish.mp4">高清 MP4</a></sub></p>

<p align="center"><img src="docs/screenshots/board.jpg" alt="麦田大屏：最新一期轮播、粉丝、数据分析、各平台卡片（演示数据）" /></p>
<p align="center"><sub>大屏（演示数据，<code>node src/demo.mjs</code> 就能看到）</sub></p>

| 日历：分发计划 | 单期复盘：同龄对比 | 每期转化漏斗 |
|---|---|---|
| <img src="docs/screenshots/calendar.jpg" alt="日历" /> | <img src="docs/screenshots/episode.jpg" alt="单期复盘" /> | <img src="docs/screenshots/convert.jpg" alt="转化漏斗" /> |

## 怎么配合

<p align="center"><img src="docs/readme/flow.png" alt="发布 skill → 麦田发布助手 → 麦田" /></p>

| 部分 | 做什么 | 在哪 |
|---|---|---|
| 发布 skill | 让 AI 助手（Claude Code / Codex）看片、写各平台文案、生成发布工程并校验 | 本仓库 [`skills/maitian-publish`](skills/maitian-publish/SKILL.md) |
| 麦田发布助手 | 浏览器扩展，各平台适配器：打开上传页、传视频和封面、填文案、设定时 | [Chrome 应用商店](https://chromewebstore.google.com/detail/eaaipbilkhibicihiollecmbpneikpnj)（装进麦田所用的浏览器） |
| 麦田（本仓库） | 分发计划、调度、防重、等你点发布、取链接、采数据、网页大屏、飞书通知 | 本仓库 |

链路：成片 → skill 写「发布素材.md」→ 生成 `publish.json` → `hub plan` 进分发计划 → `hub run` 分批填写 → 国内平台你点发布 → 到点取链接 → 每天采数据 → 大屏和飞书卡片。

## 安装

三种方式，按自己习惯挑一种。

### Agent 自动安装

不动手也能装：把下面这段话复制给你的 AI 助手（Claude Code / Codex 等）。它会读专门的[安装指引](agent-install.md)，自行装好麦田本体，并把发布 skill 装进**它自己**的 skill 目录——各 Agent 的 skill 目录不同，所以让 Agent 按指引自行安装，不依赖一行安装脚本里写死的 Claude 路径：

```text
请帮我接入麦田的发布能力：阅读 https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/agent-install.md 并严格按其中的步骤完成安装与授权。
```

### 一行装好

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/scripts/install.sh)"
```

下载麦田和发布助手到 `~/maitian/`、接上发布 skill、打开安装向导；向导问完几个问题，生成配置、装好开机自启、打开各平台登录页。需要 macOS、Node.js ≥ 22.5 和 Ego Lite。

Windows（社区贡献，感谢 [ajin558](https://github.com/ajin558)；开机自启暂未适配）：

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/scripts/install-windows.ps1 | iex"
```

同样下载到 `%USERPROFILE%\maitian\`、接上发布 skill、打开安装向导，安装目录里另有 4 个双击启动器（演示 / 登录 / 体检 / 启动）。需要 Windows 10/11、Node.js ≥ 22.5、Google Chrome；缺 Git / Node 时脚本会用 winget 自动补装。向导请选择 `chrome`。开机自启暂未适配（向导里的 launchd 步骤会自动跳过），可用任务计划程序指向安装目录的 `4-start.bat` 代替。

<p align="center"><img src="https://github.com/CzzzzzzJ/mdldm-maitian/releases/download/media/maitian-install.gif" width="720" alt="一行安装演示" /></p>

### 手动安装

或者手动：

需要 Node.js ≥ 22.5（用到内置 `node:sqlite`）。macOS 默认用 [Ego Lite](https://lite.ego.app/download)，完成浏览器初始化后应能运行 `ego-browser --version`。Windows 请在安装向导显式选择 `chrome`。NAS、飞书群机器人和 cloudflared 可以按需配置。

```bash
git clone https://github.com/CzzzzzzJ/mdldm-maitian.git && cd mdldm-maitian
node src/demo.mjs                       # 先用假数据看看效果：http://localhost:8788/?key=demo
node src/init.mjs                       # 安装向导，配置麦田的浏览器并打开平台登录页
node src/hub.mjs doctor                 # 登录完检查各平台登录态和上传页（不上传、不填写）
```

打开向导最后给出的地址（`http://localhost:8787/?key=<web.key>`），之后浏览器会记住口令。手动安装也可以：`cp config.example.json config.json` 填好后跑 `scripts/install-launchd.sh`。

### 三级上手

macOS 使用 Ego Lite 时，先在 Ego Lite 里安装发布助手，并将该浏览器 `chrome://version` 显示的资料路径填入 `config.json` 的 `egoProfile`。麦田使用 Ego Lite 当前的默认资料，已有的平台登录态会一起使用。终端或守护进程找不到命令时，可以把 `egoCommand` 设为 `ego-browser` 的绝对路径。

Ego Lite 遇到浏览器权限提示时会把 Space 交给你。麦田会保留该 Space。填写中断时，先在原标签页核对上传状态，再决定是否重跑。

更新已有安装时，配置中没有 `browser` 的工作台也会默认使用 Ego Lite。希望继续使用专用 Chrome、B 站副号或 `driver: "plugin"` 开发桥时，在 `config.json` 里显式设置 `"browser": "chrome"`。

| 级别 | 你能得到 | 要装的 | 大概时间 |
|---|---|---|---|
| L1 只看数据 | 各平台粉丝、已发作品的播放互动、大屏、飞书日报 | 麦田；在选定浏览器里登录各平台；已发的期用 `hub adopt` 登记 | 30 分钟 |
| L2 分发 | 一期一次填好各平台，定时，自动取链接 | + [麦田发布助手](https://chromewebstore.google.com/detail/eaaipbilkhibicihiollecmbpneikpnj)；+ 发布 skill（或手写 `publish.json`） | 再 1 小时 |
| L3 转化 | 每期带来的注册和收入 | + 你自己的站点按 `src/site.mjs` 的接口接入 | 看站点 |

## 它做什么

- **播种（发布）**：读 NAS 上的一期发布工程（成片、封面、各平台文案、定时），按批次在选定浏览器里填好各平台上传页。
  - X、YouTube、Instagram、自有站点：回读文案和定时一致后自动提交，只点一次。
  - B站、抖音、小红书、视频号：**填好就停**，等你自己点「发布 / 定时发布」，守护进程每 20 分钟提醒。
  - 防重：库里已经到位的平台不再跑；X 定时列表、YouTube Studio、Instagram 主页、站点后台已有同名的不再传。
- **长势（流量和粉丝）**：每天上午采一次各期在各平台的播放和互动、各平台粉丝数；新一期头三天每 6 小时采一次。「账号作品」能单独查看 B站、抖音、小红书现有作品，不用登记发布工程。点「采集账号流量」或运行 `node src/hub.mjs metrics-accounts`；直连模式会启动选定浏览器，首次需先登录。可在 `config.json` 中设置 `"accountTrafficAuto": true`，随每天的流量日报采集。失败时保留上次成功数据。
  - B站副号可在 `bilibiliAccounts` 配置（例如 `[{ "id": "second", "name": "副号" }]`）。副号需要 `direct` 模式并使用独立的调试端口和 Chrome 登录目录（默认按 ID 分配，亦可显式设置 `chromePort`、`chromeProfile`）。可填 `uid` 防止登错号；首次成功采集后也会校验历史归属。副号不参与发布。
- **收成（转化，可选）**：接上自有站点后，看注册、会员、订单、收入从哪个渠道、哪一期来。
- **日历**：上周到未来两周，已发布、已定时、等你点、计划中的期一眼看清。
- **粮仓（档案）**：每期的封面、文案快照、各平台链接、过程日志。
- **复盘（数据分析）**：每期发布后第 1/3/7 天自动出复盘卡片：各平台占比、互动率、和上一期同龄对比（第 N 天对第 N 天）、期间涨粉、带来的注册；每周一出周报。网页单期页有同一份复盘表，转化页有每期转化漏斗（播放 → 注册 → 会员 → 收入）。
- **飞书通知**：开跑、每个平台到位、异常、等你点发布、定时被平台改掉、每日日报、复盘和周报，都是带颜色的卡片。webhook 和「飞书验证码登录」开关可以在网页「系统 → 集成」里编辑、测试，保存即生效。
- **平台管理**：网页「系统 → 平台」列出每个平台的登录状态（体检结果），掉线了点「去登录」只打开这一家的后台，在跑麦田的电脑上用选定浏览器扫码；「全部检查」就是一次体检。不用的平台可以停用（不体检、不发布、不采粉丝），会写进 `config.json` 的 `disabled`。同一个平台登多个账号、在网页里嵌扫码做不到：登录态存放在选定浏览器的资料目录。B 站副号使用专用 Chrome。

## 各平台的坑（实战总结）

- **国内四家由你自己点最终发布**。自动化只负责填写和核对，最后一下人点，降低风控风险。
- **小红书只走最保守的路**：只读页面上已经渲染的内容、像人一样滚动和点击，不在页面里直接调它的接口，低频。
- **同一条视频每个平台只上传一次**，反复重传最容易触发风控；中控的防重就是为这个。
- **视频号的定时可能被改**：表单回读是对的，提交后平台记成别的时间（遇到过 +2 小时）。`sync` 会拿平台记录的定时和计划比对，不一致发 ⚠️ 卡片。
- **YouTube 上传对话框被关掉**时，视频可能已经排好定时；中控会先查 Studio 列表再下结论。
- **成片必须 faststart**（moov 在文件头），否则小红书报「无视频流信息」、抖音不出表单；校验会拦。
- **专用 Chrome 卡死**：用 `curl 127.0.0.1:9333/json/close/<id>` 关掉卡住的标签页，不会触发「离开此网站」确认。

<details>
<summary><b>架构</b></summary>

```
            ┌────────────── Mac（常开）──────────────┐
NAS 发布工程 │  hub.mjs 守护进程 ──── Ego Lite / 专用 Chrome ── 各平台创作者后台
publish.json ─▶│     │  ▲                 ▲                       │
成片/封面     │     │  │ 平台适配器（麦田发布助手 lib/）       │
            │     ▼  │                                          │
            │  SQLite（data/hub.db） ── web.mjs（麦田网页 :8787）── 手机/电脑（可选 Cloudflare 隧道）
            │     │                                              │
            │     └── feishu.mjs ──▶ 飞书群机器人（卡片通知）       │
            └───────────────────────────────────────────────┘
```

- 平台填写逻辑在 [麦田发布助手](https://chromewebstore.google.com/detail/eaaipbilkhibicihiollecmbpneikpnj)（Chrome 插件）里。从应用商店安装后，麦田加载插件的发布引擎（`src/plugin.mjs`）。浏览器驱动为插件提供 `chrome.tabs` 和 `chrome.debugger`。Ego Lite 通过 `ego-browser` 操作独立 Space。
- 发布工程 `publish.json` 由 `src/make-publish.mjs` 从一份 Markdown 发布素材生成，`src/validate.mjs` 校验（字数、禁词、封面比例、成片 faststart 等），字段规则跟着插件走。

</details>

<details>
<summary><b>命令</b></summary>

```bash
node src/hub.mjs login [--only bilibili,channels]   # 在选定浏览器打开平台登录页，网页「系统 → 平台」也可按平台打开
node src/hub.mjs doctor [--only a,b] [--quiet]      # 体检登录态，结果给网页用；--quiet 不发飞书
node src/hub.mjs plan [工程目录]            # 登记进分发计划（不带目录 = 扫描 rootPath）
node src/hub.mjs run <工程目录> [--only x,zsz] [--force] [--now]   # 发一期；--now 让站点课程立即上线（默认推迟到定时前 30 分钟）
node src/hub.mjs status [id] [--logs]
node src/hub.mjs sync <id> [--only a,b]     # 取链接，写 发布记录.json，回填发布素材 md 的「已发布」行
node src/hub.mjs mark <id> <平台> <状态> [备注] [--url 链接]   # 手动改状态（平台认不出时用）
node src/hub.mjs adopt <工程目录>            # 登记一期已经发过的（不上传），按标题取链接
node src/hub.mjs metrics [id]               # 采发布工程流量并发日报
node src/hub.mjs metrics-accounts [--skip a,b] # 只读采集已发布的账号作品
node src/hub.mjs metrics-login bilibili@second # 在专用 Chrome 里打开 B站副号登录页
node src/hub.mjs followers                  # 采粉丝
node src/hub.mjs review <id> [天数] [--notify]   # 看某期发布 N 天的复盘（守护进程会在第 1/3/7 天自动发）
node src/hub.mjs weekly [--notify]          # 上周周报（守护进程每周一自动发）
node src/hub.mjs board                      # 同步到飞书多维表格（可选）
node src/hub.mjs daemon                     # 常驻（install-launchd.sh 装的就是它）
```

</details>

<details>
<summary><b>配置要点（config.json）</b></summary>

| 项 | 说明 |
|---|---|
| `browser` | `ego`（默认）；只有显式设为 `chrome` 才会使用专用 Chrome |
| `egoProfile` / `egoCommand` | Ego Lite 的资料路径；可选的 `ego-browser` 可执行文件绝对路径 |
| `plugin` | `store`（默认）：用选定浏览器安装的发布助手；`local` 用 `pluginDir` 指定发布助手目录 |
| `rootPath` / `nasUrl` | 发布工程根目录；NAS 掉线或被挂到「…-1」时守护进程会自己卸掉重挂 |
| `batches` | 上传批次。一次传太多平台会互相抢带宽导致超时，建议国内两两一批 |
| `auto` / `manual` | 自动提交 / 等你点发布的平台 |
| `keepAlive` | 容易掉登录的平台（视频号），定时刷一下保活 |
| `disabled` | 停用的平台（如 `["instagram"]`）：不体检、不打开登录页、不发布、不采粉丝。网页「系统 → 平台」里也能开关 |
| `bilibiliAccounts` | 可选的 B 站采集账号配置；这项配置不改变发布账号或发布流程 |
| `site` | 自有站点，可选，见下 |
| `board` | 飞书多维表格看板，可选 |
| `web.key` | 网页口令，所有页面和接口没有口令一律 401 |

多账号采集配置示例（可选）：

```json
"bilibiliAccounts": [
  { "id": "default", "name": "主号", "uid": "123456", "enabled": true },
  { "id": "second", "name": "副号", "uid": "234567", "enabled": true }
]
```

`default` 始终继承现有的 `chromePort` 和 `chromeProfile`；未填写时仍使用默认账号。副号默认使用独立端口和登录目录，也可用 `chromePort`、`chromeProfile` 单独指定，不能与其他账号重复。用户 ID（UID）用字符串填写。将 `bilibili` 放进 `disabled` 会停用整个 B 站；仅停用副号则把该账号的 `enabled` 设为 `false`。这里仅定义配置，实际按账号采集需要对应的采集功能。

</details>

<details>
<summary><b>接入小鹅通销售看板（可选）</b></summary>

在本地 `config.json` 中配置店铺，然后重启麦田。将 `shopName` 填为后台显示的完整店铺名。

```json
{
  "site": {
    "provider": "xiaoe",
    "enabled": true,
    "name": "小鹅通",
    "shopName": "你的店铺名称",
    "base": "https://admin.xiaoe-tech.com",
    "adminPath": "/t/merchant/index"
  }
}
```

运行 `node src/hub.mjs login --only zsz`，在选定浏览器中登录并进入店铺。运行 `node src/hub.mjs board` 首次同步，随后可在大屏和「销售」查看当天、近 7 天、近 30 天的支付、退款、订单及最近 10 笔订单。守护进程每 10 分钟更新一次，按北京时间每日补齐最近 30 个完整自然日。订单仅保存编号、商品、金额、状态和下单时间。销售模式下，小鹅通不参与课程发布。

已结束日期的退款来自每日统计。需要当天退款时，可在 `site.refundQuery` 中填写当前店铺后台「退款趋势图」查询的 JSON 请求体（只需请求体，无需请求头或 Cookie）。同步时会自动替换日期，按「退款金额」字段取值。缺少当天报表或数据时，退款和支付净额显示为「–」。每个销售数据库绑定一家店铺，换店时请使用单独的 `MAITIAN_DB` 数据库路径。

</details>

<details>
<summary><b>接入你自己的站点（可选，二次开发）</b></summary>

不配 `config.site` 就整块关掉，网页上不显示站点卡片，「转化」页只说明怎么接。要看转化：

1. 发布 skill 会在 B站、YouTube、X 的链接上带 `utm_campaign=<主题>-<序号>`；你的站点记下访客第一次带来的这个参数，注册和下单时一起存。
2. 站点提供两个只读接口给麦田（用选定浏览器里的管理员登录态去调），字段见 [`src/site.mjs`](src/site.mjs) 顶部注释。
3. 在 `config.site` 里填站点地址和接口路径。也可以直接在网页「系统 → 集成」里编辑、点「测试连接」，保存即生效（不用重启守护进程）。

作者用自己的课程站做了示例；你的站结构不同，改 `src/site.mjs` 和转化页即可。

</details>

<details>
<summary><b>远程访问（可选）</b></summary>

`scripts/install-launchd.sh --tunnel` 会装一个 cloudflared 隧道，地址推到飞书。

- **固定域名（推荐）**：域名交给 Cloudflare 后，跑 `cloudflared tunnel login`、`cloudflared tunnel create maitian`、`cloudflared tunnel route dns maitian maitian.你的域名`，在 `config.json` 里加 `"tunnel": { "name": "maitian", "hostname": "maitian.你的域名" }`。地址永远不变，建议再在 Cloudflare Zero Trust 里给它加一层邮箱验证码登录（Access → Self-hosted 应用），然后在 `config.json` 的 `web.access` 填团队域名和应用的 AUD Tag：麦田会验证 Access 签发的登录凭证，手机上输邮箱收验证码就能进，不用再带 `?key=`。
- **飞书验证码登录（推荐，零配置）**：`config.json` 的 `web` 里加 `"login": "feishu"`。远程打开麦田会先到登录页，点「发送验证码」，6 位码推到飞书群，输入后这台设备记住 30 天；验证码 5 分钟有效、只能用一次、错 5 次作废，60 秒内只能发一次。`?key=` 口令仍可用作备用。飞书 webhook 和这个开关也能在网页「系统 → 集成」里编辑、点「测试发送」，保存即生效。
- **快速隧道（默认）**：不配 `tunnel` 时用 `https://xxx.trycloudflare.com`，不用账号，但每次重启地址都会变。

</details>

## 手机小组件（可选）

iPhone 桌面 / 锁屏常驻显示全平台粉丝、今日涨粉、最新一期播放、站点近 7 天注册和收入，点一下打开麦田。

1. `config.json` 的 `web` 里加 `"widgetToken": "<一串随机字符>"`（只读口令，只能读 `/api/widget` 的汇总数字）；想在小组件上显示头像和署名，再加 `"avatar": "data/avatar.jpg"`、`"owner": "你的名字"`（中号、大号还会显示最新一期封面）
2. 手机上登录麦田后打开 `/widget`，按页面提示装 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)、复制脚本（地址和口令已填好）。复制的是一个加载器：每次刷新从麦田的 `/api/widget/code` 拉最新的 `scripts/widget/maitian-widget.js` 来运行，以后改样式手机上自动生效，拉不到就用上次存下的那份
3. 桌面添加 Scriptable 小组件（小 / 中 / 大），锁屏也可以加（长条 / 圆形 / 单行），Script 选它

另外，Safari 里「分享 → 添加到主屏幕」可以把麦田当 App 用（全屏、带麦苗图标）。

## 数据和隐私

- `config.json`、`data/`（数据库、日志）、`chrome-profile/`（各平台登录态）都不进 git。
- 麦田只读你自己账号的创作者后台数据，不做互动自动化、不碰别人的账号。
- 安装向导结尾、出错通知（每天最多一次）和没接站点时的「转化」页里，有一个作者知识站和交流群的链接，带 utm 参数，只是让知识站知道访客从麦田来；麦田本身不上报任何数据。不想看到就在 `config.json` 里加 `"learnLinks": false`。

## 作者

<p align="center"><a href="https://www.mdldm.club/ai-course-promotion?utm_source=github&utm_medium=readme&utm_campaign=maitian-readme"><img src="docs/readme/author.png" alt="麦当 mdldm · 0 基础 AI Agent 教学博主 · mdldm.club 知识站" /></a></p>

我是麦当，做 0 基础 AI Agent / AI Coding 教程。麦田是照着我自己的发布流程一点点搭起来的，一边发视频一边在改。

- 📚 **知识站 [mdldm.club](https://www.mdldm.club/ai-course-promotion?utm_source=github&utm_medium=readme&utm_campaign=maitian-readme)**：0 基础 AI Agent 课程 + 每周直播。麦田怎么搭、数据怎么采、怎么接自己的项目，课里讲得更细。
- 🎬 B站 / 小红书 / 抖音 / 视频号：搜「麦当mdldm」
- ▶️ [YouTube](https://www.youtube.com/channel/UCOz23ZQMefLAgDdnraGV2RQ) · 𝕏 [@czzzzzzJ_](https://x.com/czzzzzzJ_)

### 交流群

想一起聊麦田、多平台运营的，微信扫码进群（1–5 群已满，现在开的是 6 群）：

<p align="center"><img src="docs/readme/qr-group.jpg" width="260" alt="微信群：麦当 mdldm 的麦田 6 群" /></p>

> 微信群码 7 天有效（这张 11 月 27 日前可扫），我会定期换；扫不进去就提个 Issue 喊我一声。

觉得有用就点个 ⭐ Star，这是我继续改下去的动力；遇到问题直接提 [Issue](https://github.com/CzzzzzzJ/mdldm-maitian/issues)。

## Star History

<a href="https://www.star-history.com/?repos=czzzzzzj%2Fmdldm-maitian&type=date&releases=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=czzzzzzj/mdldm-maitian&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=czzzzzzj/mdldm-maitian&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=czzzzzzj/mdldm-maitian&type=date&legend=top-left" />
 </picture>
</a>

## License

MIT
