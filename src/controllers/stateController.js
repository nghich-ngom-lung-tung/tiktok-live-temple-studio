function createStateController({ stateModel, stateModels = null, ttsManager, ttsAdapters = null }) {
  return function getState(req, res) {
    const profileId = require('../profiles/registry').resolveProfileId(req.query?.profile);
    const model = stateModels?.[profileId] || stateModel;
    const tts = ttsAdapters?.[profileId] || ttsManager;
    res.json(model.getPublicState(tts));
  };
}

module.exports = { createStateController };
