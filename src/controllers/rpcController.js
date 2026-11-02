function createRpcController(rpcService, { profiles = null } = {}) {
  return async function handleHttpRpc(req, res) {
    const { jsonrpc, id, method, params } = req.body || {};
    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
      });
    }

    try {
      const methodProfile = String(method).startsWith('christian.') ? 'thien-chua-giao' : String(method).startsWith('temple.') ? 'phat-giao' : null;
      const requestedValue = req.query?.profile || params?.profileId;
      const requestedProfile = requestedValue ? require('../profiles/registry').resolveProfileId(requestedValue) : null;
      if (methodProfile && requestedProfile && methodProfile !== requestedProfile) throw new Error('Phương thức này thuộc hồ sơ Live khác.');
      const selectedProfile = methodProfile || requestedProfile || require('../profiles/registry').DEFAULT_PROFILE_ID;
      const selectedService = profiles?.[selectedProfile] || rpcService;
      const result = await selectedService.handleRpcCall(method, { ...(params || {}), profileId: selectedProfile });
      res.json({ jsonrpc: jsonrpc || '2.0', id: id ?? null, result });
    } catch (error) {
      res.status(200).json({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? null,
        error: { code: -32000, message: error.message || 'Server error' }
      });
    }
  };
}

module.exports = { createRpcController };
