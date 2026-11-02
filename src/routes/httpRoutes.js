const express = require('express');

function registerHttpRoutes({ app, controllers, security, rateLimiters }) {
  const profileId = req => require('../profiles/registry').resolveProfileId(req.query?.profile);
  app.get(['/', '/index.html'], (req, res, next) => {
    if (profileId(req) === 'thien-chua-giao' && controllers.christianLivePagePath) return res.sendFile(controllers.christianLivePagePath);
    next();
  });
  app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
    res.sendFile(profileId(req) === 'thien-chua-giao' && controllers.christianAdminPagePath ? controllers.christianAdminPagePath : controllers.adminPagePath);
  });

  app.post('/api/auth', security.requireAllowedOrigin, rateLimiters.auth, controllers.auth.authenticate);
  if (controllers.stageBackground) {
    app.post(
      '/api/stage-background',
      security.requireAllowedOrigin,
      security.requireRpcAuth,
      rateLimiters.stageBackground,
      express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '8mb' }),
      (req, res, next) => {
        const selected = controllers.stageBackgroundByProfile?.[profileId(req)] || controllers.stageBackground;
        return selected.upload(req, res, next);
      },
      (error, _req, res, next) => {
        if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'Ảnh phải nhỏ hơn 8 MB.' });
        if (error.status === 415 || error.type === 'encoding.unsupported') return res.status(415).json({ ok: false, error: 'Chỉ nhận ảnh PNG, JPG hoặc WebP.' });
        next(error);
      }
    );
    app.post(
      '/api/stage-background/reset',
      security.requireAllowedOrigin,
      security.requireRpcAuth,
      rateLimiters.stageBackground,
      (req, res) => (controllers.stageBackgroundByProfile?.[profileId(req)] || controllers.stageBackground).reset(req, res)
    );
  }
  app.get('/api/auth/status', security.requireAllowedOrigin, security.requireRpcAuth, controllers.auth.status);
  app.post('/rpc', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.rpc, controllers.rpc);
  app.post('/api/tts', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.tts, controllers.tts);
  app.get('/api/state', security.requireAllowedOrigin, security.requireRpcAuth, controllers.state);
}

module.exports = { registerHttpRoutes };
