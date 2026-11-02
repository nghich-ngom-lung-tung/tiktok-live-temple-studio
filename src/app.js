const express = require('express');
const cors = require('cors');
const { registerHttpRoutes } = require('./routes/httpRoutes');

function createApp({ config, security, rateLimiters, controllers }) {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      callback(null, origin && config.TRUSTED_ORIGINS.has(origin) ? origin : false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use(
    '/tts-cache',
    security.requireAllowedOrigin,
    security.requireRpcAuth,
    rateLimiters.asset,
    express.static(config.TTS_CACHE_DIR, { maxAge: '7d' })
  );
  app.use(
    '/stage-backgrounds',
    express.static(config.STAGE_BACKGROUND_DIR, { maxAge: '365d', immutable: true, index: false, dotfiles: 'deny' })
  );
  if (config.CHRISTIAN_STAGE_BACKGROUND_DIR) {
    app.use(
      '/stage-backgrounds/thien-chua-giao',
      express.static(config.CHRISTIAN_STAGE_BACKGROUND_DIR, { maxAge: '365d', immutable: true, index: false, dotfiles: 'deny' })
    );
  }
  registerHttpRoutes({
    app,
    controllers: {
      ...controllers,
      adminPagePath: config.ADMIN_PAGE_PATH,
      christianAdminPagePath: config.CHRISTIAN_ADMIN_PAGE_PATH,
      christianLivePagePath: config.CHRISTIAN_LIVE_PAGE_PATH
    },
    security,
    rateLimiters
  });
  app.use(express.static(config.VIEWS_BUILD_DIR));

  return app;
}

module.exports = { createApp };
