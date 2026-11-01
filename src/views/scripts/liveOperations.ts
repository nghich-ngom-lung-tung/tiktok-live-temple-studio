import { rpc, toast, escapeHtml } from './studioShared';

let current: any = {};
const actions: Record<string, string> = {
  burnIncense: 'Dâng hương', sendPrayer: 'Thả hoa đăng', ringBell: 'Thỉnh chuông',
  strikeWoodenFish: 'Gõ mõ', offerGift: 'Dâng hoa sen', grandCeremony: 'Đại lễ'
};
const text = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
async function command(method: string, params: Record<string, unknown>, button?: HTMLButtonElement) {
  if (button) button.disabled = true;
  try { const state = await rpc(method, params); syncLiveOperations(state); }
  catch (error) { toast(error instanceof Error ? error.message : 'Không thực hiện được thao tác.'); }
  finally { if (button) button.disabled = false; }
}
export function initLiveOperations(): void {
  document.getElementById('btnPauseLivePresentation')?.addEventListener('click', event => {
    void command('temple.updateSettings', { presentationPaused: !current.settings?.presentationPaused }, event.currentTarget as HTMLButtonElement);
  });
  for (const [id, key] of [['btnToggleTts', 'ttsEnabled'], ['btnToggleMusic', 'bgMusicEnabled'], ['btnToggleSfx', 'sfxEnabled']]) {
    document.getElementById(id)?.addEventListener('click', event => {
      void command('temple.updateSettings', { [key]: current.settings?.[key] === false }, event.currentTarget as HTMLButtonElement);
    });
  }
  document.getElementById('btnToggleAutoSim')?.addEventListener('click', event => {
    void command('live.setAutoSim', { enabled: !current.settings?.autoSim }, event.currentTarget as HTMLButtonElement);
  });
  document.getElementById('btnLiveDisconnect')?.addEventListener('click', event => { void command('live.disconnect', {}, event.currentTarget as HTMLButtonElement); });
  document.getElementById('btnNewLiveSession')?.addEventListener('click', event => { void command('live.newSession', {}, event.currentTarget as HTMLButtonElement); });
  document.getElementById('btnSaveGiftMapping')?.addEventListener('click', event => {
    const id = (document.getElementById('giftMappingId') as HTMLInputElement).value.trim();
    const label = (document.getElementById('giftMappingLabel') as HTMLInputElement).value.trim();
    const action = (document.getElementById('giftMappingAction') as HTMLSelectElement).value;
    if (!/^\d{1,20}$/.test(id)) { toast('Nhập ID quà dạng số. ID nằm trong danh sách quà vừa nhận bên dưới.'); return; }
    void command('temple.updateSettings', { giftMappings: { ...(current.settings?.giftMappings || {}), [id]: { label: label.slice(0, 80), action } } }, event.currentTarget as HTMLButtonElement);
  });
  document.getElementById('giftMappingList')?.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-gift]');
    if (!button) return;
    const mappings = { ...(current.settings?.giftMappings || {}) }; delete mappings[button.dataset.removeGift];
    void command('temple.updateSettings', { giftMappings: mappings }, button);
  });
  window.setInterval(renderClock, 1000);
}
function renderClock(): void {
  const session = current.liveSession;
  if (session) {
    const seconds = Math.max(0, Math.floor(((session.endedAt || Date.now()) - session.startedAt) / 1000));
    text('liveSessionDuration', `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  } else text('liveSessionDuration', '0:00:00');
  const live = current.tiktok || {};
  if (current.serverConnected === false) {
    text('liveConnectionStatus', 'Mất kết nối máy chủ. Kiểm tra server và token RPC.');
    return;
  }
  text('liveConnectionStatus', live.connected ? `Đã kết nối @${live.username} · ${Number(live.viewerCount || 0).toLocaleString('vi-VN')} người xem`
    : live.connecting ? `Đang kết nối @${live.username}…`
    : live.reconnecting ? `Đang chờ nối lại lần ${live.retryCount} · ${Math.max(0, Math.ceil(((live.nextRetryAt || Date.now()) - Date.now()) / 1000))} giây`
    : 'Chưa kết nối TikTok.');
  text('liveConnectionError', live.lastError || '');
}
export function syncLiveOperations(state: any): void {
  if (!state || !state.settings) return;
  current = state;
  const paused = Boolean(state.settings.presentationPaused);
  text('btnPauseLivePresentation', paused ? 'Tiếp tục hiệu ứng và âm thanh' : 'Tạm dừng toàn bộ hiệu ứng / âm thanh');
  document.getElementById('btnPauseLivePresentation')?.classList.toggle('is-paused', paused);
  for (const [id, key, label] of [['btnToggleTts', 'ttsEnabled', 'Giọng đọc'], ['btnToggleMusic', 'bgMusicEnabled', 'Nhạc nền'], ['btnToggleSfx', 'sfxEnabled', 'Pháp khí']]) {
    const enabled = state.settings[key] !== false;
    text(id, `${label}: ${enabled ? 'BẬT' : 'TẮT'}`);
    document.getElementById(id)?.classList.toggle('active-toggle', enabled);
  }
  text('btnToggleAutoSim', `Giả lập tương tác: ${state.settings.autoSim ? 'BẬT' : 'TẮT'}`);
  const queue = state.playback || {};
  text('liveQueueStatus', paused ? 'Đã dừng hình/tiếng và xóa hàng chờ. Công đức vẫn ghi nhận; tiếp tục sẽ phát tương tác mới.'
    : `${queue.current ? `Đang phát: ${queue.current.event.user || 'Thông báo'}` : queue.preparing ? 'Đang chuẩn bị giọng đọc…' : 'Đang chờ tương tác'} · ${queue.pendingCount || 0} lượt đang chờ`);
  text('liveQueueSkipped', queue.skipped ? `${queue.skipped} lượt hình ảnh bị dừng/bỏ qua; công đức vẫn được ghi nhận.` : '');
  text('liveSpeechWarning', queue.current?.event?.speechError ? `Lượt này chỉ phát hình ảnh: ${queue.current.event.speechError}` : '');
  const session = state.liveSession;
  text('liveSessionTitle', session ? `${session.active ? 'Phiên đang chạy' : 'Phiên đã kết thúc'} · @${session.username}` : 'Chưa có phiên TikTok thật.');
  text('liveSessionStats', session ? `${session.uniqueViewers} người đã ghi nhận · đỉnh ${session.peakViewers} người xem · ${session.comments} chat · ${session.likes} tim · ${session.follows} follow · ${session.shares} chia sẻ · ${session.giftCount} quà / ${session.coins} xu · ${session.merit} công đức` : 'Thống kê bắt đầu khi kết nối được phòng Live. Người giả lập không được tính vào phiên.');
  const history = document.getElementById('liveSessionHistory');
  if (history) history.innerHTML = (state.liveSessions || []).slice(0, 5).map((item: any) => `<li>@${escapeHtml(item.username)} · ${new Date(item.startedAt).toLocaleString('vi-VN')} · ${Number(item.coins || 0).toLocaleString('vi-VN')} xu · ${Number(item.merit || 0).toLocaleString('vi-VN')} CĐ</li>`).join('');
  const mappingList = document.getElementById('giftMappingList');
  if (mappingList) mappingList.innerHTML = Object.entries(state.settings.giftMappings || {}).map(([id, rule]: [string, any]) => `<div class="gift-mapping-row"><span>${escapeHtml(rule.label || 'Quà')} · ID ${escapeHtml(id)}<small>${escapeHtml(actions[rule.action] || rule.action)}</small></span><button class="dock-btn" type="button" data-remove-gift="${escapeHtml(id)}">Xóa</button></div>`).join('') || '<p class="helper">Chưa tùy chỉnh. Đang dùng nghi thức mặc định theo giá trị quà.</p>';
  const gifts = (state.recentEvents || []).filter((event: any) => event.giftId);
  text('recentGiftIds', gifts.length ? gifts.slice(0, 5).map((event: any) => `${event.giftName} — ID ${event.giftId}`).join(' · ') : 'ID quà sẽ hiện ở đây sau khi nhận quà thật.');
  renderClock();
}
