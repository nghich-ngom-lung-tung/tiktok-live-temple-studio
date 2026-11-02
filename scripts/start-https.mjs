import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function tunnelOrigin(text) {
  const match = String(text).match(/https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com(?=[\s/|"'<>]|$)/i);
  return match ? new URL(match[0]).origin : null;
}
export function httpsEnvironment(env, origin, token) {
  if (tunnelOrigin(origin) !== origin) throw new Error('Tên miền Quick Tunnel không hợp lệ.');
  if (String(token).length < 32) throw new Error('TEMPLE_RPC_TOKEN cần ít nhất 32 ký tự.');
  const origins = new Set(String(env.TEMPLE_CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  origins.add(origin);
  return { ...env, HOST: '127.0.0.1', TEMPLE_RPC_TOKEN: token, TEMPLE_CORS_ORIGINS: [...origins].join(','),
    ZEROTTS_ALLOW_HUB_DOWNLOAD: env.ZEROTTS_ALLOW_HUB_DOWNLOAD || '1', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
}
export function sourceLinks(origin, token) {
  return Object.fromEntries(['phat-giao', 'thien-chua-giao'].map(profile => [profile,
    `${origin}/?profile=${profile}&obs=1#token=${encodeURIComponent(token)}`]));
}

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => reject(new Error(`Cổng ${port} đang bận hoặc không mở được (${error.code}). Dừng server cũ hoặc đặt PORT khác.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
async function terminate(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', resolve); killer.once('exit', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (_) {}
  }
}
async function backendReady(port, token, signal) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/status`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(1000)])
      });
      if (response.ok) return;
    } catch (_) {}
    await delay(250, undefined, { signal });
  }
  throw new Error('Backend chưa sẵn sàng sau 30 giây.');
}
async function publicReady(origin, token, signal) {
  const deadline = Date.now() + 45_000;
  let detail = '';
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      const response = await fetch(`${origin}/api/auth/status`, {
        headers: { Authorization: `Bearer ${token}`, Origin: origin }, signal: AbortSignal.any([signal, AbortSignal.timeout(3000)])
      });
      if (response.ok) return;
      detail = `HTTP ${response.status}`;
    } catch (error) { detail = error.cause?.code || error.name; }
    await delay(500, undefined, { signal });
  }
  throw new Error(`HTTPS chưa truy cập được sau 45 giây (${detail}). Kiểm tra DNS, mạng hoặc Cloudflare rồi chạy lại.`);
}

// Dependencies are injectable so tests never create a public tunnel or touch saved Live data.
export async function launchHttps({ env = process.env, spawnProcess = spawn, assertPort = checkPort,
  waitBackend = backendReady, waitPublic = publicReady, stopChild = terminate, log = console.log, signal, tunnelTimeoutMs = 60_000 } = {}) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');
  const token = env.TEMPLE_RPC_TOKEN || randomBytes(32).toString('hex');
  if (String(token).length < 32) throw new Error('TEMPLE_RPC_TOKEN cần ít nhất 32 ký tự.');
  let stopped = false, stopPromise, closedError = null, rejectFailure, resolveClosed;
  let configDirectory, configFile;
  const cleanupConfig = async () => {
    if (configFile) await fs.rm(configFile, { force: true }).catch(() => {});
    if (configDirectory) await fs.rmdir(configDirectory).catch(() => {});
  };
  const children = new Set();
  const readiness = new AbortController();
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  failure.catch(() => {});
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopped = true;
    readiness.abort();
    stopPromise = Promise.all([...children].map(child => stopChild(child))).then(async () => {
      await cleanupConfig();
      signal?.removeEventListener('abort', abort); resolveClosed(closedError);
    });
    return stopPromise;
  };
  const fail = error => { if (!stopped) { closedError = error; rejectFailure(error); void stop(); } };
  const abort = () => fail(new Error('Đã dừng chế độ HTTPS.'));
  const track = (child, label) => {
    children.add(child);
    child.once('error', error => fail(new Error(error.code === 'ENOENT' && label === 'cloudflared'
      ? 'Chưa tìm thấy cloudflared. Cài theo docs/cloudflare-live-studio.md rồi mở lại terminal.' : `${label}: ${error.message}`)));
    child.once('exit', (code, exitSignal) => fail(new Error(`${label} đã dừng (${code ?? exitSignal}). Hãy chạy lại npm run start:https để tạo phiên mới.`)));
    return child;
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new Error('Đã dừng chế độ HTTPS.');
    await Promise.race([assertPort(port), failure]);
    if (stopped) throw closedError;
    configDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-quick-tunnel-'));
    configFile = path.join(configDirectory, 'config.yml');
    await fs.writeFile(configFile, '{}\n');
    if (stopped) throw closedError;
    // A pre-existing named tunnel configuration must not override this Quick Tunnel.
    const tunnelEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.toUpperCase().startsWith('TUNNEL_')));
    log('Đang tạo Quick Tunnel HTTPS…');
    const tunnel = track(spawnProcess('cloudflared', ['tunnel', '--config', configFile, '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {
      cwd: root, env: tunnelEnv, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
    }), 'cloudflared');
    let timeout;
    const originPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Cloudflare chưa cấp URL sau 60 giây. Kiểm tra mạng hoặc cấu hình cloudflared.')), tunnelTimeoutMs);
      for (const stream of [tunnel.stdout, tunnel.stderr]) {
        let buffer = '';
        stream?.on('data', chunk => {
          buffer = (buffer + chunk.toString()).slice(-8192);
          const origin = tunnelOrigin(buffer);
          if (origin) resolve(origin);
        });
      }
    });
    let origin;
    try { origin = await Promise.race([originPromise, failure]); } finally { clearTimeout(timeout); }
    if (stopped) throw closedError;
    const childEnv = httpsEnvironment({ ...env, PORT: String(port) }, origin, token);
    track(spawnProcess(process.execPath, [path.join(root, 'server.js')], {
      cwd: root, env: childEnv, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32'
    }), 'Backend');
    await Promise.race([waitBackend(port, token, readiness.signal), failure]);
    if (stopped) throw closedError;
    log('Backend sẵn sàng; đang kiểm tra đường HTTPS qua Cloudflare…');
    await Promise.race([waitPublic(origin, token, readiness.signal), failure]);
    if (stopped) throw closedError;
    const links = sourceLinks(origin, token);
    log(`HTTPS đã sẵn sàng: ${origin}`);
    log(`Quản lý local: http://127.0.0.1:${port}/admin?profile=phat-giao`);
    log(`Quản lý Christian: http://127.0.0.1:${port}/admin?profile=thien-chua-giao`);
    log('Link riêng để dán vào LIVE Studio/OBS (giữ kín vì có token):');
    log(`Phật giáo: ${links['phat-giao']}`);
    log(`Thiên Chúa giáo: ${links['thien-chua-giao']}`);
    log('Ctrl+C dừng backend, worker và tunnel của phiên này. URL sẽ đổi ở lần chạy sau.');
    return { origin, links, stop, closed };
  } catch (error) {
    await stop(); await cleanupConfig(); throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const abortController = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => abortController.abort());
  try {
    const session = await launchHttps({ signal: abortController.signal });
    const error = await session.closed;
    if (error && !abortController.signal.aborted) { console.error(error.message); process.exitCode = 1; }
  } catch (error) {
    if (!abortController.signal.aborted) { console.error(error.message); process.exitCode = 1; }
  }
}
