import { CHRISTIAN_CAPACITY, christianLayoutForCount, type ChristianSeat } from './christianLayout';
import { initTabs, rpc, escapeHtml, toast } from './studioShared';
import { TTS_VOICE_NAMES } from './ttsVoiceNames';
import { createChristianPlayback, type ChristianPlayback } from './christianPlayback';
import { createChristianEffects } from './christianEffects';
import { createScriptureControls } from './scriptureControls';
import { createChristianPresentation } from './christianPresentation';
import './audio';
import './gooeyNav';
import './customDropdown';
import './studioEffects';

initTabs();

const params = new URLSearchParams(window.location.search);
const obsMode = params.get('obs') === '1';
if (obsMode) document.body.classList.add('obs-mode');

const wrapper = document.getElementById('stageWrapper');
const stage = document.getElementById('stage9x16');
function fitStage(): void {
  if (!wrapper || !stage) return;
  stage.style.transform = `scale(${wrapper.clientWidth / 1080})`;
}
window.addEventListener('resize', fitStage);
if (wrapper && 'ResizeObserver' in window) new ResizeObserver(fitStage).observe(wrapper);
fitStage();

type Viewer = { name?: string; uniqueId?: string; avatar?: string; character?: string; coins?: number; lastGift?: string; seatIndex?: number };
type Session = { active?: boolean; username?: string; startedAt?: number; peakViewers?: number; uniqueViewers?: number; comments?: number; likes?: number; follows?: number; shares?: number; coins?: number; giftCount?: number; prayerRequests?: number; scriptureShares?: number; thanksgiving?: number };
type ChristianAudioEngine = {
  bgAudio: HTMLAudioElement; ttsVoice: string;
  onTtsStateChange: ((state: { speaking: boolean; text: string }) => void) | null;
  ensureContext(): AudioContext; applyRemoteSettings(settings: Record<string, any>): void;
  setMusicSource(source: string): void; setMusicVolume(value: number): void; setTtsVolume(value: number): void;
  enqueueTts(text: string, options?: Record<string, any>): void;
  stopTts(): void;
  playTempleBell?(intensity?: number): void;
};
type ChristianState = {
  playback?: ChristianPlayback;
  totalPrayerRequests?: number; totalScriptureShares?: number; totalThanksgiving?: number; totalGiftThanks?: number;
  roomViewers?: Viewer[]; supporters?: Viewer[];
  tiktok?: { connected?: boolean; connecting?: boolean; username?: string; viewerCount?: number; lastError?: string | null };
  liveSession?: Session | null; liveSessions?: Session[]; simulatedViewerCount?: number;
  recentEvents?: Array<Record<string, any>>; tts?: { ready?: boolean; status?: string; voice?: string; voices?: string[]; lastError?: string };
  settings?: { stageBackgroundUrl?: string; presentationPaused?: boolean; ttsEnabled?: boolean; ttsVoice?: string; ttsVoiceRotation?: string[]; ttsVolume?: number; bgMusicEnabled?: boolean; bgMusicVolume?: number; musicTrack?: string; musicAutoRotate?: boolean };
};

let latestState: ChristianState | null = null;
const audio = new window.TempleAudioEngine() as ChristianAudioEngine;
let ws: WebSocket | null = null;
let retryTimer = 0;
let memberTimer = 0;
let chatTimers: number[] = [];
let lastMessageId = '';
let lastSpeechId = '';
let activeUser = '';
let supporterSignature = '';
let eventFeedSignature = '';
let sessionClockTimer = 0;
let voiceListSignature = '';
let stateRevision = 0;
let animationsPaused = false;
let prayerTimer = 0;
const scriptureControls = createScriptureControls('scriptureReference', 'scriptureReflection', 'btnResetScriptureReflection');
const ritualEffects = createChristianEffects(stage, () => audio.ensureContext());
const ritualPresentation = createChristianPresentation(stage, resolveRitualReturnTarget);
const playback = createChristianPlayback({
  play: handleEvent,
  returning: event => ritualPresentation.finish(resolveRitualReturnTarget, event.endsAt),
  stop(reason) {
    if (reason === 'pause' || reason === 'cancel') audio.stopTts();
    ritualEffects.clear();
    ritualPresentation.clear();
    if (reason === 'pause' || reason === 'cancel') {
      window.clearTimeout(memberTimer); memberTimer = 0; arrivalQueue.length = 0;
      document.getElementById('memberArrival')?.classList.remove('visible');
    }
    window.clearTimeout(prayerTimer);
    document.getElementById('prayerFigure')?.classList.remove('is-walking', 'is-praying');
    const tag = document.getElementById('prayerNameTag');
    if (tag) tag.hidden = true;
    text('activeKicker', 'CÙNG HIỆP THÔNG');
    text('activeUser', 'Đang chờ lời cầu nguyện');
    text('messageKicker', 'LỜI SUY NGẪM');
    text('messageTitle', 'Bình an và hy vọng');
    text('messageBody', 'Cùng nhau dành một phút tĩnh lặng, gửi lời cầu nguyện cho người thân yêu.');
  },
  changed(status) {
    if (latestState) latestState.playback = status;
    if (!status.paused && status.current && status.current.endsAt > Date.now()) {
      playSpeech({ ...status.current.event, startsAt: status.current.event.speechStartsAt ?? status.current.startsAt });
    }
    document.body.classList.toggle('presentation-paused', status.paused);
    if (animationsPaused !== status.paused) {
      animationsPaused = status.paused;
      for (const { animation } of attendeeArrivals.values()) {
        if (status.paused) animation.pause(); else if (animation.playState === 'paused') animation.play();
      }
    }
    text('playbackStatus', status.paused ? 'Đã tạm dừng · bỏ các lượt đang chờ.'
      : status.current?.event?.ttsPrepared === false ? `Đang phát hình, đang tạo lời đọc · ${status.pendingCount} lượt chờ.`
      : status.preparing ? `Đang tạo giọng đọc · ${status.pendingCount} lượt chờ.`
      : status.current?.event?.speechError ? status.current.event.speechError
      : status.current ? `Đang phát · ${status.pendingCount} lượt chờ.` : 'Sẵn sàng nhận lời cầu nguyện.');
  }
});

type ChristianArrival = { walker: HTMLElement; animation: Animation };
const attendeeNodes = new Map<string, HTMLElement>();
const attendeeArrivals = new Map<string, ChristianArrival>();

function resolveRitualReturnTarget(event: Record<string, any>): { x: number; y: number; scale: number; attendee?: HTMLElement | null } {
  const key = christianViewerKey({ uniqueId: String(event.uniqueId || ''), name: String(event.user || '') });
  let attendee = attendeeNodes.get(key);
  if (!attendee && String(event.uniqueId || '').startsWith('operator-')) {
    const name = String(event.user || '').toLocaleLowerCase('vi');
    attendee = Array.from(attendeeNodes.values()).find(node => node.dataset.viewerName === name);
  }
  if (attendee?.isConnected) {
    const height = Number.parseFloat(attendee.style.height) || 260;
    return {
      x: Number(attendee.dataset.x) || 540,
      y: Number(attendee.dataset.y) || 1340,
      scale: Math.min(1, Math.max(.55, height / 360)),
      attendee
    };
  }

  const restingActors = Array.from(stage?.querySelectorAll<HTMLElement>('.ritual-actor.is-resting') || []);
  const occupied = new Set([
    ...Array.from(attendeeNodes.values(), node => `${node.dataset.x}:${node.dataset.y}`),
    ...restingActors.map(node => `${node.dataset.homeX || node.style.left}:${node.dataset.homeY || node.style.top}`)
  ]);
  const seatCount = Math.min(CHRISTIAN_CAPACITY, Math.max(2, attendeeNodes.size + restingActors.length + 1));
  const seat = christianLayoutForCount(seatCount).find(candidate => !occupied.has(`${candidate.x}:${candidate.y}`));
  if (seat) return { x: seat.x, y: seat.y, scale: Math.min(1, Math.max(.55, seat.height / 360)) };
  return { x: 540, y: 1580, scale: .7 };
}

function syncVoiceSelect(tts: ChristianState['tts'], selectedVoice?: string): void {
  const voiceSelect = document.getElementById('christianVoiceSelect') as HTMLSelectElement | null;
  if (!voiceSelect) return;
  const voices = tts?.ready && Array.isArray(tts.voices) ? tts.voices.filter(voice => typeof voice === 'string') : [];
  const signature = voices.join('|');
  if (voices.length) {
    if (signature !== voiceListSignature) {
      voiceSelect.replaceChildren(...voices.map(voice => new Option(TTS_VOICE_NAMES[voice] || voice, voice)));
      voiceListSignature = signature;
    }
    const chosen = selectedVoice || tts?.voice;
    if (chosen && voices.includes(chosen) && document.activeElement !== voiceSelect) voiceSelect.value = chosen;
    voiceSelect.disabled = false;
    return;
  }
  const message = tts?.status === 'error' ? 'ZeroTTS chưa sẵn sàng' : 'Đang tải danh sách giọng…';
  if (voiceSelect.options.length !== 1 || voiceSelect.options[0]?.value !== '') voiceSelect.replaceChildren(new Option(message, ''));
  else voiceSelect.options[0].text = message;
  voiceSelect.disabled = true;
  voiceListSignature = '';
}

const MUSIC_TRACKS = [
  { id: 'sanctuary', label: 'Đàn organ nhà nguyện' },
  { id: 'morning-grace', label: 'Bình minh ân sủng' },
  { id: 'candlelight', label: 'Tĩnh lặng bên ánh nến' },
  { id: 'garden-peace', label: 'Vườn bình an' },
  { id: 'gentle-dawn', label: 'Sớm mai bình an' },
  { id: 'still-waters', label: 'Dòng nước tĩnh lặng' }
];

const PRAYER_PRESETS: Record<string, string> = {
  family: 'Lạy Chúa, xin gìn giữ gia đình trong bình an, yêu thương và hiệp nhất.',
  health: 'Lạy Chúa, xin nâng đỡ những người đau yếu; ban sức mạnh, hy vọng và bình an cho họ.',
  wisdom: 'Xin Chúa Thánh Thần soi sáng để chúng con biết chọn điều thiện và bước đi trong khôn ngoan.',
  comfort: 'Xin Chúa ở gần những người đang cô đơn, mất mát hoặc gặp khó khăn; xin an ủi và nâng đỡ họ.',
  remembrance: 'Lạy Chúa, xin đón nhận người thân đã qua đời vào vòng tay yêu thương và ban bình an cho gia đình.',
  gratitude: 'Tạ ơn Chúa vì hồng ân sự sống, gia đình và những điều tốt đẹp hôm nay.'
};

const text = (id: string, value: unknown): void => {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? '');
};

const inputValue = (id: string): string => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value.trim() || '';

function setStatus(id: string, message: string, isError = false): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'ok';
}

function selectedViewer(): Viewer | undefined {
  const uniqueId = inputValue('simulatedChatUser');
  return latestState?.roomViewers?.find(viewer => viewer.uniqueId === uniqueId);
}

function formatDuration(startedAt?: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Number(startedAt || Date.now())) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderSession(state: ChristianState): void {
  const session = state.liveSession;
  const connected = Boolean(state.tiktok?.connected);
  const newSession = document.getElementById('btnNewLiveSession') as HTMLButtonElement | null;
  if (newSession) newSession.disabled = !connected;
  if (session?.active) {
    text('liveSessionDuration', formatDuration(session.startedAt));
    text('liveSessionViewers', Number(session.peakViewers || 0).toLocaleString('vi-VN'));
    text('liveSessionInteractions', [session.comments, session.likes, session.follows, session.shares].reduce((sum, value) => sum + Number(value || 0), 0).toLocaleString('vi-VN'));
    text('liveSessionCoins', Number(session.coins || 0).toLocaleString('vi-VN'));
    text('liveSessionStats', `Phiên @${session.username || state.tiktok?.username || 'TikTok'} · ${Number(session.prayerRequests || 0)} lời nguyện · ${Number(session.scriptureShares || 0)} suy ngẫm · ${Number(session.thanksgiving || 0)} tri ân.`);
  } else {
    text('liveSessionDuration', '0:00:00');
    text('liveSessionViewers', '0');
    text('liveSessionInteractions', '0');
    text('liveSessionCoins', '0');
    text('liveSessionStats', connected ? 'Đang kết nối TikTok; mở phiên để bắt đầu thống kê.' : 'Thống kê chỉ tính phiên TikTok thật.');
  }
  const history = document.getElementById('liveSessionHistory');
  if (!history) return;
  const sessions = state.liveSessions || [];
  if (!sessions.length) { history.innerHTML = '<li class="helper">Chưa có phiên trước.</li>'; return; }
  history.innerHTML = sessions.slice(0, 5).map(item => {
    const date = item.startedAt ? new Date(item.startedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Phiên trước';
    return `<li><strong>${escapeHtml(item.username || 'TikTok')}</strong> · ${escapeHtml(date)} · ${Number(item.coins || 0).toLocaleString('vi-VN')} xu</li>`;
  }).join('');
}

function renderActivity(events: Array<Record<string, any>> = []): void {
  const feed = document.getElementById('eventFeed');
  if (!feed) return;
  const signature = JSON.stringify(events.slice(0, 8).map(event => [event.id, event.type, event.user, event.timestamp, event.reference, event.wish, event.giftName]));
  if (signature === eventFeedSignature) return;
  eventFeedSignature = signature;
  if (!events.length) { feed.innerHTML = '<p class="helper">Chưa có tương tác trong phiên này.</p>'; return; }
  feed.innerHTML = events.slice(0, 8).map(event => {
    const kinds: Record<string, string> = { prayer: 'Lời cầu nguyện', scripture: 'Suy ngẫm Kinh Thánh', gift: 'Quà tặng', candle: 'Thắp nến', bell: 'Chuông thánh đường', communion: 'Hiệp thông đại lễ', peace: 'Lời chúc bình an', thanksgiving: 'Tri ân hồng ân', welcome: 'Chào đón' };
    const kind = kinds[event.type] || 'Hoạt động';
    const detail = event.type === 'prayer' ? event.wish : event.type === 'scripture' ? event.reference : event.type === 'gift' ? `${event.giftName || 'Quà'} · ${Number(event.coins || 0).toLocaleString('vi-VN')} xu` : '';
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';
    return `<article class="event-feed-item"><span class="event-feed-icon" aria-hidden="true">${event.type === 'scripture' ? '✝' : event.type === 'gift' ? '✧' : '♡'}</span><span class="event-feed-content"><span class="event-feed-copy"><strong>${escapeHtml(event.user || 'Khách xem')}</strong> · ${kind}${detail ? `: ${escapeHtml(detail)}` : ''}</span><time>${escapeHtml(time)}</time></span></article>`;
  }).join('');
}

function syncDock(state: ChristianState): void {
  const connected = Boolean(state.tiktok?.connected);
  const connecting = Boolean(state.tiktok?.connecting);
  const status = connected ? `Đã kết nối @${state.tiktok?.username || 'TikTok'} · ${Number(state.tiktok?.viewerCount || 0).toLocaleString('vi-VN')} người xem.`
    : connecting ? `Đang kết nối @${state.tiktok?.username || ''}…` : 'Chưa kết nối TikTok.';
  setStatus('tiktokStatus', status);
  setStatus('liveConnectionStatus', status);
  const error = state.tiktok?.lastError || '';
  setStatus('tiktokError', error, Boolean(error));
  setStatus('liveConnectionError', error, Boolean(error));
  const connectButton = document.getElementById('btnConnectTikTok') as HTMLButtonElement | null;
  const disconnectButton = document.getElementById('btnDisconnectTikTok') as HTMLButtonElement | null;
  if (connectButton) connectButton.disabled = connected || connecting;
  if (disconnectButton) disconnectButton.disabled = !connected && !connecting;
  const username = document.getElementById('tiktokUsername') as HTMLInputElement | null;
  if (username && document.activeElement !== username && state.tiktok?.username) username.value = state.tiktok.username;

  const simulated = Number(state.simulatedViewerCount || 0);
  const totalRoom = state.roomViewers?.length || 0;
  setStatus('simulatedViewersStatus', simulated ? `Đang có ${simulated} người test · ${totalRoom}/200 chỗ đang dùng.` : 'Chưa có người giả lập.');
  const chatUser = document.getElementById('simulatedChatUser') as HTMLSelectElement | null;
  if (chatUser) {
    const selected = chatUser.value;
    const simulatedUsers = (state.roomViewers || []).filter(viewer => String(viewer.uniqueId || '').startsWith('simulation_christian_'));
    const signature = simulatedUsers.map(viewer => viewer.uniqueId).join('|');
    if (chatUser.dataset.users !== signature) {
      chatUser.replaceChildren(...simulatedUsers.map(viewer => new Option(viewer.name || 'Khách test', viewer.uniqueId || '')));
      if (!simulatedUsers.length) chatUser.add(new Option('Tạo người test trước', ''));
      if (simulatedUsers.some(viewer => viewer.uniqueId === selected)) chatUser.value = selected;
      chatUser.dataset.users = signature;
    }
    chatUser.disabled = !simulatedUsers.length;
    const send = document.getElementById('btnSimulateChat') as HTMLButtonElement | null;
    if (send) send.disabled = !simulatedUsers.length;
  }

  const settings = state.settings || {};
  const syncInput = (id: string, value: string): void => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (element && document.activeElement !== element) element.value = value;
  };
  syncVoiceSelect(state.tts, settings.ttsVoice);
  syncInput('christianMusicTrack', settings.musicTrack || 'sanctuary');
  const voiceToggle = document.getElementById('btnToggleTts');
  if (voiceToggle) { voiceToggle.textContent = `Giọng đọc: ${settings.ttsEnabled === false ? 'TẮT' : 'BẬT'}`; voiceToggle.classList.toggle('active-toggle', settings.ttsEnabled !== false); }
  const musicToggle = document.getElementById('btnToggleMusic');
  if (musicToggle) { musicToggle.textContent = `Nhạc nền: ${settings.bgMusicEnabled ? 'BẬT' : 'TẮT'}`; musicToggle.classList.toggle('active-toggle', Boolean(settings.bgMusicEnabled)); }
  const pauseToggle = document.getElementById('btnPausePresentation');
  if (pauseToggle) { pauseToggle.textContent = settings.presentationPaused ? 'Tiếp tục hiệu ứng / âm thanh' : 'Tạm dừng hiệu ứng / âm thanh'; pauseToggle.classList.toggle('active-toggle', Boolean(settings.presentationPaused)); }
  const ttsVolume = Math.max(0, Math.min(100, Math.round(Number(settings.ttsVolume ?? 0.95) * 100)));
  const musicVolume = Math.max(0, Math.min(50, Math.round(Number(settings.bgMusicVolume ?? 0.18) * 100)));
  syncInput('christianTtsVolume', String(ttsVolume));
  syncInput('christianMusicVolume', String(musicVolume));
  text('christianTtsVolumeValue', `${ttsVolume}%`);
  text('christianMusicVolumeValue', `${musicVolume}%`);
  const autoRotate = document.getElementById('christianMusicAutoRotate') as HTMLInputElement | null;
  if (autoRotate && document.activeElement !== autoRotate) autoRotate.checked = Boolean(settings.musicAutoRotate);
  audio.ttsVoice = settings.ttsVoice || 'maichi';
  audio.applyRemoteSettings(settings);
  if (settings.presentationPaused) { ritualEffects.clear(); ritualPresentation.clear(); }
  audio.setTtsVolume(ttsVolume / 100);
  audio.setMusicVolume(musicVolume / 100);
  audio.bgAudio.loop = !settings.musicAutoRotate;
  audio.setMusicSource(`/assets/thien-chua-giao/music/${settings.musicTrack || 'sanctuary'}.wav`);
  renderSession(state);
  renderActivity(state.recentEvents || []);
}

function avatarMarkup(viewer: Viewer): string {
  if (viewer.avatar) return `<img src="${escapeHtml(viewer.avatar)}" alt="" loading="lazy">`;
  return escapeHtml(String(viewer.name || '✝').trim().charAt(0).toLocaleUpperCase('vi'));
}

function christianViewerKey(viewer: Viewer): string {
  return String(viewer.uniqueId || viewer.name || '').trim().toLocaleLowerCase('vi');
}

function christianCharacterAsset(viewer: Viewer): string {
  const isWoman = viewer.character === 'woman';
  return `/assets/thien-chua-giao/characters/tin-huu-${isWoman ? 'nu' : 'nam'}.png`;
}

function christianWalkSheet(viewer: Viewer): string {
  return `/assets/thien-chua-giao/characters/tin-huu-${viewer.character === 'woman' ? 'nu' : 'nam'}-di-8-khung.png`;
}

function updateAttendeeIdentity(node: HTMLElement, viewer: Viewer): void {
  node.dataset.viewerId = String(viewer.uniqueId || '');
  node.dataset.viewerName = String(viewer.name || '').toLocaleLowerCase('vi');
  node.title = `${viewer.name || 'Người tham dự'}${viewer.uniqueId ? ` · @${viewer.uniqueId}` : ''}${String(viewer.uniqueId || '').startsWith('simulation_christian_') ? ' · Người giả lập' : ''}`;
  node.setAttribute('aria-label', node.title);
  const sprite = node.querySelector<HTMLImageElement>('.attendee-seat-sprite');
  if (sprite && sprite.dataset.character !== (viewer.character || 'man')) {
    sprite.src = christianCharacterAsset(viewer);
    sprite.dataset.character = viewer.character || 'man';
  }
  const bowSprite = node.querySelector<HTMLImageElement>('.attendee-bow-sprite');
  if (bowSprite && bowSprite.dataset.character !== (viewer.character || 'man')) {
    bowSprite.src = `/assets/thien-chua-giao/characters/tin-huu-${viewer.character === 'woman' ? 'nu' : 'nam'}-cui-dau-v1.png`;
    bowSprite.dataset.character = viewer.character || 'man';
  }
  const walkerSprite = node.querySelector<HTMLElement>('.attendee-walk-sprite');
  if (walkerSprite && walkerSprite.dataset.character !== (viewer.character || 'man')) {
    walkerSprite.style.backgroundImage = `url("${christianWalkSheet(viewer)}")`;
    walkerSprite.dataset.character = viewer.character || 'man';
  }
  const avatar = node.querySelector<HTMLElement>('.attendee-avatar');
  if (avatar) avatar.innerHTML = avatarMarkup(viewer);
  const name = node.querySelector<HTMLElement>('.attendee-name');
  if (name) name.textContent = viewer.name || 'Khách xem';
}

function createAttendee(viewer: Viewer, key: string, seat: ChristianSeat): HTMLElement {
  const attendee = document.createElement('div');
  attendee.className = 'attendee is-entering';
  attendee.dataset.viewerKey = key;
  attendee.tabIndex = 0;
  attendee.dataset.x = String(seat.x);
  attendee.dataset.y = String(seat.y);
  attendee.style.left = `${seat.x}px`;
  attendee.style.top = `${seat.y}px`;
  attendee.style.width = `${seat.width}px`;
  attendee.style.height = `${seat.height}px`;
  attendee.style.transform = 'translate(-50%, -100%)';
  attendee.style.zIndex = String(20 + seat.row * 3);

  const sprite = document.createElement('img');
  sprite.className = 'attendee-seat-sprite';
  sprite.src = christianCharacterAsset(viewer);
  sprite.dataset.character = viewer.character || 'man';
  sprite.alt = '';
  sprite.loading = 'lazy';
  const bowSprite = document.createElement('img');
  bowSprite.className = 'attendee-bow-sprite';
  bowSprite.src = `/assets/thien-chua-giao/characters/tin-huu-${viewer.character === 'woman' ? 'nu' : 'nam'}-cui-dau-v1.png`;
  bowSprite.dataset.character = viewer.character || 'man'; bowSprite.alt = '';
  bowSprite.loading = 'lazy';
  const identity = document.createElement('span');
  identity.className = 'attendee-identity';
  const avatar = document.createElement('span');
  avatar.className = 'attendee-avatar';
  const name = document.createElement('span');
  name.className = 'attendee-name';
  identity.append(avatar, name);
  attendee.append(sprite, bowSprite, identity);
  updateAttendeeIdentity(attendee, viewer);
  return attendee;
}

function startAttendeeArrival(viewer: Viewer, key: string, seat: ChristianSeat, seatIndex: number, attendee: HTMLElement): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !stage || latestState?.settings?.presentationPaused) {
    attendee.classList.remove('is-entering');
    attendee.classList.add('is-standing');
    ritualPresentation.addCrowd(attendee);
    return;
  }

  const walker = document.createElement('div');
  walker.className = 'attendee-walker';
  if (document.getElementById('attendeeLayer')?.classList.contains('is-crowded')) walker.classList.add('is-crowded');
  walker.setAttribute('aria-hidden', 'true');
  walker.dataset.viewerKey = key;
  walker.dataset.x = String(seat.x);
  walker.dataset.y = String(seat.y);
  walker.style.opacity = '0';
  walker.style.width = `${Math.max(seat.width, Math.round(seat.height * 0.75))}px`;
  walker.style.height = `${seat.height}px`;
  const sprite = document.createElement('div');
  sprite.className = 'attendee-walk-sprite';
  sprite.style.backgroundImage = `url("${christianWalkSheet(viewer)}")`;
  sprite.dataset.character = viewer.character || 'man';
  const identity = document.createElement('span');
  identity.className = 'attendee-identity';
  const avatar = document.createElement('span');
  avatar.className = 'attendee-avatar';
  const name = document.createElement('span');
  name.className = 'attendee-name';
  identity.append(avatar, name);
  walker.append(sprite, identity);
  updateAttendeeIdentity(walker, viewer);
  stage.append(walker);

  const toSeat = 'translate(-50%, -100%)';
  const aislePoint = Math.min(1740, Math.max(1490, seat.y + 100));
  const delay = seatIndex * 40;
  const animation = walker.animate([
    { left: '540px', top: '1840px', transform: 'translate(-50%, -100%) scale(1.08)', opacity: 0, offset: 0 },
    { left: '540px', top: '1700px', transform: 'translate(-50%, -100%) scale(1.02)', opacity: 1, offset: .18 },
    { left: '540px', top: `${aislePoint}px`, transform: 'translate(-50%, -100%) scale(.92)', opacity: 1, offset: .64 },
    { left: `${seat.x}px`, top: `${seat.y}px`, transform: toSeat, opacity: 1, offset: 1 }
  ], { duration: 2550, delay, easing: 'cubic-bezier(.42,0,.3,1)', fill: 'forwards' });
  attendeeArrivals.set(key, { walker, animation });
  void animation.finished.then(() => {
    if (attendeeArrivals.get(key)?.animation !== animation) return;
    attendeeArrivals.delete(key);
    walker.remove();
    attendee.classList.remove('is-entering');
    attendee.classList.add('is-standing');
    ritualPresentation.addCrowd(attendee);
  }).catch(() => {});
}

function renderAttendees(viewers: Viewer[] = []): void {
  const layer = document.getElementById('attendeeLayer');
  if (!layer) return;
  const validViewers = viewers.filter(viewer => christianViewerKey(viewer))
    .sort((a, b) => (a.seatIndex ?? CHRISTIAN_CAPACITY) - (b.seatIndex ?? CHRISTIAN_CAPACITY)
      || christianViewerKey(a).localeCompare(christianViewerKey(b)))
    .slice(0, CHRISTIAN_CAPACITY);
  const seats = christianLayoutForCount(validViewers.length);
  const crowded = validViewers.length > 24;
  layer.classList.toggle('is-crowded', crowded);
  const currentKeys = new Set(validViewers.map(christianViewerKey));
  for (const [key, node] of attendeeNodes) {
    if (currentKeys.has(key)) continue;
    const arrival = attendeeArrivals.get(key);
    arrival?.animation.cancel(); arrival?.walker.remove();
    attendeeArrivals.delete(key); node.remove(); attendeeNodes.delete(key);
  }
  validViewers.forEach((viewer, ordinal) => {
    const key = christianViewerKey(viewer);
    const seat = seats[ordinal];
    let attendee = attendeeNodes.get(key);
    if (!attendee) {
      attendee = createAttendee(viewer, key, seat);
      attendee.classList.toggle('is-crowded', crowded);
      layer.append(attendee); attendeeNodes.set(key, attendee);
      startAttendeeArrival(viewer, key, seat, ordinal, attendee);
    } else {
      const moved = attendee.dataset.x !== String(seat.x) || attendee.dataset.y !== String(seat.y)
        || attendee.style.height !== `${seat.height}px`;
      if (moved) {
        const arrival = attendeeArrivals.get(key);
        arrival?.animation.cancel(); arrival?.walker.remove(); attendeeArrivals.delete(key);
        attendee.classList.remove('is-entering'); attendee.classList.add('is-standing');
        attendee.dataset.x = String(seat.x); attendee.dataset.y = String(seat.y);
        attendee.style.left = `${seat.x}px`; attendee.style.top = `${seat.y}px`;
        attendee.style.width = `${seat.width}px`; attendee.style.height = `${seat.height}px`;
        attendee.style.zIndex = String(20 + seat.row * 3);
      }
      attendee.classList.toggle('is-crowded', crowded);
      updateAttendeeIdentity(attendee, viewer);
      const walker = attendeeArrivals.get(key)?.walker;
      if (walker) updateAttendeeIdentity(walker, viewer);
      ritualPresentation.addCrowd(attendee);
    }
  });
}

function renderSupporters(supporters: Viewer[] = []): void {
  const list = document.getElementById('supporterList');
  if (!list) return;
  const signature = JSON.stringify(supporters.slice(0, 4).map(viewer => [viewer.uniqueId, viewer.name, viewer.avatar, viewer.coins, viewer.lastGift]));
  if (signature === supporterSignature) return;
  supporterSignature = signature;
  if (!supporters.length) {
    list.innerHTML = '<li class="supporter-empty">Cảm ơn bạn đã hiện diện</li>';
    return;
  }
  list.innerHTML = supporters.slice(0, 4).map(viewer => `<li><span class="supporter-avatar">${avatarMarkup(viewer)}</span><span>${escapeHtml(viewer.name || 'Khách xem')}</span><b>${Number(viewer.coins || 0).toLocaleString('vi-VN')} xu</b></li>`).join('');
}

function updateCentralPerson(viewer: Viewer, action: string): void {
  const person = document.getElementById('prayerPerson') as HTMLImageElement | null;
  const character = viewer.character || 'man';
  if (person) person.src = `/assets/thien-chua-giao/characters/${character === 'woman' ? 'tin-huu-nu' : 'tin-huu-nam'}.png`;
  text('centralPrayerName', viewer.name || 'Người tham dự');
  text('centralPrayerAction', action);
  const avatar = document.getElementById('centralPrayerAvatar');
  if (avatar) avatar.innerHTML = avatarMarkup(viewer);
  const tag = document.getElementById('prayerNameTag');
  if (tag) tag.hidden = false;
}

function updateState(state: ChristianState): void {
  latestState = state;
  const background = document.getElementById('stageBackground') as HTMLImageElement | null;
  if (background && state.settings?.stageBackgroundUrl && background.getAttribute('src') !== state.settings.stageBackgroundUrl) {
    background.src = state.settings.stageBackgroundUrl;
  }
  const prayerCount = Number(state.totalPrayerRequests || 0);
  text('statPrayer', `${prayerCount.toLocaleString('vi-VN')} lời nguyện`);
  const liveViewerCount = state.tiktok?.connected ? Number(state.tiktok.viewerCount || 0) : 0;
  text('statViewers', `${liveViewerCount.toLocaleString('vi-VN')} người xem`);
  text('hudPrayerCount', `${prayerCount.toLocaleString('vi-VN')} lời nguyện`);
  text('hudScriptureCount', `${Number(state.totalScriptureShares || 0).toLocaleString('vi-VN')} chia sẻ`);
  text('hudGiftCount', `${(Number(state.totalThanksgiving || 0) + Number(state.totalGiftThanks || 0)).toLocaleString('vi-VN')} lời cảm tạ`);
  document.body.classList.toggle('is-connected', Boolean(state.tiktok?.connected));
  renderAttendees(state.roomViewers || []);
  renderSupporters(state.supporters || []);
  syncDock(state);
  if (state.playback) playback.sync(state.playback);
}

type Arrival = Viewer & { user?: string; greeting?: string };
const arrivalQueue: Arrival[] = [];
function showNextMember(): void {
  const viewer = arrivalQueue.shift();
  if (!viewer) { memberTimer = 0; return; }
  text('arrivalName', viewer.name || viewer.user || 'Khách xem');
  text('arrivalGreeting', viewer.greeting || '');
  const avatar = document.getElementById('arrivalAvatar');
  if (avatar) avatar.innerHTML = avatarMarkup(viewer);
  const card = document.getElementById('memberArrival');
  card?.classList.add('visible');
  memberTimer = window.setTimeout(() => {
    card?.classList.remove('visible');
    memberTimer = window.setTimeout(showNextMember, 200);
  }, 4600);
}
function showMember(viewer: Arrival): void {
  if (latestState?.settings?.presentationPaused) return;
  if (arrivalQueue.length >= 200) return;
  arrivalQueue.push(viewer);
  if (!memberTimer) showNextMember();
}

function showChat(data: Viewer & { comment?: string; user?: string }): void {
  const layer = document.getElementById('chatLayer');
  if (!layer) return;
  const bubble = document.createElement('div');
  bubble.className = 'christian-chat-bubble';
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  avatar.innerHTML = avatarMarkup({ name: data.name || data.user, avatar: data.avatar });
  const copy = document.createElement('span');
  copy.className = 'chat-copy';
  const name = document.createElement('strong');
  name.textContent = data.name || data.user || 'Khách xem';
  const message = document.createElement('span');
  message.textContent = data.comment || '';
  copy.append(name, message);
  bubble.append(avatar, copy);
  const attendeeLayer = document.getElementById('attendeeLayer');
  const attendees = Array.from(attendeeLayer?.querySelectorAll<HTMLElement>('.attendee') || []);
  const sender = attendees.find(item => (data.uniqueId && item.dataset.viewerId === data.uniqueId)
    || (item.dataset.viewerName || '').toLocaleLowerCase('vi') === String(data.name || data.user || '').toLocaleLowerCase('vi'));
  bubble.style.left = sender ? `${Math.max(24, Math.min(540, Number(sender.dataset.x || 0) - 130))}px` : '36px';
  bubble.style.top = sender ? `${Math.max(180, Number(sender.dataset.y || 0) - 300)}px` : `${210 + (layer.children.length % 3) * 125}px`;
  if (sender) { bubble.classList.add('is-attached'); sender.classList.add('is-chatting'); }
  layer.appendChild(bubble);
  while (layer.children.length > 3) layer.firstElementChild?.remove();
  const timer = window.setTimeout(() => { bubble.remove(); sender?.classList.remove('is-chatting'); }, 7200);
  chatTimers.push(timer);
}

function showPrayer(event: Record<string, any>): void {
  const name = String(event.user || 'Người tham dự');
  const wish = String(event.wish || 'Xin cầu nguyện cho gia đình được bình an.');
  activeUser = name;
  text('messageKicker', 'LỜI CẦU NGUYỆN');
  text('messageTitle', name);
  text('messageBody', wish);
  text('activeKicker', 'CÙNG HIỆP THÔNG');
  text('activeUser', wish);
  const viewer = latestState?.roomViewers?.find(item => item.uniqueId === event.uniqueId);
  updateCentralPerson({ name, avatar: event.avatar || viewer?.avatar, uniqueId: event.uniqueId, character: event.character || viewer?.character }, 'ĐANG CẦU NGUYỆN');
  const figure = document.getElementById('prayerFigure');
  figure?.classList.remove('is-walking', 'is-praying');
  void figure?.getBoundingClientRect();
  figure?.classList.add('is-walking');
  prayerTimer = window.setTimeout(() => { figure?.classList.remove('is-walking'); figure?.classList.add('is-praying'); }, Math.max(0, 2200 - Number(event.elapsedMs || 0)));
}

function showScripture(event: Record<string, any>): void {
  text('messageKicker', [event.theme || 'LỜI SUY NGẪM', event.reference].filter(Boolean).join(' · ').toLocaleUpperCase('vi'));
  text('messageTitle', event.title || event.reference || 'Lời suy ngẫm');
  text('messageBody', event.reflection || 'Một phút cùng nhau suy ngẫm trong bình an.');
  text('activeKicker', 'LỜI SUY NGẪM');
  text('activeUser', String(event.user || 'Người tham dự') + ' · ' + String(event.reference || ''));
  updateCentralPerson({ name: String(event.user || 'Người tham dự'), avatar: event.avatar, uniqueId: event.uniqueId, character: event.character }, 'ĐANG SUY NGẪM');
}

function playSpeech(event: Record<string, any>): void {
  if (!event.ttsUrl || latestState?.settings?.ttsEnabled === false || latestState?.settings?.presentationPaused) return;
  const eventId = String(event.id || '');
  if (!eventId || eventId === lastSpeechId) return;
  lastSpeechId = eventId;
  audio.enqueueTts(String(event.ttsText || ''), { voice: event.ttsVoice || latestState?.settings?.ttsVoice || 'maichi', url: event.ttsUrl, startsAt: event.speechStartsAt ?? event.startsAt });
}

function handleEvent(event: Record<string, any>): void {
  if (!event || (event.id && event.id === lastMessageId)) return;
  if (event.id) lastMessageId = event.id;
  ritualEffects.show(event, (latestState?.settings as Record<string, any>)?.sfxEnabled !== false);
  if (event.type === 'prayer') showPrayer(event);
  if (event.type === 'scripture') showScripture(event);
  if (event.type === 'gift') {
    text('activeKicker', 'LỜI CẢM TẠ');
    text('activeUser', `${event.user || 'Người gửi'} gửi ${event.giftName || 'món quà'} · xin cảm ơn`);
    updateCentralPerson({ name: String(event.user || 'Người gửi'), avatar: event.avatar, uniqueId: event.uniqueId, character: event.character }, 'LỜI CẢM TẠ');
  }
  if (event.type === 'announcement') { text('activeKicker', 'THÔNG ĐIỆP'); text('activeUser', String(event.ttsText || 'Lời nhắn từ người điều hành')); }
  const labels: Record<string, string> = { candle: 'THẮP NẾN TẠ ƠN', bell: 'CHUÔNG THÁNH ĐƯỜNG', communion: 'HIỆP THÔNG ĐẠI LỄ', peace: 'BÌNH AN CHO BẠN', thanksgiving: 'TRI ÂN HỒNG ÂN', welcome: 'CHÀO ĐÓN TÂN KHÁCH' };
  if (labels[event.type]) {
    text('messageKicker', labels[event.type]);
    text('messageTitle', event.user || 'Cộng đoàn');
    text('messageBody', event.ttsText || '');
    text('activeKicker', labels[event.type]);
    text('activeUser', event.user || 'Cộng đoàn');
    if (event.type === 'welcome') showMember({ ...event, greeting: event.ttsText });
  }
  ritualPresentation.show(event);
  playSpeech(event);
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (!window.TempleAuth?.getToken()) {
    retryTimer = window.setTimeout(connect, 4500);
    return;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${scheme}//${window.location.host}/ws?profile=thien-chua-giao`);
  ws.onopen = () => ws?.send(JSON.stringify({ jsonrpc: '2.0', method: 'auth', params: { token: window.TempleAuth.getToken() } }));
  ws.onmessage = message => {
    try {
      const packet = JSON.parse(message.data);
      const data = packet.params || {};
      stateRevision++;
      switch (packet.method) {
        case 'christian.state': updateState(data); break;
        case 'christian.playback': playback.sync(data); break;
        case 'christian.viewerCount':
          if (latestState) updateState({ ...latestState, tiktok: { ...latestState.tiktok, viewerCount: data.viewerCount }, liveSession: data.liveSession });
          break;
        case 'tts.status':
          if (latestState) updateState({ ...latestState, tts: data });
          break;
        case 'christian.member': showMember(data); break;
        case 'christian.chat': showChat(data); break;
        case 'christian.prayer': showPrayer(data); break;
        case 'christian.scripture': showScripture(data); break;
        case 'christian.thanks':
          text('activeKicker', 'LỜI CẢM TẠ');
          text('activeUser', `${data.supporter?.name || 'Người gửi'} gửi ${data.giftName || 'món quà'} · xin cảm ơn`);
          updateCentralPerson({ name: data.supporter?.name || 'Người gửi', avatar: data.supporter?.avatar, uniqueId: data.supporter?.uniqueId }, 'LỜI CẢM TẠ');
          break;
        case 'christian.event':
          if (data.state) updateState(data.state);
          if (data.playback) playback.sync({ ...latestState?.playback, current: data.playback, paused: Boolean(latestState?.settings?.presentationPaused), pendingCount: latestState?.playback?.pendingCount || 0, preparing: false });
          break;
        case 'christian.speech':
          if (data.playback) playback.sync({ ...latestState?.playback, current: data.playback, paused: Boolean(latestState?.settings?.presentationPaused), pendingCount: latestState?.playback?.pendingCount || 0, preparing: false });
          if (data.event) playSpeech({ ...data.event, startsAt: data.startsAt || data.playback?.startsAt });
          break;
        case 'christian.activity':
          if (data.type === 'notice') { showChat({ ...data, comment: data.message }); break; }
          if (data.type === 'like') showChat({ ...data, user: data.user, comment: `đã gửi ${Number(data.count || 1)} lượt thích ♥` });
          else if (data.type === 'follow') showChat({ ...data, user: data.user, comment: 'đã theo dõi buổi cầu nguyện.' });
          else if (data.type === 'share') showChat({ ...data, user: data.user, comment: 'đã chia sẻ buổi Live.' });
          break;
      }
    } catch (error) { console.warn('[Christian live event]', error); }
  };
  ws.onclose = event => {
    ws = null;
    if (event.code === 4401) {
      window.TempleAuth.logout();
      return;
    }
    retryTimer = window.setTimeout(connect, window.TempleAuth.getToken() ? 3000 : 4500);
  };
}

async function refreshState(): Promise<void> {
  if (!window.TempleAuth?.getToken()) return;
  const revision = stateRevision;
  try { const state = await rpc('christian.getState'); if (revision === stateRevision) updateState(state); } catch (_) {}
}

async function updateSettings(patch: Record<string, unknown>): Promise<void> {
  updateState(await rpc('christian.updateSettings', patch));
}

async function loadControls(): Promise<void> {
  try {
    const config = await rpc('christian.voiceConfig');
    if (Array.isArray(config.scriptures)) scriptureControls.load(config.scriptures);
  } catch (_) { setStatus('ritualStatus', 'Cần xác thực RPC để tải danh sách Kinh Thánh.', true); }
  try {
    const status = await rpc('christian.ttsStatus');
    syncVoiceSelect(status, latestState?.settings?.ttsVoice);
    setStatus('voiceStatus', status.ready
      ? `ZeroTTS sẵn sàng · ${status.voices?.length || 0} giọng.`
      : status.lastError || 'ZeroTTS đang tải; danh sách sẽ hiện khi sẵn sàng.');
  } catch (_) {
    syncVoiceSelect({ ready: false, status: 'auth', voices: [] });
    setStatus('voiceStatus', 'Cần xác thực RPC để kiểm tra giọng đọc.', true);
  }
}

function initControls(): void {
  document.getElementById('christianPrayerPreset')?.addEventListener('change', event => {
    const preset = (event.currentTarget as HTMLSelectElement).value;
    const wish = PRAYER_PRESETS[preset];
    if (wish) (document.getElementById('prayerWish') as HTMLTextAreaElement).value = wish;
  });
  document.getElementById('btnUnlockAudio')?.addEventListener('click', () => {
    try { audio.ensureContext(); setStatus('musicStatus', 'Âm thanh đã sẵn sàng trong trình duyệt.'); }
    catch (_) { toast('Trình duyệt chưa cho phép bật âm thanh. Hãy thử bấm lại.'); }
  });
  document.getElementById('btnSendPrayer')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await rpc('christian.sendPrayer', { user: inputValue('prayerUser') || 'Người điều hành', uniqueId: `operator-${Date.now()}`, wish: inputValue('prayerWish') });
      setStatus('ritualStatus', 'Đã nhận và xếp lượt; theo dõi trạng thái đang chờ/đang phát.');
      await refreshState();
    } catch (error) { setStatus('ritualStatus', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnShareScripture')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await rpc('christian.shareScripture', { user: inputValue('prayerUser') || 'Người điều hành', uniqueId: `operator-${Date.now()}`, reference: inputValue('scriptureReference'), reflection: inputValue('scriptureReflection') });
      setStatus('ritualStatus', 'Đã nhận và xếp lượt; theo dõi trạng thái đang chờ/đang phát.');
      await refreshState();
    } catch (error) { setStatus('ritualStatus', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnQuickPrayer')?.addEventListener('click', async () => {
    try {
      await rpc('christian.sendPrayer', { user: inputValue('prayerUser') || 'Người điều hành', uniqueId: `operator-${Date.now()}`, wish: 'Xin Chúa ban bình an và sự chở che đến cho mọi người.' });
      setStatus('ritualStatus', 'Đã nhận và xếp lượt; theo dõi trạng thái đang chờ/đang phát.');
      await refreshState();
    } catch (error) { setStatus('ritualStatus', error.message, true); }
  });
  document.getElementById('btnQuickScripture')?.addEventListener('click', async () => {
    try {
      await rpc('christian.shareScripture', { user: inputValue('prayerUser') || 'Người điều hành', reference: inputValue('scriptureReference'), reflection: inputValue('scriptureReflection') });
      setStatus('ritualStatus', 'Đã nhận và xếp lượt; theo dõi trạng thái đang chờ/đang phát.');
      await refreshState();
    } catch (error) { setStatus('ritualStatus', error.message, true); }
  });
  const quickActions: Record<string, string> = {
    btnQuickCandle: 'christian.lightCandle', btnQuickBell: 'christian.ringBell',
    btnQuickThanks: 'christian.giveThanks', btnQuickChoir: 'christian.communion',
    btnQuickPeace: 'christian.blessPeace', btnQuickWelcome: 'christian.previewMember'
  };
  for (const [id, method] of Object.entries(quickActions)) {
    document.getElementById(id)?.addEventListener('click', async event => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      try {
        await rpc(method, { user: inputValue('prayerUser') || 'Người điều hành' });
        await refreshState();
        setStatus('ritualStatus', 'Đã xếp lượt tương tác, đồng bộ sang Live và OBS.');
      } catch (error) { setStatus('ritualStatus', error.message, true); }
      finally { button.disabled = false; }
    });
  }
  document.getElementById('btnSimulateViewers')?.addEventListener('click', async () => {
    const count = Number((document.getElementById('simulatedViewerCount') as HTMLInputElement | null)?.value);
    try { updateState(await rpc('christian.setSimulatedViewers', { count })); }
    catch (error) { setStatus('simulatedViewersStatus', error.message, true); }
  });
  document.getElementById('btnClearSimulatedViewers')?.addEventListener('click', async () => {
    try { updateState(await rpc('christian.setSimulatedViewers', { count: 0 })); }
    catch (error) { setStatus('simulatedViewersStatus', error.message, true); }
  });
  document.getElementById('btnPreviewMember')?.addEventListener('click', async () => {
    try { await rpc('christian.previewMember', { user: inputValue('prayerUser') || 'Khách hữu duyên' }); await refreshState(); }
    catch (error) { setStatus('ritualStatus', error.message, true); }
  });
  document.getElementById('btnSimulateChat')?.addEventListener('click', async () => {
    const viewer = selectedViewer();
    if (!viewer) { setStatus('simulatedChatStatus', 'Tạo người test trước nhé.', true); return; }
    try {
      await rpc('christian.previewChat', { uniqueId: viewer.uniqueId, user: viewer.name || 'Khách test', avatar: viewer.avatar, comment: inputValue('simulatedChatText') });
      setStatus('simulatedChatStatus', `Đã gửi chat thử từ ${viewer.name || 'Khách test'}.`);
      await refreshState();
    } catch (error) { setStatus('simulatedChatStatus', error.message, true); }
  });
  document.getElementById('btnToggleTts')?.addEventListener('click', async () => {
    try { await updateSettings({ ttsEnabled: latestState?.settings?.ttsEnabled === false }); }
    catch (error) { setStatus('voiceStatus', error.message, true); }
  });
  document.getElementById('btnToggleMusic')?.addEventListener('click', async () => {
    try {
      audio.ensureContext();
      await updateSettings({ bgMusicEnabled: !latestState?.settings?.bgMusicEnabled });
    } catch (error) { setStatus('musicStatus', error.message, true); }
  });
  document.getElementById('btnPausePresentation')?.addEventListener('click', async () => {
    try { await updateSettings({ presentationPaused: !latestState?.settings?.presentationPaused }); }
    catch (error) { toast(error.message); }
  });
  document.getElementById('christianVoiceSelect')?.addEventListener('change', async event => {
    try { await updateSettings({ ttsVoice: (event.currentTarget as HTMLSelectElement).value }); }
    catch (error) { setStatus('voiceStatus', error.message, true); }
  });
  document.getElementById('christianMusicTrack')?.addEventListener('change', async event => {
    const musicTrack = (event.currentTarget as HTMLSelectElement).value;
    try { await updateSettings({ musicTrack }); }
    catch (error) { setStatus('musicStatus', error.message, true); }
  });
  document.getElementById('btnPreviewMusic')?.addEventListener('click', async () => {
    const player = document.getElementById('christianMusicPreview') as HTMLAudioElement;
    const track = inputValue('christianMusicTrack') || 'sanctuary';
    player.src = `/assets/thien-chua-giao/music/${track}.wav`;
    player.hidden = false;
    try { await player.play(); setStatus('musicStatus', 'Đang nghe thử trên thiết bị này.'); }
    catch (_) { setStatus('musicStatus', 'Trình duyệt chặn phát thử. Bấm Bật âm thanh buổi Live rồi thử lại.', true); }
  });
  document.getElementById('btnNextMusic')?.addEventListener('click', async () => {
    const current = inputValue('christianMusicTrack') || MUSIC_TRACKS[0].id;
    const index = MUSIC_TRACKS.findIndex(track => track.id === current);
    const next = MUSIC_TRACKS[(index + 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length];
    try { await updateSettings({ musicTrack: next.id }); setStatus('musicStatus', `Đã chọn: ${next.label}.`); }
    catch (error) { setStatus('musicStatus', error.message, true); }
  });
  document.getElementById('christianMusicAutoRotate')?.addEventListener('change', async event => {
    const musicAutoRotate = (event.currentTarget as HTMLInputElement).checked;
    audio.bgAudio.loop = !musicAutoRotate;
    try { await updateSettings({ musicAutoRotate }); }
    catch (error) { setStatus('musicStatus', error.message, true); }
  });
  document.getElementById('christianMusicVolume')?.addEventListener('input', event => {
    const volume = Number((event.currentTarget as HTMLInputElement).value);
    text('christianMusicVolumeValue', `${volume}%`);
    audio.setMusicVolume(volume / 100);
  });
  document.getElementById('christianMusicVolume')?.addEventListener('change', async event => {
    try { await updateSettings({ bgMusicVolume: Number((event.currentTarget as HTMLInputElement).value) / 100 }); }
    catch (error) { setStatus('musicStatus', error.message, true); }
  });
  document.getElementById('christianTtsVolume')?.addEventListener('input', event => {
    const volume = Number((event.currentTarget as HTMLInputElement).value);
    text('christianTtsVolumeValue', `${volume}%`);
    audio.setTtsVolume(volume / 100);
  });
  document.getElementById('christianTtsVolume')?.addEventListener('change', async event => {
    try { await updateSettings({ ttsVolume: Number((event.currentTarget as HTMLInputElement).value) / 100 }); }
    catch (error) { setStatus('voiceStatus', error.message, true); }
  });
  document.getElementById('btnPreviewSpeech')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const message = inputValue('christianSpeechText');
    if (!message) { setStatus('voiceStatus', 'Nhập nội dung muốn nghe thử trước nhé.', true); return; }
    button.disabled = true;
    try {
      const speech = await rpc('christian.speak', { text: message, voice: inputValue('christianVoiceSelect'), broadcast: false });
      if (!speech?.ok || !speech.url) throw new Error(speech?.error || 'Không tạo được giọng đọc.');
      const player = document.getElementById('christianSpeechPreview') as HTMLAudioElement;
      if (player.dataset.blobUrl) URL.revokeObjectURL(player.dataset.blobUrl);
      const url = await window.TempleAuth.fetchAudioBlobUrl(speech.url);
      player.dataset.blobUrl = url; player.src = url; player.hidden = false;
      await player.play();
      setStatus('voiceStatus', 'Bản nghe thử chỉ phát trên thiết bị này.');
    } catch (error) { setStatus('voiceStatus', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnBroadcastSpeech')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const message = inputValue('christianSpeechText');
    if (!message) { setStatus('voiceStatus', 'Nhập nội dung muốn đọc trên Live.', true); return; }
    button.disabled = true;
    try {
      await rpc('christian.speak', { text: message, voice: inputValue('christianVoiceSelect'), broadcast: true });
      setStatus('voiceStatus', 'Đã đưa thông điệp vào hàng đợi đọc trên Live.');
    } catch (error) { setStatus('voiceStatus', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnConnectTikTok')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const username = inputValue('tiktokUsername').replace(/^@+/, '');
    if (!username) { setStatus('tiktokError', 'Nhập tên tài khoản TikTok muốn kết nối.', true); return; }
    button.disabled = true;
    setStatus('tiktokError', 'Đang kết nối phòng Live…');
    try { const state = await rpc('live.connect', { username }); if (state?.profileId) updateState(state); await refreshState(); }
    catch (error) { setStatus('tiktokError', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnDisconnectTikTok')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { const state = await rpc('live.disconnect'); if (state?.profileId) updateState(state); await refreshState(); setStatus('tiktokError', 'Đã ngắt kết nối TikTok.'); }
    catch (error) { setStatus('tiktokError', error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('btnNewLiveSession')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { updateState(await rpc('live.newSession')); }
    catch (error) { setStatus('liveSessionStats', error.message, true); }
    finally { button.disabled = !latestState?.tiktok?.connected; }
  });

  audio.bgAudio.addEventListener('ended', () => {
    if (!latestState?.settings?.musicAutoRotate) return;
    const current = latestState.settings.musicTrack || MUSIC_TRACKS[0].id;
    void rpc('christian.advanceMusic', { expectedTrack: current }).then(updateState).catch(error => setStatus('musicStatus', error.message, true));
  });
  audio.onTtsStateChange = state => setStatus('voiceStatus', state.speaking ? `Đang đọc: ${state.text}` : 'Giọng đọc tự phát theo lời cầu nguyện và Kinh Thánh.');
}

window.addEventListener('temple-auth-changed', () => {
  stateRevision++;
  if (!window.TempleAuth.getToken()) {
    if (retryTimer) window.clearTimeout(retryTimer);
    playback.stop();
    ws?.close(1000, 'Signed out');
    ws = null;
    latestState = null;
    window.clearTimeout(memberTimer); memberTimer = 0; arrivalQueue.length = 0;
    audio.applyRemoteSettings({ presentationPaused: true });
    return;
  }
  document.getElementById('authGate')?.removeAttribute('open');
  void refreshState();
  void loadControls();
  connect();
});
window.addEventListener('beforeunload', () => {
  playback.stop();
  if (retryTimer) window.clearTimeout(retryTimer);
  if (memberTimer) window.clearTimeout(memberTimer);
  if (sessionClockTimer) window.clearInterval(sessionClockTimer);
  chatTimers.forEach(window.clearTimeout);
  const preview = document.getElementById('christianSpeechPreview') as HTMLAudioElement | null;
  if (preview?.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
});

initControls();
if (window.TempleAuth?.getToken()) { void refreshState(); void loadControls(); }
connect();
window.setInterval(() => { void refreshState(); }, 12000);
sessionClockTimer = window.setInterval(() => {
  const session = latestState?.liveSession;
  if (session?.active) text('liveSessionDuration', formatDuration(session.startedAt));
}, 1000);
