import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { config } from './feishu.mjs';
import { egoExecutable } from './browser-config.mjs';

const worker = new URL('./ego-worker.mjs', import.meta.url).href;
const REQUEST_TIMEOUT = 180000;
let current, nextTab = 1;

function start() {
  const executable = egoExecutable(config);
  if (!executable) throw new Error('找不到 ego-browser。请安装并完成 Ego Lite 初始化，或设置 egoCommand');
  if (process.platform === 'win32') throw new Error('麦田的 Ego Lite 接入暂支持 macOS。Windows 可显式设置 browser 为 chrome');

  // A short POSIX socket path fits macOS's sun_path limit, even when TMPDIR is long.
  const directory = fs.mkdtempSync('/tmp/maitian-ego-');
  const socketPath = path.join(directory, 'worker');
  const name = `麦田 ${randomUUID().slice(0, 8)}`;
  const pending = new Map();
  let child, socket, sequence = 0, ready = false, interruption, stderr = '', finished = false;
  const server = net.createServer();
  const { promise, resolve, reject } = Promise.withResolvers();
  const connection = { check, request, stop, interrupted: () => !!interruption };
  const startup = setTimeout(() => stop(new Error('连接 Ego Lite 超时，请打开 Ego Lite 后重试')), 15000);

  function stop(error) {
    if (finished) return;
    finished = true;
    clearTimeout(startup);
    if (current === connection) current = undefined;
    if (!ready) reject(error);
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
    socket?.destroy();
    server.close();
    if (child?.exitCode === null && child?.signalCode === null) child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }

  async function check({ finishing = false } = {}) {
    await promise;
    if (finished) throw new Error('Ego Lite 已断开连接');
    if (interruption && !finishing) throw interruption;
  }

  async function request(operation, args, timeout = REQUEST_TIMEOUT) {
    await check({ finishing: operation === 'finish' });
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => stop(new Error(`Ego Lite 操作超时：${operation}`)), timeout);
      pending.set(id, { resolve, reject, timer });
      socket.write(JSON.stringify({ id, operation, args }) + '\n');
    });
  }

  server.once('error', stop);
  server.on('connection', candidate => {
    if (socket || finished) { candidate.destroy(); return; }
    socket = candidate;
    server.close();
    socket.once('error', stop);
    socket.once('close', () => stop(new Error('Ego Lite 已断开连接')));
    const lines = readline.createInterface({ input: socket });
    lines.on('line', line => {
      let reply;
      try { reply = JSON.parse(line); }
      catch { stop(new Error('Ego Lite 返回了无效响应')); return; }
      if (reply.startupError) { stop(new Error(reply.startupError)); return; }
      if (reply.ready) { ready = true; clearTimeout(startup); resolve(); return; }
      if (reply.paused) interruption ??= new Error(reply.error);
      const entry = pending.get(reply.id);
      if (!entry) return;
      pending.delete(reply.id);
      clearTimeout(entry.timer);
      if (reply.error) entry.reject(new Error(reply.error));
      else entry.resolve(reply.value);
    });
  });
  server.listen(socketPath, () => {
    const script = `await (await import(${JSON.stringify(worker)})).serve(${JSON.stringify(socketPath)}, ${JSON.stringify(name)})`;
    child = spawn(executable, ['nodejs', '-e', script], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-1200); });
    child.once('error', stop);
    child.once('exit', () => stop(new Error(stderr.trim() || 'Ego Lite 运行时已退出')));
  });
  return connection;
}

const connection = () => current ??= start();
const request = (operation, args) => connection().request(operation, args);
export async function launchBrowser() { await connection().check(); }
export async function closeConnection() {
  const active = current;
  if (!active) return;
  try { await active.request('finish', null, 5000); }
  finally { active.stop(new Error('Ego Lite 连接已关闭')); }
}
export async function closeInterrupted() {
  if (current?.interrupted()) await closeConnection();
}

export const chrome = {
  runtime: { id: 'publish-hub' },
  scripting: { executeScript: async () => { throw new Error('麦田的 Ego Lite 驱动不支持 chrome.scripting'); } },
  tabs: {
    create: options => request('create', { ...options, id: nextTab++ }),
    get: id => request('get', id),
    query: async () => [],
    update: (id, { active }) => active ? request('activate', id) : Promise.resolve({ id }),
    remove: ids => request('remove', ids),
  },
  debugger: {
    onDetach: { addListener() {} },
    attach: async ({ tabId }) => { await request('cdp', { tabId, method: 'Page.enable', params: {} }); },
    detach: async () => {},
    sendCommand: ({ tabId }, method, params = {}) => request('cdp', { tabId, method, params }),
  },
};
