/**
 * Temple audio: six local ambient tracks, ducking under speech,
 * a sampled wooden-fish instrument, synthesized bells and queued ZeroTTS.
 */
type TtsQueueOptions = {
  voice?: string;
  url?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  startsAt?: number;
};

type TtsApiResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};

type TtsQueueItem = {
  id: string;
  text: string;
  voice: string;
  url: string | null;
  onStart: (() => void) | null;
  onEnd: (() => void) | null;
  fetchPromise: Promise<TtsApiResponse> | null;
  startsAt?: number;
};

type TtsPlaybackState = {
  speaking: boolean;
  synthesizing: boolean;
  text: string;
};

class TempleAudioEngine {
  declare ctx: AudioContext | null;
  declare unlocked: boolean;
  declare sfxEnabled: boolean;
  declare bgMusicEnabled: boolean;
  declare ttsEnabled: boolean;
  declare ttsVoice: string;
  declare bgBaseVolume: number;
  declare ttsVolume: number;
  declare useSynthMusicFallback: boolean;
  declare synthBgTimer: number | null;
  declare bgAudio: HTMLAudioElement;
  declare ttsQueue: TtsQueueItem[];
  declare ttsPlaying: boolean;
  declare currentAudio: HTMLAudioElement | null;
  declare onTtsStateChange: ((state: TtsPlaybackState) => void) | null;
  declare sampleBuffers: Map<string, Promise<AudioBuffer>>;
  declare sfxVolume: number;
  private ttsEpoch = 0;
  private finishCurrentAudio: (() => void) | null = null;
  private presentationPaused = false;

  stopTts(): void {
    this.ttsEpoch++; this.ttsQueue.length = 0; this.currentAudio?.pause();
    this.finishCurrentAudio?.(); this.finishCurrentAudio = null; this.currentAudio = null;
    this.ttsPlaying = false; this.setBgDucking(false);
  }

  applyRemoteSettings(settings: any): void {
    const wasTts = this.ttsEnabled, wasMusic = this.bgMusicEnabled;
    this.presentationPaused = Boolean(settings.presentationPaused);
    this.ttsEnabled = settings.ttsEnabled !== false && !this.presentationPaused;
    this.bgMusicEnabled = settings.bgMusicEnabled !== false && !this.presentationPaused;
    this.sfxEnabled = settings.sfxEnabled !== false && !this.presentationPaused;
    if ((wasTts && !this.ttsEnabled) || this.presentationPaused) this.stopTts();
    if (!this.sfxEnabled && this.ctx) { const old = this.ctx; this.ctx = null; void old.close().catch(() => {}); }
    if (!this.bgMusicEnabled) this.stopZenAmbience();
    else if (!wasMusic && this.unlocked) this.startZenAmbience();
    if (typeof settings.sfxVolume === 'number') this.sfxVolume = settings.sfxVolume;
  }

  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';

    // Ambient library volume, 0–100%; reduced automatically during speech.
    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.65;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.95;

    this.useSynthMusicFallback = false;
    this.synthBgTimer = null;
    this.bgAudio = new Audio('/assets/phat-giao/music/lotus.wav');
    this.bgAudio.loop = true;
    this.bgAudio.preload = 'auto';
    this.bgAudio.volume = this.bgBaseVolume;
    this.bgAudio.onerror = () => {
      this.useSynthMusicFallback = true;
    };
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.onTtsStateChange = null;
    this.sampleBuffers = new Map();
    this.sfxVolume = .8;
  }

  ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC NỀN "NAM MÔ A DI ĐÀ PHẬT.M4A" (CÓ AUTO-DUCKING KHI ĐỌC LỜI KHẤN)
  // --------------------------------------------------------------------------
  getDuckedVolume() {
    return +(this.bgBaseVolume * 0.35).toFixed(3);
  }

  setMusicVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = v;
    try {
      localStorage.setItem('temple_music_vol', String(v));
    } catch (_) {}
    if (this.bgAudio && !this.useSynthMusicFallback) {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
    }
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('temple_tts_vol', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.ttsVolume;
    }
  }

  setMusicSource(source: string): void {
    if (this.bgAudio.getAttribute('src') === source) return;
    this.stopZenAmbience();
    this.useSynthMusicFallback = false;
    this.bgAudio.src = source;
    this.bgAudio.load();
    if (this.unlocked && this.bgMusicEnabled) this.startZenAmbience();
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled) return;
    if (this.useSynthMusicFallback) {
      this.startDefaultZenSynthLoop();
      return;
    }
    try {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
      if (this.bgAudio.paused) {
        const p = this.bgAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (this.bgAudio.error) {
              this.useSynthMusicFallback = true;
              this.startDefaultZenSynthLoop();
            }
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
      this.startDefaultZenSynthLoop();
    }
  }

  startDefaultZenSynthLoop() {
    if (!this.bgMusicEnabled || this.synthBgTimer) return;
    const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    let step = 0;
    const playZenNote = () => {
      if (!this.bgMusicEnabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const freq = PENTATONIC[step % PENTATONIC.length];
        step++;
        const vol = (this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume) * 0.18;
        if (vol <= 0.002) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 4.25);
      } catch (_) {}
    };
    playZenNote();
    this.synthBgTimer = setInterval(playZenNote, 3600);
  }

  stopZenAmbience() {
    try {
      this.bgAudio.pause();
    } catch (_) {}
    if (this.synthBgTimer) {
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
  }

  setBgDucking(ducked) {
    if (!this.bgMusicEnabled) return;
    try {
      if (!this.useSynthMusicFallback && this.bgAudio) {
        this.bgAudio.volume = ducked ? this.getDuckedVolume() : this.bgBaseVolume;
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ TỤNG KINH (WOODEN FISH PERCUSSION SYNTH)
  // --------------------------------------------------------------------------
  async playAudioSample(file: string, level = 1, pitchMultiplier = 1): Promise<void> {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    let pending = this.sampleBuffers.get(file);
    if (!pending) {
      pending = fetch(`/assets/phat-giao/music/${file}`)
        .then(response => { if (!response.ok) throw new Error(`Không tải được âm thanh ${file}.`); return response.arrayBuffer(); })
        .then(data => ctx.decodeAudioData(data))
        .catch(error => { this.sampleBuffers.delete(file); throw error; });
      this.sampleBuffers.set(file, pending);
    }
    const buffer = await pending;
    if (!this.sfxEnabled) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(.75, Math.min(1.35, pitchMultiplier * (.97 + Math.random() * .06)));
    gain.gain.value = Math.max(0, Math.min(1, this.sfxVolume * level));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
  }

  async playWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled) return;
    try { await this.playAudioSample('wooden-fish.wav', .9, pitchMultiplier); }
    catch (_) { this.playSyntheticWoodenFish(pitchMultiplier); }
  }

  playSyntheticWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 620 * pitchMultiplier * (0.98 + Math.random() * 0.04);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, now + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, now);
      filter.Q.setValueAtTime(4.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28*this.sfxVolume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    const level = .64 * Math.max(.3, Math.min(1.2, intensity));
    void this.playAudioSample('temple-bell.wav', level).catch(() => this.playSyntheticTempleBell(intensity));
  }

  playSyntheticTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const base = 174;
      const partials = [
        { ratio: 0.5, amp: 0.22, decay: 4.2 },
        { ratio: 1.0, amp: 0.35, decay: 3.6 },
        { ratio: 1.506, amp: 0.16, decay: 2.4 },
        { ratio: 2.0, amp: 0.18, decay: 1.9 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * Math.min(1.0, intensity), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE (FORTUNE STICK SHAKER)
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    void this.playAudioSample('fortune-shake.wav', .72).catch(() => this.playSyntheticFortuneShake());
  }

  playSyntheticFortuneShake() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playSyntheticWoodenFish(1.16 + (i % 2) * 0.12);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG NGỌC DÂNG LỄ / THẮP HƯƠNG (SINGING CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const notes = [528, 660];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.10, now + idx * 0.1 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.15);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. ZEROTTS VOICE QUEUE & PREFETCHER
  // --------------------------------------------------------------------------
  enqueueTts(text: string, options: TtsQueueOptions = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    if (!this.ttsEnabled) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }

    if (this.ttsQueue.length >= 6) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || null,
      onStart,
      onEnd,
      fetchPromise: null,
      startsAt: options.startsAt
    };

    if (!item.url) {
      item.fetchPromise = this.fetchZeroTtsAudio(item.text, item.voice);
    }

    this.ttsQueue.push(item);
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text: string, voice = 'maichi'): Promise<TtsApiResponse> {
    try {
      const res = await window.TempleAuth.fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      const data = await res.json();
      if (data && data.ok && data.url) {
        return data;
      }
      return { ok: false, error: data?.error || 'ZeroTTS unavailable' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();
    const epoch = this.ttsEpoch;

    try {
      let audioUrl = item.url;
      if (!audioUrl && item.fetchPromise) {
        const res = await item.fetchPromise;
        if (res && res.ok && res.url) {
          audioUrl = res.url;
        }
      }

      if (epoch !== this.ttsEpoch) return;
      if (audioUrl) {
        this.setBgDucking(true);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: true, synthesizing: false, text: item.text });
        }
        if (item.onStart) item.onStart();
        await this.playWavUrl(audioUrl, item.startsAt);
        if (epoch === this.ttsEpoch && item.onEnd) item.onEnd();
      } else {
        if (item.onStart) item.onStart();
        if (item.onEnd) setTimeout(item.onEnd, 5500);
      }
    } catch (err) {
      if (epoch !== this.ttsEpoch) return;
      console.warn('[ZeroTTS Playback Warning]', err);
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      if (epoch !== this.ttsEpoch) return;
      this.ttsPlaying = false;
      if (this.ttsQueue.length === 0) {
        this.setBgDucking(false);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: false, synthesizing: false, text: '' });
        }
      } else {
        setTimeout(() => this.processTtsQueue(), 250);
      }
    }
  }

  async playWavUrl(url: string, startsAt?: number): Promise<void> {
    const epoch = this.ttsEpoch;
    let audioUrl = url;
    let revokeUrl = false;
    try {
      if (!String(url).startsWith('blob:')) {
        audioUrl = await window.TempleAuth.fetchAudioBlobUrl(url);
        revokeUrl = true;
      }
      if (epoch !== this.ttsEpoch) { if (revokeUrl) URL.revokeObjectURL(audioUrl); return; }
      await new Promise<void>((resolve) => {
        let finished = false;
        let audio = null;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (this.currentAudio === audio) this.currentAudio = null;
          if (this.finishCurrentAudio === finish) this.finishCurrentAudio = null;
          if (revokeUrl) URL.revokeObjectURL(audioUrl);
          resolve();
        };
        try {
          audio = new Audio(audioUrl);
          this.currentAudio = audio;
          this.finishCurrentAudio = finish;
          audio.onloadedmetadata = () => {
            if (!startsAt) return;
            const elapsed = Math.max(0, (Date.now() - startsAt) / 1000);
            if (Number.isFinite(audio.duration) && elapsed >= audio.duration) { audio.pause(); finish(); }
            else audio.currentTime = elapsed;
          };
          audio.volume = this.ttsVolume;
          audio.onended = finish;
          audio.onerror = finish;
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(finish);
        } catch (_) {
          finish();
        }
      });
    } catch (_) {
      if (revokeUrl) URL.revokeObjectURL(audioUrl);
    }
  }
}

window.TempleAudioEngine = TempleAudioEngine;
