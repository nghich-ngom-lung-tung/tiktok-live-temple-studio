function createCeremonyQueue({ stateModel, realtime, ttsManager, profileId = 'phat-giao', prefetchSpeech = false, speechTimeoutMs = 12_000, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const { getProfile } = require('../profiles/registry');
  const namespace = getProfile(profileId).namespace;
  const notify = (event, payload) => realtime.broadcastNotification(`${namespace}.${event}`, payload);
  const pending = [];
  let active = null, timer = null, generation = 0, preparing = false, skipped = 0;
  let prepared = new WeakMap();
  function prepare(event) {
    if (!prepared.has(event)) {
      const token = generation;
      prepared.set(event, Promise.resolve().then(() => token === generation ? ttsManager.synthesize(event.ttsText, event.ttsVoice) : null).catch(() => null));
    }
    return prepared.get(event);
  }
  function prepareNext() {
    const next = pending[0];
    if (prefetchSpeech && active && next?.ttsText && !next.ttsUrl && stateModel.state.settings.ttsEnabled
      && !stateModel.state.settings.presentationPaused && ttsManager.getStatus().ready) void prepare(next);
  }
  const publish = () => {
    stateModel.playback = { current: active, pendingCount: pending.length, preparing, skipped, paused: Boolean(stateModel.state.settings.presentationPaused) };
    notify('playback', stateModel.playback);
  };
  async function pump() {
    if (active || preparing || !pending.length || stateModel.state.settings.presentationPaused) return;
    const token = generation;
    const original = pending.shift();
    preparing = true; publish();
    let speech = original.ttsUrl ? { ok: true, url: original.ttsUrl, durationSec: original.durationSec } : null;
    if (!speech && original.ttsText && stateModel.state.settings.ttsEnabled && ttsManager.getStatus().ready) {
      let timeout;
      try {
        speech = await Promise.race([
          prefetchSpeech ? prepare(original) : ttsManager.synthesize(original.ttsText, original.ttsVoice),
          new Promise(resolve => { timeout = setTimer(() => resolve(null), speechTimeoutMs); })
        ]);
      } catch (_) {} finally { if (timeout) clearTimer(timeout); }
    }
    if (token !== generation) return;
    preparing = false;
    const type = original.presentation || original.type;
    const minimum = profileId === 'thien-chua-giao' && type !== 'announcement' ? 10000
      : ['burnIncense', 'sendPrayer', 'offerGift', 'grandCeremony'].includes(type) ? 7800
      : type === 'strikeWoodenFish' ? 2800 : type === 'bell' ? 7200 : type === 'communion' ? 9000 : 5700;
    const speechSeconds = Number(speech?.durationSec);
    const duration = Math.max(minimum, speech?.ok ? (Number.isFinite(speechSeconds) && speechSeconds > 0 ? speechSeconds : 10) * 1000 + 700 : 0);
    const startsAt = now() + 250;
    active = { event: { ...original, ttsUrl: speech?.ok ? speech.url : null, ttsPrepared: true,
      speechError: original.ttsText && stateModel.state.settings.ttsEnabled && !speech?.ok ? String(speech?.error || 'Giọng đọc chưa sẵn sàng hoặc quá thời gian chuẩn bị.').slice(0, 200) : null }, startsAt, endsAt: startsAt + duration };
    publish();
    notify('event', { event: active.event, playback: active, state: stateModel.getPublicState(ttsManager) });
    prepareNext();
    timer = setTimer(() => { active = null; timer = null; publish(); void pump(); }, duration + 250);
  }
  function enqueue(event) {
    if (stateModel.state.settings.presentationPaused) { skipped++; publish(); return; }
    if (event.type === 'strikeWoodenFish' && !event.ttsText) {
      const merged = pending.find(item => item.type === 'strikeWoodenFish' && !item.ttsText && (item.uniqueId || item.user) === (event.uniqueId || event.user));
      if (merged) { merged.count += event.count || 0; merged.merit += event.merit || 0; publish(); return; }
    }
    if (pending.length >= 200) {
      const expendable = pending.findIndex(item => item.type === 'strikeWoodenFish');
      if (expendable >= 0 && event.type !== 'strikeWoodenFish') pending.splice(expendable, 1);
      else { skipped++; publish(); return; }
      skipped++;
    }
    pending.push(event); publish(); void pump(); prepareNext();
  }
  function clear() {
    skipped += pending.length + (active || preparing ? 1 : 0);
    generation++; if (timer) clearTimer(timer);
    timer = null; active = null; preparing = false; pending.length = 0; prepared = new WeakMap(); publish();
  }
  publish();
  return { enqueue, clear, resume() { publish(); void pump(); }, status: () => stateModel.playback };
}
module.exports = { createCeremonyQueue };
