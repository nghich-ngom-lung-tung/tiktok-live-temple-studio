function createCeremonyQueue({ stateModel, realtime, ttsManager, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const pending = [];
  let active = null, timer = null, generation = 0, preparing = false, skipped = 0;
  const publish = () => {
    stateModel.playback = { current: active, pendingCount: pending.length, preparing, skipped, paused: Boolean(stateModel.state.settings.presentationPaused) };
    realtime.broadcastNotification('temple.playback', stateModel.playback);
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
          ttsManager.synthesize(original.ttsText, original.ttsVoice),
          new Promise(resolve => { timeout = setTimer(() => resolve(null), 12_000); })
        ]);
      } catch (_) {} finally { if (timeout) clearTimer(timeout); }
    }
    if (token !== generation) return;
    preparing = false;
    const type = original.presentation || original.type;
    const minimum = ['burnIncense', 'sendPrayer', 'offerGift', 'grandCeremony'].includes(type) ? 7800 : type === 'strikeWoodenFish' ? 2800 : 5700;
    const speechSeconds = Number(speech?.durationSec);
    const duration = Math.max(minimum, speech?.ok ? (Number.isFinite(speechSeconds) && speechSeconds > 0 ? speechSeconds : 10) * 1000 + 700 : 0);
    const startsAt = now() + 250;
    active = { event: { ...original, ttsUrl: speech?.ok ? speech.url : null, ttsPrepared: true,
      speechError: original.ttsText && stateModel.state.settings.ttsEnabled && !speech?.ok ? String(speech?.error || 'Giọng đọc chưa sẵn sàng hoặc quá thời gian chuẩn bị.').slice(0, 200) : null }, startsAt, endsAt: startsAt + duration };
    publish();
    realtime.broadcastNotification('temple.event', { event: active.event, playback: active, state: stateModel.getPublicState(ttsManager) });
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
    pending.push(event); publish(); void pump();
  }
  function clear() {
    skipped += pending.length + (active || preparing ? 1 : 0);
    generation++; if (timer) clearTimer(timer);
    timer = null; active = null; preparing = false; pending.length = 0; publish();
  }
  publish();
  return { enqueue, clear, resume() { publish(); void pump(); }, status: () => stateModel.playback };
}
module.exports = { createCeremonyQueue };
