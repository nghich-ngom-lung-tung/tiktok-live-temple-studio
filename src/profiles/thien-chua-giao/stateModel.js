const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeJsonAtomic } = require('../../utils/atomicJson');
const { sanitizeUserName, sanitizeWishText } = require('../../utils/textSanitizer');
const { getProfile } = require('../registry');

const profile = getProfile('thien-chua-giao');
const DEFAULT_STATE = Object.freeze({
  totalPrayerRequests: 0,
  totalScriptureShares: 0,
  totalThanksgiving: 0,
  totalGiftThanks: 0,
  supporters: {},
  recentEvents: [],
  prayerRequests: [],
  liveSessions: [],
  liveSession: null,
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    ttsVolume: 0.95,
    ttsVoiceRotation: [],
    stageBackgroundUrl: profile.defaultBackground,
    bgMusicEnabled: false,
    musicTrack: 'sanctuary',
    musicAutoRotate: false,
    presentationPaused: false,
    bgMusicVolume: 0.18,
    giftMappings: {},
    narrationTemplates: {
      prayer: [
        'Lạy Chúa Giêsu, xin lắng nghe lời cầu nguyện của {user}: {wish}',
        'Cùng {user}, chúng ta dâng ý nguyện này lên Chúa: {wish}',
        'Xin Chúa ban bình an và nâng đỡ {user} qua lời cầu nguyện: {wish}',
        'Lạy Chúa, xin soi sáng và đồng hành cùng {user} trong ý nguyện: {wish}'
      ].join('\n'),
      scripture: 'Cùng {user} suy ngẫm qua {reference}. {reflection}',
      gift: 'Xin cảm ơn {user} đã gửi {giftName}. Chúc bạn một ngày bình an.',
      welcome: 'Xin chào {user}, cảm ơn bạn đã ghé thăm buổi cầu nguyện.',
      candle: '{user} thắp một ngọn nến tạ ơn. Xin ánh sáng hy vọng sưởi ấm gia đình và những người thân yêu.',
      bell: 'Chuông thánh đường ngân vang. Cùng {user} dành một phút tĩnh lặng và hướng lòng về Chúa.',
      communion: 'Cùng {user} và cộng đoàn hiệp thông trong lời cầu nguyện. Xin tình yêu thương kết nối và nâng đỡ mỗi người.',
      peace: 'Nguyện xin bình an của Chúa ở cùng {user} và gia đình, hôm nay và mọi ngày.',
      thanksgiving: 'Cùng {user} dâng lời tạ ơn Chúa vì hồng ân sự sống và những điều tốt đẹp mỗi ngày.'
    }
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMusicTrack(track) {
  if (['sanctuary', 'morning-grace', 'candlelight', 'garden-peace', 'gentle-dawn', 'still-waters'].includes(track)) return track;
  if (['bamboo', 'dawn'].includes(track)) return 'morning-grace';
  if (['rain', 'night'].includes(track)) return 'candlelight';
  return 'sanctuary';
}

class ChristianStateModel {
  constructor({ stateFile }) {
    this.stateFile = stateFile;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    this.saveTimer = null;
    this.roomViewers = new Map();
    this.simulatedViewers = new Map();
    this.arrivalSequence = 0;
    this.state = this.loadState();
    this.playback = { current: null, pendingCount: 0, preparing: false, skipped: 0, paused: false };
    if (this.state.liveSession?.active) this.endLiveSession('serverRestart');
  }

  loadState() {
    try {
      if (!fs.existsSync(this.stateFile)) return clone(DEFAULT_STATE);
      const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return {
        ...clone(DEFAULT_STATE),
        ...saved,
        totalThanksgiving: Math.max(0, Number(saved.totalThanksgiving) || 0),
        supporters: saved.supporters || {},
        recentEvents: Array.isArray(saved.recentEvents) ? saved.recentEvents.slice(0, 50) : [],
        prayerRequests: Array.isArray(saved.prayerRequests) ? saved.prayerRequests.slice(0, 30) : [],
        liveSessions: Array.isArray(saved.liveSessions) ? saved.liveSessions.slice(0, 20) : [],
        settings: {
          ...clone(DEFAULT_STATE.settings),
          ...(saved.settings || {}),
          musicTrack: normalizeMusicTrack(saved.settings?.musicTrack),
          stageBackgroundUrl: saved.settings?.stageBackgroundUrl || profile.defaultBackground,
          autoSim: false,
          narrationTemplates: {
            ...DEFAULT_STATE.settings.narrationTemplates,
            ...(saved.settings?.narrationTemplates || {}),
            prayer: saved.settings?.narrationTemplates?.prayer === 'Cùng {user} gửi lời cầu nguyện: {wish}'
              ? DEFAULT_STATE.settings.narrationTemplates.prayer
              : (saved.settings?.narrationTemplates?.prayer || DEFAULT_STATE.settings.narrationTemplates.prayer)
          }
        },
        tiktok: { ...DEFAULT_STATE.tiktok }
      };
    } catch (error) {
      console.warn('[Thiên Chúa giáo] Không đọc được state, dùng mặc định:', error.message);
      return clone(DEFAULT_STATE);
    }
  }

  saveState() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const toSave = {
        totalPrayerRequests: this.state.totalPrayerRequests,
        totalScriptureShares: this.state.totalScriptureShares,
        totalThanksgiving: this.state.totalThanksgiving,
        totalGiftThanks: this.state.totalGiftThanks,
        supporters: this.state.supporters,
        recentEvents: this.state.recentEvents,
        prayerRequests: this.state.prayerRequests,
        liveSession: this.state.liveSession,
        liveSessions: this.state.liveSessions,
        settings: this.state.settings
      };
      writeJsonAtomic(this.stateFile, toSave).catch(error => {
        console.error('[Thiên Chúa giáo] Lỗi lưu state:', error.message);
      });
    }, 500);
  }

  beginLiveSession(username = this.state.tiktok.username) {
    if (this.state.liveSession?.active && this.state.liveSession.username === username) return;
    if (this.state.liveSession?.active) this.endLiveSession('switchRoom');
    this.state.liveSession = {
      id: crypto.randomUUID(), username, active: true,
      startedAt: Date.now(), updatedAt: Date.now(), endedAt: null,
      peakViewers: Number(this.state.tiktok.viewerCount || 0),
      comments: 0, likes: 0, follows: 0, shares: 0, coins: 0, giftCount: 0,
      prayerRequests: 0, scriptureShares: 0, thanksgiving: 0, viewers: {}, supporters: {}
    };
    for (const key of this.roomViewers.keys()) this.state.liveSession.viewers[`u:${key}`] = true;
    this.saveState();
  }

  endLiveSession(reason = 'manual') {
    const session = this.state.liveSession;
    if (!session?.active) return;
    session.active = false;
    session.endedAt = reason === 'serverRestart' ? session.updatedAt : Date.now();
    session.endReason = reason;
    this.state.liveSessions = [this.sessionSummary(session), ...(this.state.liveSessions || []).filter(item => item.id !== session.id)].slice(0, 20);
    this.saveState();
  }

  sessionSummary(session = this.state.liveSession) {
    if (!session) return null;
    const { viewers, supporters, ...summary } = session;
    const leaderboard = supporters
      ? Object.values(supporters).sort((a, b) => b.coins - a.coins).slice(0, 10)
      : (session.leaderboard || []);
    return {
      ...summary,
      uniqueViewers: viewers ? Object.keys(viewers).length : Number(session.uniqueViewers || 0),
      leaderboard
    };
  }

  recordRoomActivity(kind, amount = 1) {
    const session = this.state.liveSession;
    if (!session?.active) return;
    if (['comments', 'likes', 'follows', 'shares'].includes(kind)) session[kind] += amount;
    session.updatedAt = Date.now();
    this.saveState();
  }

  recordViewerCount(count) {
    const session = this.state.liveSession;
    if (session?.active) {
      session.peakViewers = Math.max(session.peakViewers, count);
      session.updatedAt = Date.now();
      this.saveState();
    }
  }

  recordMember(user, uniqueId, avatar = '') {
    const name = sanitizeUserName(user || uniqueId);
    const key = String(uniqueId || name).toLocaleLowerCase('vi');
    const simulated = this.simulatedViewers.get(key);
    if (simulated) return { ...simulated, name, avatar: avatar || simulated.avatar };
    const previous = this.roomViewers.get(key);
    const arrivalOrder = previous?.arrivalOrder ?? ++this.arrivalSequence;
    const viewer = {
      name,
      uniqueId: String(uniqueId || name),
      avatar: avatar || previous?.avatar || '',
      character: previous?.character || (arrivalOrder % 2 === 1 ? 'man' : 'woman'),
      arrivalOrder,
      joinedAt: previous?.joinedAt || Date.now(),
      lastSeenAt: Date.now()
    };
    this.roomViewers.set(key, viewer);
    if (this.state.liveSession?.active) {
      this.state.liveSession.viewers[`u:${key}`] = true;
      this.state.liveSession.updatedAt = Date.now();
      this.saveState();
    }
    return viewer;
  }

  observeRoomViewer(user, uniqueId, avatar) {
    return this.recordMember(user, uniqueId, avatar);
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
    const viewers = [...this.roomViewers.values(), ...this.simulatedViewers.values()]
      .sort((a, b) => a.arrivalOrder - b.arrivalOrder)
      .slice(0, 200);
    return viewers.map((viewer, seatIndex) => ({ ...viewer, seatIndex }));
  }

  setSimulatedViewerCount(count) {
    if (!Number.isInteger(count) || count < 0 || count > 200) throw new Error('Số người giả lập phải là số nguyên từ 0 đến 200.');
    const next = new Map();
    for (let index = 1; index <= count; index++) {
      const uniqueId = `simulation_christian_${index}`;
      next.set(uniqueId, this.simulatedViewers.get(uniqueId) || {
        uniqueId,
        name: `Khách test ${String(index).padStart(3, '0')}`,
        avatar: '',
        character: index % 2 === 1 ? 'man' : 'woman',
        isSimulated: true,
        arrivalOrder: ++this.arrivalSequence,
        joinedAt: Date.now(),
        lastSeenAt: Date.now()
      });
    }
    this.simulatedViewers = next;
  }

  pushEventLog(event) {
    const entry = { id: `evt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`, timestamp: new Date().toISOString(), ...event };
    this.state.recentEvents.unshift(entry);
    if (this.state.recentEvents.length > 50) this.state.recentEvents.length = 50;
    this.saveState();
    return entry;
  }

  recordPrayer({ user, uniqueId, avatar, wish }) {
    const entry = {
      id: crypto.randomUUID(),
      user: sanitizeUserName(user || uniqueId),
      uniqueId: String(uniqueId || ''),
      avatar: String(avatar || ''),
      wish: sanitizeWishText(wish, 240).slice(0, 240),
      timestamp: new Date().toISOString()
    };
    this.state.totalPrayerRequests += 1;
    this.state.prayerRequests.unshift(entry);
    if (this.state.prayerRequests.length > 30) this.state.prayerRequests.length = 30;
    if (this.state.liveSession?.active) {
      this.state.liveSession.prayerRequests += 1;
      this.state.liveSession.updatedAt = Date.now();
    }
    this.pushEventLog({ type: 'prayer', user: entry.user, uniqueId: entry.uniqueId, avatar: entry.avatar, wish: entry.wish });
    return entry;
  }

  recordScriptureShare({ user, uniqueId, avatar, reference, reflection, reflectionId, title, category }) {
    const entry = {
      id: crypto.randomUUID(),
      user: sanitizeUserName(user || uniqueId),
      uniqueId: String(uniqueId || ''),
      avatar: String(avatar || ''),
      reference: String(reference || '').normalize('NFC').slice(0, 80),
      reflectionId, title, category,
      reflection: sanitizeWishText(reflection, 240).slice(0, 240),
      timestamp: new Date().toISOString()
    };
    this.state.totalScriptureShares += 1;
    if (this.state.liveSession?.active) {
      this.state.liveSession.scriptureShares += 1;
      this.state.liveSession.updatedAt = Date.now();
    }
    this.pushEventLog({ type: 'scripture', user: entry.user, uniqueId: entry.uniqueId, avatar: entry.avatar, reference: entry.reference, reflection: entry.reflection, reflectionId, title, category });
    return entry;
  }

  recordGift({ user, uniqueId, avatar, coins = 0, giftCount = 1, giftName = 'quà' }) {
    const name = sanitizeUserName(user || uniqueId);
    const key = String(uniqueId || name).slice(0, 80);
    const supporter = this.state.supporters[key] || { name, uniqueId: String(uniqueId || ''), avatar: '', coins: 0, gifts: 0, lastGift: '' };
    supporter.name = name;
    supporter.avatar = avatar || supporter.avatar || '';
    supporter.coins += Math.max(0, Number(coins) || 0);
    supporter.gifts += Math.max(1, Number(giftCount) || 1);
    supporter.lastGift = sanitizeWishText(giftName).slice(0, 80);
    this.state.supporters[key] = supporter;
    this.state.totalGiftThanks += 1;
    if (this.state.liveSession?.active) {
      this.state.liveSession.coins += Math.max(0, Number(coins) || 0);
      this.state.liveSession.giftCount += Math.max(1, Number(giftCount) || 1);
      const sessionSupporter = this.state.liveSession.supporters[key] || { ...supporter, coins: 0, gifts: 0 };
      this.state.liveSession.supporters[key] = {
        ...supporter,
        coins: sessionSupporter.coins + Math.max(0, Number(coins) || 0),
        gifts: sessionSupporter.gifts + Math.max(1, Number(giftCount) || 1)
      };
      this.state.liveSession.updatedAt = Date.now();
    }
    this.pushEventLog({ type: 'gift', user: name, uniqueId: String(uniqueId || ''), avatar: supporter.avatar, coins: Math.max(0, Number(coins) || 0), giftName: supporter.lastGift });
    return supporter;
  }

  recordThanksgiving({ user, uniqueId }) {
    const name = sanitizeUserName(user || uniqueId);
    this.state.totalThanksgiving += 1;
    if (this.state.liveSession?.active) {
      this.state.liveSession.thanksgiving = (this.state.liveSession.thanksgiving || 0) + 1;
      this.state.liveSession.updatedAt = Date.now();
    }
    return this.pushEventLog({ type: 'thanksgiving', user: name, uniqueId: String(uniqueId || '') });
  }

  getSupporters(limit = 6) {
    return Object.values(this.state.supporters)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, limit)
      .map((supporter, index) => ({ rank: index + 1, ...supporter }));
  }

  getPublicState(ttsManager = null) {
    return {
      profileId: profile.id,
      totalPrayerRequests: this.state.totalPrayerRequests,
      totalScriptureShares: this.state.totalScriptureShares,
      totalThanksgiving: this.state.totalThanksgiving,
      totalGiftThanks: this.state.totalGiftThanks,
      prayerRequests: this.state.prayerRequests.slice(0, 12),
      supporters: this.getSupporters(6),
      roomViewers: this.getRoomViewers(),
      simulatedViewerCount: this.simulatedViewers.size,
      liveSession: this.sessionSummary(),
      liveSessions: this.state.liveSessions.map(session => this.sessionSummary(session)),
      playback: this.playback,
      recentEvents: this.state.recentEvents.slice(0, 15),
      settings: this.state.settings,
      tiktok: this.state.tiktok,
      tts: ttsManager ? ttsManager.getStatus() : { ready: false, status: 'init', voice: this.state.settings.ttsVoice }
    };
  }
}

module.exports = { ChristianStateModel, DEFAULT_STATE };
