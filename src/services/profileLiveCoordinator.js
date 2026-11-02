const { resolveProfileId, DEFAULT_PROFILE_ID } = require('../profiles/registry');

function createProfileLiveCoordinator(liveServices) {
  let activeProfileId = DEFAULT_PROFILE_ID;
  let transition = Promise.resolve();

  function connect(profileValue, username) {
    const profileId = resolveProfileId(profileValue);
    transition = transition.catch(() => {}).then(async () => {
      for (const [id, service] of Object.entries(liveServices)) {
        if (id !== profileId) service.disconnectTikTokLive();
      }
      activeProfileId = profileId;
      return liveServices[profileId].connectTikTokLive(username);
    });
    return transition;
  }

  function disconnect(profileValue = activeProfileId) {
    const profileId = resolveProfileId(profileValue);
    transition = transition.catch(() => {}).then(() => liveServices[profileId].disconnectTikTokLive());
    return transition;
  }

  return {
    connect,
    disconnect,
    activeProfileId: () => activeProfileId,
    forProfile(profileValue) {
      const profileId = resolveProfileId(profileValue);
      return {
        connectTikTokLive: username => connect(profileId, username),
        disconnectTikTokLive: () => disconnect(profileId)
      };
    }
  };
}

module.exports = { createProfileLiveCoordinator };
