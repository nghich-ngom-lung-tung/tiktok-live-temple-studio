const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');

(async () => {
  const { tunnelOrigin, httpsEnvironment, sourceLinks, launchHttps } = await import('./start-https.mjs');
  const origin = 'https://sample-live-test.trycloudflare.com';
  assert.equal(tunnelOrigin(`INFO | ${origin} |`), origin);
  for (const bad of ['http://bad.trycloudflare.com', 'https://bad.trycloudflare.com.attacker.test', 'https://example.com']) assert.equal(tunnelOrigin(bad), null);
  const env = httpsEnvironment({ TEMPLE_CORS_ORIGINS: 'https://existing.example', HOST: '0.0.0.0' }, origin, 'x'.repeat(32));
  assert.equal(env.TEMPLE_CORS_ORIGINS, `https://existing.example,${origin}`);
  assert.equal(env.HOST, '127.0.0.1');
  assert.throws(() => httpsEnvironment({}, 'https://invalid.example', 'x'.repeat(32)));
  assert.ok(sourceLinks(origin, 'private & token')['phat-giao'].endsWith('#token=private%20%26%20token'));

  function fixture(mode = 'normal') {
    const calls = [], stopped = [], logs = [];
    const options = {
      env: { PORT: '3333', TEMPLE_RPC_TOKEN: 't'.repeat(40) },
      assertPort: async port => assert.equal(port, 3333),
      waitBackend: async (_port, token) => { assert.equal(token, 't'.repeat(40)); },
      waitPublic: async (value, token) => { assert.equal(value, origin); assert.equal(token, 't'.repeat(40)); },
      stopChild: async child => { stopped.push(child); child.exitCode = 0; },
      log: message => logs.push(message),
      spawnProcess(command, args, spawnOptions) {
        const child = new EventEmitter();
        child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null;
        calls.push({ command, args, options: spawnOptions, child });
        if (calls.length === 1) queueMicrotask(() => {
          if (mode === 'missing') child.emit('error', Object.assign(new Error('not found'), { code: 'ENOENT' }));
          else if (mode !== 'silent') { child.stderr.write('INFO https://sample-live-'); child.stderr.write('test.trycloudflare.com |\n'); }
        });
        else if (mode === 'backend-error') queueMicrotask(() => child.emit('exit', 1));
        return child;
      }
    };
    return { options, calls, stopped, logs };
  }
  const normal = fixture();
  const session = await launchHttps(normal.options);
  assert.equal(normal.calls.length, 2);
  assert.equal(normal.calls[0].command, 'cloudflared');
  assert.equal(normal.calls[0].args.at(-1), 'http://127.0.0.1:3333');
  const isolatedConfig = normal.calls[0].args[normal.calls[0].args.indexOf('--config') + 1];
  assert.equal(fs.readFileSync(isolatedConfig, 'utf8'), '{}\n');
  assert.equal(normal.calls[1].options.env.TEMPLE_CORS_ORIGINS, origin);
  assert.equal(normal.calls[1].options.env.TEMPLE_RPC_TOKEN, 't'.repeat(40));
  assert.equal(Object.keys(session.links).length, 2);
  assert.ok(normal.logs.some(message => message.includes('HTTPS đã sẵn sàng')));
  await session.stop(); await session.stop();
  assert.equal(normal.stopped.length, 2, 'Stop only the two owned child trees, once');
  assert.equal(fs.existsSync(isolatedConfig), false);
  assert.equal(await session.closed, null);

  const missing = fixture('missing');
  await assert.rejects(launchHttps(missing.options), /Chưa tìm thấy cloudflared/);
  assert.equal(missing.calls.length, 1, 'Do not launch backend when cloudflared is missing');
  const timeout = fixture('silent');
  await assert.rejects(launchHttps({ ...timeout.options, tunnelTimeoutMs: 10 }), /Cloudflare chưa cấp URL/);
  assert.equal(timeout.stopped.length, 1);
  const broken = fixture('backend-error');
  await assert.rejects(launchHttps(broken.options), /Backend đã dừng/);
  assert.equal(broken.stopped.length, 2);
  const unreachable = fixture();
  await assert.rejects(launchHttps({ ...unreachable.options, waitPublic: async () => { throw new Error('HTTPS unavailable'); } }), /HTTPS unavailable/);
  assert.equal(unreachable.stopped.length, 2, 'Do not announce a ready link when the public endpoint is unavailable');

  const dropped = fixture();
  const running = await launchHttps(dropped.options);
  dropped.calls[0].child.emit('exit', 1);
  assert.match((await running.closed).message, /cloudflared đã dừng/);
  assert.equal(dropped.stopped.length, 2, 'Tunnel failure must not leave a hidden backend running');
  const busy = fixture();
  await assert.rejects(launchHttps({ ...busy.options, assertPort: async () => { throw new Error('port busy'); } }), /port busy/);
  assert.equal(busy.calls.length, 0);
  const cancel = fixture('silent'), abort = new AbortController();
  const starting = launchHttps({ ...cancel.options, signal: abort.signal });
  await new Promise(resolve => setImmediate(resolve)); abort.abort();
  await assert.rejects(starting, /Đã dừng/);
  assert.equal(cancel.stopped.length, cancel.calls.length, 'Cancellation during config preparation must not leak children');
  console.log('PASS HTTPS launcher: exact origin, split URL logs, private links, startup order, missing binary, busy port, timeout, cancellation and child cleanup. No public tunnel created.');
})().catch(error => { console.error(error); process.exitCode = 1; });
