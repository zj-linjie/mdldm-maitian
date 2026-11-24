// 麦田发布助手（各平台填写引擎）在哪：
//   默认从选定浏览器的资料目录读取应用商店版。
//   config.plugin = 'local' 时用 config.pluginDir（插件开发者自己调试用）。
import fs from 'node:fs'; import path from 'node:path';
import { config } from './feishu.mjs';
import { browserName, browserOf, homePath } from './browser-config.mjs';
import { PROFILE } from './chrome-shim.mjs';

export const STORE_ID = 'eaaipbilkhibicihiollecmbpneikpnj';
export const STORE_URL = `https://chromewebstore.google.com/detail/${STORE_ID}`;

const ver = (s) => s.split(/[._]/).map(Number);
const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const usable = (d) => d && fs.existsSync(path.join(d, 'lib', 'publish.js'));

export function storeDir() {
  const profile = browserOf(config) === 'ego' ? config.egoProfile : path.join(PROFILE, 'Default');
  if (!profile) return null;
  const base = path.join(homePath(profile), 'Extensions', STORE_ID);
  let dirs = []; try { dirs = fs.readdirSync(base).filter(n => /^\d+(\.\d+)*_\d+$/.test(n)); } catch { return null; }
  const best = dirs.sort(newer).reverse().map(n => path.join(base, n)).find(usable);
  return best || null;
}

function versionOf(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version; } catch { return null; } }

// 返回 { source: 'store' | 'local' | null, dir, version }
export function pluginInfo() {
  const dir = config.pluginDir && homePath(config.pluginDir);
  const local = usable(dir) ? dir : null;
  if (config.plugin === 'local') return local ? { source: 'local', dir: local, version: versionOf(local) } : { source: null };
  const store = storeDir();
  if (store) return { source: 'store', dir: store, version: versionOf(store) };
  // 老配置：没装商店版但有本地插件目录，先接着用本地的
  return local ? { source: 'local', dir: local, version: versionOf(local) } : { source: null };
}

export function pluginDir() {
  const p = pluginInfo();
  if (!p.dir) {
    const browser = browserOf(config);
    const profileHint = browser === 'ego' ? '，并把 Ego Lite 的 chrome://version 所显示的资料路径填到 egoProfile' : '';
    throw new Error(`找不到麦田发布助手：运行 node src/hub.mjs login，在${browserName(browser)}安装发布助手${profileHint}（${STORE_URL}）`);
  }
  return p.dir;
}
