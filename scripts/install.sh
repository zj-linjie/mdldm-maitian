#!/bin/bash
# 麦田一行安装：
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/CzzzzzzJ/mdldm-maitian/main/scripts/install.sh)"
# 做的事：检查 git 和 Node（≥22.5）→ 把麦田下载到 ~/maitian/ → 运行安装向导（麦田发布助手从 Chrome 应用商店装）
# 换目录：MAITIAN_HOME=~/somewhere bash -c "$(curl -fsSL …)"
set -e
DIR=${MAITIAN_HOME:-$HOME/maitian}
say() { echo; echo "== $1"; }

say "麦田 · 一行安装（装到 $DIR）"
command -v git >/dev/null || { echo "需要 git：先装 Xcode 命令行工具（xcode-select --install）"; exit 1; }
if ! command -v node >/dev/null; then echo "需要 Node.js 22.5 以上：brew install node，或去 https://nodejs.org 下载"; exit 1; fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)' || { echo "Node.js 版本是 $(node -v)，需要 22.5 以上"; exit 1; }

mkdir -p "$DIR"; cd "$DIR"
for R in mdldm-maitian; do
  if [ -d "$R/.git" ]; then say "更新 $R"; git -C "$R" pull --ff-only -q; else say "下载 $R"; for i in 1 2 3; do git clone --depth 1 "https://github.com/CzzzzzzJ/$R.git" && break; echo "下载失败，第 $i 次重试"; rm -rf "$R"; sleep 3; done; [ -d "$R/.git" ] || { echo "$R 下载失败，检查网络后重跑这条命令"; exit 1; }; fi
done

say "麦田发布助手（Chrome 插件）"
echo "安装向导最后会在你选择的浏览器里打开应用商店。默认使用 Ego Lite。"

say "发布 skill"
L="$HOME/.claude/skills/maitian-publish"
if [ -e "$L" ] || [ -L "$L" ]; then echo "~/.claude/skills/maitian-publish 已经存在，没动它"
elif [ -d "$HOME/.claude/skills" ]; then ln -s "$DIR/mdldm-maitian/skills/maitian-publish" "$L"; echo "已链接到 ~/.claude/skills/maitian-publish（Claude Code 里说「整理发布」就会用上）"
else echo "没找到 ~/.claude/skills；用 Claude Code 的话，把 $DIR/mdldm-maitian/skills/maitian-publish 放进 ~/.claude/skills/"; fi

say "安装向导"
[ -t 0 ] || { echo "安装向导需要在终端里交互：cd $DIR/mdldm-maitian && node src/init.mjs"; exit 0; }
cd "$DIR/mdldm-maitian" && node src/init.mjs
