import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { browserOf } from '../src/browser-config.mjs';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const platforms = ['bilibili', 'douyin', 'xhs', 'channels'];

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maitian-ego-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const runner = path.join(dir, 'ego');
  const trace = path.join(dir, 'trace.jsonl');
  const cfg = path.join(dir, 'config.json');
  const plugin = path.join(dir, 'Profile 2', 'Extensions', 'eaaipbilkhibicihiollecmbpneikpnj', '0.5.1_0');
  const project = path.join(dir, 'smoke');
  const db = path.join(dir, 'hub.db');
  const options = { cwd: root, env: { ...process.env, MAITIAN_CONFIG: cfg, MAITIAN_DB: db, HUB_DRIVER: 'direct' }, timeout: 20000 };
  fs.mkdirSync(path.join(plugin, 'lib'), { recursive: true });
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(plugin, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(plugin, 'manifest.json'), '{"version":"0.5.1"}');
  fs.writeFileSync(path.join(plugin, 'lib/bundle.js'), `
    export const validate = () => ({ errors: [], warnings: [] });
    export const PLATFORMS = {};
  `);
  fs.writeFileSync(path.join(plugin, 'lib/cdp.js'), `
    export const send = (tabId, method, params) => chrome.debugger.sendCommand({ tabId }, method, params);
    export const evaluate = (tabId, expression) => send(tabId, 'Runtime.evaluate', { expression });
  `);
  fs.writeFileSync(path.join(plugin, 'lib/publish.js'), `
    export const ADAPTERS = Object.fromEntries(${JSON.stringify(platforms)}.map(id => [id, true]));
    export async function preflight(ids, { keepTabs }) {
      return Object.fromEntries(await Promise.all(ids.map(async id => {
        const tab = await chrome.tabs.create({ url: 'https://example.test/' + id });
        await chrome.debugger.attach({ tabId: tab.id });
        if (!keepTabs) void chrome.tabs.remove(tab.id).catch(() => {});
        return [id, { ok: true, tabId: tab.id }];
      })));
    }
    export async function run(project, { platforms, onChange }) {
      const tabs = await preflight(platforms, { keepTabs: true });
      return Promise.all(platforms.map(async id => {
        const tabId = tabs[id].tabId;
        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', { files: ['sample.mp4'] });
        const state = { id, tabId, status: '待你发布', logs: [] };
        onChange(state);
        return state;
      }));
    }
  `);
  fs.writeFileSync(runner, `#!${process.execPath}
    const fs = require('node:fs');
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const trace = (operation, data) => fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify({operation, data}) + '\\n');
    globalThis.taskSpace = async () => {
      const pages = new Map();
      const create = () => {
        const label = 'p' + (last++);
        let url = 'about:blank';
        const page = {
          label,
          goto: async value => { url = value; trace('goto', url); },
          info: async () => ({ url, title: url }),
          close: async () => { await new Promise(resolve => setTimeout(resolve, 35)); pages.delete(label); trace('close', label); },
          cdp: async (name, params) => {
            trace(name, { url, params });
            if (params?.expression === 'pause') throw new Error('The user now controls this task space.');
            if (name === 'Page.captureScreenshot') return { data: 'YQ==' };
            return {};
          },
        };
        pages.set(label, page);
        return page;
      };
      let last = 1;
      create();
      return { page: id => pages.get(id), newPage: async () => create(), pages: async () => [...pages.values()], finish: async ({ keep }) => trace('finish', keep) };
    };
    new AsyncFunction(process.argv[4])().catch(e => { console.error(e); process.exitCode = 1; });
  `, { mode: 0o700 });
  const config = { egoCommand: runner, egoProfile: path.join(dir, 'Profile 2'), rootPath: dir, batches: [['bilibili', 'douyin'], ['xhs', 'channels']], manual: platforms, auto: [] };
  fs.writeFileSync(cfg, JSON.stringify(config));
  fs.writeFileSync(path.join(project, 'publish.json'), JSON.stringify({ id: 'smoke', name: 'Ego smoke test', platforms: Object.fromEntries(platforms.map(id => [id, {}])) }));
  return { cfg, config, options, project, db, trace: () => fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse) };
}

test('Ego Lite is the default and Chrome requires a valid explicit option', () => {
  assert.equal(browserOf({}), 'ego');
  assert.equal(browserOf({ browser: 'chrome' }), 'chrome');
  assert.throws(() => browserOf({ browser: 'other' }), /browser/);
});

test('the default CLI runs login, preflight and manual publishing through Ego Lite', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  assert.match((await exec(process.execPath, ['src/hub.mjs', 'login', '--only', platforms.join(',')], f.options)).stdout, /Ego Lite已打开 4 个/);
  assert.match((await exec(process.execPath, ['src/hub.mjs', 'doctor', '--only', platforms.join(','), '--quiet'], f.options)).stdout, /视频号：✅ 已登录/);
  await exec(process.execPath, ['src/hub.mjs', 'run', f.project, '--only', platforms.join(',')], f.options);
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(f.db, { readOnly: true });
  t.after(() => database.close());
  const states = database.prepare('SELECT platform, state FROM tasks WHERE episode_id=? ORDER BY platform').all('smoke');
  assert.deepEqual(states.map(x => [x.platform, x.state]), platforms.toSorted().map(id => [id, 'awaiting_user']));
  const events = f.trace();
  assert.deepEqual(events.filter(e => e.operation === 'finish').map(e => e.data.length), [4, 0, 4]);
  const fileEvents = events.filter(e => ['Page.bringToFront', 'DOM.setFileInputFiles'].includes(e.operation) && e.data.url.startsWith('https://example.test/'));
  assert.equal(fileEvents.filter(e => e.operation === 'DOM.setFileInputFiles').length, 4);
  for (const id of platforms) {
    assert.deepEqual(fileEvents.filter(e => e.data.url.endsWith('/' + id)).map(e => e.operation), ['Page.bringToFront', 'DOM.setFileInputFiles']);
  }
  assert.equal(events.filter(e => e.operation === 'Page.captureScreenshot').length, 4);
});

test('missing Ego and browser handoff never fall back to Chrome', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  fs.writeFileSync(f.cfg, JSON.stringify({ ...f.config, egoCommand: f.config.egoCommand + '-missing' }));
  await assert.rejects(exec(process.execPath, ['src/hub.mjs', 'login', '--only', 'bilibili'], f.options), /找不到 ego-browser/);
  fs.writeFileSync(f.cfg, JSON.stringify(f.config));
  const script = `
    import * as driver from './src/driver.mjs';
    await driver.withTab('https://example.test/healthy', async id => {
      await driver.close({ interruptedOnly: true });
      await driver.evaluate(id, 'keep the healthy browser open');
    }, { wait: 0 });
    try {
      await driver.withTab('https://example.test/prompt', id => driver.evaluate(id, 'pause'), { wait: 0 });
    } catch (error) { console.log(error.message); }
    try { await driver.openForLogin(['https://example.test/other']); }
    catch (error) { console.log(error.message); }
    await driver.close({ interruptedOnly: true });
    await driver.openForLogin(['https://example.test/next-operation']);
    await driver.close();
  `;
  assert.match((await exec(process.execPath, ['--input-type=module', '-e', script], f.options)).stdout, /处理浏览器提示/);
  assert.deepEqual(f.trace().filter(e => ['goto', 'close', 'finish'].includes(e.operation)), [
    { operation: 'goto', data: 'https://example.test/healthy' },
    { operation: 'close', data: 'p1' },
    { operation: 'goto', data: 'https://example.test/prompt' },
    { operation: 'goto', data: 'https://example.test/next-operation' },
    { operation: 'finish', data: ['p1'] },
  ]);
});
