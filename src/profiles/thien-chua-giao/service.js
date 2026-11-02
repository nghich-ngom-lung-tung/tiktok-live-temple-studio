const crypto = require('node:crypto');
const { isBlockedSpamOrToxic, sanitizeUserName, sanitizeWishText } = require('../../utils/textSanitizer');
const { SCRIPTURE_CATALOG, findScripture, createScripturePicker } = require('./scriptureCatalog');

function createChristianService({ stateModel, realtime, ceremonyQueue, ttsManager = null }) {
  const prayerCooldown = new Map();
  const chatCooldown = new Map();
  const lastTemplateByKind = new Map();
  let voiceRotationCursor = 0;
  const scripturePicker = createScripturePicker();

  function nextVoice() {
    const settings = stateModel.state.settings;
    const voices = settings.ttsVoiceRotation;
    if (!Array.isArray(voices) || voices.length < 2) return settings.ttsVoice || 'maichi';
    const voice = voices[voiceRotationCursor % voices.length];
    voiceRotationCursor = (voiceRotationCursor + 1) % voices.length;
    return voice;
  }

  function template(kind, values) {
    const templates = String(stateModel.state.settings.narrationTemplates?.[kind] || '')
      .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const previous = lastTemplateByKind.get(kind);
    const candidates = templates.filter(line => line !== previous);
    let text = (candidates.length ? candidates : templates)[Math.floor(Math.random() * (candidates.length || templates.length))] || '';
    lastTemplateByKind.set(kind, text);
    for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{${key}}`, String(value || ''));
    return sanitizeWishText(text).slice(0, 1000);
  }

  function prepareViewer(user, uniqueId, avatar) {
    // Operator previews are performers, not new arrivals in the TikTok room.
    if (!uniqueId || String(uniqueId).startsWith('operator-')) {
      const name = sanitizeUserName(user || 'Người điều hành');
      const character = [...name].reduce((sum, letter) => sum + letter.codePointAt(0), 0) % 2 ? 'woman' : 'man';
      return { name, uniqueId: String(uniqueId || `operator-${name}`), avatar: avatar || '', character };
    }
    return stateModel.recordMember(user, uniqueId, avatar);
  }

  function performAction(kind, { user, uniqueId, avatar }) {
    if (!['candle', 'bell', 'communion', 'peace', 'thanksgiving', 'welcome'].includes(kind)) throw new Error('Hoạt động không hợp lệ.');
    const viewer = prepareViewer(user, uniqueId, avatar);
    const event = {
      id: crypto.randomUUID(), type: kind, profileId: 'thien-chua-giao',
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, character: viewer.character,
      ttsText: template(kind, { user: viewer.name }), ttsVoice: nextVoice()
    };
    stateModel.pushEventLog({ type: kind, user: viewer.name, uniqueId: viewer.uniqueId });
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    ceremonyQueue.enqueue(event);
    return event;
  }

  function sendPrayer({ user, uniqueId, avatar, wish }) {
    const viewer = prepareViewer(user, uniqueId, avatar);
    const cleanWish = sanitizeWishText(wish).slice(0, 240) || 'Xin cầu nguyện cho gia đình được bình an.';
    const request = stateModel.recordPrayer({ user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, wish: cleanWish });
    const event = {
      id: crypto.randomUUID(), type: 'prayer', profileId: 'thien-chua-giao',
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, character: viewer.character,
      wish: cleanWish,
      ttsText: template('prayer', { user: viewer.name, wish: cleanWish }),
      ttsVoice: nextVoice()
    };
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    ceremonyQueue.enqueue(event);
    return request;
  }

  function shareScripture({ user, uniqueId, avatar, reference, reflection, category = 'all' }) {
    const passage = reference ? findScripture(reference) : scripturePicker.pick(category);
    if (!passage) throw new Error('Chọn một mục trong danh sách Kinh Thánh có sẵn nhé.');
    const viewer = prepareViewer(user, uniqueId, avatar);
    const cleanReflection = sanitizeWishText(reflection).slice(0, 240) || passage.reflection;
    const share = stateModel.recordScriptureShare({
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar,
      reference: passage.reference,
      reflectionId: passage.id, title: passage.title, category: passage.category,
      reflection: cleanReflection
    });
    const event = {
      id: crypto.randomUUID(), type: 'scripture', profileId: 'thien-chua-giao',
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, character: viewer.character,
      reference: passage.reference, theme: passage.theme, reflection: cleanReflection,
      reflectionId: passage.id, title: passage.title, category: passage.category,
      ttsText: template('scripture', { user: viewer.name, reference: passage.reference, reflection: cleanReflection }),
      ttsVoice: nextVoice()
    };
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    ceremonyQueue.enqueue(event);
    return share;
  }

  function thankGift({ user, uniqueId, avatar, coins, giftQuantity, giftName }) {
    const viewer = prepareViewer(user, uniqueId, avatar);
    const supporter = stateModel.recordGift({
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar,
      coins,
      giftCount: giftQuantity,
      giftName: giftName || 'quà'
    });
    const event = {
      id: crypto.randomUUID(), type: 'gift', profileId: 'thien-chua-giao',
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, character: viewer.character,
      coins: Math.max(0, Number(coins) || 0), giftQuantity: Math.max(1, Number(giftQuantity) || 1),
      giftName: sanitizeWishText(giftName || 'quà').slice(0, 80),
      ttsText: template('gift', { user: viewer.name, giftName: giftName || 'quà' }),
      ttsVoice: nextVoice()
    };
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    ceremonyQueue.enqueue(event);
    return supporter;
  }

  function memberJoined(user, uniqueId, avatar) {
    const viewer = prepareViewer(user, uniqueId, avatar);
    realtime.broadcastNotification('christian.member', {
      user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar,
      character: viewer.character, greeting: template('welcome', { user: viewer.name }), profileId: 'thien-chua-giao'
    });
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    return viewer;
  }

  function handleLike(viewer, count = 1) {
    const amount = Math.max(1, Math.floor(Number(count) || 1));
    stateModel.recordRoomActivity('likes', amount);
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    realtime.broadcastNotification('christian.activity', {
      type: 'like', user: sanitizeUserName(viewer.user), count: amount, profileId: 'thien-chua-giao'
    });
  }

  function handleSocial(viewer, kind) {
    if (!['follows', 'shares'].includes(kind)) return;
    stateModel.recordRoomActivity(kind);
    const member = prepareViewer(viewer.user, viewer.uniqueId, viewer.avatar);
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    realtime.broadcastNotification('christian.activity', {
      type: kind === 'follows' ? 'follow' : 'share',
      user: member.name, uniqueId: member.uniqueId, avatar: member.avatar,
      profileId: 'thien-chua-giao'
    });
  }

  function parseViewerComment(commentText, user, uniqueId, avatar) {
    const raw = String(commentText || '').trim();
    if (!raw || isBlockedSpamOrToxic(raw)) return null;
    const viewer = prepareViewer(user, uniqueId, avatar);
    stateModel.recordRoomActivity('comments');
    realtime.broadcastNotification('christian.state', stateModel.getPublicState(ttsManager));
    const now = Date.now();
    const cleanChat = raw.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 240);
    const key = String(uniqueId || user || viewer.name);
    if (cleanChat && now - (chatCooldown.get(key) || 0) >= 250) {
      realtime.broadcastNotification('christian.chat', {
        user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar,
        comment: cleanChat, profileId: 'thien-chua-giao'
      });
      chatCooldown.set(key, now);
      if (chatCooldown.size > 1000) chatCooldown.delete(chatCooldown.keys().next().value);
    }

    const clean = sanitizeWishText(raw).slice(0, 240);
    if (!clean) return null;
    if (now - (prayerCooldown.get(key) || 0) < 3500) return null;
    const lower = clean.toLocaleLowerCase('vi');
    if (/kinh thánh|kinh thanh|lời chúa|loi chua|xin kinh|suy ngẫm|suy ngam|scripture/.test(lower)) {
      prayerCooldown.set(key, now);
      const reference = SCRIPTURE_CATALOG.find(item => lower.includes(item.reference.toLocaleLowerCase('vi')))?.reference;
      const topics = { 'gia-dinh': /gia đình|gia dinh|trẻ nhỏ|tre nho/, 'binh-an': /bình an|binh an/, 'hy-vong': /hy vọng|hy vong|kiên trì|kien tri/,
        'yeu-thuong': /yêu thương|yeu thuong|tình yêu|tinh yeu/, 'tha-thu': /tha thứ|tha thu|hòa giải|hoa giai/, 'biet-on': /biết ơn|biet on|tạ ơn|ta on/,
        'nghi-ngoi': /nghỉ ngơi|nghi ngoi|an ủi|an ui/, 'khon-ngoan': /khôn ngoan|khon ngoan|lựa chọn|lua chon/, 'se-chia': /sẻ chia|se chia|phục vụ|phuc vu/, 'duc-tin': /đức tin|duc tin|chở che|cho che/ };
      const category = Object.entries(topics).find(([, pattern]) => pattern.test(lower))?.[0] || 'all';
      return shareScripture({ ...viewer, user: viewer.name, reference, category });
    }
    const action = /thắp nến|thap nen/.test(lower) ? 'candle'
      : /đổ chuông|do chuong|rung chuông|rung chuong/.test(lower) ? 'bell'
      : /hiệp thông|hiep thong|đại lễ|dai le/.test(lower) ? 'communion'
      : /tạ ơn|ta on|tri ân|tri an/.test(lower) ? 'thanksgiving'
      : /bình an|binh an/.test(lower) && !/cầu|cau|nguyện|nguyen/.test(lower) ? 'peace' : null;
    if (action) {
      prayerCooldown.set(key, now);
      return performAction(action, { user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar });
    }
    if (/cầu nguyện|cau nguyen|xin cầu|xin cau|prayer|pray for/.test(lower)) {
      prayerCooldown.set(key, now);
      return sendPrayer({ ...viewer, user: viewer.name, wish: clean });
    }
    return null;
  }

  function updateSettings(patch) {
    for (const key of ['ttsEnabled', 'bgMusicEnabled', 'musicAutoRotate', 'presentationPaused']) {
      if (patch[key] !== undefined && typeof patch[key] !== 'boolean') throw new Error('Trạng thái bật tắt không hợp lệ.');
    }
    for (const [key, max] of [['ttsVolume', 1], ['bgMusicVolume', 0.5]]) {
      if (patch[key] !== undefined && (typeof patch[key] !== 'number' || !Number.isFinite(patch[key]) || patch[key] < 0 || patch[key] > max)) throw new Error('Âm lượng không hợp lệ.');
    }
    if (patch.musicTrack !== undefined && !['sanctuary', 'morning-grace', 'candlelight'].includes(patch.musicTrack)) throw new Error('Bản nhạc không hợp lệ.');
    const settings = { ...stateModel.state.settings, narrationTemplates: { ...stateModel.state.settings.narrationTemplates } };
    if (typeof patch.ttsEnabled === 'boolean') settings.ttsEnabled = patch.ttsEnabled;
    if (Number.isFinite(Number(patch.ttsVolume))) settings.ttsVolume = Math.max(0, Math.min(1, Number(patch.ttsVolume)));
    if (typeof patch.bgMusicEnabled === 'boolean') settings.bgMusicEnabled = patch.bgMusicEnabled;
    if (typeof patch.musicAutoRotate === 'boolean') settings.musicAutoRotate = patch.musicAutoRotate;
    const voiceStatus = ttsManager?.getStatus?.() || { ready: false, voices: [] };
    if (Object.prototype.hasOwnProperty.call(patch, 'ttsVoice')) {
      if (!voiceStatus.ready) throw new Error('Chờ ZeroTTS sẵn sàng trước khi đổi giọng.');
      if (typeof patch.ttsVoice !== 'string' || !voiceStatus.voices?.includes(patch.ttsVoice)) {
        throw new Error('Giọng đọc không có trong model đang chạy.');
      }
      settings.ttsVoice = patch.ttsVoice;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'ttsVoiceRotation')) {
      if (!voiceStatus.ready) throw new Error('Chờ ZeroTTS sẵn sàng trước khi chọn giọng luân phiên.');
      const voices = patch.ttsVoiceRotation;
      if (!Array.isArray(voices) || voices.length > voiceStatus.voices.length
        || voices.some(voice => typeof voice !== 'string' || !voiceStatus.voices.includes(voice))
        || new Set(voices).size !== voices.length) {
        throw new Error('Danh sách giọng luân phiên không hợp lệ.');
      }
      settings.ttsVoiceRotation = [...voices];
      voiceRotationCursor = 0;
    }
    const tracks = ['sanctuary', 'morning-grace', 'candlelight'];
    if (typeof patch.musicTrack === 'string' && tracks.includes(patch.musicTrack)) settings.musicTrack = patch.musicTrack;
    if (Number.isFinite(Number(patch.bgMusicVolume))) settings.bgMusicVolume = Math.max(0, Math.min(0.5, Number(patch.bgMusicVolume)));
    if (typeof patch.presentationPaused === 'boolean') settings.presentationPaused = patch.presentationPaused;
    if (patch.narrationTemplates && typeof patch.narrationTemplates === 'object') {
      for (const key of ['prayer', 'scripture', 'gift', 'welcome', 'candle', 'bell', 'communion', 'peace', 'thanksgiving']) {
        if (typeof patch.narrationTemplates[key] === 'string') {
          settings.narrationTemplates[key] = patch.narrationTemplates[key].slice(0, 600);
        }
      }
    }
    stateModel.state.settings = settings;
    if (settings.presentationPaused) ceremonyQueue.clear();
    else ceremonyQueue.resume();
    stateModel.saveState();
    const publicState = stateModel.getPublicState(ttsManager);
    realtime.broadcastNotification('christian.state', publicState);
    return publicState;
  }

  function resetPlayback() {
    ceremonyQueue.clear();
    stateModel.state.settings.presentationPaused = false;
    stateModel.saveState();
  }

  const liveHandlers = {
    onLike: handleLike,
    onSocial: handleSocial,
    onGift: thankGift,
    onMember: memberJoined
  };

  return {
    pickScripture: category => scripturePicker.pick(category || 'all'),
    performAction,
    sendPrayer,
    shareScripture,
    thankGift,
    memberJoined,
    handleLike,
    handleSocial,
    parseViewerComment,
    updateSettings,
    resetPlayback,
    liveHandlers
  };
}

module.exports = { createChristianService };
