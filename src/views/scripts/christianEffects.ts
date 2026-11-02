const SYMBOLS: Record<string, string> = {
  prayer: '<path d="M50 12v76M28 36h44"/>',
  scripture: '<path d="M50 30Q30 16 10 26v58q20-10 40 2 20-12 40-2V26Q70 16 50 30v56M20 40h18M20 52h18M62 40h18M62 52h18"/>',
  candle: '<path class="candle-flame" d="M50 5C27 31 40 40 50 44 65 39 68 23 50 5Z"/><path d="M50 44v9M36 54h28v35H36ZM25 90h50"/>',
  bell: '<g class="cathedral-bell"><path d="M22 68h56l-8-12V35a20 20 0 0 0-40 0v21ZM42 80q8 14 16 0M50 8V3"/></g><circle class="bell-wave" cx="50" cy="45" r="44"/>',
  communion: '<circle cx="50" cy="50" r="25"/><path d="M50 34v32M40 44h20M50 2v12M50 86v12M2 50h12M86 50h12M16 16l9 9M75 75l9 9M16 84l9-9M75 25l9-9"/>',
  peace: '<path d="M15 55q20 7 35-12L35 18q28 5 35 25 16-13 21-2l-12 9Q70 79 40 76L14 88l8-23M72 45h1M54 70q12 6 22 20"/>',
  thanksgiving: '<path d="M50 85 17 54C-6 25 27 3 50 29 73 3 106 25 83 54Z"/>',
  gift: '<path d="M14 39h72v18H14ZM22 57v33h56V57M50 39v51M50 38C9 35 24 4 42 22l8 16c41-3 26-34 8-16Z"/>',
  welcome: '<path d="M20 90V40a30 30 0 0 1 60 0v50M50 10v80M14 90h72M60 55h2"/>'
};

export function createChristianEffects(stage: HTMLElement | null, context: () => AudioContext) {
  let layer: HTMLElement | null = null;
  const timers: number[] = [];
  const sounds = new Set<OscillatorNode>();
  function clear() {
    layer?.remove(); layer = null;
    stage?.removeAttribute('data-action');
    timers.splice(0).forEach(window.clearTimeout);
    for (const sound of sounds) { try { sound.stop(); } catch (_) {} }
    sounds.clear();
  }
  function chord(frequencies: number[], delay = 0, duration = 2.8) {
    try {
      const ctx = context();
      for (const frequency of frequencies) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = ctx.currentTime + delay;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(.055 / frequencies.length, at + .035);
        gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
        oscillator.connect(gain); gain.connect(ctx.destination);
        sounds.add(oscillator);
        oscillator.onended = () => { sounds.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at); oscillator.stop(at + duration);
      }
    } catch (_) { /* Visuals remain usable when browser audio is locked. */ }
  }
  return {
    clear,
    show(event: Record<string, any>, soundEnabled = true) {
      clear();
      if (!stage || !SYMBOLS[event.type]) return;
      stage.dataset.action = event.type;
      layer = document.createElement('div');
      layer.className = `christian-ritual-effect effect-${event.type}`;
      layer.setAttribute('aria-hidden', 'true');
      const symbol = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${SYMBOLS[event.type]}</svg>`;
      layer.innerHTML = `<div class="ritual-aureole"></div><div class="ritual-emblem">${symbol}</div>`;
      const count = event.type === 'communion' ? 24 : event.type === 'peace' || event.type === 'thanksgiving' || event.type === 'gift' ? 12 : 0;
      for (let index = 0; index < count; index++) {
        const mote = document.createElement('span');
        mote.className = 'ritual-light-mote';
        mote.style.setProperty('--x', `${8 + (index * 37 % 84)}%`);
        mote.style.setProperty('--delay', `${-(index % 8) * .7}s`);
        layer.append(mote);
      }
      stage.append(layer);
      const elapsed = Number(event.elapsedMs || 0);
      for (const animation of layer.getAnimations({ subtree: true })) {
        if (elapsed > 0) animation.currentTime = elapsed;
      }
      if (soundEnabled && elapsed < 800) {
        if (event.type === 'bell') {
          chord([261.63, 523.25, 784.88], 0, 3.5);
          chord([261.63, 523.25, 784.88], 1.6, 3.5);
          chord([261.63, 523.25, 784.88], 3.2, 3.5);
        } else if (event.type === 'communion') chord([261.63, 329.63, 392, 523.25], 0, 5);
        else if (['candle', 'peace', 'thanksgiving', 'gift'].includes(event.type)) chord([523.25, 659.25, 784], 0, 2);
      }
    }
  };
}
