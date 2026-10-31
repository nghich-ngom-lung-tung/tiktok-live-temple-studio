const { WebSocketServer } = require('ws');

function attachWebSocketController({ server, config, security, realtime, rpcService, stateModel, ttsManager }) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 16 * 1024,
    verifyClient(info, callback) {
      const allowed = security.isAllowedOrigin(info.origin);
      callback(allowed, allowed ? undefined : 403, allowed ? undefined : 'Origin không được phép');
    }
  });

  realtime.attach(wss);

  wss.on('connection', (ws, req) => {
    let authenticated = security.isValidRpcToken(security.tokenFromAuthorization(req.headers.authorization));
    ws.authenticated = authenticated;
    let authTimer = null;
    let messageWindowStartedAt = Date.now();
    let messageCount = 0;

    const sendState = () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'temple.state',
        params: stateModel.getPublicState(ttsManager)
      }));
    };

    if (authenticated) {
      sendState();
    } else {
      authTimer = setTimeout(() => ws.close(4401, 'Authentication required'), 5000);
    }

    ws.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString('utf8'));
      } catch (_) {
        return;
      }
      if (!message || !message.method) return;

      if (!authenticated) {
        if (message.method !== 'auth' || !security.isValidRpcToken(message.params?.token)) {
          ws.close(4401, 'Authentication required');
          return;
        }
        authenticated = true;
        ws.authenticated = true;
        clearTimeout(authTimer);
        ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'auth.ok' }));
        sendState();
        return;
      }

      const now = Date.now();
      if (now - messageWindowStartedAt >= 60_000) {
        messageWindowStartedAt = now;
        messageCount = 0;
      }
      messageCount += 1;
      if (messageCount > 240) {
        ws.close(1013, 'Rate limit exceeded');
        return;
      }

      try {
        const result = await rpcService.handleRpcCall(message.method, message.params || {});
        if (message.id !== undefined) {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
        }
      } catch (error) {
        if (message.id !== undefined) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32000, message: error.message || 'RPC Error' }
          }));
        }
      }
    });

    ws.on('close', () => clearTimeout(authTimer));
  });

  return wss;
}

module.exports = { attachWebSocketController };
