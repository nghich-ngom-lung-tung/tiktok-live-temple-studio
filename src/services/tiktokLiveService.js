const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const { createGiftTracker } = require('./giftTracker');

function createTikTokLiveService({ stateModel, realtime, ritualService, commentService, ttsManager, timers = {}, ceremonyQueue = null, profileId = 'phat-giao', liveHandlers = null }) {
  const state = stateModel.state;
  const { getProfile } = require('../profiles/registry');
  const profile = getProfile(profileId);
  const later = timers.setTimeout || setTimeout, cancel = timers.clearTimeout || clearTimeout;
  const now = timers.now || Date.now;
  const giftTracker = createGiftTracker({ now });
  const broadcast = (...args) => realtime.broadcastNotification(...args);
  const notify = (event, payload) => broadcast(`${profile.namespace}.${event}`, payload);
  const publicState = () => stateModel.getPublicState(ttsManager);
  let connection = null, wanted = '', revision = 0, reconnectTimer = null, retryCount = 0, connecting = null;
  const presenceTimer = (timers.setInterval || setInterval)(() => {
    if (stateModel.pruneRoomViewers()) notify('state', publicState());
  }, 60_000);
  presenceTimer.unref?.();

  function resolveTikTokUsername(rawInput) {
    const input = String(rawInput || '').trim();
    if (/^@?[A-Za-z0-9._]{2,24}$/.test(input)) return input.replace(/^@/, '');
    if (!input || /^http:\/\//i.test(input)) throw new Error('Nhập @username hoặc URL TikTok HTTPS trực tiếp.');
    let url;
    try { url = new URL(input.startsWith('https://') ? input : `https://${input}`); }
    catch (_) { throw new Error('Username hoặc URL TikTok không hợp lệ.'); }
    const match = url.pathname.match(/^\/@([A-Za-z0-9._]{2,24})(?:\/|$)/);
    if (url.protocol !== 'https:' || !['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(url.hostname.toLowerCase())
      || url.port || url.username || url.password || !match) throw new Error('Chỉ nhận @username hoặc link hồ sơ TikTok HTTPS trực tiếp.');
    return match[1];
  }

  function extractUserFromEvent(data) {
    const user = data?.user || data || {};
    const uniqueId = String(user.uniqueId || user.displayId || data?.uniqueId || user.userId || '');
    return { uniqueId, user: user.nickname || uniqueId || data?.nickname || 'Thí Chủ',
      avatar: user.profilePictureUrl || user.avatarLarge?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || user.avatarMedium?.urlList?.[0] || data?.profilePictureUrl || '' };
  }
  function observe(data) {
    const viewer = extractUserFromEvent(data);
    stateModel.observeRoomViewer(viewer.user, viewer.uniqueId, viewer.avatar);
    return viewer;
  }
  function ensureSession() { if (wanted) stateModel.beginLiveSession(wanted); }
  function release() {
    const old = connection; connection = null;
    if (old) {
      old.removeAllListeners(); old.on(ControlEvent.ERROR, () => {});
      try { Promise.resolve(old.disconnect()).catch(() => {}); } catch (_) {}
    }
  }
  function scheduleRetry(token) {
    if (!wanted || token !== revision || reconnectTimer) return;
    retryCount++;
    const delay = Math.min(30_000, 2000 * 2 ** Math.min(retryCount - 1, 4));
    state.tiktok = { ...state.tiktok, connected: false, connecting: false, reconnecting: true, retryCount, nextRetryAt: now() + delay, viewerCount: 0 };
    notify('state', publicState());
    reconnectTimer = later(() => { reconnectTimer = null; void open(token).catch(() => {}); }, delay);
    reconnectTimer.unref?.();
  }
  async function open(token) {
    if (!wanted || token !== revision) return state.tiktok;
    release();
    state.tiktok.connecting = true; state.tiktok.reconnecting = retryCount > 0; state.tiktok.nextRetryAt = null;
    notify('state', publicState());
    let current;
    try {
      current = new TikTokLiveConnection(wanted, { processInitialData: false, fetchRoomInfoOnConnect: true, enableExtendedGiftInfo: true });
      connection = current;
      const valid = () => token === revision && current === connection;
      const on = (type, handler) => { if (type) current.on(type, data => { if (valid()) handler(data); }); };
      const connected = room => {
        ensureSession(); retryCount = 0;
        if (reconnectTimer) cancel(reconnectTimer); reconnectTimer = null;
        Object.assign(state.tiktok, { connected: true, connecting: false, reconnecting: false, retryCount: 0, nextRetryAt: null,
          roomId: String(room?.roomId || current.roomId || ''), lastError: null });
        notify('state', publicState());
      };
      on(ControlEvent.CONNECTED, connected);
      on(ControlEvent.DISCONNECTED, () => {
        Object.assign(state.tiktok, { connected: false, connecting: false, viewerCount: 0 });
        if (wanted) scheduleRetry(token); else notify('state', publicState());
      });
      on(ControlEvent.ERROR, error => { state.tiktok.lastError = error?.message || String(error); notify('state', publicState()); });
      on(WebcastEvent.STREAM_END, () => {
        ceremonyQueue?.clear();
        wanted = ''; revision++; connecting = null;
        if (reconnectTimer) cancel(reconnectTimer); reconnectTimer = null;
        release(); giftTracker.clear();
        Object.assign(state.tiktok, { connected: false, connecting: false, reconnecting: false, viewerCount: 0, nextRetryAt: null });
        stateModel.roomViewers.clear(); stateModel.endLiveSession('streamEnded');
        notify('state', publicState());
      });
      on(WebcastEvent.ROOM_USER, data => {
        ensureSession(); const viewerCount = Number(data?.total ?? data?.viewerCount);
        if (!Number.isFinite(viewerCount) || viewerCount < 0) return;
        state.tiktok.viewerCount = viewerCount; stateModel.recordViewerCount(viewerCount);
        notify('viewerCount', { viewerCount, liveSession: stateModel.sessionSummary() });
      });
      on(WebcastEvent.MEMBER, data => {
        ensureSession(); const viewer = observe(data);
        if (liveHandlers?.onMember) liveHandlers.onMember(viewer.user, viewer.uniqueId, viewer.avatar);
        else {
          const devotee = stateModel.recordDevotee(viewer.user, viewer.uniqueId, viewer.avatar, 1, 0, 0, 'Đã vào Chánh Điện lễ Phật');
          notify('member', { user: devotee.name, uniqueId: devotee.uniqueId, avatar: devotee.avatar });
        }
        notify('state', publicState());
      });
      on(WebcastEvent.CHAT, data => { ensureSession(); const viewer = observe(data); commentService.parseViewerComment(data?.content || data?.comment || '', viewer.user, viewer.uniqueId, viewer.avatar); });
      on(WebcastEvent.LIKE, data => {
        ensureSession(); const viewer = observe(data);
        const count = Math.max(1, Math.floor(Number(data?.count ?? data?.likeCount) || 1));
        if (liveHandlers?.onLike) liveHandlers.onLike(viewer, count);
        else {
          stateModel.recordRoomActivity('likes', count);
          ritualService.strikeWoodenFish({ ...viewer, count });
        }
      });
      const socialIds = new Set();
      const social = (data, kind) => {
        const id = String(data?.common?.msgId || data?.msgId || '');
        if (id && socialIds.has(`${kind}:${id}`)) return;
        if (id) socialIds.add(`${kind}:${id}`);
        if (socialIds.size > 2000) socialIds.delete(socialIds.values().next().value);
        ensureSession(); const viewer = observe(data);
        if (liveHandlers?.onSocial) liveHandlers.onSocial(viewer, kind);
        else {
          stateModel.recordRoomActivity(kind);
          ritualService.ringBell({ ...viewer, count: 1, wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn', readTts: false });
        }
      };
      on(WebcastEvent.FOLLOW, data => social(data, 'follows'));
      on(WebcastEvent.SHARE, data => social(data, 'shares'));
      on(WebcastEvent.SOCIAL, data => {
        const action = String(data?.action || ''), text = String(data?.common?.displayText?.key || data?.displayType || '').toLowerCase();
        if (action === '1' || text.includes('follow')) social(data, 'follows');
        else if (action === '3' || text.includes('share')) social(data, 'shares');
      });
      on(WebcastEvent.GIFT, data => {
        ensureSession(); const viewer = observe(data);
        const gift = giftTracker.take(data, viewer.uniqueId || viewer.user);
        if (!gift) return;
        const giftName = `${gift.quantity > 1 ? gift.quantity + 'x ' : ''}${gift.name}`;
        if (liveHandlers?.onGift) liveHandlers.onGift({ ...viewer, coins: gift.coins, giftId: gift.giftId, giftQuantity: gift.quantity, giftName });
        else {
          const rule = state.settings.giftMappings?.[gift.giftId];
          ritualService.offerGift({ ...viewer, coins: gift.coins, giftId: gift.giftId, giftQuantity: gift.quantity,
            giftName, presentation: rule?.action || null, wish: `Thành tâm dâng ${gift.name} kính lễ Đức Phật A Di Đà` });
        }
      });
      const room = await current.connect();
      if (valid()) connected(room);
      return state.tiktok;
    } catch (error) {
      if (token !== revision) return state.tiktok;
      state.tiktok.lastError = error?.message || 'Không kết nối được phòng TikTok.';
      state.tiktok.connecting = false; scheduleRetry(token);
      throw error;
    }
  }
  function connectTikTokLive(raw) {
    const username = resolveTikTokUsername(raw);
    if (username === wanted && connecting) return connecting;
    if (username === wanted && state.tiktok.connected) return Promise.resolve(state.tiktok);
    const differentRoom = state.tiktok.username !== username;
    revision++; if (reconnectTimer) cancel(reconnectTimer); reconnectTimer = null; release();
    if (differentRoom) { ceremonyQueue?.clear(); stateModel.endLiveSession('switchRoom'); stateModel.roomViewers.clear(); giftTracker.clear(); }
    wanted = username; retryCount = 0;
    state.tiktok = { connected: false, connecting: true, reconnecting: false, retryCount: 0, nextRetryAt: null, username, roomId: null, viewerCount: 0, lastError: null };
    const token = revision;
    connecting = open(token).finally(() => { if (token === revision) connecting = null; });
    return connecting;
  }
  function disconnectTikTokLive() {
    ceremonyQueue?.clear();
    wanted = ''; revision++; connecting = null; if (reconnectTimer) cancel(reconnectTimer); reconnectTimer = null;
    release(); stateModel.roomViewers.clear(); giftTracker.clear(); stateModel.endLiveSession('manual');
    Object.assign(state.tiktok, { connected: false, connecting: false, reconnecting: false, viewerCount: 0, retryCount: 0, nextRetryAt: null });
    notify('state', publicState()); return state.tiktok;
  }
  return { resolveTikTokUsername, extractUserFromEvent, connectTikTokLive, disconnectTikTokLive };
}
module.exports = { createTikTokLiveService };
