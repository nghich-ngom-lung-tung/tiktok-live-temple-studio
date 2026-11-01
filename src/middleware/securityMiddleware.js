const crypto = require('crypto');
const config = require('../config');

function isAllowedOrigin(origin) {
  return !origin || config.TRUSTED_ORIGINS.has(origin);
}

function tokenFromAuthorization(header) {
  const match = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  return match ? match[1] : '';
}

function isValidRpcToken(candidate) {
  if (typeof candidate !== 'string') return false;
  const supplied = Buffer.from(candidate, 'utf8');
  const expected = Buffer.from(config.RPC_TOKEN, 'utf8');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function requireAllowedOrigin(req, res, next) {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ ok: false, error: 'Origin không được phép' });
  }
  next();
}

function requireRpcAuth(req, res, next) {
  if (!isValidRpcToken(tokenFromAuthorization(req.headers.authorization))) {
    return res.status(401).json({ ok: false, error: 'Thiếu hoặc sai RPC token' });
  }
  next();
}

function createRateLimit(maxRequests, windowMs) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - bucket.startedAt)) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, error: 'Quá nhiều yêu cầu; vui lòng thử lại sau' });
    }
    bucket.count += 1;
    if (buckets.size > 4096) {
      for (const [address, value] of buckets) {
        if (now - value.startedAt >= windowMs) buckets.delete(address);
      }
    }
    next();
  };
}

function createRateLimiters() {
  return {
    rpc: createRateLimit(240, 60_000),
    tts: createRateLimit(30, 60_000),
    asset: createRateLimit(240, 60_000),
    stageBackground: createRateLimit(8, 60_000),
    auth: createRateLimit(20, 60_000)
  };
}

module.exports = {
  isAllowedOrigin,
  tokenFromAuthorization,
  isValidRpcToken,
  requireAllowedOrigin,
  requireRpcAuth,
  createRateLimiters
};
