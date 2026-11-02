function createProfileTtsAdapter({ ttsManager, stateModel }) {
  function selectedVoice() {
    return String(stateModel.state.settings.ttsVoice || 'maichi').toLowerCase();
  }

  return {
    getStatus() {
      return { ...ttsManager.getStatus(selectedVoice()), voice: selectedVoice() };
    },
    synthesize(text, voiceOverride) {
      return ttsManager.synthesize(text, voiceOverride || selectedVoice());
    }
  };
}

module.exports = { createProfileTtsAdapter };
