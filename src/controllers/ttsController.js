function createTtsController({ stateModel, ttsManager }) {
  return async function synthesize(req, res) {
    const text = String(req.body?.text || '').trim();
    const voice = String(req.body?.voice || stateModel.state.settings.ttsVoice || 'maichi').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
    }
    if (text.length > 1000) {
      return res.status(413).json({ ok: false, error: 'Nội dung TTS vượt quá 1000 ký tự' });
    }
    const result = await ttsManager.synthesize(text, voice);
    res.json(result);
  };
}

module.exports = { createTtsController };
