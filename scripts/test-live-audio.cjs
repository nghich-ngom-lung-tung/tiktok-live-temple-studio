const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { ZeroTtsManager } = require('../src/services/zeroTtsManager');
const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
class FakeAudio {
  constructor(src) { this.src = src; this.duration = 20; this.currentTime = 0; this.paused = true; }
  play() { this.paused = false; this.onloadedmetadata?.(); return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
}
async function main() {
  const browser = { TempleAuth: { fetchAudioBlobUrl: async () => 'blob:voice' } };
  const sandbox = { window: browser, Audio: FakeAudio, localStorage: { getItem: () => null }, URL: { revokeObjectURL() {} }, setTimeout, clearTimeout, setInterval, clearInterval, console };
  vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname, '../src/views/scripts/audio.ts'), 'utf8')), sandbox);
  const engine = new browser.TempleAudioEngine();
  engine.applyRemoteSettings({ ttsEnabled: true, bgMusicEnabled: false, sfxEnabled: false });
  engine.enqueueTts('hello', { url: '/voice.wav', startsAt: Date.now() - 5000 });
  await flush();
  const playing = engine.currentAudio;
  assert.ok(playing); assert.ok(playing.currentTime >= 5 && playing.currentTime < 6);
  engine.applyRemoteSettings({ ttsEnabled: false, bgMusicEnabled: false, sfxEnabled: false });
  await flush(); assert.equal(playing.paused, true); assert.equal(engine.currentAudio, null); assert.equal(engine.ttsPlaying, false);

  let resolveOld;
  browser.TempleAuth.fetchAudioBlobUrl = url => url === '/old.wav' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve('blob:new');
  engine.applyRemoteSettings({ ttsEnabled: true, bgMusicEnabled: false, sfxEnabled: false });
  engine.enqueueTts('old', { url: '/old.wav' }); await flush();
  engine.stopTts(); engine.enqueueTts('new', { url: '/new.wav' }); await flush();
  const newer = engine.currentAudio;
  resolveOld('blob:old'); await flush();
  assert.equal(engine.currentAudio, newer); assert.equal(engine.ttsPlaying, true);
  let closed = 0; engine.ctx = { close: async () => { closed++; } };
  engine.applyRemoteSettings({ presentationPaused: true, ttsEnabled: true, bgMusicEnabled: true, sfxEnabled: true });
  await flush(); assert.equal(closed, 1); assert.equal(engine.ttsEnabled, false); assert.equal(engine.bgMusicEnabled, false); assert.equal(engine.sfxEnabled, false); assert.equal(engine.ttsQueue.length, 0);
  console.log('PASS audio: synchronized playback offset, immediate mute, stale download cancellation, emergency stop.');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-audio-test-'));
  const dataDir = path.join(directory, 'data'), cache = path.join(dataDir, 'tts-cache');
  fs.mkdirSync(cache, { recursive: true });
  const filename = path.join(cache, 'cached.wav');
  const wav = Buffer.alloc(480044);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(480000, 40);
  fs.writeFileSync(filename, wav);
  try {
    let result;
    const manager = { rootDir: directory, pending: new Map([[1, { timer: null, resolve: value => { result = value; } }]]) };
    ZeroTtsManager.prototype.handleWorkerLine.call(manager, JSON.stringify({ type: 'result', id: 1, ok: true, file: 'cached.wav', url: '/tts-cache/cached.wav' }));
    assert.equal(result.durationSec, 10);
    console.log('PASS cached TTS: actual WAV duration is recovered, preventing premature next ceremony.');
  } finally { fs.unlinkSync(filename); fs.rmdirSync(cache); fs.rmdirSync(dataDir); fs.rmdirSync(directory); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
