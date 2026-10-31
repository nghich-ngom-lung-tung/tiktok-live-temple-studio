function createStateController({ stateModel, ttsManager }) {
  return function getState(_req, res) {
    res.json(stateModel.getPublicState(ttsManager));
  };
}

module.exports = { createStateController };
