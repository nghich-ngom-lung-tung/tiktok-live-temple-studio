function createCeremonyQueue({ stateModel, realtime, ttsManager, profileId = 'phat-giao', prefetchSpeech = false, nonBlockingSpeech = false, speechTimeoutMs = 12_000, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const { getProfile } = require('../profiles/registry');
  const namespace = getProfile(profileId).namespace;
  const notify = (event, payload) => realtime.broadcastNotification(`${namespace}.${event}`, payload);
  const pending = [];
  let speechTimer = null;
  let active = null, timer = null, generation = 0, preparing = false, skipped = 0;
  let prepared = new WeakMap();
  let speechResults = new WeakMap();
  let speechTail = Promise.resolve();
  function prepare(event) {
    if (!prepared.has(event)) {
      const token = generation;
      const task = speechTail
        .then(async () => {
          const deadline = now() + speechTimeoutMs;
          while (token === generation && !ttsManager.getStatus().ready && now() < deadline) await new Promise(resolve => setTimer(resolve, 250));
          return token === generation && ttsManager.getStatus().ready ? ttsManager.synthesize(event.ttsText, event.ttsVoice) : null;
        })
        .then(speech => {
          if (token !== generation) return null;
          if (speech?.ok) speechResults.set(event, speech);
          return speech;
        })
        .catch(() => null);
      prepared.set(event, task);
      speechTail = task.then(() => undefined, () => undefined);
    }
    return prepared.get(event);
  }
  function prepareNext() {
    const next = pending[0];
    if (prefetchSpeech && active && next?.ttsText && !next.ttsUrl && !speechResults.has(next) && stateModel.state.settings.ttsEnabled
      && !stateModel.state.settings.presentationPaused && ttsManager.getStatus().ready) void prepare(next);
  }
  const publish = () => {
    stateModel.playback = { current: active, pendingCount: pending.length, preparing, skipped, paused: Boolean(stateModel.state.settings.presentationPaused) };
    notify('playback', stateModel.playback);
  };
  function durationFor(original, speech) {
    const type = original.presentation || original.type;
    const minimum = profileId === 'thien-chua-giao'
      ? ['prayer', 'candle', 'communion', 'peace', 'thanksgiving'].includes(type) ? 10000
        : type === 'announcement' ? 5700 : 7200
      : ['burnIncense', 'sendPrayer', 'offerGift', 'grandCeremony'].includes(type) ? 7800
        : type === 'strikeWoodenFish' ? 2800 : type === 'bell' ? 7200 : type === 'communion' ? 9000 : 5700;
    const speechSeconds = Number(speech?.durationSec);
    return Math.max(minimum, speech?.ok ? (Number.isFinite(speechSeconds) && speechSeconds > 0 ? speechSeconds : 10) * 1000 + 700 : 0);
  }
  function scheduleFinish(expected) {
    if (timer) clearTimer(timer);
    timer = setTimer(() => {
      if (active !== expected) return;
      if (nonBlockingSpeech && !expected.event.ttsPrepared && now() < expected.speechDeadline) {
        expected.returnsAt = now() + 250;
        expected.endsAt = expected.returnsAt + expected.returnDuration;
        publish(); scheduleFinish(expected); return;
      }
      active = null; timer = null; publish(); void pump();
    }, Math.max(0, expected.endsAt - now()));
  }
  function start(original, token, speech = null, allowAsyncSpeech = false) {
    const shouldPrepareSpeech = allowAsyncSpeech && !speech && !original.ttsUrl && original.ttsText
      && stateModel.state.settings.ttsEnabled;
    const startsAt = now() + 250;
    const duration = durationFor(original, speech);
    const event = {
      ...original,
      ttsUrl: speech?.ok ? speech.url : original.ttsUrl || null,
      ttsPrepared: !shouldPrepareSpeech,
      speechStartsAt: speech?.ok ? startsAt : null,
      speechError: original.ttsText && stateModel.state.settings.ttsEnabled && !speech?.ok && !shouldPrepareSpeech
        ? String(speech?.error || 'Giọng đọc chưa sẵn sàng hoặc quá thời gian chuẩn bị.').slice(0, 200) : null
    };
    const returnDuration = profileId === 'thien-chua-giao' && original.type !== 'announcement' ? 2600 : 0;
    active = { event, startsAt, returnsAt: startsAt + (shouldPrepareSpeech ? Math.max(duration, speechTimeoutMs) : duration), endsAt: startsAt + (shouldPrepareSpeech ? Math.max(duration, speechTimeoutMs) : duration) + returnDuration,
      returnDuration, speechDeadline: startsAt + speechTimeoutMs };
    const current = active;
    preparing = false;
    publish();
    notify('event', { event: current.event, playback: current, state: stateModel.getPublicState(ttsManager) });
    scheduleFinish(current);
    if (speechTimer) clearTimer(speechTimer);
    if (shouldPrepareSpeech) speechTimer = setTimer(() => {
      if (token !== generation || active !== current || current.event.ttsPrepared) return;
      current.event = { ...current.event, ttsPrepared: true, speechError: `Tạo giọng quá ${Math.round(speechTimeoutMs / 1000)} giây; lượt này tiếp tục bằng hình ảnh.` };
      publish();
    }, Math.max(0, current.speechDeadline - now()));
    speechTimer?.unref?.();

    if (allowAsyncSpeech && shouldPrepareSpeech) {
      void prepare(original).then(preparedSpeech => {
        if (token !== generation || active?.event?.id !== original.id || active.event.ttsPrepared || now() >= active.returnsAt || stateModel.state.settings.presentationPaused || !stateModel.state.settings.ttsEnabled) return;
        if (speechTimer) { clearTimer(speechTimer); speechTimer = null; }
        if (!preparedSpeech?.ok) {
          if (active?.event?.id === original.id) {
            active.event = { ...active.event, ttsPrepared: true, speechError: 'Giọng đọc chưa sẵn sàng.' };
            active.returnsAt = Math.max(now(), startsAt + duration);
            active.endsAt = active.returnsAt + active.returnDuration;
            scheduleFinish(active);
            publish();
          }
          return;
        }
        const speechStartsAt = now() + 250;
        const readyEvent = { ...original, ttsUrl: preparedSpeech.url, ttsPrepared: true, speechError: null, speechStartsAt };
        let playback = null;
        if (active?.event?.id === original.id) {
          active.event = readyEvent;
          const speechSeconds = Number(preparedSpeech.durationSec);
          const speechDuration = (Number.isFinite(speechSeconds) && speechSeconds > 0 ? speechSeconds : 10) * 1000 + 700;
          active.returnsAt = Math.max(startsAt + duration, speechStartsAt + speechDuration);
          active.endsAt = active.returnsAt + active.returnDuration;
          playback = active;
          scheduleFinish(playback);
          publish();
        }
        // Speech has its own clock; late results from expired cues are ignored.
        notify('speech', { event: readyEvent, startsAt: speechStartsAt, playback });
      });
    }
    prepareNext();
  }
  async function pump() {
    if (active || preparing || !pending.length || stateModel.state.settings.presentationPaused) return;
    const token = generation;
    const original = pending.shift();
    if (nonBlockingSpeech) {
      const speech = original.ttsUrl ? { ok: true, url: original.ttsUrl, durationSec: original.durationSec }
        : stateModel.state.settings.ttsEnabled ? speechResults.get(original) || null : null;
      start(original, token, speech, true);
      return;
    }
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
    start(original, token, speech, false);
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
    generation++; if (speechTimer) { clearTimer(speechTimer); speechTimer = null; } if (timer) clearTimer(timer);
    timer = null; active = null; preparing = false; pending.length = 0; prepared = new WeakMap(); speechResults = new WeakMap(); speechTail = Promise.resolve(); publish();
  }
  publish();
  return { enqueue, clear, resume() { publish(); void pump(); }, status: () => stateModel.playback };
}
module.exports = { createCeremonyQueue };
