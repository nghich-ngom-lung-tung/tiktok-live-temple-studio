const fs = require('fs');
const http = require('http');
const config = require('./config');
const security = require('./middleware/securityMiddleware');
const { TempleStateModel } = require('./models/templeStateModel');
const fortuneDeck = require('./data/fortuneDeck');
const { ZeroTtsManager } = require('./services/zeroTtsManager');
const { createRealtimeService } = require('./services/realtimeService');
const { createRitualService } = require('./services/ritualService');
const { createCommentService } = require('./services/commentService');
const { createTikTokLiveService } = require('./services/tiktokLiveService');
const { createAutoSimulationService } = require('./services/autoSimulationService');
const { createRpcService } = require('./services/rpcService');
const { createAuthController } = require('./controllers/authController');
const { createRpcController } = require('./controllers/rpcController');
const { createStateController } = require('./controllers/stateController');
const { createTtsController } = require('./controllers/ttsController');
const { createStageBackgroundController } = require('./controllers/stageBackgroundController');
const { attachWebSocketController } = require('./controllers/webSocketController');
const { createApp } = require('./app');
const { createCeremonyQueue } = require('./services/ceremonyQueue');

function createApplication() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.mkdirSync(config.TTS_CACHE_DIR, { recursive: true });
  fs.mkdirSync(config.STAGE_BACKGROUND_DIR, { recursive: true });

  const stateModel = new TempleStateModel({ stateFile: config.STATE_FILE });
  const realtime = createRealtimeService();
  const ttsManager = new ZeroTtsManager({
    rootDir: config.ROOT_DIR,
    workerPath: config.TTS_WORKER_PATH,
    stateModel,
    broadcastNotification: realtime.broadcastNotification
  });
  const ceremonyQueue = createCeremonyQueue({ stateModel, realtime, ttsManager });
  const ritualService = createRitualService({ stateModel, realtime, ttsManager, fortuneDeck, ceremonyQueue });
  const autoSimulationService = createAutoSimulationService({ stateModel, ritualService });
  ritualService.setAutoSimulationController(autoSimulationService.configureAutoSim);

  const commentService = createCommentService({ rituals: ritualService, onComment(data) {
    if (stateModel.roomViewers.has(String(data.uniqueId || '').toLocaleLowerCase('vi'))) stateModel.recordRoomActivity('comments');
    const dev = stateModel.recordDevotee(data.user, data.uniqueId, data.avatar, 0, 0, 0);
    realtime.broadcastNotification('temple.state', stateModel.getPublicState(ttsManager));
    realtime.broadcastNotification('temple.chat', { ...data, uniqueId: dev.uniqueId });
  } });
  const tiktokLiveService = createTikTokLiveService({
    stateModel,
    realtime,
    ritualService,
    commentService,
    ttsManager,
    ceremonyQueue
  });
  const rpcService = createRpcService({
    stateModel,
    ritualService,
    commentService,
    ttsManager,
    tiktokLiveService,
    autoSimulationService,
    ceremonyQueue,
    realtime
  });

  const controllers = {
    auth: createAuthController(security),
    rpc: createRpcController(rpcService),
    state: createStateController({ stateModel, ttsManager }),
    tts: createTtsController({ stateModel, ttsManager })
  };
  controllers.stageBackground = createStageBackgroundController({
    stateModel,
    realtime,
    ttsManager,
    stageBackgroundDir: config.STAGE_BACKGROUND_DIR
  });
  const rateLimiters = security.createRateLimiters();
  const app = createApp({ config, security, rateLimiters, controllers });
  const server = http.createServer(app);
  const webSocketServer = attachWebSocketController({
    server,
    config,
    security,
    realtime,
    rpcService,
    stateModel,
    ttsManager
  });

  return {
    app,
    server,
    webSocketServer,
    stateModel,
    ttsManager,
    tiktokLiveService,
    autoSimulationService
  };
}

function startServer() {
  const system = createApplication();
  system.server.listen(config.PORT, config.HOST, () => {
    console.log('============================================================');
    console.log('🪷 CHÙA ONLINE TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG');
    console.log(`📺 Màn hình Live (9:16 OBS): http://127.0.0.1:${config.PORT} (bind ${config.HOST})`);
    console.log(`🎛️ Bảng điều khiển RPC Admin: http://127.0.0.1:${config.PORT}/admin`);
    console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://127.0.0.1:${config.PORT}/rpc (ws://127.0.0.1:${config.PORT}/ws)`);
    if (!process.env.TEMPLE_RPC_TOKEN) {
      console.log(`[Auth] RPC token cho phiên này: ${config.RPC_TOKEN}`);
    }
    console.log('============================================================');

    if (process.env.TIKTOK_AUTO_CONNECT === '1') {
      const defaultChannel = process.env.TIKTOK_USER || system.stateModel.state.tiktok?.username || '';
      if (defaultChannel) {
        system.tiktokLiveService.connectTikTokLive(defaultChannel).catch((error) => {
          console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, error.message);
        });
      } else {
        console.warn('[Auto-Connect] Hãy đặt TIKTOK_USER khi TIKTOK_AUTO_CONNECT=1');
      }
    }
  });
  return system;
}

if (require.main === module) startServer();

module.exports = { createApplication, startServer };
