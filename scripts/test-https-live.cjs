// Optional external-network test. Creates and closes a real public Quick Tunnel with isolated app data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

(async () => {
  const { launchHttps } = await import('./start-https.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-https-'));
  const session = await launchHttps({
    env: { ...process.env, PORT: process.env.HTTPS_TEST_PORT || '3014', TIKTOK_AUTO_CONNECT: '0', REVIEW_DATA: directory },
    log: message => { if (!message.includes('#token=')) console.log(message); },
    spawnProcess(command, args, options) {
      if (command === 'cloudflared') return spawn(command, args, options);
      const bootstrap = `const path=require('node:path');const config=require('./src/config');config.DATA_DIR=process.env.REVIEW_DATA;config.STATE_FILE=path.join(config.DATA_DIR,'state.json');config.STAGE_BACKGROUND_DIR=path.join(config.DATA_DIR,'backgrounds');config.CHRISTIAN_STAGE_BACKGROUND_DIR=path.join(config.DATA_DIR,'christian-backgrounds');require('./src/server').startServer();`;
      return spawn(process.execPath, ['-e', bootstrap], options);
    }
  });
  try {
    const token = new URL(session.links['phat-giao']).hash.slice('#token='.length);
    for (const profile of ['phat-giao', 'thien-chua-giao']) {
      const response = await fetch(`${session.origin}/api/state?profile=${profile}`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, Origin: session.origin }, signal: AbortSignal.timeout(20000)
      });
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.equal(profile === 'phat-giao' ? state.totalMerit : state.totalPrayerRequests, 0);
    }
    const response = await fetch(`${session.origin}/api/state`, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 401, 'Public tunnel must retain RPC token authentication');
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`${session.origin.replace('https:', 'wss:')}/ws?profile=thien-chua-giao`, { origin: session.origin });
      const timeout = setTimeout(() => { socket.terminate(); reject(new Error('No remote WebSocket state')); }, 20000);
      socket.once('open', () => socket.send(JSON.stringify({ method: 'auth', params: { token: decodeURIComponent(token) } })));
      socket.on('message', raw => {
        if (JSON.parse(raw).method === 'christian.state') { clearTimeout(timeout); socket.close(); resolve(); }
      });
      socket.once('error', error => { clearTimeout(timeout); socket.terminate(); reject(error); });
    });
    console.log('PASS real Quick Tunnel: HTTPS state for both isolated profiles, token required, WSS authentication/state.');
  } finally {
    await session.stop();
    console.log('Stopped test tunnel/backend/worker. Saved user Live data was not used.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
