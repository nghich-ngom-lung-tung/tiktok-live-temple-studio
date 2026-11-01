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
  liveSessions: [],
  liveSession: null,
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    ttsVoiceRotation: [],
    centralCharacter: 'aoLam',
    centralCharacterConfigured: false,
    centralCharacterRotationEnabled: false,
    centralCharacterRotationPool: ['aoLam', 'maleBrown', 'elder', 'novice', 'pinkAoDai'],
    centralCharacterRotationCursor: 0,
    narrationTemplates: { ...DEFAULT_NARRATION },
    fortuneReadingMode: 'summary',
    musicTrack: 'lotus',
    musicAutoRotate: false,
    stageBackgroundUrl: '/assets/tam-the-sanctuary-stage.png',
    bgMusicEnabled: true,
    sfxEnabled: true,
    presentationPaused: false,
    sfxVolume: 0.8,
    giftMappings: {},
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
    this.roomViewers = new Map();
    this.simulatedViewers = new Map();
    this.state = this.loadState();
    this.playback = { current: null, pendingCount: 0, preparing: false, skipped: 0, paused: false };
    if (this.state.liveSession?.active) this.endLiveSession('serverRestart');
  }

  beginLiveSession(username) {
    if (this.state.liveSession?.active && this.state.liveSession.username === username) return;
    if (this.state.liveSession?.active) this.endLiveSession('switchRoom');
    this.state.liveSession = {
      id: require('node:crypto').randomUUID(), username, active: true,
      startedAt: Date.now(), updatedAt: Date.now(), endedAt: null,
      peakViewers: Number(this.state.tiktok.viewerCount || 0), comments: 0, likes: 0, follows: 0, shares: 0,
      coins: 0, giftCount: 0, merit: 0, rituals: 0, viewers: {}, leaders: {}
    };
    for (const key of this.roomViewers.keys()) this.state.liveSession.viewers[`u:${key}`] = true;
    this.saveState();
  }

  endLiveSession(reason = 'manual') {
    const session = this.state.liveSession;
    if (!session?.active) return;
    session.active = false; session.endedAt = reason === 'serverRestart' ? session.updatedAt : Date.now();
    session.endReason = reason;
    const history = Array.isArray(this.state.liveSessions) ? this.state.liveSessions : [];
    this.state.liveSessions = [this.sessionSummary(session), ...history.filter(item => item.id !== session.id)].slice(0, 20);
    this.saveState();
  }

  recordRoomActivity(kind, amount = 1) {
    const session = this.state.liveSession;
    if (!session?.active) return;
    if (['comments', 'likes', 'follows', 'shares'].includes(kind)) session[kind] += amount;
    session.updatedAt = Date.now(); this.saveState();
  }

  recordViewerCount(count) {
    const session = this.state.liveSession;
    if (session?.active) { session.peakViewers = Math.max(session.peakViewers, count); session.updatedAt = Date.now(); this.saveState(); }
  }

  sessionSummary(session = this.state.liveSession) {
    if (!session) return null;
    const { viewers, leaders, ...summary } = session;
    return { ...summary, uniqueViewers: viewers ? Object.keys(viewers).length : Number(session.uniqueViewers || 0),
      leaderboard: leaders ? Object.values(leaders).sort((a, b) => b.merit - a.merit).slice(0, 10) : (session.leaderboard || []) };
  }

  observeRoomViewer(user, uniqueId, avatar) {
    const name = sanitizeUserName(user || uniqueId);
    const key = String(uniqueId || name).toLocaleLowerCase('vi');
    const previous = this.roomViewers.get(key);
    const characters = ['aoLam', 'maleBrown', 'elder', 'novice', 'pinkAoDai'];
    this.roomViewers.set(key, {
      name, uniqueId: uniqueId || name, avatar: avatar || previous?.avatar || '',
      character: previous?.character || characters[require('node:crypto').randomInt(characters.length)],
      lastSeenAt: Date.now()
    });
    if (this.state.liveSession?.active) {
      this.state.liveSession.viewers[`u:${key}`] = true;
      this.state.liveSession.updatedAt = Date.now();
    }
  }

  pruneRoomViewers() {
    let removed = false;
    for (const [key, viewer] of this.roomViewers) {
      if (Date.now() - viewer.lastSeenAt > 15 * 60 * 1000) {
        this.roomViewers.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  getRoomViewers() {
    this.pruneRoomViewers();
    const devoteesById = new Map(Object.values(this.state.devotees).map(devotee => [String(devotee.uniqueId).toLocaleLowerCase('vi'), devotee]));
    return [...this.roomViewers.values(), ...this.simulatedViewers.values()].map(viewer => {
      const devotee = devoteesById.get(String(viewer.uniqueId).toLocaleLowerCase('vi'));
      return { ...viewer, merit: devotee?.merit || 0 };
    }).sort((a, b) => b.merit - a.merit).slice(0, 200);
  }

  setSimulatedViewerCount(count) {
    if (!Number.isInteger(count) || count < 0 || count > 200) throw new Error('Số người giả lập phải là số nguyên từ 0 đến 200.');
    const characters = ['aoLam', 'maleBrown', 'elder', 'novice', 'pinkAoDai'];
    const next = new Map();
    for (let index = 1; index <= count; index++) {
      const uniqueId = `simulation_viewer_${index}`;
      next.set(uniqueId, this.simulatedViewers.get(uniqueId) || {
        uniqueId, name: `Khách test ${String(index).padStart(3, '0')}`, avatar: '',
        character: characters[require('node:crypto').randomInt(characters.length)], isSimulated: true
      });
    }
    this.simulatedViewers = next;
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
          settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}), autoSim: false, narrationTemplates: { ...DEFAULT_NARRATION, ...(saved.settings?.narrationTemplates || {}) } },
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
        settings: this.state.settings,
        liveSession: this.state.liveSession, liveSessions: this.state.liveSessions
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
    const session = this.state.liveSession;
    const roomKey = String(uniqueId || displayName).toLocaleLowerCase('vi');
    if (session?.active && this.roomViewers.has(roomKey)) {
      const previous = session.leaders[`u:${roomKey}`];
      session.leaders[`u:${roomKey}`] = { name: displayName, uniqueId, avatar: avatar || previous?.avatar || '', merit: (previous?.merit || 0) + meritDelta };
      session.merit += meritDelta; session.updatedAt = Date.now();
    }
    this.state.haloIntensity = Math.min(1.0, 0.35 + (this.state.totalMerit % 1000) / 1400);
    return devotee;
  }

  pushEventLog(event) {
    const session = this.state.liveSession;
    if (session?.active && this.roomViewers.has(String(event.uniqueId || '').toLocaleLowerCase('vi'))) {
      session.rituals++; session.updatedAt = Date.now();
      if (event.type === 'offerGift' || event.type === 'grandCeremony') {
        session.coins += Number(event.coins || 0); session.giftCount += Number(event.giftQuantity || 1);
      }
    }
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
      roomViewers: this.getRoomViewers(),
      simulatedViewerCount: this.simulatedViewers.size,
      liveSession: this.sessionSummary(),
      liveSessions: (this.state.liveSessions || []).map(session => this.sessionSummary(session)),
      playback: this.playback,
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
