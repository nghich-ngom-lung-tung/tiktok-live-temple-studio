function createTtsController({ stateModel, ttsManager, ttsAdapters = null }) {
  return async function synthesize(req, res) {
    const profileId = require('../profiles/registry').resolveProfileId(req.query?.profile || req.body?.profileId);
    const adapter = ttsAdapters?.[profileId] || ttsManager;
    const text = String(req.body?.text || '').trim();
    const voice = String(req.body?.voice || adapter.getStatus().voice || stateModel.state.settings.ttsVoice || 'maichi').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
    }
    if (text.length > 1000) {
      return res.status(413).json({ ok: false, error: 'Nội dung TTS vượt quá 1000 ký tự' });
    }
    const result = await adapter.synthesize(text, voice);
    res.json(result);
  };
}

module.exports = { createTtsController };
