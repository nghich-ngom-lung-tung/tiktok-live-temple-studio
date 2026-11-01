// Isolated HTTP/WS fixture: no Python worker, real TikTok connection or user data writes.
process.env.PORT = process.env.LIVE_TEST_PORT || '5199';
process.env.TEMPLE_RPC_TOKEN = 'live-runtime-test-token-000000000000000000';
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');
const config = require('../src/config');
const security = require('../src/middleware/securityMiddleware');
const { createApp } = require('../src/app');
const { createAuthController } = require('../src/controllers/authController');
const { createStateController } = require('../src/controllers/stateController');
const { createRpcController } = require('../src/controllers/rpcController');
const { attachWebSocketController } = require('../src/controllers/webSocketController');
const { TempleStateModel } = require('../src/models/templeStateModel');
const { createRealtimeService } = require('../src/services/realtimeService');
const { createCeremonyQueue } = require('../src/services/ceremonyQueue');
const { createRitualService } = require('../src/services/ritualService');
const { createCommentService } = require('../src/services/commentService');
const { createRpcService } = require('../src/services/rpcService');
const deck = require('../src/data/fortuneDeck');
const base = `http://127.0.0.1:${config.PORT}`;
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.RPC_TOKEN}`, Origin: base };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 9000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for synchronized event'); await delay(20); }
}
async function start() {
  const model = new TempleStateModel({ stateFile: path.join(__dirname, '__missing_http_test__.json') });
  model.saveState = () => {};
  model.state.settings.centralCharacterConfigured = true;
  const realtime = createRealtimeService();
  const tts = { getStatus: () => ({ ready: false, status: 'fixture', voices: [] }), synthesize: async () => ({ ok: false }) };
  const queue = createCeremonyQueue({ stateModel: model, realtime, ttsManager: tts });
  const rituals = createRitualService({ stateModel: model, realtime, ttsManager: tts, fortuneDeck: deck, ceremonyQueue: queue });
  const comments = createCommentService({ rituals, onComment: data => {
    model.recordDevotee(data.user, data.uniqueId, data.avatar, 0);
    realtime.broadcastNotification('temple.state', model.getPublicState(tts));
    realtime.broadcastNotification('temple.chat', data);
  } });
  const tiktok = {
    async connectTikTokLive(username) {
      model.beginLiveSession(username); model.observeRoomViewer('Người xem thật mẫu', 'fixture_real_user', '');
      Object.assign(model.state.tiktok, { connected: true, username, viewerCount: 1 });
      realtime.broadcastNotification('temple.state', model.getPublicState(tts));
      return model.state.tiktok;
    },
    disconnectTikTokLive() { model.endLiveSession(); model.roomViewers.clear(); model.state.tiktok.connected = false; realtime.broadcastNotification('temple.state', model.getPublicState(tts)); return model.state.tiktok; }
  };
  const rpc = createRpcService({ stateModel: model, ritualService: rituals, commentService: comments, ttsManager: tts,
    tiktokLiveService: tiktok, autoSimulationService: { configureAutoSim: enabled => { model.state.settings.autoSim = enabled; } }, realtime, ceremonyQueue: queue });
  const app = createApp({ config, security, rateLimiters: security.createRateLimiters(), controllers: {
    auth: createAuthController(security), rpc: createRpcController(rpc), state: createStateController({ stateModel: model, ttsManager: tts }),
    tts: (_req, res) => res.json({ ok: false, error: 'Fixture has no TTS worker' })
  } });
  const server = http.createServer(app);
  const wss = attachWebSocketController({ server, config, security, realtime, rpcService: rpc, stateModel: model, ttsManager: tts });
  async function close() { queue.clear(); wss.clients.forEach(client => client.terminate()); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); }
  app.post('/__shutdown', security.requireRpcAuth, (_req, res) => { res.json({ ok: true }); void close(); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.PORT, '127.0.0.1', resolve); });
  return { close, model, realtime, queue };
}
async function rpc(method, params = {}) {
  const response = await fetch(base + '/rpc', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  const result = await response.json(); assert.equal(response.status, 200); assert.ok(!result.error, JSON.stringify(result)); return result.result;
}
async function main() {
  const fixture = await start();
  if (process.argv.includes('--serve')) { console.log(`Isolated runtime fixture: ${base}`); return; }
  const sockets = [];
  try {
    assert.equal((await fetch(base + '/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const logs = [[], []];
    for (let index = 0; index < 2; index++) {
      const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers }); sockets.push(ws);
      ws.on('message', raw => logs[index].push(JSON.parse(raw)));
      await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    }
    await rpc('temple.updateSettings', { ttsEnabled: false, bgMusicEnabled: false, sfxEnabled: false });
    await waitFor(() => logs.every(log => log.some(item => item.method === 'temple.state' && item.params.settings.sfxEnabled === false)));
    await rpc('temple.setSimulatedViewers', { count: 20 });
    await rpc('temple.previewViewerChat', { uniqueId: 'simulation_viewer_7', comment: 'hi' });
    await waitFor(() => logs.every(log => log.some(item => item.method === 'temple.chat' && item.params.uniqueId === 'simulation_viewer_7' && item.params.comment === 'hi')));
    await rpc('temple.ringBell', { user: 'First user', readTts: false });
    await rpc('temple.ringBell', { user: 'Second user', readTts: false });
    await waitFor(() => logs.every(log => log.filter(item => item.method === 'temple.event').length === 2));
    const left = logs[0].filter(item => item.method === 'temple.event'), right = logs[1].filter(item => item.method === 'temple.event');
    assert.equal(left[0].params.event.user, 'First user'); assert.equal(left[1].params.event.user, 'Second user');
    assert.ok(left[1].params.playback.startsAt >= left[0].params.playback.endsAt);
    assert.deepEqual(left.map(item => item.params.playback), right.map(item => item.params.playback));
    await rpc('temple.updateSettings', { presentationPaused: true });
    await waitFor(() => logs.every(log => log.some(item => item.method === 'temple.playback' && item.params.paused && !item.params.current)));
    const events = logs[0].filter(item => item.method === 'temple.event').length;
    const before = fixture.model.state.totalMerit;
    await rpc('temple.offerGift', { user: 'Paused gift', coins: 10 });
    assert.ok(fixture.model.state.totalMerit > before);
    await delay(80); assert.equal(logs[0].filter(item => item.method === 'temple.event').length, events);
    await rpc('temple.updateSettings', { presentationPaused: false });
    assert.equal(fixture.queue.status().pendingCount, 0);
    await rpc('live.connect', { username: 'fixture_channel' });
    await rpc('live.newSession');
    assert.equal(fixture.model.state.liveSessions.length, 1);
    console.log('PASS HTTP/WS: authentication, two synchronized clients, remote sound flags, short chat, FIFO timing, emergency pause, gift credit during pause, session archive.');
  } finally { sockets.forEach(ws => ws.terminate()); await fixture.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
