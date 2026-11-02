function createRealtimeService({ profileId = null } = {}) {
  let webSocketServer = null;

  function attach(server) {
    webSocketServer = server;
  }

  function broadcastNotification(method, params) {
    if (!webSocketServer) return;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    for (const client of webSocketServer.clients) {
      if (client.readyState === 1 && client.authenticated === true
        && (profileId === null || client.profileId === profileId)) {
        client.send(payload);
      }
    }
  }

  return { attach, broadcastNotification };
}

module.exports = { createRealtimeService };
