const fortuneDeck = require('../data/fortuneDeck');
const { DEFAULT_NARRATION, PLACEHOLDERS } = require('./narrationService');
function createRpcService({ stateModel, ritualService, commentService, ttsManager, tiktokLiveService, autoSimulationService, realtime, ceremonyQueue = null }) {
  const Rituals = ritualService;
  const parseViewerComment = commentService.parseViewerComment;
  const zeroTts = ttsManager;
  const getPublicState = () => stateModel.getPublicState(ttsManager);
  const broadcastNotification = (...args) => realtime.broadcastNotification(...args);
  const connectTikTokLive = (...args) => tiktokLiveService.connectTikTokLive(...args);
  const disconnectTikTokLive = (...args) => tiktokLiveService.disconnectTikTokLive(...args);
  const configureAutoSim = (...args) => autoSimulationService.configureAutoSim(...args);
  const saveState = () => stateModel.saveState();

async function handleRpcCall(method, params = {}) {
  // Profile routing metadata is not a ritual setting.
  const { profileId, ...actionParams } = params;
  params = actionParams;
  switch (method) {
    case 'temple.advanceMusic': {
      const tracks = ['lotus', 'rain', 'stream', 'bamboo', 'night', 'dawn'];
      const settings = stateModel.state.settings;
      if (settings.musicAutoRotate && !settings.presentationPaused && settings.musicTrack === params.expectedTrack) {
        return Rituals.updateSettings({ musicTrack: tracks[(tracks.indexOf(settings.musicTrack) + 1) % tracks.length] });
      }
      return getPublicState();
    }
    case 'live.newSession':
      if (!stateModel.state.tiktok.connected) throw new Error('Kết nối TikTok trước khi mở phiên mới.');
      stateModel.endLiveSession('newSession');
      stateModel.beginLiveSession(stateModel.state.tiktok.username);
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    case 'temple.previewViewerChat': {
      const viewer = stateModel.simulatedViewers.get(String(params.uniqueId || ''));
      if (!viewer) throw new Error('Chọn một người giả lập đang có trong room.');
      const { sanitizeWishText, isBlockedSpamOrToxic } = require('../utils/textSanitizer');
      const comment = sanitizeWishText(params.comment).slice(0, 240);
      if (!comment || isBlockedSpamOrToxic(comment)) throw new Error('Nội dung chat không hợp lệ.');
      broadcastNotification('temple.chat', { user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, comment });
      return { ok: true };
    }
    case 'temple.setSimulatedViewers':
      stateModel.setSimulatedViewerCount(params.count);
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    case 'temple.previewWelcome':
      broadcastNotification('temple.member', { user: require('../utils/textSanitizer').sanitizeUserName(params.user), uniqueId: 'preview-' + Date.now() });
      return { ok: true };
    case 'temple.listFortunes':
      return fortuneDeck;
    case 'temple.voiceConfig':
      return { defaults: DEFAULT_NARRATION, placeholders: PLACEHOLDERS };
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.speak': {
      if (params.broadcast !== false && stateModel.state.settings.presentationPaused) throw new Error('Đang tạm dừng hiệu ứng và âm thanh.');
      if (params.broadcast !== false && stateModel.state.settings.ttsEnabled === false) throw new Error('Bật giọng đọc trước khi phát thông báo trên Live.');
      const res = await zeroTts.synthesize(params.text, params.voice);
      if (res.ok && params.broadcast !== false) {
        if (ceremonyQueue) ceremonyQueue.enqueue({ id: require('node:crypto').randomUUID(), type: 'announcement', ttsText: params.text, ttsVoice: res.voice, ttsUrl: res.url, durationSec: res.durationSec });
        else broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    }
    case 'temple.ttsStatus':
      return zeroTts.getStatus();
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      if (typeof params.enabled !== 'boolean') throw new Error('Trạng thái giả lập phải là bật hoặc tắt.');
      if (params.enabled && stateModel.state.settings.presentationPaused) throw new Error('Tiếp tục hiệu ứng trước khi bật giả lập tương tác.');
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

  return { handleRpcCall };
}

module.exports = { createRpcService };
