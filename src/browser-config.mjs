import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function browserOf(config) {
  const browser = config.browser ?? 'ego';
  if (browser !== 'ego' && browser !== 'chrome') throw new Error('browser 只能设为 ego 或 chrome');
  return browser;
}

export const browserName = browser => browser === 'ego' ? 'Ego Lite' : '专用 Chrome';
export const homePath = value => value.replace(/^~(?=\/|$)/, os.homedir());

export function egoExecutable(config) {
  const candidates = config.egoCommand
    ? [homePath(config.egoCommand)]
    : [path.join(os.homedir(), '.local/bin/ego-browser'), ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, 'ego-browser'))];
  return candidates.find(file => {
    try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); }
    catch { return false; }
  });
}
