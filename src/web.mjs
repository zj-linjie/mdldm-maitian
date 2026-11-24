// 麦田：本地网页。播种（发布）、长势（流量）、收成（转化）、粮仓（档案）
import http from 'node:http'; import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path'; import { spawn, execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { db, NAMES, STATE_CN, episodes, getEpisode, getTasks, recentLogs, getSnapshot, getMeta, setMeta } from './db.mjs';
import { config, testFeishu } from './feishu.mjs';
import { SITE, siteOn, refreshSite, matchesSiteData } from './site.mjs';
import { applyFeishuPatch, applySitePatch, saveConfig, testSite } from './config-admin.mjs';
import { learnOn, learnUrl } from './learn.mjs';
import { buildSalesSummary, salesDateRange } from './sales.mjs';
import { review } from './review.mjs';
import { accessEmail } from './access.mjs';
import { initLogin, sessionOk, handleLogin } from './login.mjs';
import { browserName, browserOf, egoExecutable } from './browser-config.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(DIR, '..');
let W = config.web || { port: 8787, key: '' };
const send = (res, code, body, type = 'application/json; charset=utf-8', extra = {}) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', ...extra }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readPj = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'publish.json'), 'utf8')); } catch { return null; } };
const short = (n) => n.split(/[｜|]/)[0].trim();
const nickOf = (name, pj) => (pj && pj.nick) || (short(name).split(/[，,？?！!：:。]/)[0].trim() || short(name)).slice(0, 16);
const latest = db.prepare('SELECT * FROM metrics WHERE episode_id=? AND platform=? ORDER BY day DESC LIMIT 1');
const actions = [];   // 最近的操作（内存里）
// 平台管理：登录状态、按平台打开登录页、停用/启用（停用写 config.disabled）
const PLATFORMS = ['bilibili', 'douyin', 'xhs', 'channels', 'youtube', 'x', 'instagram', ...(config.batches?.flat().includes('wechat') ? ['wechat'] : [])];   // 知识站不是平台账号，不在这里
const CFG = process.env.MAITIAN_CONFIG || path.join(ROOT, 'config.json');
const platformList = () => PLATFORMS.filter(id => id !== 'zsz' || !SITE?.salesOnly).map(id => ({ id, name: NAMES[id] || id, state: getMeta(`login:${id}`) || '', reason: getMeta(`loginReason:${id}`) || '', day: getMeta(`loginDay:${id}`) || '', disabled: (config.disabled || []).includes(id) }));

function episodeView(ep, full = false) {
  const snap = getSnapshot(ep.id), pj = (snap && JSON.parse(snap.project)) || readPj(ep.dir) || { platforms: {} };
  let views = 0, inter = 0;
  const tasks = getTasks(ep.id).map(t => {
    const m = latest.get(ep.id, t.platform) || null;
    if (m) { views += m.views || 0; inter += (m.likes || 0) + (m.comments || 0) + (m.favorites || 0) + (m.shares || 0); }
    const p = pj.platforms[t.platform] || {};
    return { platform: t.platform, name: NAMES[t.platform] || t.platform, state: t.state, stateCn: STATE_CN[t.state] || t.state, detail: t.detail || '', url: t.url || '', updatedAt: t.updated_at,
      m: m && { day: m.day, views: m.views, likes: m.likes, comments: m.comments, favorites: m.favorites, shares: m.shares, extra: JSON.parse(m.extra || '{}') },
      publishedAt: t.published_at || p.published_at || '', publishedTitle: t.published_title || p.published_title || '',
      ...(full ? { copy: { title: p.title || p.shortTitle || '', body: p.desc || p.body || p.text || p.description || '', tags: p.tags || p.topics || [], covers: p.covers || [] }, shot: fs.existsSync(path.join(ep.dir, '发布档案', `${t.platform}.jpg`)) } : {}) };
  });
  // 封面缓存版本号：封面文件被替换（同 URL、新内容）时改 v，避免浏览器继续用旧的占位图
  const covers = Object.keys(pj.covers || {});
  let coverMtime = 0, coverSize = 0;
  for (const k of covers) { try { const s = fs.statSync(path.join(ep.dir, pj.covers[k])); coverMtime = Math.max(coverMtime, Math.round(s.mtimeMs)); coverSize += s.size; } catch {} }
  const coverVer = coverMtime ? Math.round(coverMtime / 1000).toString(36) + '-' + coverSize.toString(36) : '';
  // 实际发布时间：取各平台 published_at 里最早的一个（北京时间），没有就退回计划时间。
  // 视频号可能提前单独发布；保留平台原时间，整期优先按主平台定位。
  // 它的时间照实记在 platforms.channels.published_at 里，但不参与这个锚点，否则整期会回退到前一天。
  const MAIN_PLAT = ['douyin', 'bilibili', 'xhs', 'youtube', 'x', 'instagram', 'zsz'];
  const when = (raw) => {
    if (!raw) return NaN;
    const s = String(raw);
    const x = s.replace(' ', 'T');
    return Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(x) ? x : x + (x.length === 16 ? ':00+08:00' : '+08:00'));
  };
  // 扩展平台可能隔天单独发布，不改变已有主平台的日期锚点。
  // 否则整期会被拖到公众号那天，日历上就看不见四家真正发布的那一天。
  const ANCHOR_PLAT = new Set([...MAIN_PLAT, 'channels']);
  let firstPublish = 0, anyPublish = 0;
  for (const [pid, p] of Object.entries(pj.platforms || {})) {
    if (p.skip) continue;
    const t = when((tasks.find(t => t.platform === pid) || {}).publishedAt || p.published_at);
    if (!Number.isFinite(t)) continue;
    if (ANCHOR_PLAT.has(pid) && (!anyPublish || t < anyPublish)) anyPublish = t;   // 兜底：只有视频号发过也照样定位
    if (MAIN_PLAT.includes(pid) && (!firstPublish || t < firstPublish)) firstPublish = t;
  }
  const fallback = Object.entries(pj.platforms || {}).filter(([, p]) => !p.skip).map(([, p]) => when(p.published_at)).filter(Number.isFinite);
  const publishMs = firstPublish || anyPublish || (fallback.length ? Math.min(...fallback) : 0);
  const publishAt = publishMs ? new Date(publishMs).toISOString() : '';
  const out = { id: ep.id, episode: ep.episode, name: ep.name, short: short(ep.name), nick: nickOf(ep.name, pj), schedule: ep.schedule, publishAt, createdAt: ep.created_at, dir: ep.dir,
    campaign: (JSON.stringify(pj.platforms).match(/utm_campaign=([\w-]+)/) || [])[1] || '', covers, coverVer, durationSec: pj.durationSec || 0, tasks, views, inter };
  if (full) {
    out.logs = recentLogs(ep.id, 200);
    out.metrics = db.prepare('SELECT day, platform, views, likes, comments, favorites, shares FROM metrics WHERE episode_id=? ORDER BY day').all(ep.id);
    out.snapshotAt = snap && snap.taken_at;
    // 复盘：已经到了第 1/3/7 天的节点（和飞书卡片同一套算法）
    const t0 = Date.parse(ep.schedule || ep.created_at);
    out.reviews = tasks.some(t => t.state === 'published') ? [1, 3, 7].filter(a => Date.now() >= t0 + a * 864e5 || a === 1).map(a => { try { const r = review(ep, a); return { age: a, partial: Date.now() < t0 + a * 864e5, views: r.cur.views, ints: r.cur.ints, rows: r.cur.rows.map(x => ({ p: x.p, views: x.m.views, inter: x.m.likes + x.m.comments + x.m.favorites + x.m.shares })), prev: r.prev && { nick: r.prev.nick, views: r.prev.views, rows: r.prev.rows.map(x => ({ p: x.p, views: x.m.views })) }, fans: r.fans.sum, conv: r.conv || null }; } catch { return null; } }).filter(Boolean) : [];
    out.files = ['成片.mp4', '字幕.srt', '发布素材.md', 'publish.json', '发布记录.json'].filter(f => fs.existsSync(path.join(ep.dir, f)));
  }
  return out;
}

const ACT = { links: '取链接', mark: '标记', 'login-expired': '登录过期', upload: '上传', fill: '填写', submit: '提交', verify: '核对', state: '状态', 'start-batch': '开跑', plan: '登记计划', 'manual-submit': '手动提交', 'metrics-error': '采集出错', 'screenshot-error': '截图失败', 'article-job': '长文', 'deferred-run': '自动建课' };
function feed(n = 14) {
  const names = Object.fromEntries(episodes().map(e => [e.id, e.episode])), nicks = Object.fromEntries(episodes().map(e => [e.id, nickOf(e.name, readPj(e.dir))]));
  return db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(n).map(l => {
    let r = l.result || ''; try { const j = JSON.parse(r); r = j.status || j.note || ''; } catch {}
    return { ts: l.ts, episode: names[l.episode_id] || '', nick: nicks[l.episode_id] || '', platform: NAMES[l.platform] || l.platform || '', action: ACT[l.action] || l.action, result: STATE_CN[r] || String(r).slice(0, 40) };
  });
}
async function chromeUp() { try { const r = await fetch(`http://127.0.0.1:${config.chromePort || 9333}/json/version`, { signal: AbortSignal.timeout(800) }); return r.ok; } catch { return false; } }
async function browserHealth() {
  const id = browserOf(config), name = browserName(id);
  if (id === 'ego') {
    const ok = !!egoExecutable(config);
    return { id, name, ok, status: ok ? '已安装' : '待安装' };
  }
  const ok = await chromeUp();
  return { id, name, ok, status: ok ? '在线' : '没开' };
}

function widgetScript(req, file) {
  let base = `${req.headers['x-forwarded-proto'] || (req.headers['cf-visitor'] ? 'https' : 'http')}://${req.headers.host}`;
  try { base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tunnel.json'), 'utf8')).base || base; } catch {}
  return fs.readFileSync(path.join(ROOT, 'scripts', 'widget', file), 'utf8').replace('__MAITIAN_URL__', base).replace('__WIDGET_TOKEN__', W.widgetToken);
}
const latestPublished = () => episodes().filter(e => e.schedule && Date.parse(e.schedule) <= Date.now()).sort((a, b) => Date.parse(b.schedule) - Date.parse(a.schedule))[0];
// 手机小组件：只读汇总（粉丝、涨幅、最新一期播放、站点近 7 天），用单独的 config.web.widgetToken，只能读这一个接口
function widgetData() {
  const ORDER = ['bilibili', 'douyin', 'xhs', 'channels', 'youtube', 'x', 'instagram'];
  const rows = db.prepare("SELECT day, platform, total FROM followers WHERE day >= date('now','localtime','-40 day') AND total IS NOT NULL ORDER BY day").all();
  const by = {}; for (const r of rows) (by[r.platform] ||= []).push(r);
  const today = new Date().toLocaleDateString('sv-SE');
  const ago = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() - n); return t.toLocaleDateString('sv-SE'); };
  const stat = (p) => { const a = by[p]; if (!a || !a.length) return null; const last = a[a.length - 1];
    const prev = [...a].reverse().find(r => r.day < last.day), week = [...a].reverse().find(r => r.day <= ago(last.day, 7)) || (a[0] !== last ? a[0] : null);   // 记录不满 7 天就从最早一天算
    return { id: p, name: NAMES[p] || p, total: last.total, today: last.day === today && prev ? last.total - prev.total : 0, week: week ? last.total - week.total : 0, day: last.day }; };
  const platforms = ORDER.map(stat).filter(Boolean);
  const sum = k => platforms.reduce((n, p) => n + (p[k] || 0), 0);
  const now = Date.now();
  const pub = latestPublished();
  const ev = pub && episodeView(pub);
  const siteDay = SITE && SITE.salesOnly ? db.prepare('SELECT MAX(day) day FROM site_daily').get().day || today : today;
  const days = matchesSiteData(getMeta('siteShopName')) ? db.prepare('SELECT * FROM site_daily WHERE day >= ? AND day <= ? ORDER BY day').all(ago(siteDay, 6), siteDay) : [];
  const zsz = stat('zsz');
  const salesTotal = key => days.length === 7 && days.every(d => d[key] != null && Number.isFinite(d[key])) ? days.reduce((n, d) => n + Math.round(d[key] * 100), 0) / 100 : null;
  const revenue = salesTotal('revenue'), refund = salesTotal('refund');
  return { name: config.name || '麦田', owner: W.owner || '', avatar: !!W.avatar, fans: { total: sum('total'), today: sum('today'), week: sum('week') }, platforms,
    latest: ev && { title: ev.short, nick: ev.nick, views: ev.views, inter: ev.inter, hours: Math.round((now - Date.parse(pub.schedule)) / 36e5) },
    site: SITE && (SITE.salesOnly ? { name: SITE.name, salesOnly: true, dataThrough: days.length ? siteDay : null, orders: salesTotal('orders'), revenue, refund, net: revenue != null && refund != null ? Math.round((revenue - refund) * 100) / 100 : null }
      : { name: SITE.name, users: zsz && zsz.total, reg: days.reduce((n, d) => n + (d.reg || 0), 0), vip: days.reduce((n, d) => n + (d.vip || 0), 0), revenue: days.reduce((n, d) => n + (d.revenue || 0), 0) }),
    metricsDay: getMeta('metricsDay') || '', now: new Date().toISOString() };
}
const tokenEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const widgetPage = (code) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>麦田小组件</title>
<style>body{font-family:-apple-system,'PingFang SC',sans-serif;margin:0;padding:22px 18px 40px;background:#f6f1e6;color:#1c1a16;line-height:1.6}h1{font-size:24px;margin:0 0 6px}ol{padding-left:20px;font-size:15px}li{margin:6px 0}
button{width:100%;height:50px;border:0;border-radius:14px;background:#1c1a16;color:#fff;font-size:17px;font-weight:800;margin:14px 0}pre{background:#fff;border-radius:12px;padding:12px;font-size:11px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.tip{font-size:13px;color:#7a7160}</style></head><body><h1>🌾 麦田小组件</h1>
<ol><li>App Store 安装 <b>Scriptable</b>（免费）</li><li>点下面的按钮复制脚本（自动更新的加载器，只需粘贴这一次）</li><li>打开 Scriptable → 右上角 <b>＋</b> → 粘贴 → 标题改成「麦田」；已经有「麦田」脚本的，打开它全选、粘贴覆盖</li><li>长按桌面 → 左上角 <b>＋</b> → 搜 Scriptable → 选中号 → 添加；长按小组件 → 编辑小组件 → Script 选「麦田」</li><li>锁屏：长按锁屏 → 自定 → 添加小组件 → Scriptable → 同样选「麦田」</li></ol>
<button id="b">复制脚本</button><p class="tip">以后小组件改样式，手机上会自动用上新版，不用再粘贴。脚本里带着小组件口令，只能读汇总数字（粉丝、播放、站点近 7 天），打不开麦田别的页面。别发给别人；泄露了在 config.json 换一个 widgetToken 即可。</p>
<pre id="c"></pre><script>const code=${JSON.stringify(code).replace(/</g, '\\u003c')};document.getElementById('c').textContent=code;
document.getElementById('b').onclick=async()=>{try{await navigator.clipboard.writeText(code);b.textContent='已复制 ✓';}catch{const r=document.createRange();r.selectNodeContents(c);getSelection().removeAllRanges();getSelection().addRange(r);b.textContent='长按选中的文字复制';}};</script></body></html>`;

// 缩略图：macOS 自带 sips 缩放转 JPEG，按 原文件路径+修改时间+尺寸 缓存；失败返回 null（退回原图）
function thumb(f, w) {
  try {
    const st = fs.statSync(f), dir = path.join(ROOT, 'data', 'thumbs');
    const out = path.join(dir, crypto.createHash('sha1').update(`${f}|${st.mtimeMs}|${w}`).digest('hex') + '.jpg');
    if (fs.existsSync(out)) return out;
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('/usr/bin/sips', ['-Z', String(w), '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', f, '--out', out], { stdio: 'ignore', timeout: 20000 });
    return fs.existsSync(out) ? out : null;
  } catch { return null; }
}

// ---------- 集成管理（飞书 / 知识站） ----------
const metaJson = (k) => { const v = getMeta(k); if (!v) return null; try { return JSON.parse(v); } catch { return null; } };
function integrations() {
  const cs = config.site || {};
  const summary = SITE && !SITE.salesOnly && matchesSiteData(getMeta('siteShopName')) ? (() => {
    const rows = db.prepare("SELECT day, reg, revenue FROM site_daily WHERE day >= date('now','localtime','-7 day')").all();
    return { reg: rows.reduce((n, r) => n + (r.reg || 0), 0), revenue: rows.reduce((n, r) => n + (r.revenue || 0), 0) };
  })() : null;
  return {
    feishu: { webhook: config.feishuWebhook || '', login: W.login === 'feishu', lastTest: metaJson('integrations.feishu.lastTest') },
    site: {
      enabled: siteOn(), salesOnly: cs.provider === 'xiaoe', shopName: cs.shopName || '', name: cs.name || '', base: cs.base || '',
      adminPath: cs.adminPath || '/admin', coursesApi: cs.coursesApi || '/api/courses?admin=1',
      dashboardApi: cs.dashboardApi || '/api/admin/dashboard', coursePath: cs.coursePath || '/series/{seriesId}?courseId={id}',
      logo: cs.logo || '', lastTest: metaJson('integrations.site.lastTest'), summary,
    },
  };
}
const readJson = (req) => new Promise((res, rej) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 20000) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch { res({}); } }); req.on('error', rej); });
const snapConfig = () => JSON.parse(JSON.stringify(config));
const rollbackConfig = (backup) => { for (const k of Object.keys(config)) delete config[k]; Object.assign(config, backup); };

async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  // 访问控制：前面挂了 Cloudflare Access（邮箱验证码）就认它的登录凭证；否则用口令（第一次带 ?key= 进来，之后用 cookie）
  if (/^\/static\/icon-\d+\.png$/.test(u.pathname)) return send(res, 200, fs.readFileSync(path.join(DIR, 'web', path.basename(u.pathname))), 'image/png', { 'cache-control': 'max-age=86400' });   // 主屏幕图标不用登录
  if (u.pathname === '/api/widget/img') {   // 小组件图片：头像（config.web.avatar）或最新一期封面缩略图，同一个只读口令
    if (!W.widgetToken || !tokenEq(u.searchParams.get('t'), W.widgetToken)) return send(res, 401, '');
    let f = null;
    if (u.searchParams.get('k') === 'avatar') f = W.avatar && path.resolve(ROOT, W.avatar);
    else { const ep = latestPublished(); const pj = ep && (readPj(ep.dir) || {}); const rel = pj && ((pj.covers || {})[u.searchParams.get('k') || '4x3'] || Object.values(pj.covers || {})[0]); f = rel && path.join(ep.dir, rel); }
    if (!f || !fs.existsSync(f)) return send(res, 404, '');
    const t = thumb(f, Math.min(800, +u.searchParams.get('w') || 400));
    return send(res, 200, fs.readFileSync(t || f), t ? 'image/jpeg' : 'image/png', { 'cache-control': 'max-age=1800' });
  }
  if (u.pathname === '/api/widget/code') return W.widgetToken && tokenEq(u.searchParams.get('t'), W.widgetToken) ? send(res, 200, widgetScript(req, 'maitian-widget.js'), 'text/javascript; charset=utf-8') : send(res, 401, '');   // 加载器每次刷新来取最新代码
  if (u.pathname === '/api/widget') return W.widgetToken && tokenEq(u.searchParams.get('t') || req.headers['x-widget-token'], W.widgetToken) ? send(res, 200, widgetData()) : send(res, 401, { error: '小组件口令不对' });
  if (u.pathname === '/manifest.webmanifest') return send(res, 200, { name: config.name || '麦田', short_name: config.name || '麦田', start_url: '/', display: 'standalone', background_color: '#efe7d8', theme_color: '#efe7d8', icons: [{ src: '/static/icon-512.png', sizes: '512x512', type: 'image/png' }] }, 'application/manifest+json');
  // 飞书验证码登录（config.web.login = "feishu"）：/login 页面和接口不需要先登录
  const LOGIN = W.login === 'feishu' && config.feishuWebhook;
  if (LOGIN && await handleLogin(req, res, u, send)) return;
  const cookieKey = ((req.headers.cookie || '').match(/mt_key=([^;]+)/) || [])[1];
  if (W.key && cookieKey !== W.key && !(LOGIN && sessionOk(req)) && !(await accessEmail(req, W.access))) {
    if (u.searchParams.get('key') === W.key) return send(res, 302, '', 'text/plain', { 'set-cookie': `mt_key=${W.key}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`, location: '/' });
    if (LOGIN) return u.pathname.startsWith('/api/') ? send(res, 401, { error: '需要登录' }) : send(res, 302, '', 'text/plain', { location: '/login' });
    return send(res, 401, '<meta charset="utf-8"><body style="font:16px system-ui;padding:40px">需要访问口令。请用带 <code>?key=…</code> 的地址打开一次。</body>', 'text/html; charset=utf-8');
  }
  if (u.pathname === '/api/bilibili-accounts') {
    const { bilibiliAccountView, saveBilibiliAccounts, InvalidBilibiliAccounts } = await import('./config-admin.mjs');
    if (req.method === 'GET') return send(res, 200, { bilibiliAccounts: bilibiliAccountView() });
    if (req.method !== 'POST') return send(res, 405, { error: '请求方法不支持' }, undefined, { allow: 'GET, POST' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: '请发送 JSON' });
    const a = await readJson(req);
    try { return send(res, 200, saveBilibiliAccounts(a)); }
    catch (e) {
      return e instanceof InvalidBilibiliAccounts ? send(res, 400, { error: e.message }) : send(res, 500, { error: '保存 B 站账号失败' });
    }
  }
  if (u.pathname.startsWith('/static/')) { const f = path.join(DIR, 'web', path.basename(u.pathname)); if (!/\.(css|js|png)$/.test(f) || !fs.existsSync(f)) return send(res, 404, ''); return send(res, 200, fs.readFileSync(f), f.endsWith('.css') ? 'text/css; charset=utf-8' : f.endsWith('.png') ? 'image/png' : 'text/javascript; charset=utf-8'); }
  if (u.pathname === '/p') return send(res, 200, fs.readFileSync(path.join(DIR, 'web', 'pages.html')), 'text/html; charset=utf-8');
  if (u.pathname === '/board') return send(res, 200, fs.readFileSync(path.join(DIR, 'web', 'board.html')), 'text/html; charset=utf-8');
  if (u.pathname === '/') return send(res, 200, fs.readFileSync(path.join(DIR, 'web', 'board.html')), 'text/html; charset=utf-8');
  if (u.pathname === '/widget') {   // 小组件安装页（已登录才能看）：脚本里填好麦田地址和小组件口令，手机上一键复制
    if (!W.widgetToken) return send(res, 404, '<meta charset="utf-8">没配 config.web.widgetToken', 'text/html; charset=utf-8');
    return send(res, 200, widgetPage(widgetScript(req, 'maitian-loader.js')), 'text/html; charset=utf-8');
  }
  if (u.pathname === '/api/overview') {
    const salesOnly = !!SITE?.salesOnly, salesNow = Date.now(), range = salesOnly && salesDateRange(salesNow);
    const readable = matchesSiteData(getMeta('siteShopName'));
    const siteDays = !readable ? [] : salesOnly ? db.prepare('SELECT * FROM site_daily WHERE day>=? AND day<=? ORDER BY day').all(range.start, range.today) : db.prepare('SELECT * FROM site_daily ORDER BY day').all();
    const sales = salesOnly ? buildSalesSummary({ days: siteDays, now: salesNow,
      orders: readable ? db.prepare('SELECT id,title,amount,status,time,kind FROM site_orders ORDER BY time DESC,id DESC LIMIT 10').all() : [],
      syncedAt: readable && getMeta('siteLiveSyncedAt'), ordersSyncedAt: readable && getMeta('siteOrdersSyncedAt'), error: getMeta('siteError'), ordersError: getMeta('siteOrdersError') }) : null;
    const browser = await browserHealth();
    return send(res, 200, { name: config.name || '麦田', siteOn: !!SITE, siteSalesOnly: salesOnly, siteSyncedAt: SITE ? getMeta('siteSyncedAt') : '', siteError: SITE ? getMeta('siteError') : '', learn: learnOn(config) ? learnUrl('maitian-board') : '', siteName: SITE ? SITE.name : '', siteLogo: !!(SITE && config.site.logo), board: config.board && config.board.url, driver: config.driver,
      episodes: episodes().sort((a, b) => (b.episode || 0) - (a.episode || 0)).map(e => episodeView(e)), actions: actions.slice(-8).reverse(),
      site: { days: siteDays, channels: readable && !salesOnly ? db.prepare('SELECT * FROM site_channels ORDER BY revenue DESC').all() : [],
        campaigns: readable && !salesOnly ? db.prepare('SELECT * FROM site_campaigns ORDER BY reg DESC').all() : [], campaignsOn: SITE && !salesOnly && getMeta('siteCampaigns') === 'on', ...(sales && { sales }) },
      metrics: db.prepare('SELECT day, episode_id, platform, views, likes, comments, favorites, shares FROM metrics ORDER BY day').all(),
      followers: db.prepare("SELECT day, platform, total, gain, loss, source FROM followers WHERE day >= date('now','localtime','-40 day') ORDER BY day").all(),
      samples: db.prepare('SELECT ts, episode_id, platform, views FROM samples ORDER BY ts').all(),
      feed: feed(), health: { nas: fs.existsSync(config.rootPath), browser, chrome: browser.id === 'chrome' && browser.ok, metricsDay: getMeta('metricsDay') || '', doctorDay: getMeta('doctorDay') || '', platforms: platformList() }, now: new Date().toISOString() });
  }
  if (u.pathname === '/site-logo') { const f = SITE && config.site.logo && path.resolve(ROOT, config.site.logo); return f && fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), /\.svg$/.test(f) ? 'image/svg+xml' : /\.jpe?g$/.test(f) ? 'image/jpeg' : 'image/png', { 'cache-control': 'max-age=3600' }) : send(res, 404, ''); }
  if (u.pathname === '/api/episode') { const ep = getEpisode(u.searchParams.get('id')); return ep ? send(res, 200, episodeView(ep, true)) : send(res, 404, { error: '没有这一期' }); }
  if (u.pathname === '/cover' || u.pathname === '/shot') {
    const ep = getEpisode(u.searchParams.get('id')); if (!ep) return send(res, 404, '');
    let f;
    if (u.pathname === '/shot') f = path.join(ep.dir, '发布档案', `${(u.searchParams.get('p') || '').replace(/\W/g, '')}.jpg`);
    else { const pj = readPj(ep.dir) || {}; const rel = (pj.covers || {})[u.searchParams.get('k') || '4x3'] || Object.values(pj.covers || {})[0]; f = rel && path.join(ep.dir, rel); }
    if (!f || !f.startsWith(ep.dir) || !fs.existsSync(f)) return send(res, 404, '');
    // 远程打开时原图（每张 ~700KB）太慢：默认给缩略图（长边 ≤ w，默认 720，JPEG），缓存在 data/thumbs；?full=1 给原图
    if (!u.searchParams.get('full') && !/\.svg$/.test(f)) { const t = thumb(f, Math.min(1600, +u.searchParams.get('w') || 720)); if (t) return send(res, 200, fs.readFileSync(t), 'image/jpeg', { 'cache-control': 'max-age=3600' }); }
    return send(res, 200, fs.readFileSync(f), /\.png$/.test(f) ? 'image/png' : /\.svg$/.test(f) ? 'image/svg+xml' : 'image/jpeg', { 'cache-control': 'max-age=300' });
  }
  // Account traffic stays separate from publishing and integration actions.
  if (u.pathname === '/api/account-traffic') {
    const { accountTargets } = await import('./account-targets.mjs');
    let targets;
    try { targets = accountTargets(JSON.parse(fs.readFileSync(CFG, 'utf8'))); }
    catch { return send(res, 400, { error: '账号配置无效' }); }
    const direct = (process.env.HUB_DRIVER || config.driver || 'direct') === 'direct';
    const browser = browserOf(config);
    if (req.method === 'GET') {
      const { accountTrafficView } = await import('./account-traffic.mjs');
      return send(res, 200, { ...accountTrafficView(db, targets.map(t => t.id)),
        accounts: targets.map(({ id, platform, name, accountId }) => ({ id, platform, name, accountId })), direct, browser });
    }
    if (req.method !== 'POST') return send(res, 405, { error: '不支持的请求方法' });
    const origin = req.headers.origin;
    const protocol = req.headers['x-forwarded-proto'] || (req.socket.encrypted || /https/.test(req.headers['cf-visitor'] || '') ? 'https' : 'http');
    if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== `${protocol}://${req.headers.host}`)) return send(res, 403, { error: '不接受其他网站发起的操作' });
    let a;
    try { a = await readJson(req); } catch { return send(res, 400, { error: '请求格式不对' }); }
    if (!a || (a.type !== 'metricsAccounts' && a.type !== 'metricsLogin')) return send(res, 400, { error: '不支持的操作' });
    const login = a.type === 'metricsLogin';
    const target = login && targets.find(t => t.platform === 'bilibili' && t.id === a.id);
    if (login && (!direct || !target)) return send(res, 400, { error: '请在 direct 模式选择已启用的 B站账号' });
    if (login && browser === 'ego' && target.accountId !== 'default') return send(res, 400, { error: 'B站副号需要显式设置 browser: chrome' });
    if (!login && actions.some(x => !x.done && x.type !== 'mark')) return send(res, 409, { error: '上一个操作还在跑，等它结束' });
    const rec = { type: a.type, label: login ? `打开账号登录页 · ${target.name}` : '采集账号作品', startedAt: new Date().toISOString(), done: false, ok: null, tail: '' };
    actions.push(rec);
    while (actions.length > 32 && actions[0].done) actions.shift();
    const args = login ? ['metrics-login', target.id] : ['metrics-accounts'];
    const child = spawn(process.execPath, [path.join(DIR, 'hub.mjs'), ...args], { cwd: ROOT, env: { ...process.env, HUB_NO_WEB: '1' } });
    const output = data => { rec.tail = (rec.tail + data).slice(-600); };
    child.stdout.on('data', output);
    child.stderr.on('data', output);
    const finish = ok => { rec.done = true; rec.ok = ok; rec.endedAt = new Date().toISOString(); };
    child.on('error', error => { output(error.message); finish(false); });
    child.on('close', code => finish(code === 0));
    return send(res, 200, { ok: true });
  }
  if (u.pathname === '/api/integrations' && req.method === 'GET') return send(res, 200, integrations());
  if (u.pathname === '/api/integrations/feishu' && req.method === 'POST') {
    const a = await readJson(req), backup = snapConfig();
    try { applyFeishuPatch(config, { webhook: String(a.webhook ?? ''), login: a.login === true }); saveConfig(config); }
    catch (e) { rollbackConfig(backup); return /先填 webhook/.test(e.message) ? send(res, 400, { error: e.message }) : send(res, 500, { error: '写配置失败：' + e.message }); }
    W = config.web || W;   // applyFeishuPatch 可能替换了 config.web 对象
    return send(res, 200, { feishu: integrations().feishu });
  }
  if (u.pathname === '/api/integrations/site' && req.method === 'POST') {
    const a = await readJson(req), backup = snapConfig();
    try {
      applySitePatch(config, { enabled: a.enabled === undefined ? undefined : a.enabled === true, name: a.name, base: a.base, adminPath: a.adminPath, coursesApi: a.coursesApi, dashboardApi: a.dashboardApi, coursePath: a.coursePath, logo: a.logo });
      saveConfig(config);
    } catch (e) {
      rollbackConfig(backup);
      const msg = e.message || '';
      return send(res, /先填站点地址/.test(msg) ? 400 : 500, { error: /先填站点地址/.test(msg) ? msg : ('写配置失败：' + msg) });
    }
    refreshSite();
    return send(res, 200, { site: integrations().site });
  }
  if (u.pathname === '/api/integrations/feishu/test' && req.method === 'POST') {
    const a = await readJson(req);
    const r = await testFeishu(a.webhook === undefined ? config.feishuWebhook : String(a.webhook).trim());
    setMeta('integrations.feishu.lastTest', JSON.stringify({ ...r, ts: new Date().toISOString() }));
    return send(res, 200, r);
  }
  if (u.pathname === '/api/integrations/site/test' && req.method === 'POST') {
    const a = await readJson(req);
    const r = await testSite({ base: a.base, adminPath: a.adminPath, coursesApi: a.coursesApi, dashboardApi: a.dashboardApi });
    setMeta('integrations.site.lastTest', JSON.stringify({ ...r, ts: new Date().toISOString() }));
    return send(res, 200, r);
  }
  if (u.pathname === '/api/platform-toggle' && req.method === 'POST') {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      let a; try { a = JSON.parse(body); } catch { return send(res, 400, { error: '请求格式不对' }); }
      const id = a.platform, on = a.on !== false;
      if (!PLATFORMS.includes(id)) return send(res, 400, { error: '平台不对' });
      const cur = new Set(config.disabled || []); on ? cur.delete(id) : cur.add(id);
      config.disabled = [...cur].sort();
      try { if (fs.existsSync(CFG)) fs.copyFileSync(CFG, CFG + '.bak'); fs.writeFileSync(CFG, JSON.stringify(config, null, 2) + '\n'); }
      catch (e) { config.disabled = [...(new Set(JSON.parse(fs.readFileSync(CFG, 'utf8')).disabled || []))].sort(); return send(res, 500, { error: '写配置失败：' + e.message }); }
      send(res, 200, { ok: true, disabled: config.disabled });
    });
    return;
  }
  if (u.pathname === '/api/action' && req.method === 'POST') {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      let a; try { a = JSON.parse(body); } catch { return send(res, 400, { error: '请求格式不对' }); }
      const map = { sync: ['sync', a.id], metrics: a.id ? ['metrics', a.id] : ['metrics'],
        doctor: ['doctor', ...(a.platform && PLATFORMS.includes(a.platform) ? ['--only', a.platform, '--quiet'] : ['--notify'])],
        board: ['board'], followers: ['followers'],
        login: ['login', ...(a.platform && PLATFORMS.includes(a.platform) ? ['--only', a.platform] : [])],
        mark: ['mark', a.id, a.platform, a.state, a.note || '在麦田里标记', ...(a.url ? ['--url', a.url] : [])] };
      const argv = map[a.type];
      if (!argv || argv.some(x => x === undefined || x === null || x === '')) return send(res, 400, { error: '不支持的操作' });
      if (a.type === 'mark' && (a.state !== 'published' || !getEpisode(a.id) || !NAMES[a.platform])) return send(res, 400, { error: '状态不对' });
      // 登录不受「同一时间只跑一个」限制：掉线时正体检着也要能马上打开登录页
      if (actions.some(x => !x.done && x.type !== 'mark') && !['mark', 'login'].includes(a.type)) return send(res, 409, { error: '上一个操作还在跑，等它结束' });
      const rec = { type: a.type, platform: a.platform && PLATFORMS.includes(a.platform) ? a.platform : '', label: { sync: '取链接', metrics: '采流量', doctor: '体检', board: `同步${SITE ? SITE.name : '知识站'}数据`, followers: '采粉丝', mark: '标记状态', login: '打开登录页', retry: '重跑平台' }[a.type] + (a.platform ? ` · ${NAMES[a.platform] || a.platform}` : ''), startedAt: new Date().toISOString(), done: false, ok: null, tail: '' };
      actions.push(rec);
      const ch = spawn(process.execPath, [path.join(DIR, 'hub.mjs'), ...argv], { cwd: ROOT, env: { ...process.env, HUB_NO_WEB: '1' } });
      const on = (d) => { rec.tail = (rec.tail + d).slice(-600); }; ch.stdout.on('data', on); ch.stderr.on('data', on);
      ch.on('close', (code) => { rec.done = true; rec.ok = code === 0; rec.endedAt = new Date().toISOString(); });
      send(res, 200, { ok: true });
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}
export function startWeb() {
  const srv = http.createServer((req, res) => { handle(req, res).catch((e) => { try { send(res, 500, { error: e.message }); } catch {} }); });
  initLogin(ROOT);
  srv.listen(W.port, '0.0.0.0', () => console.log(`麦田网页：http://localhost:${W.port}/?key=${W.key}`));
  srv.on('error', (e) => console.error('麦田网页没起来：' + e.message));
  return srv;
}
