// 专用 Chrome 的直连驱动：用调试端口实现插件代码依赖的那几个 chrome.* 接口，
// 这样 麦田发布助手（插件）lib 下的适配器不用改就能在中控进程里跑。
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './feishu.mjs';

const profileOf = (settings) => path.resolve((settings.chromeProfile || '~/publish-hub/chrome-profile').replace(/^~(?=\/|$)/, os.homedir()));
export const PROFILE = profileOf(config);
const BIN = process.platform === 'win32'
  ? ([process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA, 'C:\\Program Files'].filter(Boolean).map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')).find(p => fs.existsSync(p)) || 'chrome.exe')
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const context = new AsyncLocalStorage(), connections = new Map(), owners = new Map();
let nextTab = 1000;
function connection(options = config) {
  const port = options.chromePort || 9333, profile = profileOf(options);
  const key = `${port}\0${profile}`;
  if (!connections.has(key)) connections.set(key, createConnection(port, profile));
  return connections.get(key);
}
const current = () => context.getStore() || connection();
const owner = (id) => { const c = owners.get(id); if (!c) throw new Error(`No tab with id: ${id}.`); return c; };
export const withBrowser = (options, fn) => context.run(connection(options), fn);
export const launchBrowser = (options) => current().launchChrome(options);
export const adoptTargets = (re) => current().adoptTargets(re);
export function closeConnection() { for (const c of connections.values()) c.closeConnection(); connections.clear(); }

export const chrome = {
  runtime: { id: 'publish-hub' },
  scripting: { executeScript: async () => { throw new Error('专用 Chrome 里不支持 scripting'); } },
  tabs: {
    create: (options) => current().chrome.tabs.create(options),
    get: (id) => owner(id).chrome.tabs.get(id),
    query: async () => [],
    update: (id, options) => owner(id).chrome.tabs.update(id, options),
    remove: async (ids) => { for (const id of [].concat(ids)) if (owners.has(id)) await owner(id).chrome.tabs.remove(id); },
  },
  debugger: {
    onDetach: { addListener() {} },
    attach: ({ tabId }) => owner(tabId).chrome.debugger.attach({ tabId }),
    detach: async () => {},
    sendCommand: ({ tabId }, method, params) => owner(tabId).chrome.debugger.sendCommand({ tabId }, method, params),
  },
};

function createConnection(PORT, PROFILE) {

let ws = null, seq = 0;
const waiting = new Map();            // id -> {resolve, reject}
const tabs = new Map();               // tabId -> {targetId, sessionId}
const byTarget = new Map();           // targetId -> tabId

const version = () => fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(2000), redirect: 'error' }).then(r => {
  if (!r.ok) throw new Error('专用 Chrome 的调试端口不可用');
  return r.json();
});

// 启动专用 Chrome（已经在跑就直接用）。foreground=true 时把窗口带到前台（登录用）
async function launchChrome({ foreground = false } = {}) {
  try { await version(); } catch {
    fs.mkdirSync(PROFILE, { recursive: true });
    const args = [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-size=1500,1000'];
    const proc = spawn(BIN, args, { detached: true, stdio: 'ignore' });
    let launchError;
    proc.on('error', e => { launchError = e; });
    proc.unref();
    for (let i = 0; i < 30; i++) { await sleep(500); if (launchError) throw new Error('专用 Chrome 启动失败：' + launchError.message); try { await version(); break; } catch { if (i === 29) throw new Error('专用 Chrome 没启动起来'); } }
  }
  if (foreground) { try { execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${await pid()}) to true`]); } catch { /* 不影响 */ } }
}
async function pid() { return execFileSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN']).toString().trim().split('\n')[0]; }

let connecting = null;
function connect() {
  if (ws && ws.readyState === 1) return Promise.resolve();
  return (connecting ||= doConnect().finally(() => { connecting = null; }));
}
async function doConnect() {
  await launchChrome();
  const v = await version();
  const endpoint = new URL(v.webSocketDebuggerUrl);
  if (endpoint.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || Number(endpoint.port) !== PORT || endpoint.username || endpoint.password || !endpoint.pathname.startsWith('/devtools/browser/')) throw new Error('专用 Chrome 返回了无效的本地调试地址');
  const sock = new WebSocket(endpoint);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error('连不上专用 Chrome 的调试端口')); });
  ws = sock;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) {
      const w = waiting.get(m.id); waiting.delete(m.id); clearTimeout(w.timer);
      m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
      return;
    }
    // 「离开此网站？」等弹窗：自动点离开，不让它卡住浏览器
    if (m.method === 'Page.javascriptDialogOpening' && m.sessionId) raw('Page.handleJavaScriptDialog', { accept: true }, m.sessionId).catch(() => {});
    if (m.method === 'Target.targetDestroyed') { const t = byTarget.get(m.params.targetId); if (t) { tabs.delete(t); owners.delete(t); byTarget.delete(m.params.targetId); } }
  };
  ws.onclose = () => { ws = null; for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(new Error('专用 Chrome 断开了')); } waiting.clear(); for (const id of tabs.keys()) owners.delete(id); tabs.clear(); byTarget.clear(); };
  await raw('Target.setDiscoverTargets', { discover: true });
}
function raw(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq, pending = { resolve, reject }; waiting.set(id, pending);
    try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
    catch (e) { waiting.delete(id); reject(e); return; }
    pending.timer = setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); reject(new Error(`${method} 超时`)); } }, 180000); pending.timer.unref();
  });
}
function tabOf(id) { const t = tabs.get(id); if (!t) throw new Error(`No tab with id: ${id}.`); return t; }
async function session(id) {
  const t = tabOf(id);
  if (!t.sessionId) {
    t.sessionId = (await raw('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
    await raw('Page.enable', {}, t.sessionId).catch(() => {});
  }
  return t.sessionId;
}

const chrome = {
  runtime: { id: 'publish-hub' },
  scripting: { executeScript: async () => { throw new Error('专用 Chrome 里不支持 scripting'); } },
  tabs: {
    async create({ url, active = false }) {
      await connect();
      const { targetId } = await raw('Target.createTarget', { url: url || 'about:blank', background: !active });
      const id = nextTab++; tabs.set(id, { targetId }); byTarget.set(targetId, id); owners.set(id, api);
      return { id, url, windowId: 1 };
    },
    async get(id) {
      await connect();
      const { targetInfo } = await raw('Target.getTargetInfo', { targetId: tabOf(id).targetId });
      return { id, url: targetInfo.url, title: targetInfo.title, windowId: 1 };
    },
    async query() { return []; },
    async update(id, { active } = {}) { await connect(); if (active) await raw('Target.activateTarget', { targetId: tabOf(id).targetId }); return { id }; },
    async remove(ids) {
      await connect();
      for (const id of [].concat(ids)) { const t = tabs.get(id); if (!t) continue; await session(id).catch(() => {}); await raw('Target.closeTarget', { targetId: t.targetId }).catch(() => {}); tabs.delete(id); byTarget.delete(t.targetId); owners.delete(id); }
    },
  },
  debugger: {
    onDetach: { addListener() {} },
    async attach({ tabId }) { await connect(); await session(tabId); },
    async detach() { /* 会话留着，后面的回读和提交还要用 */ },
    async sendCommand({ tabId }, method, params = {}) { await connect(); return raw(method, params, await session(tabId)); },
  },
};
// 认领专用 Chrome 里已经开着的页面（别的进程填好的发帖页），返回本进程可用的 tabId
async function adoptTargets(re) {
  await connect();
  const { targetInfos } = await raw('Target.getTargets');
  return targetInfos.filter(t => t.type === 'page' && re.test(t.url)).map(t => {
    let id = byTarget.get(t.targetId);
    if (id == null) { id = nextTab++; tabs.set(id, { targetId: t.targetId }); byTarget.set(t.targetId, id); owners.set(id, api); }
    return id;
  });
}
function closeConnection() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(new Error('专用 Chrome 连接已关闭')); } waiting.clear();
  for (const id of tabs.keys()) owners.delete(id); tabs.clear(); byTarget.clear();
}
const api = { chrome, launchChrome, adoptTargets, closeConnection };
return api;
}
