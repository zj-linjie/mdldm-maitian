# 麦田 · 安装指引（供 Agent 执行）

你被要求安装麦田并接入其发布能力。本文件是执行规范，按步骤依次完成。每一步都标明了由谁执行：你能自己做的直接做，必须用户操作的明确转交用户，不要跳过、不要假装完成。

## 麦田是什么

麦田是多平台视频分发与数据回采工具，三部分配合：

| 部分 | 做什么 |
|---|---|
| 发布 skill（你负责装） | 看片、写各平台文案、生成发布工程并校验 |
| 麦田发布助手（Chrome 插件，用户装） | 在各平台上传页实际填写、上传、设定时 |
| 麦田本体（你负责装） | 调度、定时、防重、取链接、采数据、大屏、飞书通知 |

## 前置条件

- macOS 或 Windows 10/11
- git
- Node.js ≥ 22.5（用到内置 `node:sqlite`）
- macOS 默认用 Ego Lite。Windows 使用显式配置的 Google Chrome。

## 步骤

### 1. 检查环境

```bash
git --version
node -v
```

校验 Node 版本是否达标：

```bash
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)'
```

不通过则停止后续步骤，把 Node 安装地址 `https://nodejs.org` 交给用户，说明需要 Node.js 22.5 以上，等用户装好再继续。

### 2. 下载麦田本体

装到 `~/maitian/`（用户可通过环境变量 `MAITIAN_HOME` 指定其他目录，有则用其值；后面每一步的路径都按同一个目录来）：

```bash
DIR=${MAITIAN_HOME:-$HOME/maitian}
mkdir -p "$DIR" && cd "$DIR"
if [ -d mdldm-maitian/.git ]; then
  git -C mdldm-maitian pull --ff-only -q
else
  git clone --depth 1 https://github.com/CzzzzzzJ/mdldm-maitian.git
fi
```

Windows（PowerShell）：将 `$HOME\maitian` 作为目录（或读 `MAITIAN_HOME`），克隆到 `mdldm-maitian`：

```powershell
$Base = if ($env:MAITIAN_HOME) { $env:MAITIAN_HOME } else { Join-Path $HOME 'maitian' }
New-Item -ItemType Directory -Force -Path $Base | Out-Null
$dest = Join-Path $Base 'mdldm-maitian'
if (Test-Path (Join-Path $dest '.git')) { git -C $dest pull --ff-only -q }
else { git clone --depth 1 https://github.com/CzzzzzzJ/mdldm-maitian.git $dest }
```

### 3. 把发布 skill 装进**你自己**的 skill 目录

这是关键一步。**不要**装到其他 Agent 的目录。先确定你所属 Agent 的 skill 目录：

- **Claude Code**：`~/.claude/skills/`
- **Codex / 其他 Agent**：查该 Agent 的文档，找到它的 skill 目录。

把 skill 链接（或拷贝）进去，确保目录下有 `SKILL.md`：

```bash
SKILL_DIR=<你所属 Agent 的 skill 目录>   # 例如 ~/.claude/skills
mkdir -p "$SKILL_DIR"
MAITIAN_DIR=${MAITIAN_HOME:-$HOME/maitian}/mdldm-maitian
ln -s "$MAITIAN_DIR/skills/maitian-publish" "$SKILL_DIR/maitian-publish"
```

不会用符号链接的 Agent，直接把 `<安装目录>/mdldm-maitian/skills/maitian-publish` 整个目录拷进 skill 目录。

Windows（PowerShell）没有 `ln -s`，直接拷贝：

```powershell
$Base = if ($env:MAITIAN_HOME) { $env:MAITIAN_HOME } else { Join-Path $HOME 'maitian' }
$SkillDir = '<你所属 Agent 的 skill 目录>'
New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $Base 'mdldm-maitian\skills\maitian-publish') $SkillDir
```

拷贝的方式不会跟着 `git pull` 更新，麦田升级后要重新拷一次。

装好后确认：`<skill 目录>/maitian-publish/SKILL.md` 存在。

### 4. 生成配置（可选，向导也会做）

```bash
cd "${MAITIAN_HOME:-$HOME/maitian}/mdldm-maitian"
cp config.example.json config.json
```

`config.json` 的字段向导会逐项问；也可以先留着，等向导生成，不强制。

### 5. 把需要用户做的事转交用户

以下步骤需要交互式终端或人工操作，你无法代劳，**务必明确列出并转交用户**，不要自己尝试、不要声称已完成：

1. **运行安装向导**（交互式：检查环境、生成 `config.json`、装开机自启、打开各平台登录页）：

   ```bash
   cd "${MAITIAN_HOME:-$HOME/maitian}/mdldm-maitian" && node src/init.mjs
   ```

   向导最后会给出大屏地址 `http://localhost:8787/?key=<web.key>`，请用户在浏览器打开。

2. **装麦田发布助手（Chrome 插件）**：请用户在选定浏览器的 [Chrome 应用商店](https://chromewebstore.google.com/detail/eaaipbilkhibicihiollecmbpneikpnj) 安装。Ego Lite 的资料路径见其 `chrome://version`，把路径填进 `config.json` 的 `egoProfile`。

3. **登录各平台**：请用户在麦田选定的浏览器里登录要发布的平台账号。

### 6. 验证

用户完成向导和登录后，检查各平台登录态（不上传、不填写）：

```bash
cd "${MAITIAN_HOME:-$HOME/maitian}/mdldm-maitian" && node src/hub.mjs doctor
```

全部通过即安装完成。此后用户说「整理发布 / 进入发布」等触发词，发布 skill 即开始工作。

## 排错

- **Node 版本不够**：装 22.5+ 后重跑第 1 步。
- **向导在非交互终端卡住**：`node src/init.mjs` 需要终端交互。在没有交互终端的环境里，先 `cp config.example.json config.json` 填好，macOS 再跑 `scripts/install-launchd.sh` 装开机自启，然后请用户手动跑向导。
- **skill 没被识别**：确认装在了你自己所属 Agent 的 skill 目录、且目录下有 `SKILL.md`；不同 Agent 的 skill 目录不同，别装错。
