const fs = require('fs');
const http = require('http');
const config = require('./config');
const security = require('./middleware/securityMiddleware');
const { TempleStateModel } = require('./models/templeStateModel');
const { ChristianStateModel } = require('./profiles/thien-chua-giao/stateModel');
const fortuneDeck = require('./data/fortuneDeck');
const { ZeroTtsManager } = require('./services/zeroTtsManager');
const { createRealtimeService } = require('./services/realtimeService');
const { createRitualService } = require('./services/ritualService');
const { createCommentService } = require('./services/commentService');
const { createTikTokLiveService } = require('./services/tiktokLiveService');
const { createAutoSimulationService } = require('./services/autoSimulationService');
const { createRpcService } = require('./services/rpcService');
const { createProfileTtsAdapter } = require('./services/profileTtsAdapter');
const { createProfileLiveCoordinator } = require('./services/profileLiveCoordinator');
const { createChristianService } = require('./profiles/thien-chua-giao/service');
const { createChristianRpcService } = require('./profiles/thien-chua-giao/rpcService');
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
  fs.mkdirSync(config.CHRISTIAN_STAGE_BACKGROUND_DIR, { recursive: true });

  const stateModel = new TempleStateModel({ stateFile: config.STATE_FILE });
  const christianStateModel = new ChristianStateModel({
    stateFile: require('node:path').join(config.DATA_DIR, 'profiles', 'thien-chua-giao', 'state.json')
  });
  const stateModels = { 'phat-giao': stateModel, 'thien-chua-giao': christianStateModel };
  const globalRealtime = createRealtimeService();
  const buddhistRealtime = createRealtimeService({ profileId: 'phat-giao' });
  const christianRealtime = createRealtimeService({ profileId: 'thien-chua-giao' });
  const ttsManager = new ZeroTtsManager({
    rootDir: config.ROOT_DIR,
    workerPath: config.TTS_WORKER_PATH,
    stateModel,
    broadcastNotification: globalRealtime.broadcastNotification
  });
  const ttsAdapters = {
    'phat-giao': ttsManager,
    'thien-chua-giao': createProfileTtsAdapter({ ttsManager, stateModel: christianStateModel })
  };

  const buddhistQueue = createCeremonyQueue({ stateModel, realtime: buddhistRealtime, ttsManager, profileId: 'phat-giao' });
  const christianQueue = createCeremonyQueue({ stateModel: christianStateModel, realtime: christianRealtime, ttsManager: ttsAdapters['thien-chua-giao'], profileId: 'thien-chua-giao', prefetchSpeech: true, nonBlockingSpeech: true, speechTimeoutMs: 30_000 });
  const ritualService = createRitualService({ stateModel, realtime: buddhistRealtime, ttsManager, fortuneDeck, ceremonyQueue: buddhistQueue });
  const autoSimulationService = createAutoSimulationService({ stateModel, ritualService });
  ritualService.setAutoSimulationController(autoSimulationService.configureAutoSim);

  const commentService = createCommentService({ rituals: ritualService, onComment(data) {
    if (stateModel.roomViewers.has(String(data.uniqueId || '').toLocaleLowerCase('vi'))) stateModel.recordRoomActivity('comments');
    const devotee = stateModel.recordDevotee(data.user, data.uniqueId, data.avatar, 0, 0, 0);
    buddhistRealtime.broadcastNotification('temple.state', stateModel.getPublicState(ttsManager));
    buddhistRealtime.broadcastNotification('temple.chat', { ...data, uniqueId: devotee.uniqueId });
  } });
  const christianService = createChristianService({
    stateModel: christianStateModel,
    realtime: christianRealtime,
    ceremonyQueue: christianQueue,
    ttsManager: ttsAdapters['thien-chua-giao']
  });
  const christianCommentService = { parseViewerComment: christianService.parseViewerComment };

  const buddhistLive = createTikTokLiveService({
    stateModel, realtime: buddhistRealtime, ritualService, commentService, ttsManager, ceremonyQueue: buddhistQueue, profileId: 'phat-giao'
  });
  const christianLive = createTikTokLiveService({
    stateModel: christianStateModel, realtime: christianRealtime, ritualService, commentService: christianCommentService,
    ttsManager: ttsAdapters['thien-chua-giao'], ceremonyQueue: christianQueue, profileId: 'thien-chua-giao', liveHandlers: christianService.liveHandlers
  });
  const liveServices = { 'phat-giao': buddhistLive, 'thien-chua-giao': christianLive };
  const liveCoordinator = createProfileLiveCoordinator(liveServices);

  const buddhistRpc = createRpcService({
    stateModel, ritualService, commentService, ttsManager, tiktokLiveService: liveCoordinator.forProfile('phat-giao'),
    autoSimulationService, ceremonyQueue: buddhistQueue, realtime: buddhistRealtime
  });
  const christianRpc = createChristianRpcService({
    stateModel: christianStateModel, service: christianService, commentService: christianCommentService,
    ttsManager: ttsAdapters['thien-chua-giao'], ceremonyQueue: christianQueue,
    liveCoordinator: liveCoordinator.forProfile('thien-chua-giao'), realtime: christianRealtime
  });
  const rpcServices = { 'phat-giao': buddhistRpc, 'thien-chua-giao': christianRpc };
  const rpcService = {
    handleRpcCall(method, params = {}) {
      const methodProfile = String(method).startsWith('christian.') ? 'thien-chua-giao'
        : String(method).startsWith('temple.') ? 'phat-giao' : null;
      const requestedProfile = params.profileId ? require('./profiles/registry').resolveProfileId(params.profileId) : null;
      if (methodProfile && requestedProfile && methodProfile !== requestedProfile) throw new Error('Phương thức này thuộc hồ sơ Live khác.');
      const methodProfileId = methodProfile || requestedProfile || require('./profiles/registry').DEFAULT_PROFILE_ID;
      return rpcServices[methodProfileId].handleRpcCall(method, { ...params, profileId: methodProfileId });
    }
  };

  const stageBackgroundByProfile = {
    'phat-giao': createStageBackgroundController({
      stateModel, realtime: buddhistRealtime, ttsManager, stageBackgroundDir: config.STAGE_BACKGROUND_DIR,
      profileId: 'phat-giao', defaultBackground: require('./profiles/registry').PROFILES['phat-giao'].defaultBackground,
      uploadUrlPrefix: '/stage-backgrounds'
    }),
    'thien-chua-giao': createStageBackgroundController({
      stateModel: christianStateModel, realtime: christianRealtime, ttsManager: ttsAdapters['thien-chua-giao'],
      stageBackgroundDir: config.CHRISTIAN_STAGE_BACKGROUND_DIR, profileId: 'thien-chua-giao',
      defaultBackground: require('./profiles/registry').PROFILES['thien-chua-giao'].defaultBackground,
      uploadUrlPrefix: '/stage-backgrounds/thien-chua-giao'
    })
  };
  const controllers = {
    auth: createAuthController(security),
    rpc: createRpcController(rpcService),
    state: createStateController({ stateModel, stateModels, ttsManager, ttsAdapters }),
    tts: createTtsController({ stateModel, ttsManager, ttsAdapters }),
    stageBackground: stageBackgroundByProfile['phat-giao'],
    stageBackgroundByProfile
  };
  const rateLimiters = security.createRateLimiters();
  const app = createApp({ config, security, rateLimiters, controllers });
  const server = http.createServer(app);
  const webSocketServer = attachWebSocketController({
    server, config, security,
    realtime: [globalRealtime, buddhistRealtime, christianRealtime],
    rpcService, stateModel, stateModels, ttsManager, ttsAdapters
  });

  return {
    app, server, webSocketServer, stateModel, christianStateModel, ttsManager,
    tiktokLiveService: buddhistLive, liveServices, liveCoordinator, autoSimulationService
  };
}

function startServer() {
  const system = createApplication();
  system.server.listen(config.PORT, config.HOST, () => {
    console.log('============================================================');
    console.log('🎥 LIVE STUDIO ĐÃ KHỞI ĐỘNG');
    console.log(`📺 Phòng Live Phật giáo       : http://127.0.0.1:${config.PORT}`);
    console.log(`📺 Phòng Live Thiên Chúa giáo : http://127.0.0.1:${config.PORT}/?profile=thien-chua-giao`);
    console.log(`🎛️ Bảng điều khiển            : http://127.0.0.1:${config.PORT}/admin`);
    console.log(`🔌 JSON-RPC                    : http://127.0.0.1:${config.PORT}/rpc (ws://127.0.0.1:${config.PORT}/ws)`);
    if (!process.env.TEMPLE_RPC_TOKEN) console.log(`[Auth] RPC token cho phiên này: ${config.RPC_TOKEN}`);
    console.log('============================================================');

    if (process.env.TIKTOK_AUTO_CONNECT === '1') {
      const defaultChannel = process.env.TIKTOK_USER || system.stateModel.state.tiktok?.username || '';
      if (defaultChannel) system.tiktokLiveService.connectTikTokLive(defaultChannel).catch(error => {
        console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, error.message);
      });
      else console.warn('[Auto-Connect] Hãy đặt TIKTOK_USER khi TIKTOK_AUTO_CONNECT=1');
    }
  });
  return system;
}

if (require.main === module) startServer();

module.exports = { createApplication, startServer };
