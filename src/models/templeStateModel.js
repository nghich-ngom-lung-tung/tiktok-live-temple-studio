const { DEFAULT_NARRATION } = require('../services/narrationService');
const fs = require('fs');
const { sanitizeUserName, sanitizeWishText } = require('../utils/textSanitizer');

const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: { lotus: 3, fruit: 2, lamp: 2, dragon: 1 },
  devotees: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    ttsVoiceRotation: [],
    narrationTemplates: { ...DEFAULT_NARRATION },
    fortuneReadingMode: 'summary',
    musicTrack: 'lotus',
    musicAutoRotate: false,
    bgMusicEnabled: true,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

class TempleStateModel {
  constructor({ stateFile }) {
    this.stateFile = stateFile;
    this.saveTimer = null;
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        return {
          ...DEFAULT_STATE,
          ...saved,
          devotees: saved.devotees || {},
          offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
          settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}), narrationTemplates: { ...DEFAULT_NARRATION, ...(saved.settings?.narrationTemplates || {}) } },
          tiktok: { ...DEFAULT_STATE.tiktok }
        };
      }
    } catch (error) {
      console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', error.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const toSave = {
        totalIncense: this.state.totalIncense,
        totalMerit: this.state.totalMerit,
        woodenFishHits: this.state.woodenFishHits,
        bellRings: this.state.bellRings,
        lanternCount: this.state.lanternCount,
        fortuneCount: this.state.fortuneCount,
        activeIncenseSticks: this.state.activeIncenseSticks,
        offerings: this.state.offerings,
        devotees: this.state.devotees,
        settings: this.state.settings
      };
      fs.promises.writeFile(this.stateFile, JSON.stringify(toSave, null, 2), 'utf8').catch((error) => {
        console.error('[State] Lỗi lưu file:', error.message);
      });
    }, 1200);
  }

  getLeaderboard(limit = 6) {
    return Object.values(this.state.devotees)
      .sort((a, b) => b.merit - a.merit)
      .slice(0, limit)
      .map((devotee, index) => ({
        rank: index + 1,
        name: devotee.name,
        uniqueId: devotee.uniqueId,
        avatar: devotee.avatar || '',
        merit: devotee.merit,
        incense: devotee.incense || 0,
        lastWish: devotee.lastWish || ''
      }));
  }

  recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
    const displayName = sanitizeUserName(user || uniqueId);
    const cleanWish = sanitizeWishText(wish);
    const key = (uniqueId || displayName).slice(0, 40);
    if (!this.state.devotees[key]) {
      this.state.devotees[key] = {
        name: displayName,
        uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
        avatar: avatar || '',
        merit: 0,
        incense: 0,
        gifts: 0,
        lastWish: ''
      };
    }
    const devotee = this.state.devotees[key];
    devotee.name = displayName;
    if (avatar) devotee.avatar = avatar;
    devotee.merit += meritDelta;
    devotee.incense += incenseDelta;
    devotee.gifts += giftDelta;
    if (cleanWish) devotee.lastWish = cleanWish;

    this.state.totalMerit += meritDelta;
    this.state.haloIntensity = Math.min(1.0, 0.35 + (this.state.totalMerit % 1000) / 1400);
    return devotee;
  }

  pushEventLog(event) {
    const entry = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.state.recentEvents.unshift(entry);
    if (this.state.recentEvents.length > 35) this.state.recentEvents.length = 35;
    return entry;
  }

  getPublicState(ttsManager = null) {
    return {
      totalIncense: this.state.totalIncense,
      totalMerit: this.state.totalMerit,
      woodenFishHits: this.state.woodenFishHits,
      bellRings: this.state.bellRings,
      lanternCount: this.state.lanternCount,
      fortuneCount: this.state.fortuneCount,
      activeIncenseSticks: this.state.activeIncenseSticks,
      haloIntensity: this.state.haloIntensity,
      offerings: this.state.offerings,
      leaderboard: this.getLeaderboard(200),
      recentEvents: this.state.recentEvents.slice(0, 15),
      settings: this.state.settings,
      tiktok: this.state.tiktok,
      tts: ttsManager
        ? ttsManager.getStatus()
        : { ready: false, status: 'init', voice: 'maichi' }
    };
  }
}

module.exports = { TempleStateModel, DEFAULT_STATE };
