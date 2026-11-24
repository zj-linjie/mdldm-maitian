// Runs inside `ego-browser nodejs` with the documented TaskSpace and Page APIs.
import net from 'node:net';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

const userHasControl = error => /user now controls this task space|agentDelegatedToUser/i.test(error.message);

export async function serve(socketPath, spaceName) {
  const socket = net.createConnection(socketPath);
  const messages = readline.createInterface({ input: socket });
  const pages = new Map();
  const pending = new Set();
  let task, blank, paused;

  function pageOf(id) {
    const page = pages.get(id);
    if (!page) throw new Error(`找不到 Ego Lite 标签页 ${id}`);
    return page;
  }

  const operations = {
    async create({ id, url, active }) {
      const pending = blank || task.newPage();
      blank = null;
      const page = await pending;
      try {
        await page.goto(url || 'about:blank', { waitUntil: 'commit', timeout: 30000 });
        if (active) await page.cdp('Page.bringToFront');
      } catch (error) {
        if (!userHasControl(error)) await page.close().catch(() => {});
        throw error;
      }
      pages.set(id, page);
      return { id, url, windowId: 1 };
    },
    async get(id) {
      const info = await pageOf(id).info();
      return { id, url: info.url, title: info.title, windowId: 1 };
    },
    async activate(id) { await pageOf(id).cdp('Page.bringToFront'); return { id }; },
    async remove(ids) {
      for (const id of [].concat(ids)) {
        const page = pages.get(id);
        if (!page) continue;
        pages.delete(id);
        const open = (await task.pages()).some(item => item.label === page.label);
        if (open) await page.close();
      }
    },
    async cdp({ tabId, method, params }) {
      const page = pageOf(tabId);
      // Upload forms may defer the file-change handler while the tab is hidden.
      if (method === 'DOM.setFileInputFiles') await page.cdp('Page.bringToFront');
      return page.cdp(method, params);
    },
    async finish() {
      const open = new Set((await task.pages()).map(page => page.label));
      await task.finish({ keep: [...pages.values()].map(page => page.label).filter(label => open.has(label)) });
      task = null;
    },
  };

  const send = value => socket.write(JSON.stringify(value) + '\n');
  try {
    task = await globalThis.taskSpace(spaceName);
    blank = task.page('p1');
    send({ ready: true });
    for await (const line of messages) {
      const { id, operation, args } = JSON.parse(line);
      const run = async () => {
        try {
          if (paused) {
            if (operation !== 'finish') throw paused;
            task = null; // Ego Lite has already handed the space to the user.
            send({ id });
            return;
          }
          send({ id, value: await operations[operation](args) });
        } catch (error) {
          if (!paused && userHasControl(error)) {
            paused = new Error(`请在 Ego Lite 的「${spaceName}」处理浏览器提示。填写中断时先核对原标签页的上传状态。`);
          }
          send({ id, error: (paused || error).message, paused: !!paused });
        }
      };
      if (operation === 'finish') {
        // Some publisher cleanup is fire-and-forget. Give it time before closing the Space.
        await Promise.race([Promise.allSettled([...pending]), delay(1500, undefined, { ref: false })]);
        await run();
        break;
      }
      const operationResult = run();
      pending.add(operationResult);
      void operationResult.finally(() => pending.delete(operationResult));
    }
  } catch (error) {
    send({ startupError: error.message });
  } finally {
    // On lost IPC, leave outstanding tabs available for the user.
    if (task && !paused) await task.finish({ keep: 'all' }).catch(() => {});
    messages.close();
    socket.end();
  }
}
