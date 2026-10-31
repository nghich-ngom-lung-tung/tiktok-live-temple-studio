function createRpcController(rpcService) {
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
      const result = await rpcService.handleRpcCall(method, params || {});
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
