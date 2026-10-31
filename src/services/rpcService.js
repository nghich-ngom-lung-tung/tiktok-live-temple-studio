const fortuneDeck = require('../data/fortuneDeck');
const { DEFAULT_NARRATION, PLACEHOLDERS } = require('./narrationService');
function createRpcService({ stateModel, ritualService, commentService, ttsManager, tiktokLiveService, autoSimulationService, realtime }) {
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
  switch (method) {
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
      const res = await zeroTts.synthesize(params.text, params.voice);
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
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
