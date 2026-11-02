const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { createGiftTracker } = require('../src/services/giftTracker');
const { createCeremonyQueue } = require('../src/services/ceremonyQueue');
const { TempleStateModel } = require('../src/models/templeStateModel');
const { createRitualService } = require('../src/services/ritualService');
const { createRpcService } = require('../src/services/rpcService');
const constants = require('tiktok-live-connector');
const deck = require('../src/data/fortuneDeck');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function clock() {
  let time = 100_000, counter = 0;
  const tasks = new Map();
  return {
    now: () => time,
    setTimeout(callback, delay) { const key = ++counter; tasks.set(key, { at: time + delay, callback }); return key; },
    clearTimeout: key => tasks.delete(key),
    setInterval: () => ({ unref() {} }),
    async advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at).find(([, item]) => item.at <= end);
        if (!next) break;
        tasks.delete(next[0]); time = next[1].at; next[1].callback(); await flush();
      }
      time = end; await flush();
    }
  };
}
function model() {
  const value = new TempleStateModel({ stateFile: path.join(__dirname, '__missing_live_test__.json') });
  value.saveState = () => {};
  return value;
}
function runtime(time = clock(), tts = { getStatus: () => ({ ready: false }) }) {
  const stateModel = model(), notifications = [];
  const realtime = { broadcastNotification: (method, params) => notifications.push({ method, params: structuredClone(params) }) };
  const queue = createCeremonyQueue({ stateModel, realtime, ttsManager: tts, now: time.now, setTimer: time.setTimeout, clearTimer: time.clearTimeout });
  const rituals = createRitualService({ stateModel, realtime, ttsManager: tts, fortuneDeck: deck, ceremonyQueue: queue });
  return { time, stateModel, notifications, realtime, queue, rituals, tts };
}
function mockedConnector() {
  const time = clock(), connections = [], calls = [];
  let fail = false;
  class FakeConnection extends EventEmitter {
    constructor(username) { super(); this.username = username; connections.push(this); }
    async connect() { if (fail) throw new Error('Network offline'); return { roomId: 'test-room' }; }
    disconnect() { this.emit(constants.ControlEvent.DISCONNECTED); }
  }
  const filename = path.resolve(__dirname, '../src/services/tiktokLiveService.js');
  const originalRequire = createRequire(filename);
  const sandbox = { module: { exports: {} }, require: id => id === 'tiktok-live-connector' ? { ...constants, TikTokLiveConnection: FakeConnection } : originalRequire(id), URL, Date, setTimeout, clearTimeout, setInterval };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  const stateModel = model(), notifications = [];
  const service = sandbox.module.exports.createTikTokLiveService({ stateModel, realtime: { broadcastNotification: (method, params) => notifications.push({ method, params }) },
    ritualService: { offerGift: params => calls.push(params), ringBell: params => calls.push(params), strikeWoodenFish: params => calls.push(params) },
    commentService: { parseViewerComment() {} }, ttsManager: null, timers: time });
  return { time, stateModel, service, notifications, connections, calls, fail(value) { fail = value; } };
}
async function main() {
  const tracker = createGiftTracker();
  const gift = { giftId: 1, giftType: 1, groupId: 'streak', gift: { diamondCount: 5 }, repeatEnd: false };
  assert.equal(tracker.take({ ...gift, repeatCount: 1 }, 'a').coins, 5);
  assert.equal(tracker.take({ ...gift, repeatCount: 2 }, 'a').coins, 5);
  assert.equal(tracker.take({ ...gift, repeatCount: 2 }, 'a'), null);
  assert.equal(tracker.take({ ...gift, repeatCount: 2, repeatEnd: true }, 'a'), null);
  assert.equal(tracker.take({ ...gift, repeatCount: 1 }, 'b').coins, 5);
  const single = { giftId: 2, giftType: 2, repeatCount: 1, repeatEnd: true };
  assert.equal(tracker.take(single, 'a').quantity, 1);
  assert.equal(tracker.take(single, 'a').quantity, 1);
  assert.ok(tracker.take({ ...single, common: { msgId: 'unique' } }, 'a'));
  assert.equal(tracker.take({ ...single, common: { msgId: 'unique' } }, 'a'), null);
  const fallback = { ...gift, groupId: undefined, repeatCount: 1 };
  assert.ok(tracker.take(fallback, 'fallback'));
  assert.equal(tracker.take({ ...fallback, repeatEnd: true }, 'fallback'), null);
  assert.ok(tracker.take(fallback, 'fallback'));
  console.log('PASS gifts: incremental combos, duplicates, final packet, standalone gifts, per-user isolation.');

  const credits = runtime();
  assert.equal(credits.stateModel.state.totalMerit, 0);
  assert.equal(credits.stateModel.state.totalIncense, 0);
  assert.equal(credits.stateModel.state.settings.musicVolume, .65);
  assert.equal(credits.stateModel.state.settings.ttsVolume, .95);
  const likeBurst = credits.rituals.strikeWoodenFish({ user: 'Like sender', count: 250 }).event;
  assert.equal(likeBurst.merit, 250, 'Large connector Like packets must retain all credits');
  credits.queue.clear();
  const recognized = [];
  const keywordParser = require('../src/services/commentService').createCommentService({ rituals: new Proxy({}, { get: (_target, kind) => params => { recognized.push({kind, params}); return params; } }) });
  keywordParser.parseViewerComment('rất vui được làm quen', 'Guest', 'neutral', '');
  assert.equal(recognized.at(-1).kind, 'burnIncense', 'The substring que inside quen must not draw a fortune');
  keywordParser.parseViewerComment('hương', 'Guest', 'incense-keyword', '');
  assert.equal(recognized.at(-1).params.count, 3);
  for (const [coins, multiplier] of [[1,20],[5,20],[9,20],[10,30],[99,30],[100,50]]) {
    assert.equal(credits.rituals.offerGift({user:'Gift sender', coins}).event.merit, coins * multiplier);
    credits.queue.clear();
  }
  const batch = runtime(), split = runtime();
  const batchGift = batch.rituals.offerGift({user:'Same gift', coins:100, giftQuantity:100}).event;
  for(let i=0;i<100;i++) { split.rituals.offerGift({user:'Same gift', coins:1, giftQuantity:1}); split.queue.clear(); }
  assert.equal(batchGift.giftType, 'lotus', 'A combo of cheap gifts must not become an expensive gift type');
  for(const field of ['totalMerit','totalIncense']) assert.equal(batch.stateModel.state[field], split.stateModel.state[field], field);
  assert.deepEqual(batch.stateModel.state.offerings, split.stateModel.state.offerings);
  assert.equal(Object.values(batch.stateModel.state.devotees)[0].gifts, 100);
  console.log('PASS interaction contracts: full Like credit, keyword boundaries, incense keyword and gift thresholds.');
  const r = runtime();
  const first = r.rituals.burnIncense({ user: 'First user', readTts: false }).event;
  const second = r.rituals.offerGift({ user: 'Second user', coins: 10, readTts: false }).event;
  assert.equal(r.queue.status().current.event.id, first.id);
  assert.equal(r.queue.status().pendingCount, 1);
  await r.time.advance(8049);
  assert.equal(r.queue.status().current.event.id, first.id);
  await r.time.advance(1);
  assert.equal(r.queue.status().current.event.id, second.id);
  assert.equal(r.notifications.filter(item => item.method === 'temple.event').length, 2);
  r.rituals.updateSettings({ presentationPaused: true });
  assert.equal(r.queue.status().current, null);
  assert.equal(r.stateModel.state.settings.autoSim, false);
  const merit = r.stateModel.state.totalMerit;
  r.rituals.offerGift({ user: 'Paused user', coins: 3 });
  assert.ok(r.stateModel.state.totalMerit > merit);
  assert.equal(r.queue.status().current, null);
  r.rituals.updateSettings({ presentationPaused: false });
  assert.equal(r.queue.status().current, null);
  assert.throws(() => r.rituals.updateSettings({ presentationPaused: 'yes' }));
  assert.throws(() => r.rituals.updateSettings({ giftMappings: { bad: { action: 'ringBell', label: '' } } }));
  r.rituals.updateSettings({ giftMappings: { '5655': { action: 'ringBell', label: 'Rose' } }, ttsEnabled: false, bgMusicEnabled: false, sfxEnabled: false });
  assert.equal(r.stateModel.state.settings.giftMappings['5655'].action, 'ringBell');
  console.log('PASS queue/settings: FIFO, no overlap, synchronized payload, pause clears visuals and preserves merit, validation.');
  const rpc = createRpcService({ stateModel: r.stateModel, ritualService: r.rituals, commentService: { parseViewerComment() {} }, ttsManager: r.tts, tiktokLiveService: {}, autoSimulationService: { configureAutoSim() {} }, realtime: r.realtime, ceremonyQueue: r.queue });
  r.rituals.updateSettings({ musicAutoRotate: true, musicTrack: 'lotus' });
  await Promise.all([rpc.handleRpcCall('temple.advanceMusic', { expectedTrack: 'lotus' }), rpc.handleRpcCall('temple.advanceMusic', { expectedTrack: 'lotus' })]);
  assert.equal(r.stateModel.state.settings.musicTrack, 'rain');
  await assert.rejects(rpc.handleRpcCall('live.setAutoSim', { enabled: 'false' }));
  console.log('PASS music: two clients finishing one track advance the shared track only once.');

  let resolveSpeech;
  const delayed = runtime(clock(), { getStatus: () => ({ ready: true }), synthesize: () => new Promise(resolve => { resolveSpeech = resolve; }) });
  delayed.rituals.burnIncense({ user: 'Waiting user' });
  assert.equal(delayed.queue.status().preparing, true);
  delayed.rituals.updateSettings({ presentationPaused: true });
  resolveSpeech({ ok: true, url: '/late.wav', durationSec: 20 }); await flush();
  assert.equal(delayed.queue.status().current, null);
  const voiced = runtime(clock(), { getStatus: () => ({ ready: true }), synthesize: async () => ({ ok: true, url: '/voice.wav', durationSec: 30 }) });
  voiced.rituals.burnIncense({ user: 'Long speech' }); await flush();
  assert.equal(voiced.queue.status().current.event.ttsUrl, '/voice.wav');
  assert.ok(voiced.queue.status().current.endsAt - voiced.queue.status().current.startsAt >= 30_700);
  voiced.queue.clear();
  console.log('PASS speech: late synthesis cannot resume paused visuals; long audio reserves its full slot.');
  const burst = runtime();
  const beforeBurst = burst.stateModel.state.totalMerit;
  for (let index = 0; index < 250; index++) burst.rituals.offerGift({ user: `Gift user ${index}`, coins: 1, readTts: false });
  assert.equal(burst.queue.status().pendingCount, 200);
  assert.equal(burst.queue.status().skipped, 49);
  assert.equal(burst.stateModel.state.totalMerit, beforeBurst + 250 * 20);
  burst.queue.clear();
  console.log('PASS overload: bounded visual queue, all 250 gift credits retained.');
  const likes = runtime();
  likes.rituals.ringBell({ user: 'First user', readTts: false });
  likes.rituals.strikeWoodenFish({ user: 'Like user', uniqueId: 'liker', count: 3 });
  likes.rituals.strikeWoodenFish({ user: 'Like user', uniqueId: 'liker', count: 4 });
  assert.equal(likes.queue.status().pendingCount, 1);
  await likes.time.advance(5950);
  assert.equal(likes.queue.status().current.event.count, 7);
  likes.queue.clear();
  console.log('PASS like bursts: repeated pending strikes merge while preserving counts.');

  const m = model(); m.beginLiveSession('real_channel');
  const lifetime = m.state.totalMerit;
  m.observeRoomViewer('Real user', 'real', ''); m.recordDevotee('Real user', 'real', '', 20);
  m.recordRoomActivity('comments'); m.recordViewerCount(42);
  m.pushEventLog({ type: 'offerGift', uniqueId: 'real', coins: 2, giftQuantity: 2 });
  m.recordDevotee('Demo user', 'simulation_viewer_1', '', 500);
  assert.equal(m.sessionSummary().merit, 20); assert.equal(m.sessionSummary().coins, 2);
  assert.equal(m.sessionSummary().uniqueViewers, 1); assert.equal(m.sessionSummary().peakViewers, 42);
  m.endLiveSession(); m.beginLiveSession('another_channel');
  assert.equal(m.state.liveSessions.length, 1); assert.equal(m.sessionSummary().merit, 0);
  assert.equal(m.sessionSummary(m.state.liveSessions[0]).uniqueViewers, 1);
  assert.equal(m.state.totalMerit, lifetime + 520);
  console.log('PASS sessions: per-live totals, real viewers only, archival, lifetime data retained.');

  const c = mockedConnector(); c.fail(true);
  await assert.rejects(c.service.connectTikTokLive('test_channel'));
  assert.equal(c.stateModel.state.tiktok.reconnecting, true);
  c.fail(false); await c.time.advance(2000);
  assert.equal(c.stateModel.state.tiktok.connected, true);
  const conn = c.connections.at(-1);
  conn.emit(constants.WebcastEvent.ROOM_USER, { total: 0 });
  assert.equal(c.notifications.at(-1).method, 'temple.viewerCount');
  assert.equal(c.notifications.at(-1).params.viewerCount, 0);
  c.stateModel.state.settings.giftMappings = { '99': { action: 'ringBell', label: '' } };
  conn.emit(constants.WebcastEvent.GIFT, { user: { uniqueId: 'gift_user', nickname: 'Gift user' }, giftId: 99, giftType: 2, repeatCount: 1, gift: { diamondCount: 10 } });
  assert.equal(c.calls.at(-1).coins, 10); assert.equal(c.calls.at(-1).presentation, 'ringBell');
  conn.emit(constants.ControlEvent.DISCONNECTED);
  assert.equal(c.stateModel.state.tiktok.reconnecting, true);
  c.service.disconnectTikTokLive(); await c.time.advance(60_000);
  assert.equal(c.stateModel.state.tiktok.connected, false);
  assert.equal(c.connections.length, 2);
  await c.service.connectTikTokLive('new_channel');
  const endedConnection = c.connections.at(-1);
  const lateConnected = endedConnection.listeners(constants.ControlEvent.CONNECTED)[0];
  const lateGift = endedConnection.listeners(constants.WebcastEvent.GIFT)[0];
  endedConnection.emit(constants.WebcastEvent.STREAM_END);
  const callsAtEnd = c.calls.length;
  lateConnected({ roomId: 'ended-room' });
  lateGift({ user: { uniqueId: 'late_user' }, giftId: 99, giftType: 2 });
  assert.equal(c.calls.length, callsAtEnd);
  assert.equal(c.stateModel.state.tiktok.connected, false);
  await c.time.advance(60_000);
  assert.equal(c.stateModel.state.tiktok.reconnecting, false);
  assert.equal(c.stateModel.state.liveSession.active, false);
  console.log('PASS connector: retry/backoff, zero viewers, gift rules, manual stop, stream-end stop, stale callbacks.');

  const filename = path.resolve(__dirname, '../src/services/commentService.js');
  let now = 100_000, bubbles = [], rituals = 0;
  const sandbox = { module: { exports: {} }, require: createRequire(filename), Date: { now: () => now } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  const comments = sandbox.module.exports.createCommentService({ rituals: { burnIncense() { rituals++; } }, onComment: data => bubbles.push(data.comment) });
  comments.parseViewerComment('hi', 'Alice', 'alice', '');
  now += 250; comments.parseViewerComment('hello everyone', 'Alice', 'alice', '');
  now += 250; comments.parseViewerComment('another chat', 'Alice', 'alice', '');
  assert.equal(bubbles.length, 3); assert.equal(rituals, 1);
  console.log('PASS chat: short comments and successive bubbles are independent of ritual cooldown.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
