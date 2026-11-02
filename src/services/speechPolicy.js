// Match the worker's synthesis timeout; visuals start immediately while speech prepares.
const configured = Number(process.env.CHRISTIAN_SPEECH_TIMEOUT_MS || 180_000);
if (!Number.isFinite(configured) || configured < 5000 || configured > 180_000) throw new Error('CHRISTIAN_SPEECH_TIMEOUT_MS phải từ 5000 đến 180000.');
module.exports = { CHRISTIAN_SPEECH_TIMEOUT_MS: configured };
