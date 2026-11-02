import { ACTIVE_PROFILE_ID, rpc, toast, escapeHtml, initTabs } from './studioShared';
import { TTS_VOICE_NAMES } from './ttsVoiceNames';
import { createScriptureControls } from './scriptureControls';
import './customDropdown';
import { ritualIcon } from './studioEffects';

const contentUrl = new URL(window.location.href);
if (['scripture', 'voiceSettings'].includes(contentUrl.searchParams.get('tab') || contentUrl.hash.slice(1))) {
  contentUrl.searchParams.set('tab', 'content');
  if (['#scripture', '#voiceSettings'].includes(contentUrl.hash)) contentUrl.hash = '';
  window.history.replaceState(null, '', contentUrl);
}
initTabs();

const $ = (id: string): HTMLElement | null => document.getElementById(id);
const input = (id: string): HTMLInputElement => $(id) as HTMLInputElement;
const textarea = (id: string): HTMLTextAreaElement => $(id) as HTMLTextAreaElement;
const select = (id: string): HTMLSelectElement => $(id) as HTMLSelectElement;
const DEFAULT_BACKGROUND = '/assets/thien-chua-giao/backgrounds/nha-tho-live.png';
const CHRISTIAN_MUSIC_TRACKS = [
  { id: 'sanctuary', label: 'Đàn organ nhà nguyện', mood: 'Organ ấm · hợp âm chậm, trang nghiêm' },
  { id: 'morning-grace', label: 'Bình minh ân sủng', mood: 'Piano sáng · giai điệu nhẹ, thanh thoát' },
  { id: 'candlelight', label: 'Tĩnh lặng bên ánh nến', mood: 'Chuông mềm · âm nền sâu, lắng đọng' },
  { id: 'garden-peace', label: 'Vườn bình an', mood: 'Đàn hạc mộc · arpeggio thong thả' },
  { id: 'gentle-dawn', label: 'Sớm mai bình an', mood: 'Sáo mềm · giai điệu nâng dần' },
  { id: 'still-waters', label: 'Dòng nước tĩnh lặng', mood: 'Dây êm · hợp âm dài cho giờ suy niệm' }
];
const musicLibrary = $('christianMusicTrackList');
if (musicLibrary) musicLibrary.innerHTML = CHRISTIAN_MUSIC_TRACKS.map((track, index) =>
  `<button class="track-row" type="button" data-christian-track="${track.id}" aria-pressed="${index === 0}"><span class="track-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(track.label)}<small>${escapeHtml(track.mood)}</small></span><span>0:23</span></button>`
).join('');
let latestState: any = null;
let refreshBusy = false;
let backgroundUrl = DEFAULT_BACKGROUND;
function setStagePreviewImages(url: string): void {
  document.querySelectorAll<HTMLImageElement>('#stagePreview, .church-stage-preview, .scene-preview img').forEach(image => {
    if (image.getAttribute('src') !== url) image.src = url;
  });
}
let previewObjectUrl = '';
let previewLocked = false;
let sessionTimer = 0;
let saveBusy = false;
let availableVoices: string[] = [];
let savedVoiceRotation: string[] = [];
let draftVoiceRotation: string[] | null = null;
let voiceStatusSnapshot: any = null;
let voiceControlsBusy = false;
let voicePreviewBusy = false;
let voicePreviewBlobUrl = '';
let previewMusicTrack = 'sanctuary';
let prayerTemplateDirty = false;
let localMusicUrl = '';
let socket: WebSocket | null = null;
let reconnectTimer = 0;
let stateRevision = 0;
const scriptureControls = createScriptureControls('scriptureSelect', 'scriptureReflection', 'btnResetScriptureReflection');

function connectRealtime(): void {
  if (!window.TempleAuth.getToken() || (socket && socket.readyState <= WebSocket.OPEN)) return;
  const current = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?profile=thien-chua-giao`);
  socket = current;
  current.onopen = () => current.send(JSON.stringify({ jsonrpc: '2.0', method: 'auth', params: { token: window.TempleAuth.getToken() } }));
  current.onmessage = message => {
    if (socket !== current) return;
    try {
      const packet = JSON.parse(message.data);
      if (packet.method === 'christian.state') {
        stateRevision++;
        updateState(packet.params);
      } else if (packet.method === 'christian.viewerCount' && latestState) {
        stateRevision++;
        updateState({ ...latestState, tiktok: { ...latestState.tiktok, viewerCount: packet.params.viewerCount }, liveSession: packet.params.liveSession });
      } else if (packet.method === 'tts.status') {
        stateRevision++;
        syncChristianVoiceControls(packet.params, latestState?.settings?.ttsVoice, latestState?.settings?.ttsVoiceRotation || []);
      } else if (packet.method === 'christian.playback') {
        renderPlayback(packet.params);
      }
    } catch (error) { console.warn('[Christian admin sync]', error); }
  };
  current.onclose = event => {
    if (socket !== current) return;
    socket = null;
    setText('serverStatus', 'Đang nối lại…');
    if (event.code === 4401) { window.TempleAuth.logout(); return; }
    if (window.TempleAuth.getToken()) reconnectTimer = window.setTimeout(connectRealtime, 3000);
  };
}

function renderPlayback(status: any): void {
  setText('playbackStatus', status?.paused ? 'Đã tạm dừng · bỏ các lượt đang chờ.'
    : status?.preparing ? `Đang tạo giọng đọc · ${status.pendingCount} lượt chờ.`
    : status?.current?.event?.speechError || (status?.current ? `Đang phát · ${status.pendingCount} lượt chờ.` : 'Sẵn sàng nhận tương tác.'));
}

function requireRpcToken(statusId: string): boolean {
  if (window.TempleAuth.getToken()) return true;
  const gate = document.getElementById('authGate') as HTMLDetailsElement | null;
  if (gate) {
    gate.open = true;
    gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  setStatus(statusId, 'Cần xác thực RPC trước. Nhập token ở mục “Kết nối điều khiển” phía trên.', true);
  return false;
}

function setText(id: string, value: unknown): void {
  const element = $(id);
  if (element) element.textContent = String(value ?? '');
}

function setStatus(id: string, message: string, error = false): void {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.dataset.state = error ? 'error' : '';
}

function renderChristianVoiceRotation(): void {
  const list = $('christianVoiceRotationList');
  if (!list) return;
  list.replaceChildren();
  if (!voiceStatusSnapshot?.ready || availableVoices.length === 0) {
    const helper = document.createElement('p');
    helper.className = 'helper';
    helper.textContent = 'Xác thực RPC và chờ ZeroTTS sẵn sàng để tải danh sách giọng.';
    list.append(helper);
    return;
  }
  const selected = draftVoiceRotation ?? savedVoiceRotation;
  for (const voice of availableVoices) {
    const label = document.createElement('label');
    label.className = 'voice-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = voice;
    checkbox.checked = selected.includes(voice);
    checkbox.disabled = voiceControlsBusy;
    const caption = document.createElement('span');
    caption.textContent = TTS_VOICE_NAMES[voice] || voice;
    label.append(checkbox, caption);
    list.append(label);
  }
}

function syncChristianVoiceControls(status: any, selectedVoice?: string, rotation?: string[]): void {
  voiceStatusSnapshot = status || { ready: false, status: 'starting', voices: [] };
  const readyVoices = status?.ready && Array.isArray(status.voices) ? status.voices.filter((voice: unknown) => typeof voice === 'string') : [];
  const changed = JSON.stringify(readyVoices) !== JSON.stringify(availableVoices);
  if (changed) {
    availableVoices = readyVoices;
    const voiceSelect = select('ttsVoice');
    if (readyVoices.length) voiceSelect.replaceChildren(...readyVoices.map((voice: string) => new Option(TTS_VOICE_NAMES[voice] || voice, voice)));
  }

  const voiceSelect = select('ttsVoice');
  const preview = $('btnVoicePreview') as HTMLButtonElement | null;
  const ready = Boolean(status?.ready && availableVoices.length);
  if (!ready) {
    const message = status?.status === 'auth' ? 'Xác thực để tải giọng' : status?.status === 'error' ? 'ZeroTTS chưa sẵn sàng' : 'Đang tải danh sách giọng…';
    voiceSelect.replaceChildren(new Option(message, ''));
    voiceSelect.disabled = true;
  } else {
    if (!voiceSelect.options.length || voiceSelect.options[0].value === '') {
      voiceSelect.replaceChildren(...availableVoices.map(voice => new Option(TTS_VOICE_NAMES[voice] || voice, voice)));
    }
    const chosen = selectedVoice || status.voice || latestState?.settings?.ttsVoice || availableVoices[0];
    if (availableVoices.includes(chosen)) voiceSelect.value = chosen;
    voiceSelect.disabled = voiceControlsBusy;
  }
  const fieldset = $('christianVoiceRotationFieldset') as HTMLFieldSetElement | null;
  if (fieldset) fieldset.disabled = !ready || voiceControlsBusy;
  if (preview) preview.disabled = !ready || voiceControlsBusy || voicePreviewBusy;

  if (Array.isArray(rotation)) {
    const valid = rotation.filter((voice, index) => availableVoices.includes(voice) && rotation.indexOf(voice) === index);
    if (JSON.stringify(valid) !== JSON.stringify(savedVoiceRotation) || changed) savedVoiceRotation = valid;
  }
  renderChristianVoiceRotation();

  if (!voiceControlsBusy && !voicePreviewBusy) {
    if (status?.ready) setStatus('voiceStatus', `ZeroTTS sẵn sàng · ${availableVoices.length} giọng. Cài đặt này chỉ áp dụng cho hồ sơ Thiên Chúa giáo.`);
    else if (status?.status === 'error') setStatus('voiceStatus', status.lastError || 'ZeroTTS chưa sẵn sàng.', true);
    else if (status?.status === 'auth') setStatus('voiceStatus', 'Xác thực RPC để tải danh sách 8 giọng ZeroTTS.');
    else setStatus('voiceStatus', `ZeroTTS đang ${status?.status || 'khởi động'}; danh sách giọng sẽ hiện sau khi sẵn sàng.`);
  }
}

function renderRecent(events: any[] = []): void {
  const list = $('recentActivity');
  if (!list) return;
  if (!events.length) {
    list.innerHTML = '<li class="event-summary-empty">Chưa có tương tác trong phiên này.</li>';
    return;
  }
  const labels: Record<string, string> = { prayer: 'gửi lời cầu nguyện', scripture: 'chia sẻ suy ngẫm', gift: 'gửi quà', member: 'vừa vào phòng Live', candle: 'thắp nến tạ ơn', bell: 'đổ chuông thánh đường', communion: 'hiệp thông đại lễ', peace: 'gửi lời chúc bình an', thanksgiving: 'dâng lời tri ân', welcome: 'được chào đón' };
  const icons: Record<string, string> = { prayer: 'prayer', scripture: 'bible', gift: 'gift', member: 'person', candle: 'incense', bell: 'bell', communion: 'ceremony', peace: 'heart', thanksgiving: 'heart', welcome: 'person' };
  list.innerHTML = events.slice(0, 6).map(event => {
    const date = event.timestamp ? new Date(event.timestamp) : null;
    const validDate = date && !Number.isNaN(date.getTime());
    const time = validDate ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';
    const detail = event.title ? [event.title, event.reference].filter(Boolean).join(' · ') : event.type === 'gift' ? [event.giftName, Number(event.coins) ? `${Number(event.coins).toLocaleString('vi-VN')} xu` : ''].filter(Boolean).join(' · ') : event.reference || event.giftName || event.wish || '';
    const description = `${event.user || 'Khách xem'} ${labels[event.type] || 'tương tác'}${detail ? ` · ${detail}` : ''}`;
    return `<li class="event-summary-item" data-kind="${escapeHtml(event.type || 'other')}" title="${escapeHtml(description)}"><span class="event-feed-icon" aria-hidden="true">${ritualIcon(icons[event.type] || 'heart')}</span><span class="event-summary-copy"><span><strong>${escapeHtml(event.user || 'Khách xem')}</strong> ${labels[event.type] || 'tương tác'}${detail ? ` · ${escapeHtml(detail)}` : ''}</span><time${validDate ? ` datetime="${escapeHtml(date.toISOString())}"` : ''}>${escapeHtml(time)}</time></span></li>`;
  }).join('');
}

function formatDuration(startedAt?: number): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - Number(startedAt || Date.now())) / 1000));
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function updateState(state: any): void {
  latestState = state;
  renderPlayback(state.playback);
  if (state.tts) syncChristianVoiceControls(state.tts, state.settings?.ttsVoice, state.settings?.ttsVoiceRotation || []);
  setText('totalPrayers', Number(state.totalPrayerRequests || 0).toLocaleString('vi-VN'));
  setText('totalScriptures', Number(state.totalScriptureShares || 0).toLocaleString('vi-VN'));
  setText('totalThanks', Number(state.totalGiftThanks || 0).toLocaleString('vi-VN'));
  setText('serverStatus', 'Đã đồng bộ');
  const serverStatus = $('serverStatus');
  if (serverStatus) serverStatus.dataset.state = 'ok';
  if ($('sessionBadge')) {
    const session = state.liveSession;
    setText('sessionBadge', session?.active ? 'ĐANG LIVE' : 'CHƯA LIVE');
    const badge = $('sessionBadge');
    if (badge && session?.active) badge.classList.add('is-live'); else badge?.classList.remove('is-live');
    setText('sessionDuration', session?.active ? formatDuration(session.startedAt) : '00:00:00');
    setText('peakViewers', Number(session?.peakViewers || 0).toLocaleString('vi-VN'));
    setText('commentCount', Number(session?.comments || 0).toLocaleString('vi-VN'));
    if (sessionTimer) window.clearInterval(sessionTimer);
    sessionTimer = session?.active ? window.setInterval(() => setText('sessionDuration', formatDuration(session.startedAt)), 1000) : 0;
  }
  renderRecent(state.recentEvents || []);

  const currentBackground = state.settings?.stageBackgroundUrl || DEFAULT_BACKGROUND;
  backgroundUrl = currentBackground;
  if (!previewLocked) setStagePreviewImages(currentBackground);
  const reset = $('btnResetBackground') as HTMLButtonElement | null;
  if (reset) reset.disabled = currentBackground === DEFAULT_BACKGROUND || !window.TempleAuth.getToken();

  if (document.activeElement !== input('ttsEnabled')) input('ttsEnabled').checked = state.settings?.ttsEnabled !== false;
  if (document.activeElement !== input('presentationPaused')) input('presentationPaused').checked = Boolean(state.settings?.presentationPaused);
  if (!prayerTemplateDirty && document.activeElement !== textarea('prayerTemplate')) textarea('prayerTemplate').value = state.settings?.narrationTemplates?.prayer || '';
  if (document.activeElement !== select('ttsVoice') && state.settings?.ttsVoice) select('ttsVoice').value = state.settings.ttsVoice;
  syncChristianMusicControls(state.settings || {});
}

function syncChristianMusicControls(settings: any): void {
  const track = CHRISTIAN_MUSIC_TRACKS.some(item => item.id === settings.musicTrack) ? settings.musicTrack : 'sanctuary';
  const trackSelect = $('christianMusicTrack') as HTMLSelectElement | null;
  if (trackSelect && document.activeElement !== trackSelect) trackSelect.value = track;
  previewMusicTrack = track;
  document.querySelectorAll<HTMLButtonElement>('[data-christian-track]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.christianTrack === track));
  });
  const enabled = $('christianBgMusicEnabled') as HTMLInputElement | null;
  if (enabled && document.activeElement !== enabled) enabled.checked = Boolean(settings.bgMusicEnabled);
  const rotate = $('christianMusicAutoRotate') as HTMLInputElement | null;
  if (rotate && document.activeElement !== rotate) rotate.checked = Boolean(settings.musicAutoRotate);
  const volume = Math.max(0, Math.min(50, Math.round(Number(settings.bgMusicVolume ?? 0.18) * 100)));
  const volumeInput = $('christianMusicVolume') as HTMLInputElement | null;
  if (volumeInput && document.activeElement !== volumeInput) volumeInput.value = String(volume);
  setText('christianMusicVolumeValue', `${volume}%`);
}

async function saveChristianMusicSettings(patch: Record<string, unknown>, success: string): Promise<boolean> {
  if (!requireRpcToken('christianMusicStatus')) return false;
  try {
    const state = await rpc('christian.updateSettings', patch);
    updateState(state);
    setStatus('christianMusicStatus', success);
    return true;
  } catch (error: any) {
    syncChristianMusicControls(latestState?.settings || {});
    setStatus('christianMusicStatus', error.message || 'Không lưu được cài đặt nhạc.', true);
    toast(error.message || 'Không lưu được cài đặt nhạc.');
    return false;
  }
}

async function run(method: string, params: Record<string, unknown> = {}, button?: HTMLButtonElement): Promise<any> {
  const statusId = method === 'christian.shareScripture' ? 'scriptureStatus' : 'actionStatus';
  if (button) button.disabled = true;
  try {
    const result = await rpc(method, params);
    const output = $('rpcOutput');
    if (output) output.textContent = JSON.stringify(result, null, 2);
    if (result?.settings && result?.profileId === 'thien-chua-giao') updateState(result);
    setStatus(statusId, 'Đã đồng bộ hoạt động sang Phòng Live Thiên Chúa giáo.');
    return result;
  } catch (error: any) {
    setStatus(statusId, error.message || 'Không thực hiện được yêu cầu.', true);
    toast(error.message || 'Không thực hiện được yêu cầu.');
    throw error;
  } finally {
    if (button) button.disabled = false;
  }
}

async function refresh(): Promise<void> {
  if (refreshBusy || !window.TempleAuth.getToken()) return;
  refreshBusy = true;
  const revision = stateRevision;
  try {
    const state = await rpc('christian.getState');
    if (revision === stateRevision) updateState(state);
  } catch (error: any) {
    setText('serverStatus', 'Chưa kết nối được');
    const status = $('serverStatus');
    if (status) status.dataset.state = 'error';
    syncChristianVoiceControls({ ready: false, status: 'error', lastError: error?.message || 'Không tải được danh sách giọng.', voices: [] });
    if (error?.message) setStatus('authStatus', error.message, true);
  } finally { refreshBusy = false; }
}

const currentUser = () => input('viewerName').value.trim() || 'Khách Demo';
const bindAction = (id: string, method: string, params: () => Record<string, unknown>) => {
  const button = $(id) as HTMLButtonElement | null;
  button?.addEventListener('click', () => { void run(method, params(), button).catch(() => {}); });
};

bindAction('btnPrayer', 'christian.sendPrayer', () => ({ user: currentUser(), wish: input('prayerWish').value.trim() || 'Xin Chúa gìn giữ gia đình trong bình an, yêu thương và hiệp nhất.' }));
bindAction('btnScriptureQuick', 'christian.shareScripture', () => ({ user: currentUser(), reference: select('scriptureSelect')?.value, reflection: textarea('scriptureReflection')?.value.trim() }));
bindAction('btnCandle', 'christian.lightCandle', () => ({ user: currentUser() }));
bindAction('btnCathedralBell', 'christian.ringBell', () => ({ user: currentUser() }));
bindAction('btnThanks', 'christian.giveThanks', () => ({ user: currentUser() }));
bindAction('btnChoir', 'christian.communion', () => ({ user: currentUser() }));
bindAction('btnPeace', 'christian.blessPeace', () => ({ user: currentUser() }));
bindAction('btnPreviewMember', 'christian.previewMember', () => ({ user: currentUser() }));
bindAction('btnScripture', 'christian.shareScripture', () => ({ user: currentUser(), reference: select('scriptureSelect').value, reflection: textarea('scriptureReflection').value.trim() }));

select('ttsVoice').addEventListener('change', async () => {
  const voice = select('ttsVoice').value;
  if (!voice || voiceControlsBusy || !requireRpcToken('voiceStatus')) return;
  const previous = latestState?.settings?.ttsVoice || 'maichi';
  voiceControlsBusy = true;
  syncChristianVoiceControls(voiceStatusSnapshot, previous, savedVoiceRotation);
  try {
    const state = await rpc('christian.updateSettings', { ttsVoice: voice });
    updateState(state);
    syncChristianVoiceControls(voiceStatusSnapshot, state.settings?.ttsVoice, state.settings?.ttsVoiceRotation || []);
    setStatus('voiceStatus', `Đã lưu ${TTS_VOICE_NAMES[voice] || voice} cho hồ sơ Thiên Chúa giáo.`);
  } catch (error: any) {
    select('ttsVoice').value = previous;
    setStatus('voiceStatus', error.message || 'Không lưu được giọng đọc.', true);
  } finally {
    voiceControlsBusy = false;
    syncChristianVoiceControls(voiceStatusSnapshot, latestState?.settings?.ttsVoice, savedVoiceRotation);
  }
});

$('christianVoiceRotationList')?.addEventListener('change', async event => {
  const changed = event.target as HTMLInputElement;
  if (changed.type !== 'checkbox' || voiceControlsBusy) return;
  const list = $('christianVoiceRotationList');
  if (!list) return;
  const next = Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
  draftVoiceRotation = next;
  if (next.length === 1) {
    setStatus('voiceStatus', `Đã chọn ${TTS_VOICE_NAMES[next[0]] || next[0]}. Chọn thêm một giọng để bật xoay vòng.`);
    renderChristianVoiceRotation();
    return;
  }
  if (!requireRpcToken('voiceStatus')) { draftVoiceRotation = null; renderChristianVoiceRotation(); return; }
  voiceControlsBusy = true;
  renderChristianVoiceRotation();
  syncChristianVoiceControls(voiceStatusSnapshot, latestState?.settings?.ttsVoice, savedVoiceRotation);
  setStatus('voiceStatus', next.length ? 'Đang lưu danh sách giọng luân phiên…' : 'Đang tắt xoay vòng giọng…');
  try {
    const state = await rpc('christian.updateSettings', { ttsVoiceRotation: next });
    updateState(state);
    savedVoiceRotation = state.settings?.ttsVoiceRotation || [];
    setStatus('voiceStatus', savedVoiceRotation.length
      ? `Đang xoay vòng: ${savedVoiceRotation.map(voice => TTS_VOICE_NAMES[voice] || voice).join(' → ')}.`
      : `Đã tắt xoay vòng. Giọng mặc định: ${TTS_VOICE_NAMES[state.settings?.ttsVoice] || state.settings?.ttsVoice || 'Mai Chi'}.`);
  } catch (error: any) {
    draftVoiceRotation = null;
    setStatus('voiceStatus', error.message || 'Không lưu được danh sách giọng.', true);
  } finally {
    draftVoiceRotation = null;
    voiceControlsBusy = false;
    syncChristianVoiceControls(voiceStatusSnapshot, latestState?.settings?.ttsVoice, savedVoiceRotation);
  }
});

const saveChristianMusicTrack = async (track: string) => {
  if (!CHRISTIAN_MUSIC_TRACKS.some(item => item.id === track)) return;
  const saved = await saveChristianMusicSettings({ musicTrack: track }, `Đã chọn ${CHRISTIAN_MUSIC_TRACKS.find(item => item.id === track)?.label}. Phòng Live và OBS sẽ dùng bài này.`);
  if (saved) {
    clearLocalMusic();
    const player = $('christianMusicPreview') as HTMLAudioElement | null;
    if (player) { player.pause(); player.src = `/assets/thien-chua-giao/music/${track}.wav`; player.load(); }
  }
};
function clearLocalMusic(): void {
  if (localMusicUrl) URL.revokeObjectURL(localMusicUrl);
  localMusicUrl = '';
  const file = input('musicFile');
  if (file) { file.value = ''; file.dispatchEvent(new Event('change', { bubbles: true })); }
  setStatus('musicFileStatus', '');
}
input('musicFile')?.addEventListener('change', async () => {
  const file = input('musicFile').files?.[0];
  if (!file) return;
  if (!file.type.startsWith('audio/') || file.size > 50 * 1024 * 1024) {
    setStatus('musicFileStatus', 'Chọn tệp âm thanh dưới 50 MB.', true);
    input('musicFile').value = ''; return;
  }
  const player = $('christianMusicPreview') as HTMLAudioElement | null;
  if (!player) return;
  if (localMusicUrl) URL.revokeObjectURL(localMusicUrl);
  localMusicUrl = URL.createObjectURL(file);
  player.src = localMusicUrl;
  player.volume = Math.max(0, Math.min(50, Number(input('christianMusicVolume')?.value ?? 18))) / 100;
  setStatus('musicFileStatus', `File riêng: ${file.name}. Chỉ nghe thử trong tab này.`);
  try { await player.play(); } catch (_) { setStatus('musicFileStatus', `Đã chọn ${file.name}. Bấm phát trên thanh nghe thử để bật âm thanh.`); }
});
$('christianMusicTrackList')?.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-christian-track]');
  if (button?.dataset.christianTrack) saveChristianMusicTrack(button.dataset.christianTrack);
});
select('christianMusicTrack')?.addEventListener('change', () => saveChristianMusicTrack(select('christianMusicTrack').value));
$('btnChristianMusicNext')?.addEventListener('click', () => {
  const currentIndex = CHRISTIAN_MUSIC_TRACKS.findIndex(item => item.id === previewMusicTrack);
  saveChristianMusicTrack(CHRISTIAN_MUSIC_TRACKS[(currentIndex + 1) % CHRISTIAN_MUSIC_TRACKS.length].id);
});
$('btnChristianMusicPreview')?.addEventListener('click', async () => {
  const player = $('christianMusicPreview') as HTMLAudioElement | null;
  if (!player) return;
  const track = select('christianMusicTrack')?.value || previewMusicTrack;
  player.src = localMusicUrl || `/assets/thien-chua-giao/music/${track}.wav`;
  player.volume = Math.max(0, Math.min(50, Number(input('christianMusicVolume')?.value ?? 18))) / 100;
  player.hidden = false;
  try {
    await player.play();
    setStatus('christianMusicStatus', localMusicUrl ? 'Đang nghe file riêng trong tab này.' : `Đang nghe thử ${CHRISTIAN_MUSIC_TRACKS.find(item => item.id === track)?.label} trên thiết bị này.`);
  } catch (_) {
    setStatus('christianMusicStatus', 'Trình duyệt chặn phát thử. Bấm Nghe thử nhạc lần nữa để bật âm thanh.', true);
  }
});
input('christianBgMusicEnabled')?.addEventListener('change', () => {
  const enabled = input('christianBgMusicEnabled').checked;
  void saveChristianMusicSettings({ bgMusicEnabled: enabled }, enabled ? 'Đã bật nhạc nền trong Phòng Live và OBS.' : 'Đã tắt nhạc nền trong Phòng Live và OBS.');
});
input('christianMusicAutoRotate')?.addEventListener('change', () => {
  const enabled = input('christianMusicAutoRotate').checked;
  void saveChristianMusicSettings({ musicAutoRotate: enabled }, enabled ? 'Nhạc sẽ tự chuyển bài khi hết.' : 'Đã tắt tự chuyển bài.');
});
input('christianMusicVolume')?.addEventListener('input', () => {
  const value = Math.max(0, Math.min(50, Number(input('christianMusicVolume').value)));
  setText('christianMusicVolumeValue', `${value}%`);
  const player = $('christianMusicPreview') as HTMLAudioElement | null;
  if (player) player.volume = value / 100;
});
input('christianMusicVolume')?.addEventListener('change', () => {
  const value = Math.max(0, Math.min(50, Number(input('christianMusicVolume').value)));
  void saveChristianMusicSettings({ bgMusicVolume: value / 100 }, `Đã lưu âm lượng nhạc ${value}%.`);
});

($('btnVoicePreview') as HTMLButtonElement | null)?.addEventListener('click', async () => {
  if (!requireRpcToken('voiceStatus') || voicePreviewBusy) return;
  const voice = select('ttsVoice').value;
  if (!voice) return;
  const player = $('christianAudioPreview') as HTMLAudioElement | null;
  if (!player) return;
  const selection = scriptureControls.getSelection();
  if (!selection) { setStatus('voiceStatus', 'Chọn hoặc soạn một lời suy ngẫm trước khi nghe thử.', true); return; }
  voicePreviewBusy = true;
  syncChristianVoiceControls(voiceStatusSnapshot, voice, savedVoiceRotation);
  setStatus('voiceStatus', `Đang tạo nghe thử bằng ${TTS_VOICE_NAMES[voice] || voice}…`);
  try {
    const speech = await rpc('christian.speak', {
      text: `Cùng ${currentUser()} suy ngẫm qua ${selection.reference}. ${selection.reflection}`,
      voice,
      broadcast: false
    });
    if (!speech?.ok || !speech.url) throw new Error(speech?.error || 'Không tạo được âm thanh nghe thử.');
    const blobUrl = await window.TempleAuth.fetchAudioBlobUrl(speech.url);
    if (voicePreviewBlobUrl) URL.revokeObjectURL(voicePreviewBlobUrl);
    voicePreviewBlobUrl = blobUrl;
    player.src = blobUrl;
    player.hidden = false;
    await player.play();
    setStatus('voiceStatus', `Đang nghe thử ${TTS_VOICE_NAMES[voice] || voice} trên thiết bị này.`);
  } catch (error: any) {
    setStatus('voiceStatus', error.message || 'Không nghe thử được giọng đọc.', true);
  } finally {
    voicePreviewBusy = false;
    syncChristianVoiceControls(voiceStatusSnapshot, latestState?.settings?.ttsVoice, savedVoiceRotation);
  }
});

const PRAYER_PRESETS: Record<string, string> = {
  family: 'Lạy Chúa, xin gìn giữ gia đình trong bình an, yêu thương và hiệp nhất.',
  health: 'Lạy Chúa, xin nâng đỡ những người đau yếu; ban sức mạnh, hy vọng và bình an cho họ.',
  wisdom: 'Xin Chúa Thánh Thần soi sáng để chúng con biết chọn điều thiện và bước đi trong khôn ngoan.',
  comfort: 'Xin Chúa ở gần những người đang cô đơn, mất mát hoặc gặp khó khăn; xin an ủi và nâng đỡ họ.',
  remembrance: 'Lạy Chúa, xin đón nhận người thân đã qua đời vào vòng tay yêu thương và ban bình an cho gia đình.',
  gratitude: 'Tạ ơn Chúa vì hồng ân sự sống, gia đình và những điều tốt đẹp hôm nay.'
};
select('christianPrayerPreset').addEventListener('change', () => {
  const wish = PRAYER_PRESETS[select('christianPrayerPreset').value];
  if (wish) input('prayerWish').value = wish;
});

textarea('prayerTemplate')?.addEventListener('input', () => { prayerTemplateDirty = true; });
$('btnSaveSettings')?.addEventListener('click', async () => {
  if (saveBusy) return;
  saveBusy = true;
  const button = $('btnSaveSettings') as HTMLButtonElement;
  button.disabled = true;
  try {
    const state = await run('christian.updateSettings', {
      ttsEnabled: input('ttsEnabled').checked,
      presentationPaused: input('presentationPaused').checked,
      ...(voiceStatusSnapshot?.ready && select('ttsVoice').value ? { ttsVoice: select('ttsVoice').value } : {}),
      narrationTemplates: { prayer: textarea('prayerTemplate').value.slice(0, 600) }
    }, button);
    prayerTemplateDirty = false;
    updateState(state);
    setStatus('settingsStatus', 'Đã lưu và đồng bộ cài đặt.');
  } catch (error: any) { setStatus('settingsStatus', error.message || 'Không lưu được.', true); }
  finally { saveBusy = false; button.disabled = false; }
});

async function loadCatalog(): Promise<void> {
  if (!window.TempleAuth.getToken()) { setStatus('scriptureStatus', 'Xác thực RPC để tải các lời suy ngẫm mẫu.'); return; }
  try {
    const result = await rpc('christian.voiceConfig');
    scriptureControls.load(result.scriptures || []);
    setStatus('scriptureStatus', `Đã tải ${result.scriptures?.length || 0} lời suy ngẫm mẫu. Nội dung này không phải nguyên văn câu Kinh Thánh.`);
  } catch (error: any) { setStatus('scriptureStatus', error.message || 'Không tải được lời suy ngẫm mẫu.', true); }
}

const fileInput = input('stageBackgroundFile') as HTMLInputElement;
const applyBackground = $('btnApplyBackground') as HTMLButtonElement;
const backgroundStatus = $('backgroundStatus');
let selectedFile: File | null = null;
fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] || null;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
  if (!selectedFile) { previewLocked = false; setStagePreviewImages(backgroundUrl); applyBackground.disabled = true; return; }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(selectedFile.type) || selectedFile.size > 8 * 1024 * 1024) {
    setStatus('backgroundStatus', selectedFile.size > 8 * 1024 * 1024 ? 'Ảnh phải nhỏ hơn 8 MB.' : 'Chỉ nhận ảnh PNG, JPG hoặc WebP.', true);
    selectedFile = null; fileInput.value = ''; previewLocked = false; applyBackground.disabled = true;
    setStagePreviewImages(backgroundUrl);
    return;
  }
  previewObjectUrl = URL.createObjectURL(selectedFile);
  previewLocked = true;
  setStagePreviewImages(previewObjectUrl);
  setStatus('backgroundStatus', `Xem trước: ${selectedFile.name}. Bấm “Tải lên và áp dụng” để đồng bộ.`);
  applyBackground.disabled = false;
});

applyBackground.addEventListener('click', async () => {
  if (!selectedFile) {
    setStatus('backgroundStatus', 'Chọn ảnh nền trước khi tải lên.', true);
    return;
  }
  if (!requireRpcToken('backgroundStatus')) return;
  applyBackground.disabled = true;
  try {
    const response = await window.TempleAuth.fetch(`/api/stage-background?profile=${ACTIVE_PROFILE_ID}`, {
      method: 'POST', headers: { 'Content-Type': selectedFile.type }, body: selectedFile
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Không tải được ảnh.');
    backgroundUrl = result.url;
    previewLocked = false;
    setStatus('backgroundStatus', `Đã lưu ảnh ${result.width} × ${result.height} px, chỉ dùng trong hồ sơ Thiên Chúa giáo.`);
    toast('Đã cập nhật ảnh nền Live Thiên Chúa giáo.');
    selectedFile = null; fileInput.value = '';
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
    setStagePreviewImages(backgroundUrl);
    void refresh();
  } catch (error: any) {
    setStatus('backgroundStatus', error.message || 'Không tải được ảnh.', true);
    applyBackground.disabled = false;
  }
});

$('btnResetBackground')?.addEventListener('click', async () => {
  if (!requireRpcToken('backgroundStatus')) return;
  const button = $('btnResetBackground') as HTMLButtonElement;
  button.disabled = true;
  try {
    const response = await window.TempleAuth.fetch(`/api/stage-background/reset?profile=${ACTIVE_PROFILE_ID}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Không khôi phục được ảnh.');
    backgroundUrl = result.url;
    previewLocked = false;
    setStagePreviewImages(backgroundUrl);
    setStatus('backgroundStatus', 'Đã khôi phục ảnh mặc định của Thiên Chúa giáo.');
    void refresh();
  } catch (error: any) { setStatus('backgroundStatus', error.message || 'Không khôi phục được ảnh.', true); button.disabled = false; }
});

window.addEventListener('temple-auth-changed', () => {
  stateRevision++;
  window.clearTimeout(reconnectTimer);
  if (!window.TempleAuth.getToken()) {
    const previous = socket; socket = null; previous?.close(1000, 'Signed out');
    syncChristianVoiceControls({ ready: false, status: 'auth', voices: [] });
    setStatus('voiceStatus', 'Xác thực RPC để tải danh sách 8 giọng ZeroTTS.');
  }
  connectRealtime();
  void refresh();
  void loadCatalog();
});
window.addEventListener('beforeunload', () => {
  if (localMusicUrl) URL.revokeObjectURL(localMusicUrl);
  window.clearTimeout(reconnectTimer);
  const previous = socket; socket = null; previous?.close();
  if (sessionTimer) window.clearInterval(sessionTimer);
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  if (voicePreviewBlobUrl) URL.revokeObjectURL(voicePreviewBlobUrl);
});
void loadCatalog();
void refresh();
connectRealtime();
window.setInterval(() => { void refresh(); }, 15000);

export {};
