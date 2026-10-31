const crypto = require('crypto');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const VITE_PORT = Number(process.env.VITE_PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const RPC_TOKEN = process.env.TEMPLE_RPC_TOKEN || crypto.randomBytes(32).toString('hex');

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT phải là số nguyên từ 1 đến 65535');
}
if (Buffer.byteLength(RPC_TOKEN, 'utf8') < 32) {
  throw new Error('TEMPLE_RPC_TOKEN phải có ít nhất 32 byte');
}

const TRUSTED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  `https://localhost:${PORT}`,
  `https://127.0.0.1:${PORT}`,
  `http://localhost:${VITE_PORT}`,
  `http://127.0.0.1:${VITE_PORT}`,
  ...String(process.env.TEMPLE_CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
]);

module.exports = {
  ROOT_DIR,
  VIEWS_BUILD_DIR: path.join(ROOT_DIR, 'dist'),
  ADMIN_PAGE_PATH: path.join(ROOT_DIR, 'dist', 'admin', 'index.html'),
  DATA_DIR: path.join(ROOT_DIR, 'data'),
  TTS_CACHE_DIR: path.join(ROOT_DIR, 'data', 'tts-cache'),
  STATE_FILE: path.join(ROOT_DIR, 'data', 'merit-state.json'),
  TTS_WORKER_PATH: path.join(ROOT_DIR, 'tts_worker.py'),
  PORT,
  VITE_PORT,
  HOST,
  RPC_TOKEN,
  TRUSTED_ORIGINS
};
