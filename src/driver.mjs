// 发布助手在 Node 中运行，浏览器后端默认为 Ego Lite。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './feishu.mjs';
import { browserOf, browserName } from './browser-config.mjs';
import * as bridge from './bridge.mjs';
import { pluginDir, pluginInfo } from './plugin.mjs';

export const mode = (process.env.HUB_DRIVER || config.driver || 'direct');
export const browser = browserOf(config);
export const browserLabel = browserName(browser);
export const sleep = bridge.sleep;
const loadBrowser = () => browser === 'ego' ? import('./ego-shim.mjs') : import('./chrome-shim.mjs');
function usePluginBridge() {
  if (mode !== 'plugin') return false;
  if (browser === 'ego') throw new Error('Ego Lite 请使用 driver: direct。插件开发桥需要显式设置 browser: chrome');
  return true;
}
let lib = null;   // 插件的 publish.js / cdp.js（direct 模式下在本进程里加载）
async function load() {
  if (lib) return lib;
  const shim = await loadBrowser();
  globalThis.chrome = shim.chrome;
  const dir = pluginDir();
  const pub = await import(pathToFileURL(path.join(dir, 'lib/publish.js')).href);
  const cdp = await import(pathToFileURL(path.join(dir, 'lib/cdp.js')).href);
  return (lib = { shim, pub, cdp });
}

export async function ensure() { if (usePluginBridge()) return bridge.ensureBridge(); const l = await load(); await l.shim.launchBrowser(); }
export async function evaluate(tabId, expr, timeout) { if (usePluginBridge()) return bridge.evaluate(tabId, expr, timeout); return (await load()).cdp.evaluate(tabId, expr); }
// 真实鼠标点击（直连模式用插件 cdp.js 的 click；开发桥模式退回元素 .click()）
export async function click(tabId, expr) {
  if (usePluginBridge()) return bridge.evaluate(tabId, `(()=>{const e=${expr};if(!e)return false;e.click();return true})()`);
  return (await load()).cdp.click(tabId, expr);
}
// 认领已开着的页面（hub submit 用）；插件方式不支持
export async function adoptTabs(re) { if (usePluginBridge() || browser === 'ego') throw new Error('认领已有发帖页需要 browser: chrome 和 driver: direct'); return (await load()).shim.adoptTargets(re); }
export async function withTab(url, fn, { wait = 8000 } = {}) {
  if (usePluginBridge()) return bridge.withTab(url, fn, { wait });
  await load(); const t = await chrome.tabs.create({ url, active: false });
  try { await sleep(wait); return await fn(t.id); } finally { await chrome.tabs.remove(t.id).catch(() => {}); }
}
export async function busy() { if (!usePluginBridge()) return false; const j = await bridge.panel('job', [], 30000); return !!(j && j.running); }

// 商店里的插件版本还没有某个平台的适配器（比如新平台刚加、商店还在审核）：这几个平台先跳过并说明
const split = (pub, ids) => [ids.filter(id => pub.ADAPTERS[id]), ids.filter(id => !pub.ADAPTERS[id])];
const tooOld = (id) => { const p = pluginInfo(); return `麦田发布助手 ${p.version || ''}（${p.source === 'store' ? '商店版' : '本地'}）还不支持 ${id}，等插件更新`; };

// 跑一批平台；onState(st) 在每次状态变化时调用，st = {id, status, logs, tabId}
export async function runBatch(project, batch, onState, onStall) {
  if (!usePluginBridge()) {
    const { pub, shim } = await load();
    if (browser === 'ego') await shim.launchBrowser();
    const [ok, missing] = split(pub, batch);
    const gone = missing.map(id => ({ id, status: '异常', logs: [{ kind: 'err', msg: tooOld(id) }] }));
    gone.forEach(onState);
    if (!ok.length) return gone;
    const states = await pub.run(project, { rootPath: config.rootPath, platforms: ok, onChange: (st) => onState(st), shouldStop: () => false });
    return [...Object.values(states), ...gone];
  }
  const r = await bridge.panel('startRaw', [project, batch, config.rootPath]);
  if (!r || !r.ok) throw new Error(`插件没能开始：${r ? r.error : '没有响应'}`);
  for (let miss = 0, warned = false; ;) {
    await sleep(20000);
    let j; try { j = await bridge.panel('job', [], 30000); miss = 0; } catch { miss++; }
    if (miss >= 6 && !warned) { warned = true; onStall && onStall(); }
    if (!j) continue;
    const st = Array.isArray(j.states) ? j.states : Object.values(j.states || {});
    for (const s of st) if (batch.includes(s.id)) onState(s);
    if (!j.running) return st;
  }
}
export async function checkLogin(ids) {
  if (usePluginBridge()) { const r = await bridge.panel('checkLogin', [ids], 120000); return r && r.ok ? r.result : {}; }
  const { pub, shim } = await load(); const [ok, missing] = split(pub, ids);
  const r = ok.length ? await pub.preflight(ok, { keepTabs: false }) : {};
  if (browser === 'ego') await shim.launchBrowser();
  for (const id of missing) r[id] = { ok: false, reason: tooOld(id) };
  return r;
}
export async function links(project, ids) {
  if (usePluginBridge()) { const r = await bridge.panel('links', [project, ids], 600000); if (!r || !r.ok) throw new Error(r ? r.error : '没有响应'); return r.result; }
  return (await load()).pub.collectLinks(project, ids, {});
}
// First-time setup must be able to open the store before the plugin exists.
export async function openForLogin(urls) { usePluginBridge(); const shim = await loadBrowser(); await shim.launchBrowser({ foreground: true }); for (const u of urls) await shim.chrome.tabs.create({ url: u, active: true }); }
export async function close({ interruptedOnly = false } = {}) {
  if (!interruptedOnly) await (await loadBrowser()).closeConnection();
  else if (browser === 'ego') await (await loadBrowser()).closeInterrupted();
}
// 页面截图（存档用），返回 JPEG Buffer
export async function screenshot(tabId) {
  const params = { format: 'jpeg', quality: 70 };
  const r = usePluginBridge() ? await bridge.call({ op: 'cdp', tabId, method: 'Page.captureScreenshot', params }) : await (await load()).cdp.send(tabId, 'Page.captureScreenshot', params);
  return Buffer.from(r.data, 'base64');
}

// Scope only account traffic to a second Chrome; normal publishing keeps its
// existing driver and profile. Explicitly start Chrome even for a cold daemon.
export async function withTrafficBrowser(target, fn) {
  if (browser === 'ego') {
    if (target.accountId && target.accountId !== 'default') throw new Error('B站副号需要显式设置 browser: chrome');
    await ensure();
    return fn();
  }
  if (usePluginBridge()) {
    if (target.accountId && target.accountId !== 'default') throw new Error('B站多账号需要 direct 模式');
    await ensure();
    return fn();
  }
  const shim = await import('./chrome-shim.mjs');
  return shim.withBrowser(target, async () => { await ensure(); return fn(); });
}

export async function openTrafficLogin(target) {
  if (browser === 'ego') {
    if (target.accountId && target.accountId !== 'default') throw new Error('B站副号需要显式设置 browser: chrome');
    return openForLogin(['https://member.bilibili.com/']);
  }
  if (usePluginBridge()) throw new Error('账号流量登录请使用 direct 模式，或在现有发布助手浏览器中登录');
  const shim = await import('./chrome-shim.mjs');
  return shim.withBrowser(target, () => openForLogin(['https://member.bilibili.com/']));
}
