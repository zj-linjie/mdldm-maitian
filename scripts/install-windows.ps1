# 麦田 · Windows 一键安装
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/scripts/install-windows.ps1 | iex"
# 做的事（与 scripts/install.sh 逐步对应）：检查 git 和 Node（≥22.5，缺了用 winget 装）→
#   把麦田和麦田发布助手克隆到 %USERPROFILE%\maitian\ → 拷双击启动器 → 接上发布 skill → 运行安装向导
# 换目录：先设环境变量 MAITIAN_HOME，如 $env:MAITIAN_HOME = 'D:\maitian' 再运行
$ErrorActionPreference = 'Stop'
$Base = if ($env:MAITIAN_HOME) { $env:MAITIAN_HOME } else { Join-Path $HOME 'maitian' }
$Hub  = Join-Path $Base 'mdldm-maitian'

function Say($t) { Write-Host "`n== $t" -ForegroundColor Green }
function Ok($t)  { Write-Host "  OK $t" }
function Tip($t) { Write-Host "  · $t" -ForegroundColor Yellow }
function Refresh-Path { $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User') }

Say "麦田 · Windows 一键安装（装到 $Base）"
New-Item -ItemType Directory -Force -Path $Base | Out-Null

# ---------- 1. Git ----------
Say '检查 Git'
if (Get-Command git -ErrorAction SilentlyContinue) { Ok 'git 已装' }
elseif (Get-Command winget -ErrorAction SilentlyContinue) {
  Tip '用 winget 安装 Git…'
  winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git 装完但当前窗口还认不到，关掉 PowerShell 重新打开再跑一次本脚本' }
  Ok 'git 已装'
} else { throw '需要 git：先去 https://git-scm.com/download/win 装 Git，或装好 winget 后重跑本脚本' }

# ---------- 2. Node.js >= 22.5 ----------
Say '检查 Node.js'
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  $v = (node -v) -replace 'v',''
  $p = $v.Split('.') | ForEach-Object { [int]$_ }
  if ($p[0] -gt 22 -or ($p[0] -eq 22 -and $p[1] -ge 5)) { $nodeOk = $true; Ok "Node.js $v" }
  else { Tip "Node.js $v 太旧，需要 22.5 以上" }
}
if (-not $nodeOk) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw '没找到 winget，请先去 https://nodejs.org 下载 Node.js 22.5+ 再重跑本脚本' }
  Tip '用 winget 安装 Node.js LTS…'
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node 装完但当前窗口还认不到，关掉 PowerShell 重新打开再跑一次本脚本' }
  Ok "Node.js $(node -v)"
}

# ---------- 3. 克隆/更新两个仓库 ----------
Say '下载麦田本体与发布助手'
foreach ($r in @('mdldm-maitian')) {
  $dest = Join-Path $Base $r
  if (Test-Path (Join-Path $dest '.git')) { Tip "更新 $r"; git -C $dest pull --ff-only -q }
  else {
    $done = $false
    for ($i = 1; $i -le 3 -and -not $done; $i++) {
      git clone --depth 1 "https://github.com/CzzzzzzJ/$r.git" $dest
      if (Test-Path (Join-Path $dest '.git')) { $done = $true }
      else { Tip "下载失败，第 $i 次重试"; if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }; Start-Sleep -Seconds 3 }
    }
    if (-not $done) { throw "$r 下载失败，检查网络后重跑本脚本" }
  }
  Ok $r
}

# ---------- 4. 双击启动器 ----------
Say '拷贝双击启动器'
foreach ($b in @('1-demo.bat','2-login.bat','3-doctor.bat','4-start.bat')) {
  $src = Join-Path $Hub "scripts\windows\$b"
  if (Test-Path $src) { Copy-Item $src (Join-Path $Base $b) -Force; Ok $b }
}

# ---------- 5. 麦田发布助手（Chrome 插件） ----------
Say '麦田发布助手（Chrome 插件）'
Write-Host '  在安装向导显式输入 chrome。向导会在麦田的专用 Chrome 里打开应用商店安装麦田发布助手。'

# ---------- 6. 发布 skill ----------
Say '发布 skill'
$SkillDir = Join-Path $HOME '.claude\skills'
$Link = Join-Path $SkillDir 'maitian-publish'
if (Test-Path $Link) { Write-Host '  ~/.claude/skills/maitian-publish 已经存在，没动它' }
elseif (Test-Path $SkillDir) {
  New-Item -ItemType Junction -Path $Link -Target (Join-Path $Hub 'skills\maitian-publish') | Out-Null
  Write-Host '  已链接到 ~/.claude/skills/maitian-publish（Claude Code 里说「整理发布」就会用上）'
} else { Write-Host "  没找到 ~/.claude/skills；用 Claude Code 的话，把 $Hub\skills\maitian-publish 放进 ~/.claude/skills" }

# ---------- 7. 安装向导 ----------
Say '安装向导'
Set-Location $Hub
node src/init.mjs
