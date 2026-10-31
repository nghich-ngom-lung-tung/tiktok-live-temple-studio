function registerHttpRoutes({ app, controllers, security, rateLimiters }) {
  app.get('/admin', (_req, res) => {
    res.sendFile(controllers.adminPagePath);
  });

  app.post('/api/auth', security.requireAllowedOrigin, rateLimiters.auth, controllers.auth.authenticate);
  app.get('/api/auth/status', security.requireAllowedOrigin, security.requireRpcAuth, controllers.auth.status);
  app.post('/rpc', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.rpc, controllers.rpc);
  app.post('/api/tts', security.requireAllowedOrigin, security.requireRpcAuth, rateLimiters.tts, controllers.tts);
  app.get('/api/state', security.requireAllowedOrigin, security.requireRpcAuth, controllers.state);
}

module.exports = { registerHttpRoutes };
