import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendPort = Number(process.env.PORT || 3000);
const vitePort = Number(process.env.VITE_PORT || 5173);
let vite;
let backend;
let stopping = false;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (backend?.pid) {
    if (process.platform === 'win32') {
      await new Promise(resolve => {
        const killer = spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', resolve);
        killer.once('exit', resolve);
      });
    } else {
      try { process.kill(-backend.pid, 'SIGTERM'); } catch {}
    }
  }
  await vite?.close();
  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, () => { void shutdown(); });
}

try {
  // Check both ports before Vite starts scanning dependencies.
  for (const [port, host, service] of [
    [backendPort, process.env.HOST || '127.0.0.1', 'Backend'],
    [vitePort, '127.0.0.1', 'Vite']
  ]) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', error => {
        if (error.code === 'EADDRINUSE') {
          error.message = `${service} port ${port} is already in use. Stop the old server with Ctrl+C, then retry npm run dev.`;
        }
        reject(error);
      });
      probe.listen(port, host, () => probe.close(resolve));
    });
  }
  vite = await createServer({ root: path.join(root, 'src/views'), configFile: path.join(root, 'vite.config.mjs') });
  await vite.listen();
  backend = spawn(process.execPath, ['--watch', 'server.js'], {
    cwd: root,
    env: {
      ...process.env,
      ZEROTTS_ALLOW_HUB_DOWNLOAD: process.env.ZEROTTS_ALLOW_HUB_DOWNLOAD || '1',
      PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
      HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET || '1'
    },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true
  });
  backend.once('error', error => { console.error(error.message); void shutdown(1); });
  backend.once('exit', code => { if (!stopping) void shutdown(code || 0); });
  console.log('\nDev UI (Live / Admin):');
  vite.printUrls();
  console.log('Ctrl+C stops Vite, backend, and the TTS worker.');
} catch (error) {
  console.error(`[dev] ${error.message}`);
  await shutdown(1);
}
