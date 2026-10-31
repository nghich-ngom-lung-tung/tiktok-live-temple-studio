function createAuthController(security) {
  return {
    authenticate(req, res) {
      if (!security.isValidRpcToken(req.body?.token)) {
        return res.status(401).json({ ok: false, error: 'RPC token không hợp lệ' });
      }
      res.json({ ok: true });
    },

    status(_req, res) {
      res.json({ ok: true });
    }
  };
}

module.exports = { createAuthController };
