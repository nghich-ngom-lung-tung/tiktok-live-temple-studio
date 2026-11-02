const crypto = require('node:crypto');
const { SCRIPTURE_CATALOG, SCRIPTURE_CATEGORIES } = require('./scriptureCatalog');
const { sanitizeUserName, sanitizeWishText, isBlockedSpamOrToxic } = require('../../utils/textSanitizer');

function createChristianRpcService({ stateModel, service, commentService, ttsManager, ceremonyQueue, liveCoordinator, realtime }) {
  const getState = () => stateModel.getPublicState(ttsManager);

  async function handleRpcCall(method, params = {}) {
    switch (method) {
      case 'christian.getState':
        return getState();
      case 'christian.sendPrayer':
        return service.sendPrayer(params);
      case 'christian.shareScripture':
        return service.shareScripture(params);
      case 'christian.pickScripture':
        return service.pickScripture(params.category);
      case 'christian.thankGift':
        return service.thankGift(params);
      case 'christian.lightCandle': return service.performAction('candle', params);
      case 'christian.ringBell': return service.performAction('bell', params);
      case 'christian.communion': return service.performAction('communion', params);
      case 'christian.blessPeace': return service.performAction('peace', params);
      case 'christian.giveThanks': return service.performAction('thanksgiving', params);
      case 'christian.previewMember': {
        return service.performAction('welcome', params);
      }
      case 'christian.setSimulatedViewers':
        stateModel.setSimulatedViewerCount(Number(params.count));
        stateModel.saveState();
        realtime.broadcastNotification('christian.state', getState());
        return getState();
      case 'christian.previewChat': {
        const comment = sanitizeWishText(params.comment).slice(0, 240);
        if (!comment || isBlockedSpamOrToxic(comment)) throw new Error('Nội dung bình luận không hợp lệ.');
        const viewer = stateModel.getRoomViewers().find(item => item.isSimulated && item.uniqueId === String(params.uniqueId || ''));
        if (!viewer) throw new Error('Chọn một người test đang có trong room trước nhé.');
        const preview = { user: viewer.name, uniqueId: viewer.uniqueId, avatar: viewer.avatar, comment, profileId: 'thien-chua-giao' };
        realtime.broadcastNotification('christian.chat', preview);
        return preview;
      }
      case 'christian.updateSettings':
        return service.updateSettings(params);
      case 'christian.advanceMusic': {
        const settings = stateModel.state.settings;
        const tracks = ['sanctuary', 'morning-grace', 'candlelight'];
        if (settings.musicAutoRotate && !settings.presentationPaused && settings.musicTrack === params.expectedTrack) {
          return service.updateSettings({ musicTrack: tracks[(tracks.indexOf(settings.musicTrack) + 1) % tracks.length] });
        }
        return getState();
      }
      case 'christian.voiceConfig':
        return { templates: stateModel.state.settings.narrationTemplates, scriptures: SCRIPTURE_CATALOG, scriptureCategories: SCRIPTURE_CATEGORIES };
      case 'christian.ttsStatus':
        return ttsManager.getStatus();
      case 'christian.speak': {
        const text = sanitizeWishText(params.text).slice(0, 1000);
        if (!text) throw new Error('Nhập nội dung cần đọc.');
        if (params.broadcast !== false && stateModel.state.settings.presentationPaused) throw new Error('Đang tạm dừng hiệu ứng và âm thanh.');
        if (params.broadcast !== false && stateModel.state.settings.ttsEnabled === false) throw new Error('Bật giọng đọc trước khi phát thông báo trên Live.');
        if (params.broadcast === false) return ttsManager.synthesize(text, params.voice);
        if (!ttsManager.getStatus().ready) throw new Error('Chờ ZeroTTS sẵn sàng trước khi phát thông điệp.');
        const voice = params.voice || stateModel.state.settings.ttsVoice;
        if (!ttsManager.getStatus().voices.includes(voice)) throw new Error('Giọng đọc không có trong model đang chạy.');
        const event = { id: crypto.randomUUID(), type: 'announcement', profileId: 'thien-chua-giao', ttsText: text, ttsVoice: voice };
        ceremonyQueue.enqueue(event);
        return { ok: true, queued: true, eventId: event.id };
      }
      case 'live.connect':
        return liveCoordinator.connectTikTokLive(params.username);
      case 'live.disconnect':
        return liveCoordinator.disconnectTikTokLive();
      case 'live.newSession':
        if (!stateModel.state.tiktok.connected) throw new Error('Kết nối TikTok trước khi mở phiên mới.');
        stateModel.endLiveSession('newSession');
        stateModel.beginLiveSession(stateModel.state.tiktok.username);
        realtime.broadcastNotification('christian.state', getState());
        return getState();
      default:
        throw new Error(`Không tìm thấy phương thức JSON-RPC Thiên Chúa giáo: ${method}`);
    }
  }

  return { handleRpcCall };
}

module.exports = { createChristianRpcService };
