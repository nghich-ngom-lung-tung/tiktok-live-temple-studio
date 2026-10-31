function createAutoSimulationService({ stateModel, ritualService }) {
  const state = stateModel.state;
  const Rituals = ritualService;

let autoSimTimer = null;
const SIM_DEVOTEES = [
  { user: 'Khách Demo 01', uniqueId: 'demo_viewer_01', wish: 'Cầu bình an và sức khỏe' },
  { user: 'Khách Demo 02', uniqueId: 'demo_viewer_02', wish: 'Cầu công việc thuận lợi' },
  { user: 'Khách Demo 03', uniqueId: 'demo_viewer_03', wish: 'Nguyện gia đình an vui' },
  { user: 'Khách Demo 04', uniqueId: 'demo_viewer_04', wish: 'Cầu học tập tiến bộ' },
  { user: 'Khách Demo 05', uniqueId: 'demo_viewer_05', wish: 'Cầu một ngày bình an' },
  { user: 'Khách Demo 06', uniqueId: 'demo_viewer_06', wish: 'Xin gieo quẻ cầu bình an' }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();
  if (roll < 0.30) {
    Rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.55) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.75) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    Rituals.offerGift({ user: pick.user, uniqueId: pick.uniqueId, giftType: 'lotus', coins: 15, giftName: 'Hoa Sen Vàng Tinh Khiết' });
  } else {
    Rituals.ringBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    autoSimTimer = setInterval(runSingleSimulationStep, state.settings.autoSimIntervalMs || 9500);
  }
}

  return { configureAutoSim, runSingleSimulationStep };
}

module.exports = { createAutoSimulationService };
