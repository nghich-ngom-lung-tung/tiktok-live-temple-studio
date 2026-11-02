const PROFILES = Object.freeze({
  'phat-giao': Object.freeze({
    id: 'phat-giao',
    label: 'Phật giáo',
    namespace: 'temple',
    defaultBackground: '/assets/phat-giao/backgrounds/chinh-dien-phat-giao.png'
  }),
  'thien-chua-giao': Object.freeze({
    id: 'thien-chua-giao',
    label: 'Thiên Chúa giáo',
    namespace: 'christian',
    defaultBackground: '/assets/thien-chua-giao/backgrounds/nha-tho-live.png'
  })
});

const DEFAULT_PROFILE_ID = 'phat-giao';

function resolveProfileId(value) {
  const id = String(value || '').trim().toLocaleLowerCase('vi');
  return Object.hasOwn(PROFILES, id) ? id : DEFAULT_PROFILE_ID;
}

function getProfile(value) {
  return PROFILES[resolveProfileId(value)];
}

module.exports = { PROFILES, DEFAULT_PROFILE_ID, resolveProfileId, getProfile };
