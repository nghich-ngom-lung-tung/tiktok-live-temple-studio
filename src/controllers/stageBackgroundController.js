const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BACKGROUND = '/assets/tam-the-sanctuary-stage.png';
const IMAGE_TYPES = new Map([
  ['image/png', { extension: 'png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }],
  ['image/jpeg', { extension: 'jpg', signature: Buffer.from([0xff, 0xd8, 0xff]) }],
  ['image/webp', { extension: 'webp', signature: null }]
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 36_000_000;
const MAX_IMAGE_EDGE = 10_000;

function dimensionsForImage(buffer, mimeType) {
  if (mimeType === 'image/png') {
    if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) return null;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
      const startOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
      if (startOfFrame) {
        if (segmentLength < 7) return null;
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      offset += segmentLength;
    }
    return null;
  }

  if (mimeType === 'image/webp') {
    if (buffer.length < 25 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3)
      };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer[20] === 0x2f) {
      return {
        width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
        height: 1 + ((buffer[22] & 0xc0) >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10)
      };
    }
  }

  return null;
}

function createStageBackgroundController({ stateModel, realtime, ttsManager, stageBackgroundDir }) {
  function publishState() {
    realtime.broadcastNotification('temple.state', stateModel.getPublicState(ttsManager));
  }

  return {
    async upload(req, res) {
      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const type = IMAGE_TYPES.get(mimeType);
      const image = req.body;
      if (!type) return res.status(415).json({ ok: false, error: 'Chỉ nhận ảnh PNG, JPG hoặc WebP.' });
      if (!Buffer.isBuffer(image) || image.length === 0) return res.status(400).json({ ok: false, error: 'Chưa nhận được ảnh. Hãy chọn lại tệp.' });
      if (image.length > MAX_IMAGE_BYTES) return res.status(413).json({ ok: false, error: 'Ảnh phải nhỏ hơn 8 MB.' });
      if (type.signature && !image.subarray(0, type.signature.length).equals(type.signature)) {
        return res.status(400).json({ ok: false, error: 'Nội dung tệp không khớp định dạng ảnh đã chọn.' });
      }
      if (mimeType === 'image/webp' && (image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP')) {
        return res.status(400).json({ ok: false, error: 'Tệp WebP không hợp lệ.' });
      }

      const dimensions = dimensionsForImage(image, mimeType);
      if (!dimensions || !Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) || dimensions.width < 320 || dimensions.height < 320) {
        return res.status(400).json({ ok: false, error: 'Ảnh không hợp lệ hoặc độ phân giải quá nhỏ.' });
      }
      if (dimensions.width > MAX_IMAGE_EDGE || dimensions.height > MAX_IMAGE_EDGE || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
        return res.status(400).json({ ok: false, error: 'Độ phân giải ảnh quá lớn. Hãy chọn ảnh tối đa 10.000 px mỗi chiều.' });
      }

      const filename = `stage-${crypto.randomUUID()}.${type.extension}`;
      const target = path.join(stageBackgroundDir, filename);
      try {
        await fs.mkdir(stageBackgroundDir, { recursive: true });
        await fs.writeFile(target, image, { flag: 'wx' });
        const url = `/stage-backgrounds/${filename}`;
        stateModel.state.settings.stageBackgroundUrl = url;
        stateModel.saveState();
        publishState();
        return res.status(201).json({ ok: true, url, width: dimensions.width, height: dimensions.height });
      } catch (error) {
        await fs.rm(target, { force: true }).catch(() => {});
        console.error('[Stage background] Không lưu được ảnh:', error.message);
        return res.status(500).json({ ok: false, error: 'Không lưu được ảnh nền. Thử lại nhé.' });
      }
    },

    reset(_req, res) {
      stateModel.state.settings.stageBackgroundUrl = DEFAULT_BACKGROUND;
      stateModel.saveState();
      publishState();
      return res.json({ ok: true, url: DEFAULT_BACKGROUND });
    }
  };
}

module.exports = { createStageBackgroundController, DEFAULT_BACKGROUND, dimensionsForImage };
