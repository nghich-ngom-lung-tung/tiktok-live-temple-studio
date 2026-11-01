const express = require('express');

function registerHttpRoutes({ app, controllers, security, rateLimiters }) {
  app.get('/admin', (_req, res) => {
    res.sendFile(controllers.adminPagePath);
  });

  app.post('/api/auth', security.requireAllowedOrigin, rateLimiters.auth, controllers.auth.authenticate);
  if (controllers.stageBackground) {
    app.post(
      '/api/stage-background',
      security.requireAllowedOrigin,
      security.requireRpcAuth,
      rateLimiters.stageBackground,
      express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '8mb' }),
      controllers.stageBackground.upload,
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
      controllers.stageBackground.reset
    );
  }
  app.get('/api/auth/status', security.requireAllowedOrigin, security.requireRpcAuth, controllers.auth.status);
  app.post('/rpc', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.rpc, controllers.rpc);
  app.post('/api/tts', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.tts, controllers.tts);
  app.get('/api/state', security.requireAllowedOrigin, security.requireRpcAuth, controllers.state);
}

module.exports = { registerHttpRoutes };
