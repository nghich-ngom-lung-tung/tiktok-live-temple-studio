const { renderNarration, validateTemplates } = require('./narrationService');
const { sanitizeUserName, sanitizeWishText } = require('../utils/textSanitizer');

function createRitualService({ stateModel, realtime, ttsManager, fortuneDeck, ceremonyQueue = null }) {
  const state = stateModel.state;
  const FORTUNE_DECK = fortuneDeck;
  const recordDevotee = (...args) => stateModel.recordDevotee(...args);
  const CHARACTER_KEYS = ['aoLam', 'maleBrown', 'elder', 'novice', 'pinkAoDai'];
  function pushEventLog(event) {
    const settings = state.settings;
    const pool = Array.isArray(settings.centralCharacterRotationPool)
      ? [...new Set(settings.centralCharacterRotationPool.filter(key => CHARACTER_KEYS.includes(key)))]
      : [];
    let character = CHARACTER_KEYS.includes(settings.centralCharacter) ? settings.centralCharacter : 'aoLam';

    if (settings.centralCharacterRotationEnabled && pool.length > 1) {
      let cursor = Number(settings.centralCharacterRotationCursor);
      if (!Number.isInteger(cursor) || cursor < 0 || cursor >= pool.length) {
        cursor = Math.max(0, pool.indexOf(character));
      }
      character = pool[cursor];
      settings.centralCharacterRotationCursor = (cursor + 1) % pool.length;
      settings.centralCharacter = character;
      settings.centralCharacterConfigured = true;
    }

    return stateModel.pushEventLog({ ...event, centralCharacter: character });
  }
  const saveState = () => stateModel.saveState();
  const broadcastNotification = (...args) => realtime.broadcastNotification(...args);
  const getPublicState = () => stateModel.getPublicState(ttsManager);
  const publishRitual = event => {
    if (ceremonyQueue) {
      ceremonyQueue.enqueue(event);
      broadcastNotification('temple.state', getPublicState());
    } else broadcastNotification('temple.event', { event, state: getPublicState() });
  };
  let configureAutoSim = () => {};
  const fortuneBags = new Map();
  const lastFortunes = new Map();
  let voiceRotationCursor = 0;

  function nextRitualVoice() {
    const voices = state.settings.ttsVoiceRotation;
    if (!Array.isArray(voices) || voices.length === 0) return state.settings.ttsVoice || 'maichi';
    const voice = voices[voiceRotationCursor % voices.length];
    voiceRotationCursor = (voiceRotationCursor + 1) % voices.length;
    return voice;
  }

const rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const devotee = recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : renderNarration(state.settings, 'incense', { user: devotee.name, count, wish });

    const event = pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(1_000_000, Math.floor(Number(params.count) || 1)));
    const merit = count;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0);
    const ttsText = params.readTts === true
      ? renderNarration(state.settings, 'woodenFish', { user: devotee.name, count })
      : '';

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const ttsText = params.readTts
      ? renderNarration(state.settings, 'bell', { user: devotee.name, count, wish })
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : renderNarration(state.settings, 'prayer', { user: devotee.name, wish });

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    if ((params.coins !== undefined && !Number.isFinite(Number(params.coins)))
      || (params.giftQuantity !== undefined && !Number.isFinite(Number(params.giftQuantity)))) throw new Error('Giá trị và số lượng quà phải là số hữu hạn.');
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const giftQuantity = Math.max(1, Math.floor(Number(params.giftQuantity) || 1));
    const giftUnitCoins = Math.max(1, coins / giftQuantity);
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : (giftUnitCoins >= 100 ? 'dragon' : giftUnitCoins >= 20 ? 'fruit' : giftUnitCoins >= 5 ? 'lamp' : 'lotus');

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = giftUnitCoins >= 100 ? 50 : giftUnitCoins >= 10 ? 30 : 20;
    const merit = Math.max(20, coins * multiplier);

    state.offerings[giftType] = (state.offerings[giftType] || 0) + giftQuantity;
    state.totalIncense += 3 * giftQuantity;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3 * giftQuantity);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3 * giftQuantity, giftQuantity, wish);

    const ttsText = params.readTts === false
      ? ''
      : renderNarration(state.settings, 'gift', { user: devotee.name, giftName: sanitizeWishText(giftName), wish });

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftName,
      giftId: params.giftId || null,
      giftQuantity,
      giftUnitCoins,
      presentation: params.presentation || null,
      count: Math.min(9, Number(params.giftQuantity || 1)),
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const category = params.category || 'all';
    const pool = category === 'all' ? FORTUNE_DECK : FORTUNE_DECK.filter(item => item.category === category);
    if (!pool.length) throw new Error('Chủ đề quẻ không hợp lệ.');
    let bag = fortuneBags.get(category);
    if (!bag?.length) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1].number === lastFortunes.get(category)) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      fortuneBags.set(category, bag);
    }
    const fortune = bag.pop();
    lastFortunes.set(category, fortune.number);
    const merit = 10;

    state.fortuneCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`);

    const ttsText = params.readTts === false
      ? ''
      : renderNarration(state.settings, 'fortune', { user: devotee.name, fortune: state.settings.fortuneReadingMode === 'full' ? fortune.reading : fortune.ttsSummary });

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: ttsText ? nextRitualVoice() : (state.settings.ttsVoice || 'maichi')
    });

    saveState();
    publishRitual(event);
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  updateSettings(params = {}) {
    if (params.autoSim === true && (params.presentationPaused ?? state.settings.presentationPaused)) throw new Error('Tiếp tục hiệu ứng trước khi bật giả lập tương tác.');
    if (params.giftMappings !== undefined) {
      const mappings = params.giftMappings;
      const actions = ['burnIncense', 'sendPrayer', 'ringBell', 'strikeWoodenFish', 'offerGift', 'grandCeremony'];
      if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings) || Object.keys(mappings).length > 100
        || Object.entries(mappings).some(([id, rule]) => !/^\d{1,20}$/.test(id) || !rule || typeof rule !== 'object' || !actions.includes(rule.action) || typeof rule.label !== 'string' || rule.label.length > 80)) {
        throw new Error('Cấu hình quà không hợp lệ: dùng ID quà dạng số và chọn nghi thức.');
      }
    }
    if (Object.prototype.hasOwnProperty.call(params, 'ttsVoice')) {
      const status = ttsManager.getStatus();
      if (!status.ready) throw new Error('Chờ ZeroTTS sẵn sàng trước khi đổi giọng.');
      if (typeof params.ttsVoice !== 'string' || !status.voices.includes(params.ttsVoice)) {
        throw new Error('Giọng đọc không có trong model đang chạy.');
      }
    }
    if (Object.prototype.hasOwnProperty.call(params, 'ttsVoiceRotation')) {
      const status = ttsManager.getStatus();
      if (!status.ready) throw new Error('Chờ ZeroTTS sẵn sàng trước khi chọn giọng luân phiên.');
      const voices = params.ttsVoiceRotation;
      if (!Array.isArray(voices) || voices.length > status.voices.length || voices.some((voice) => typeof voice !== 'string' || !status.voices.includes(voice)) || new Set(voices).size !== voices.length) {
        throw new Error('Danh sách giọng luân phiên không hợp lệ.');
      }
    }
    const characterKeys = ['aoLam', 'maleBrown', 'elder', 'novice', 'pinkAoDai'];
    if (Object.prototype.hasOwnProperty.call(params, 'centralCharacter') && !characterKeys.includes(params.centralCharacter)) {
      throw new Error('Nhân vật chủ lễ không hợp lệ.');
    }
    if (Object.prototype.hasOwnProperty.call(params, 'centralCharacterRotationEnabled') && typeof params.centralCharacterRotationEnabled !== 'boolean') {
      throw new Error('Trạng thái xoay tua không hợp lệ.');
    }
    if (Object.prototype.hasOwnProperty.call(params, 'centralCharacterRotationPool')) {
      const pool = params.centralCharacterRotationPool;
      if (!Array.isArray(pool) || pool.length > characterKeys.length || pool.some(key => !characterKeys.includes(key)) || new Set(pool).size !== pool.length) {
        throw new Error('Danh sách nhân vật xoay tua không hợp lệ.');
      }
      const enabled = params.centralCharacterRotationEnabled ?? state.settings.centralCharacterRotationEnabled;
      if (enabled && pool.length < 2) throw new Error('Chọn ít nhất hai nhân vật để bật xoay tua.');
    }
    if (params.centralCharacterRotationEnabled === true) {
      const pool = params.centralCharacterRotationPool ?? state.settings.centralCharacterRotationPool;
      if (!Array.isArray(pool) || pool.length < 2) throw new Error('Chọn ít nhất hai nhân vật để bật xoay tua.');
    }
    const allowed = ['ttsVoice', 'ttsVoiceRotation', 'ttsEnabled', 'bgMusicEnabled', 'sfxEnabled', 'musicVolume', 'ttsVolume', 'smokeDensity', 'autoSim', 'autoSimIntervalMs', 'narrationTemplates', 'fortuneReadingMode', 'musicTrack', 'musicAutoRotate', 'centralCharacter', 'centralCharacterRotationEnabled', 'centralCharacterRotationPool'];
    allowed.push('presentationPaused', 'sfxVolume', 'giftMappings');
    if (Object.keys(params).some(key => !allowed.includes(key))) throw new Error('Cấu hình không được hỗ trợ.');
    const next = { ...params };
    if (params.presentationPaused === true) next.autoSim = false;
    if (params.centralCharacter !== undefined) next.centralCharacterConfigured = true;
    if (params.centralCharacter !== undefined || params.centralCharacterRotationPool !== undefined || params.centralCharacterRotationEnabled !== undefined) {
      const nextCharacter = params.centralCharacter ?? state.settings.centralCharacter;
      const nextPool = params.centralCharacterRotationPool ?? state.settings.centralCharacterRotationPool;
      const foundIndex = Array.isArray(nextPool) ? nextPool.indexOf(nextCharacter) : -1;
      next.centralCharacterRotationCursor = foundIndex >= 0 ? foundIndex : 0;
    }
    if (params.narrationTemplates !== undefined) next.narrationTemplates = { ...state.settings.narrationTemplates, ...validateTemplates(params.narrationTemplates) };
    if (params.fortuneReadingMode !== undefined && !['summary', 'full'].includes(params.fortuneReadingMode)) throw new Error('Chế độ đọc quẻ không hợp lệ.');
    if (params.musicTrack !== undefined && !['lotus', 'rain', 'stream', 'bamboo', 'night', 'dawn'].includes(params.musicTrack)) throw new Error('Bản nhạc không hợp lệ.');
    for (const key of ['ttsEnabled', 'bgMusicEnabled', 'sfxEnabled', 'autoSim', 'musicAutoRotate', 'presentationPaused']) {
      if (params[key] !== undefined && typeof params[key] !== 'boolean') throw new Error('Trạng thái bật tắt không hợp lệ.');
    }
    for (const key of ['musicVolume', 'ttsVolume', 'sfxVolume']) {
      if (params[key] !== undefined && (!Number.isFinite(params[key]) || params[key] < 0 || params[key] > 1)) throw new Error('Âm lượng cần nằm trong khoảng 0 đến 1.');
    }
    state.settings = { ...state.settings, ...next };
    if (typeof next.autoSim === 'boolean') {
      configureAutoSim(next.autoSim);
    }
    if (params.presentationPaused === true) ceremonyQueue?.clear();
    else if (!state.settings.presentationPaused) ceremonyQueue?.resume();
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 0;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 0, fruit: 0, lamp: 0, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

  Object.defineProperty(rituals, 'setAutoSimulationController', {
    enumerable: false,
    value(controller) {
      configureAutoSim = controller;
    }
  });
  return rituals;
}

module.exports = { createRitualService };
