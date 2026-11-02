// Run only against scripts/review-server.cjs (isolated state and fixed test token).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:3012';
const headers = { Authorization: 'Bearer studio-local-review-token-000000000000', 'Content-Type': 'application/json' };
async function rpc(profile, method, params = {}) {
  const response = await fetch(`${base}/rpc?profile=${profile}`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  assert.equal(response.status, 200);
  const body = await response.json(); assert.ok(!body.error, JSON.stringify(body.error)); return body.result;
}
async function state(profile) {
  const response = await fetch(`${base}/api/state?profile=${profile}`, { headers });
  assert.equal(response.status, 200); return response.json();
}
async function main() {
  // This explicit marker prevents accidentally running mutation checks on a normal server.
  const marker = await fetch(`${base}/__review-fixture`);
  assert.equal(marker.status, 200, 'Start scripts/review-server.cjs; never point this suite at saved Live data');
  assert.equal((await marker.json()).isolated, true);
  const profiles = ['phat-giao', 'thien-chua-giao'];
  for (const profile of profiles) {
    const namespace = profile === profiles[0] ? 'temple' : 'christian';
    await rpc(profile, `${namespace}.updateSettings`, { ttsEnabled: false, presentationPaused: true });
    await rpc(profile, `${namespace}.updateSettings`, { presentationPaused: false });
    const actions = namespace === 'temple'
      ? [['burnIncense', 'burnIncense', { count: 3 }], ['strikeWoodenFish', 'strikeWoodenFish', { count: 250 }], ['ringBell', 'ringBell'], ['sendPrayer', 'sendPrayer'], ['offerGift', 'offerGift', { coins: 5 }], ['grandCeremony', 'grandCeremony'], ['drawFortune', 'drawFortune']]
      : [['sendPrayer', 'prayer'], ['shareScripture', 'scripture'], ['lightCandle', 'candle'], ['ringBell', 'bell'], ['communion', 'communion'], ['blessPeace', 'peace'], ['giveThanks', 'thanksgiving'], ['previewMember', 'welcome'], ['thankGift', 'gift', { coins: 5 }]];
    const other = profile === profiles[0] ? profiles[1] : profiles[0];
    const before = await state(other);
    for (const [method, type, params] of actions) {
      await rpc(profile, `${namespace}.${method}`, { user: 'Kiểm tra tính năng', wish: 'Xin bình an cho mọi người', ...params });
      const current = (await state(profile)).playback.current;
      assert.equal(current.event.type, type, `${profile}/${method}`);
      assert.ok(current.endsAt > current.startsAt);
      await rpc(profile, `${namespace}.updateSettings`, { presentationPaused: true });
      assert.equal((await state(profile)).playback.current, null);
      await rpc(profile, `${namespace}.updateSettings`, { presentationPaused: false });
    }
    const after = await state(other);
    assert.deepEqual(after.settings, before.settings, 'Actions must not change the other profile settings');
    for (const field of ['totalMerit', 'totalPrayerRequests', 'totalScriptureShares', 'totalGiftThanks']) assert.equal(after[field], before[field]);
    const image = fs.readFileSync(path.join(__dirname, '..', 'public/assets', profile, 'backgrounds', profile === profiles[0] ? 'chinh-dien-phat-giao.png' : 'nha-tho-live.png'));
    const upload = await fetch(`${base}/api/stage-background?profile=${profile}`, { method: 'POST', headers: { Authorization: headers.Authorization, 'Content-Type': 'image/png' }, body: image });
    assert.equal(upload.status, 201); const uploaded = await upload.json();
    assert.equal((await state(profile)).settings.stageBackgroundUrl, uploaded.url);
    assert.equal((await state(other)).settings.stageBackgroundUrl, before.settings.stageBackgroundUrl);
    assert.equal((await fetch(base + uploaded.url)).status, 200);
    assert.equal((await fetch(`${base}/api/stage-background/reset?profile=${profile}`, { method: 'POST', headers })).status, 200);
    console.log(`PASS ${profile}: all ritual commands, pause/resume, background upload/reset and profile isolation.`);
  }
  const profile = profiles[1];
  await rpc(profile, 'christian.updateSettings', { ttsEnabled: true });
  const deadline = Date.now() + 90000;
  while (!(await state(profile)).tts.ready) {
    assert.ok(Date.now() < deadline, 'ZeroTTS did not become ready within 90 seconds');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const text = 'Xin Chúa ban bình an và hy vọng cho gia đình. '.repeat(6).trim();
  const speech = await rpc(profile, 'christian.speak', { text, broadcast: false });
  assert.equal(speech.ok, true, JSON.stringify(speech));
  const audio = await fetch(base + speech.url, { headers }); assert.equal(audio.status, 200);
  const wav = Buffer.from(await audio.arrayBuffer()); assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.ok(wav.length > 100000);
  console.log('PASS Christian real ZeroTTS: >240-character preview and authenticated WAV download.');
  await rpc(profile, 'christian.sendPrayer', { user: 'Kiểm tra lời đọc', wish: 'Xin Chúa ban bình an và hy vọng cho gia đình, xin nâng đỡ những người đang gặp khó khăn.' });
  const speechDeadline = Date.now() + require('../src/services/speechPolicy').CHRISTIAN_SPEECH_TIMEOUT_MS + 5000;
  let current;
  do {
    current = (await state(profile)).playback.current;
    assert.ok(current, 'The real prayer must retain its visual cue while speech is being generated');
    assert.ok(!current.event.speechError, current.event.speechError);
    assert.ok(Date.now() < speechDeadline, 'Prayer speech missed the expected deadline');
    if (!current.event.ttsUrl) await new Promise(resolve => setTimeout(resolve, 250));
  } while (!current.event.ttsUrl);
  assert.ok(current.event.speechStartsAt >= current.startsAt);
  assert.equal(current.endsAt - current.returnsAt, 2600);
  await rpc(profile, 'christian.updateSettings', { presentationPaused: true });
  console.log('PASS real Christian prayer: nonblocking scene, synthesized speech with its own timestamp, reserved return phase and pause.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
