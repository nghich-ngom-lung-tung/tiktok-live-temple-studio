// Isolated fixtures: no real TikTok room, Python worker or saved user state.
process.env.PORT = process.env.CHRISTIAN_TEST_PORT || '5399';
process.env.TEMPLE_RPC_TOKEN = 'christian-runtime-test-token-000000000000';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { stripTypeScriptTypes } = require('node:module');
const WebSocket = require('ws');
const { ChristianStateModel } = require('../src/profiles/thien-chua-giao/stateModel');
const { SCRIPTURE_CATALOG, SCRIPTURE_CATEGORIES, findScripture, createScripturePicker } = require('../src/profiles/thien-chua-giao/scriptureCatalog');
const { createChristianService } = require('../src/profiles/thien-chua-giao/service');
const { createChristianRpcService } = require('../src/profiles/thien-chua-giao/rpcService');
const { createProfileLiveCoordinator } = require('../src/services/profileLiveCoordinator');
const { createCeremonyQueue } = require('../src/services/ceremonyQueue');
const { createRealtimeService } = require('../src/services/realtimeService');
const { createApp } = require('../src/app');
const { createRpcController } = require('../src/controllers/rpcController');
const { createAuthController } = require('../src/controllers/authController');
const { createStateController } = require('../src/controllers/stateController');
const { createTtsController } = require('../src/controllers/ttsController');
const { attachWebSocketController } = require('../src/controllers/webSocketController');
const config = require('../src/config');
const security = require('../src/middleware/securityMiddleware');
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'christian-runtime-'));
let modelCounter = 0;
function model() {
  const value = new ChristianStateModel({ stateFile: path.join(directory, `${++modelCounter}.json`) });
  value.saveState = () => {};
  return value;
}
function clock() {
  let time = 100000, id = 0;
  const tasks = new Map();
  return {
    now: () => time,
    setTimeout(fn, ms) { tasks.set(++id, { at: time + ms, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    async advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at).find(([, task]) => task.at <= end);
        if (!next) break;
        tasks.delete(next[0]); time = next[1].at; next[1].fn(); await flush();
      }
      time = end; await flush();
    }
  };
}
function runtime({ time = clock(), tts } = {}) {
  const stateModel = model(), notifications = [];
  tts ||= { getStatus: () => ({ ready: false, voices: [] }) };
  const realtime = { broadcastNotification: (method, params) => notifications.push({ method, params: structuredClone(params) }) };
  const queue = createCeremonyQueue({ stateModel, realtime, ttsManager: tts, profileId: 'thien-chua-giao', prefetchSpeech: true, nonBlockingSpeech: true, speechTimeoutMs: require('../src/services/speechPolicy').CHRISTIAN_SPEECH_TIMEOUT_MS, now: time.now, setTimer: time.setTimeout, clearTimer: time.clearTimeout });
  const service = createChristianService({ stateModel, realtime, ceremonyQueue: queue, ttsManager: tts });
  return { stateModel, notifications, queue, service, realtime, time, tts };
}
async function regressions() {
  let motionNow = 11000;
  const animations = [];
  const sprite = { animate(frames, options) { const animation = { frames, options, cancel() { this.cancelled = true; } }; animations.push(animation); return animation; } };
  const actor = { querySelector: () => sprite };
  const crowd = { querySelector: () => sprite, classList: { contains: () => true } };
  const motionStage = { querySelectorAll: () => [crowd], setAttribute() {}, removeAttribute() {} };
  const motionSandbox = { Date: { now: () => motionNow }, window: { matchMedia: () => ({ matches: false }) } };
  vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/views/scripts/christianPrayerMotion.ts'), 'utf8')).replaceAll('export ', ''), motionSandbox);
  const motion = motionSandbox.createChristianPrayerMotion(motionStage);
  motion.start({ type: 'prayer', startsAt: 10000, endsAt: 20000 }, actor);
  assert.equal(animations.length, 4, 'Actor and crowd share the prayer clock');
  assert.equal(animations[0].currentTime, -3600, 'Prayer waits until the walk reaches the altar');
  assert.equal(animations[0].options.duration, 5400);
  assert.equal(animations[1].frames.map(frame => frame.opacity).join(','), '0,1,1,0', 'Bow returns upright before the event ends');
  motion.addCrowd(crowd);
  assert.equal(animations.length, 4, 'Repeated state notifications must not restart a bow');
  motion.clear();
  assert.ok(animations.every(animation => animation.cancelled));
  motionNow = 18000;
  motion.start({ type: 'prayer', startsAt: 10000, endsAt: 20000 }, actor);
  assert.equal(animations[4].currentTime, 3400, 'Reload resumes the current prayer pose');
  motion.clear();
  console.log('PASS prayer motion: altar arrival delay, synchronized crowd, bow/hold/rise, deduplication, reload offset and cleanup.');
  const layoutSandbox = {};
  vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/views/scripts/christianLayout.ts'), 'utf8')).replaceAll('export ', ''), layoutSandbox);
  for (const count of [0, 1, 12, 24, 25, 80, 120, 200]) {
    const seats = layoutSandbox.christianLayoutForCount(count);
    assert.equal(seats.length, count);
    assert.equal(new Set(seats.map(seat => `${seat.x}:${seat.y}`)).size, count);
    assert.ok(seats.every(seat => seat.height >= 200 && seat.y >= 1340 && seat.y <= 1650 && seat.x > 0 && seat.x < 1080), 'All feet must stay on the open floor in front of the last pew');
    for (let index = 0; index + 1 < seats.length; index += 2) {
      assert.equal(seats[index].x + seats[index + 1].x, 1080);
      assert.equal(seats[index].y, seats[index + 1].y);
    }
  }
  assert.ok(layoutSandbox.christianLayoutForCount(12).every(seat => seat.height >= 280));
  assert.equal(layoutSandbox.christianLayoutForCount(999).length, 200);
  const denseSeats = layoutSandbox.christianLayoutForCount(200);
  assert.ok(denseSeats.every((seat, index) => !index || seat.y >= denseSeats[index - 1].y), 'Earlier arrivals must occupy upper rows');
  assert.ok(Math.max(...denseSeats.map(seat => seat.y)) - Math.min(...denseSeats.map(seat => seat.y)) >= 300);
  console.log('PASS crowd layout: 200 distinct balanced positions, arrival order, feet clear of pews, foreground kept above the HUD.');
  assert.equal(SCRIPTURE_CATALOG.length, 100);
  assert.equal(SCRIPTURE_CATEGORIES.length, 10);
  for (const field of ['id', 'title', 'reflection']) assert.equal(new Set(SCRIPTURE_CATALOG.map(item => item[field])).size, 100);
  for (const category of SCRIPTURE_CATEGORIES) assert.equal(SCRIPTURE_CATALOG.filter(item => item.category === category.id).length, 10);
  for (const item of SCRIPTURE_CATALOG) {
    assert.ok(item.reflection.length > 60 && item.reflection.length <= 240);
    assert.equal(findScripture(item.id), item);
  }
  for (const reference of ['Thi Thiên 23:1', 'Ma-thi-ơ 11:28', 'Phi-líp 4:6–7', 'Giăng 14:27']) assert.ok(findScripture(reference));
  assert.equal(findScripture('Giăng 14'), null, 'Ambiguous reference prefixes must not select the wrong item');
  const picker = createScripturePicker({ random: max => max - 1 });
  const firstCycle = Array.from({ length: 100 }, () => picker.pick());
  assert.equal(new Set(firstCycle.map(item => item.id)).size, 100);
  assert.notEqual(picker.pick().id, firstCycle.at(-1).id);
  for (const category of SCRIPTURE_CATEGORIES) {
    const items = Array.from({ length: 10 }, () => picker.pick(category.id));
    assert.equal(new Set(items.map(item => item.id)).size, 10);
    assert.ok(items.every(item => item.category === category.id));
  }
  assert.throws(() => picker.pick('invalid'));
  console.log('PASS reflection library: 100 unique texts, 10 balanced topics, <=240 characters, legacy references, full shuffle cycles without repeats.');
  const r = runtime();
  const ordered = model();
  ordered.recordMember('First', 'first');
  ordered.setSimulatedViewerCount(2);
  ordered.recordMember('Last', 'last');
  ordered.recordMember('First chats again', 'first');
  assert.equal(ordered.getRoomViewers()[0].uniqueId, 'first');
  assert.equal(ordered.getRoomViewers().at(-1).uniqueId, 'last');
  ordered.roomViewers.delete('first');
  ordered.recordMember('New arrival', 'new');
  assert.equal(ordered.getRoomViewers().at(-1).uniqueId, 'new', 'A new arrival cannot take a departed early viewer’s upper position');
  r.service.performAction('candle', { user: 'Operator' });
  assert.equal(r.stateModel.getRoomViewers().length, 0, 'Manual rituals must not create phantom room viewers');
  assert.ok(r.queue.status().current.endsAt - r.queue.status().current.startsAt >= 10000);
  r.queue.clear();
  r.service.parseViewerComment('xin suy ngẫm Kinh Thánh về gia đình', 'Gia đình An', 'family-test', '');
  assert.equal(r.queue.status().current.event.category, 'gia-dinh');
  r.queue.clear();
  r.service.parseViewerComment('xin cầu nguyện cho gia đình', 'Tên hiển thị', 'account_id', '');
  assert.equal(r.queue.status().current.event.user, 'Tên hiển thị');
  r.service.performAction('candle', { user: 'Người tiếp' });
  r.service.updateSettings({ presentationPaused: true });
  assert.equal(r.queue.status().current, null);
  assert.equal(r.queue.status().pendingCount, 0);
  r.service.updateSettings({ presentationPaused: false });
  assert.equal(r.queue.status().current, null);
  assert.throws(() => r.service.updateSettings({ ttsEnabled: false, ttsVoice: 'invalid' }));
  assert.equal(r.stateModel.state.settings.ttsEnabled, true, 'Failed validation must not silently mute the profile');
  assert.throws(() => r.service.updateSettings({ presentationPaused: 'false' }));
  for (const kind of ['candle', 'bell', 'communion', 'peace', 'thanksgiving', 'welcome']) {
    r.queue.clear();
    r.service.performAction(kind, { user: 'Khách thử' });
    assert.equal(r.queue.status().current.event.type, kind);
    assert.ok(r.queue.status().current.event.ttsText.includes('Khách thử'));
  }
  r.queue.clear();
  r.service.parseViewerComment('cầu bình an cho gia đình', 'Natural', 'natural-prayer', '');
  assert.equal(r.queue.status().current.event.type, 'prayer');
  r.queue.clear();
  r.service.parseViewerComment('xin kinh Thi Thiên 999:1', 'Unknown', 'unknown-passage', '');
  assert.equal(r.queue.status().current, null, 'Do not silently substitute an unsupported Bible reference');
  assert.ok(r.notifications.some(item => item.method === 'christian.activity' && item.params.type === 'notice'));
  r.service.parseViewerComment('xin kinh Thi Thiên 23:1', 'Reader A', 'reader-a', '');
  const requestedFirst = r.queue.status().current.event;
  assert.equal(requestedFirst.reference, 'Thi Thiên 23:1'); r.queue.clear();
  r.service.parseViewerComment('xin kinh Thi Thiên 23:1', 'Reader B', 'reader-b', '');
  assert.equal(r.queue.status().current.event.reference, 'Thi Thiên 23:1');
  assert.notEqual(r.queue.status().current.event.reflectionId, requestedFirst.reflectionId); r.queue.clear();
  const longReflection = 'Xin Chúa ban bình an và hy vọng cho mọi người. '.repeat(5).trim().replace(/\.$/, '');
  r.service.shareScripture({ user: 'Long', reference: SCRIPTURE_CATALOG[0].id, reflection: longReflection });
  assert.equal(r.queue.status().current.event.reflection.length, longReflection.length);
  assert.ok(r.queue.status().current.event.ttsText.length > 120, 'Narration must not be silently cut at 120 characters');
  assert.equal(r.stateModel.state.recentEvents[0].reference, SCRIPTURE_CATALOG[0].reference, 'Keep punctuation in stored Bible references');
  r.queue.clear();
  const referencePicker = createScripturePicker();
  const requestedReference = SCRIPTURE_CATALOG[0].reference;
  assert.notEqual(referencePicker.pickReference(requestedReference).id, referencePicker.pickReference(requestedReference).id);
  r.service.handleLike({ user: 'Name', uniqueId: 'identity', avatar: '/avatar.png' }, 5);
  const like = r.notifications.filter(item => item.method === 'christian.activity').at(-1).params;
  assert.equal(like.uniqueId, 'identity'); assert.equal(like.avatar, '/avatar.png');
  assert.equal(r.stateModel.state.totalGiftThanks, 0, 'Thanksgiving must not invent gift credits');
  for (const [text, kind] of [['thắp nến', 'candle'], ['đổ chuông', 'bell'], ['hiệp thông', 'communion'], ['tạ ơn', 'thanksgiving'], ['bình an', 'peace']]) {
    r.service.parseViewerComment(text, 'Tên thật', `viewer-${kind}`, '');
    assert.equal(r.queue.status().current.event.type, kind);
    r.queue.clear();
  }
  r.stateModel.recordGift({ user: 'A', uniqueId: 'a', coins: 100 });
  r.stateModel.beginLiveSession('test-channel');
  r.stateModel.recordGift({ user: 'A', uniqueId: 'a', coins: 3 });
  assert.equal(r.stateModel.sessionSummary().leaderboard[0].coins, 3);
  r.stateModel.recordThanksgiving({ user: 'A', uniqueId: 'a' });
  assert.equal(r.stateModel.sessionSummary().thanksgiving, 1);
  r.stateModel.endLiveSession();
  r.stateModel.setSimulatedViewerCount(200);
  const countBeforePreview = r.stateModel.getRoomViewers().length;
  r.stateModel.recordMember('Simulation', 'simulation_christian_1', '');
  assert.equal(r.stateModel.getRoomViewers().length, countBeforePreview, 'Simulated performers must not also become real room members');
  const seats = new Map(r.stateModel.getRoomViewers().map(viewer => [viewer.uniqueId, viewer.seatIndex]));
  const real = r.stateModel.roomViewers.values().next().value;
  real.lastSeenAt += 10000;
  for (const viewer of r.stateModel.getRoomViewers()) if (seats.has(viewer.uniqueId)) assert.equal(viewer.seatIndex, seats.get(viewer.uniqueId));
  assert.equal(new Set(r.stateModel.getRoomViewers().map(viewer => viewer.seatIndex)).size, 200);
  console.log('PASS Christian actions: six distinct events, comment recognition, display names, pause/clear, atomic settings, session-only gift totals.');

  const time = clock(), calls = [], speech = new Map();
  const slow = runtime({ time, tts: {
    getStatus: () => ({ ready: true, voices: ['maichi'] }),
    synthesize(text) { calls.push(text); return new Promise(resolve => speech.set(text, resolve)); }
  } });
  slow.service.sendPrayer({ user: 'A', wish: 'First' }); await flush();
  assert.equal(slow.queue.status().preparing, false, 'Visuals must not wait for speech');
  assert.equal(slow.queue.status().current.event.ttsUrl, null);
  await time.advance(15000);
  assert.ok(slow.queue.status().current, 'Keep the scene while waiting within the speech deadline');
  speech.get(calls[0])({ ok: true, url: '/first.wav', durationSec: 2 }); await flush();
  const spoken = slow.notifications.find(item => item.method === 'christian.speech');
  assert.equal(spoken.params.startsAt, time.now() + 250, 'Start speech from its own future clock, never seek past the new WAV');
  assert.equal(slow.queue.status().current.event.speechStartsAt, spoken.params.startsAt);
  slow.service.sendPrayer({ user: 'B', wish: 'Second' }); await flush();
  assert.equal(calls.length, 2);
  speech.get(calls[1])({ ok: true, url: '/second.wav', durationSec: 5 }); await flush();
  const first = slow.queue.status().current;
  assert.equal(first.endsAt - first.returnsAt, 2600, 'Reserve the complete return walk before admitting the next actor');
  await time.advance(first.endsAt - time.now());
  assert.equal(slow.queue.status().current.event.ttsUrl, '/second.wav');
  assert.equal(calls.length, 2, 'Reuse prefetched speech');
  slow.queue.clear();
  slow.service.sendPrayer({ user: 'C', wish: 'Cancel' }); await flush();
  slow.service.updateSettings({ presentationPaused: true });
  speech.get(calls.at(-1))({ ok: true, url: '/stale.wav', durationSec: 5 }); await flush();
  assert.equal(slow.queue.status().current, null);
  assert.ok(!slow.notifications.some(item => item.method === 'christian.speech' && item.params.event.ttsUrl === '/stale.wav'));

  let ready = false;
  const warming = runtime({ time, tts: { getStatus: () => ({ ready }), synthesize: async () => ({ ok: true, url: '/warm.wav', durationSec: 2 }) } });
  warming.service.sendPrayer({ user: 'W', wish: 'Warm up' }); await flush();
  ready = true; await time.advance(250); await flush();
  assert.equal(warming.queue.status().current.event.ttsUrl, '/warm.wav', 'Retry after worker readiness without replaying visuals');
  warming.queue.clear();
  const muteClock = clock();
  const muting = runtime({ time: muteClock, tts: { getStatus: () => ({ ready: true, voices: ['maichi'] }), synthesize: () => new Promise(() => {}) } });
  muting.service.sendPrayer({ user: 'Mute', wish: 'Pending voice' }); await flush();
  const reservedEnd = muting.queue.status().current.endsAt;
  muting.service.updateSettings({ ttsEnabled: false });
  assert.ok(muting.queue.status().current.endsAt < reservedEnd, 'Muting speech releases the synthesis wait while retaining the complete visual and return');
  muting.queue.clear();
  const timeoutClock = clock(); let lateResolve;
  const expires = runtime({ time: timeoutClock, tts: { getStatus: () => ({ ready: true }), synthesize: () => new Promise(resolve => lateResolve = resolve) } });
  expires.service.sendPrayer({ user: 'Late', wish: 'Timeout' }); await flush();
  await timeoutClock.advance(require('../src/services/speechPolicy').CHRISTIAN_SPEECH_TIMEOUT_MS + 250);
  assert.ok(expires.queue.status().current.event.speechError, 'Expose bounded speech timeout');
  await timeoutClock.advance(2600);
  assert.equal(expires.queue.status().current, null);
  lateResolve({ ok: true, url: '/expired.wav', durationSec: 2 }); await flush();
  assert.ok(!expires.notifications.some(item => item.method === 'christian.speech'), 'Expired speech must not interrupt another scene');
  console.log('PASS async speech: independent clock, readiness retry, prefetch, full return phase and stale-result rejection.');

  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/views/scripts/christianPlayback.ts'), 'utf8')).replace('export function', 'function');
  const fakeDate = class extends Date { static now() { return time.now(); } };
  const sandbox = { Date: fakeDate, window: { setTimeout: time.setTimeout, clearTimeout: time.clearTimeout } };
  vm.runInNewContext(source, sandbox);
  const plays = [], stops = [], returns = [];
  const controller = sandbox.createChristianPlayback({ play: event => plays.push(event), stop: () => stops.push(true), returning: () => returns.push(time.now()), changed() {} });
  const current = { event: { id: 'synchronized', type: 'bell' }, startsAt: time.now() + 250, returnsAt: time.now() + 7650, endsAt: time.now() + 10250 };
  const status = { current, paused: false, pendingCount: 0, preparing: false };
  controller.sync(status); await time.advance(249); assert.equal(plays.length, 0);
  await time.advance(1); assert.equal(plays.length, 1); assert.equal(plays[0].startsAt, current.startsAt);
  controller.sync(status); await time.advance(1000); assert.equal(plays.length, 1);
  const reloaded = sandbox.createChristianPlayback({ play: event => plays.push(event), stop() {}, changed() {} });
  reloaded.sync(status); await time.advance(0);
  assert.equal(plays.at(-1).elapsedMs, 1000);
  controller.sync({ ...status, paused: true, current: null });
  assert.ok(stops.length >= 2);
  await time.advance(10000);
  reloaded.sync(status); await time.advance(0); assert.equal(plays.length, 2);
  const returnAt = time.now() + 1250;
  const returnController = sandbox.createChristianPlayback({ play() {}, stop() {}, returning: () => returns.push(time.now()), changed() {} });
  returnController.sync({ current: { event: { id: 'return-phase' }, startsAt: time.now() + 250, returnsAt: returnAt, endsAt: returnAt + 2600 }, paused: false, pendingCount: 0, preparing: false });
  await time.advance(1249); assert.equal(returns.length, 0);
  await time.advance(1); assert.deepEqual(returns, [returnAt]);
  await time.advance(2600); assert.equal(returns.length, 1);
  console.log('PASS client timeline: scheduled start, deduplication, reload offset, pause, expired-event rejection and automatic end.');
}

async function fixture() {
  const stateModel = model();
  const realtime = createRealtimeService({ profileId: 'thien-chua-giao' });
  const tts = { getStatus: () => ({ ready: true, status: 'ready', voices: ['baotrang', 'giahuy', 'hamy', 'huuduc', 'kimoanh', 'maichi', 'quangminh', 'tiendat'], voice: stateModel.state.settings.ttsVoice }),
    synthesize: async (_text, voice = 'maichi') => ({ ok: true, url: '/__fixture-voice.wav', durationSec: process.argv.includes('--serve') ? 30 : 4, voice }) };
  const queue = createCeremonyQueue({ stateModel, realtime, ttsManager: tts, profileId: 'thien-chua-giao', prefetchSpeech: true, nonBlockingSpeech: true, speechTimeoutMs: require('../src/services/speechPolicy').CHRISTIAN_SPEECH_TIMEOUT_MS });
  const service = createChristianService({ stateModel, realtime, ceremonyQueue: queue, ttsManager: tts });
  const calls = [];
  const coordinator = createProfileLiveCoordinator({
    'phat-giao': { disconnectTikTokLive() { calls.push('stop-buddhist'); } },
    'thien-chua-giao': {
      async connectTikTokLive(username) { stateModel.state.tiktok.connected = true; stateModel.state.tiktok.username = username; stateModel.beginLiveSession(username); realtime.broadcastNotification('christian.state', stateModel.getPublicState(tts)); return stateModel.state.tiktok; },
      disconnectTikTokLive() { queue.clear(); stateModel.state.tiktok.connected = false; stateModel.endLiveSession(); realtime.broadcastNotification('christian.state', stateModel.getPublicState(tts)); return stateModel.state.tiktok; }
    }
  });
  const rpc = createChristianRpcService({ stateModel, realtime, service, ttsManager: tts, ceremonyQueue: queue, liveCoordinator: coordinator.forProfile('thien-chua-giao') });
  const app = createApp({ config, security, rateLimiters: security.createRateLimiters(), controllers: {
    auth: createAuthController(security), rpc: createRpcController(rpc),
    state: createStateController({ stateModel, ttsManager: tts }), tts: createTtsController({ stateModel, ttsManager: tts })
  } });
  const wav = Buffer.alloc(44 + 24000 * 2 * (process.argv.includes('--serve') ? 30 : 4));
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  app.get('/__fixture-voice.wav', (_req, res) => res.type('audio/wav').send(wav));
  const server = http.createServer(app);
  const wss = attachWebSocketController({ server, config, security, realtime, rpcService: rpc, stateModel, ttsManager: tts });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.PORT, '127.0.0.1', resolve); });
  return { stateModel, rpc, calls, queue, async close() { queue.clear(); wss.clients.forEach(ws => ws.terminate()); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); } };
}
async function network() {
  const f = await fixture(), sockets = [], logs = [[], [], []];
  const base = `http://127.0.0.1:${config.PORT}`;
  async function rpc(method, params = {}) {
    const response = await fetch(base + '/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.RPC_TOKEN}`, Origin: base }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const result = await response.json(); assert.ok(!result.error, JSON.stringify(result)); return result.result;
  }
  const waitFor = async predicate => { const until = Date.now() + 3000; while (!predicate()) { if (Date.now() > until) throw Error('Missing realtime message'); await new Promise(resolve => setTimeout(resolve, 10)); } };
  try {
    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?profile=${i === 2 ? 'phat-giao' : 'thien-chua-giao'}`, { headers: { Origin: base } });
      sockets.push(ws); ws.on('message', raw => logs[i].push(JSON.parse(raw)));
      await new Promise(resolve => ws.once('open', resolve));
      ws.send(JSON.stringify({ method: 'auth', params: { token: config.RPC_TOKEN } }));
      await waitFor(() => logs[i].some(m => m.method === 'auth.ok'));
    }
    await rpc('live.connect', { username: 'fixture' }); assert.deepEqual(f.calls, ['stop-buddhist']);
    const catalog = await rpc('christian.voiceConfig');
    assert.equal(catalog.scriptures.length, 100); assert.equal(catalog.scriptureCategories.length, 10);
    const picked = await rpc('christian.pickScripture', { category: 'gia-dinh' });
    assert.equal(picked.category, 'gia-dinh');
    await rpc('christian.shareScripture', { user: 'Người thử', reference: picked.id, reflection: 'Bản chỉnh sửa riêng cho gia đình.' });
    await waitFor(() => logs.slice(0, 2).every(log => log.some(m => m.method === 'christian.event' && m.params.event.reflectionId === picked.id)));
    const reflectionEvent = logs[0].find(m => m.method === 'christian.event' && m.params.event.reflectionId === picked.id).params.event;
    assert.equal(reflectionEvent.reference, picked.reference);
    assert.equal(reflectionEvent.reflection, 'Bản chỉnh sửa riêng cho gia đình');
    assert.ok(reflectionEvent.ttsText.includes('Bản chỉnh sửa riêng cho gia đình'));
    f.queue.clear(); logs.forEach(log => { log.length = 0; });
    await rpc('christian.setSimulatedViewers', { count: 200 });
    await waitFor(() => logs.slice(0, 2).every(log => log.some(m => m.method === 'christian.state' && m.params.roomViewers.length === 200)));
    await rpc('christian.previewChat', { uniqueId: 'simulation_christian_1', comment: 'Bình an' });
    await waitFor(() => logs.slice(0, 2).every(log => log.some(m => m.method === 'christian.chat' && m.params.uniqueId === 'simulation_christian_1')));
    const before = Date.now();
    const result = await rpc('christian.speak', { text: 'Thông điệp theo hàng đợi', broadcast: true });
    assert.equal(result.queued, true); assert.ok(Date.now() - before < 1000);
    await waitFor(() => logs.slice(0, 2).every(log => log.some(m => m.method === 'christian.event')));
    const events = logs.slice(0, 2).map(log => log.find(m => m.method === 'christian.event').params);
    assert.deepEqual(events[0], events[1]); assert.ok(events[0].playback.startsAt);
    await rpc('christian.updateSettings', { presentationPaused: true });
    await waitFor(() => logs.slice(0, 2).every(log => log.some(m => m.method === 'christian.playback' && m.params.paused && !m.params.current)));
    assert.equal(logs[2].filter(m => m.method.startsWith('christian.')).length, 0);
    await rpc('christian.updateSettings', { presentationPaused: false, musicAutoRotate: true, musicTrack: 'sanctuary' });
    await Promise.all([rpc('christian.advanceMusic', { expectedTrack: 'sanctuary' }), rpc('christian.advanceMusic', { expectedTrack: 'sanctuary' })]);
    assert.equal(f.stateModel.state.settings.musicTrack, 'morning-grace');
    await rpc('live.newSession'); await rpc('live.disconnect'); assert.equal(f.stateModel.state.tiktok.connected, false);
    console.log('PASS HTTP/WS: connect/disconnect, 200 viewers and chat on two clients, identical timelines, immediate pause, Buddhist isolation, music advances once.');
  } finally { sockets.forEach(ws => ws.terminate()); await f.close(); }
}
(async () => {
  if (process.argv.includes('--serve')) {
    const f = await fixture();
    console.log(`Christian isolated fixture: http://127.0.0.1:${config.PORT}`);
    process.on('SIGINT', async () => { await f.close(); process.exit(0); });
    return;
  }
  try { await regressions(); await network(); }
  finally {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'christian-runtime-')));
    fs.rmSync(directory, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
