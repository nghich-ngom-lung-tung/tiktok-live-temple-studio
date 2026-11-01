import { avatarMarkup, viewerKey, showViewerChat, clearViewerChats } from './viewerPresence';
import { initLiveOperations, syncLiveOperations } from './liveOperations';
import { ritualIcon } from './studioEffects';
import { VIP_CUSHION_COORDS, hallLayoutForCount } from './templeLayout';
import { syncVoiceControls } from './voiceControls';
import { bindMusicEngine, syncMusicControls } from './musicControls';
import './narrationControls';
import { initTabs, rpc, toast } from './studioShared';
initTabs();
initLiveOperations();
/**
 * Live 9:16 Client Controller — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Hiển thị 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Công Đức)
 * - Hiển thị 94 Phật Tử mặc áo lam quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng người xem bước dọc thảm đỏ lên trước Lư Hương Đồng dâng hương
 * - Giọng đọc ZeroTTS (Mai Chi) + Pháp khí Web Audio
 */
(function () {
  let presentationPaused = false;
  let playbackState: any = null;
  let latestUIState: any = null;
  let playbackStartTimer = 0;
  const playedCeremonies = new Set<string>();
  const ritualEffectTimers = new Set<number>();
  function effectLater(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => { ritualEffectTimers.delete(timer); if (!presentationPaused) callback(); }, delay);
    ritualEffectTimers.add(timer);
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('obs') === '1') {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const rect = stageWrapper.getBoundingClientRect();
    const scale = stageWrapper.clientWidth / 1080;
    stage9x16.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  if(stageWrapper) new ResizeObserver(fitStage).observe(stageWrapper);
  fitStage();

  // 2. Khởi tạo Particle Engine & Audio Engine (ZeroTTS Mai Chi)
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();
  bindMusicEngine(audio);
  const sfxStatus = document.getElementById('sfxStatus');
  const previewSfx = (id: string, label: string, play: () => void) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (presentationPaused || !audio.sfxEnabled) { toast('Bật pháp khí và tiếp tục hiệu ứng trước khi nghe thử.'); return; }
      audio.ensureContext();
      play();
      if (sfxStatus) sfxStatus.textContent = `Đang phát thử ${label}.`;
    });
  };
  previewSfx('btnTestWood', 'tiếng mõ gỗ mới', () => { void audio.playWoodenFish(); });
  previewSfx('btnTestBell', 'tiếng Đại Hồng Chung', () => audio.playTempleBell());
  previewSfx('btnTestFortune', 'tiếng lắc ống xăm', () => audio.playFortuneShake());
  document.getElementById('sfxVolume')?.addEventListener('input',e=>{audio.sfxVolume=Number((e.target as HTMLInputElement).value)/100;});
  document.getElementById('sfxVolume')?.addEventListener('change', event => {
    void rpc('temple.updateSettings', { sfxVolume: Number((event.target as HTMLInputElement).value) / 100 }).catch(error => toast(error.message));
  });
  const welcomeQueue: { user: string; uniqueId?: string }[] = [];
  const recentWelcome = new Map<string, number>();
  let welcoming = false;
  let welcomeTimer = 0;
  function showNextWelcome() {
    if(welcoming || !welcomeQueue.length) return;
    welcoming = true;
    const member = welcomeQueue.shift();
    document.getElementById('welcomeUser').textContent = member.user;
    document.getElementById('welcomeCard').classList.add('visible');
    welcomeTimer = window.setTimeout(()=>{ document.getElementById('welcomeCard').classList.remove('visible'); welcomeTimer = window.setTimeout(()=>{welcoming=false;showNextWelcome();},350); },4000);
  }
  function queueWelcome(member) {
    if(!member?.user) return;
    const key=String(member.uniqueId||member.user), now=Date.now();
    if(now-(recentWelcome.get(key)||0)<60000) return;
    recentWelcome.set(key,now);
    for(const [id,time] of recentWelcome) if(now-time>60000)recentWelcome.delete(id);
    if(welcomeQueue.length>=12)welcomeQueue.shift();
    welcomeQueue.push({user:String(member.user).slice(0,80),uniqueId:key});showNextWelcome();
  }
  document.getElementById('btnWelcomePreview')?.addEventListener('click',()=>{rpc('temple.previewWelcome',{user:(document.getElementById('inputDevoteeName') as HTMLInputElement).value||'Khách hữu duyên'}).catch(e=>toast(e.message));});

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = 'Âm thanh đã sẵn sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // 3. Vẽ các nén nhang đang cháy trong Lư Hương Đỉnh Đồng (x=540, y=895)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  let renderedStickCount = 0;

  function renderIncenseSticks(count, configuredDensity = 1) {
    const target = Math.max(3, Math.min(36, Number(count) || 9));
    particles.smokeDensity = Math.max(.4, Math.min(2, Number(configuredDensity) || 1)) * (.55 + target / 15);
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 65 + spread * 28 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 12 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 76 + (i % 3) * 6;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember';
      ember.style.animationDelay = `${(i * 0.15) % 1.1}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 540 + (leftPx - 65) + Math.sin(rad) * heightPx;
      const tipY = 680 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  function crowdFrames(viewer) {
    return CHARACTER_SPRITE_SETS[viewer?.character as keyof typeof CHARACTER_SPRITE_SETS] || CHARACTER_SPRITE_SETS.aoLam;
  }

  // Chỉ dựng nhân vật cho người xem đã được ghi nhận trong phiên room.
  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = leaderboard.slice(0, VIP_CUSHION_COORDS.length).map((dev, idx) => {
      const slot = VIP_CUSHION_COORDS[idx];
      return `
        <div class="vip-devotee-slot" data-viewer="${escapeHtml(viewerKey(dev))}" data-viewer-name="${escapeHtml(String(dev.name || '').toLocaleLowerCase('vi'))}" data-x="${slot.x}" data-y="${slot.y}" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${12 + idx};">
          <img src="${crowdFrames(dev).kneel}" data-character="${escapeHtml(dev.character || 'aoLam')}" alt="" class="devotee-sprite" />${avatarMarkup(dev)}
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 12))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Dựng Đạo Tràng 194 Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (97 chỗ mỗi bên)
  const congregationHall = document.getElementById('congregationHall');
  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    // Những người xếp từ hạng 7 trở đi ngồi ở các vị trí đầu tiên cạnh thảm đỏ
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.uniqueId}:${d.name}:${d.merit}:${d.avatar}:${d.character}`));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    const hallSeats = hallLayoutForCount(hallViewers.length);
    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < hallSeats.length) {
        seatViewerMap.set(idx, viewer);
      }
    });

    congregationHall.innerHTML = hallSeats.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      if (!viewer) return '';
      const showBadge = Boolean(viewer);
      const badgeHtml = showBadge
        ? `
          <div class="seat-badge">
            <span class="seat-avatar">${
              viewer.avatar
                ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                : escapeHtml(String(viewer.name || 'P').charAt(0).toUpperCase())
            }</span>
            <span class="seat-username">${escapeHtml(shortenName(viewer.name, 11))}</span>
          </div>
        `
        : '';

      return `
        <div
          class="hall-seat"
            data-seat-idx="${idx}" data-viewer="${escapeHtml(viewerKey(viewer))}" data-viewer-name="${escapeHtml(String(viewer?.name || '').toLocaleLowerCase('vi'))}" data-x="${seat.x}" data-y="${seat.y}"
          title="${escapeHtml(viewer?.name || 'Chỗ ngồi')}"
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${20 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale});"
        >
          <img
            src="${crowdFrames(viewer).kneel}" data-character="${escapeHtml(viewer.character || 'aoLam')}"
            alt=""
            class="devotee-sprite"
          />
          ${avatarMarkup(viewer)}${badgeHtml}
        </div>
      `;
    }).join('');
  }

  // Không hiển thị khách mặc định trước khi nhận trạng thái room.
  renderVipCushions();
  renderCongregationHall();

  // Bộ 8 khung cho từng nhân vật chủ lễ. Đạo tràng nền vẫn dùng Phật tử áo lam.
  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  const CHARACTER_SPRITE_SETS = {
    aoLam: SPRITE_FRAMES,
    maleBrown: {
      walk1: '/assets/characters/male-brown/walk1.webp',
      walk2: '/assets/characters/male-brown/walk2.webp',
      kneelDown: '/assets/characters/male-brown/kneelDown.webp',
      kneel: '/assets/characters/male-brown/kneel.webp',
      forehead: '/assets/characters/male-brown/forehead.webp',
      bowMid: '/assets/characters/male-brown/bowMid.webp',
      prostrate: '/assets/characters/male-brown/prostrate.webp',
      prostrateDeep: '/assets/characters/male-brown/prostrateDeep.webp'
    },
    elder: {
      walk1: '/assets/characters/elder/walk1.webp',
      walk2: '/assets/characters/elder/walk2.webp',
      kneelDown: '/assets/characters/elder/kneelDown.webp',
      kneel: '/assets/characters/elder/kneel.webp',
      forehead: '/assets/characters/elder/forehead.webp',
      bowMid: '/assets/characters/elder/bowMid.webp',
      prostrate: '/assets/characters/elder/prostrate.webp',
      prostrateDeep: '/assets/characters/elder/prostrateDeep.webp'
    },
    novice: {
      walk1: '/assets/characters/novice/walk1.webp',
      walk2: '/assets/characters/novice/walk2.webp',
      kneelDown: '/assets/characters/novice/kneelDown.webp',
      kneel: '/assets/characters/novice/kneel.webp',
      forehead: '/assets/characters/novice/forehead.webp',
      bowMid: '/assets/characters/novice/bowMid.webp',
      prostrate: '/assets/characters/novice/prostrate.webp',
      prostrateDeep: '/assets/characters/novice/prostrateDeep.webp'
    },
    pinkAoDai: {
      walk1: '/assets/characters/pink-ao-dai/walk1.webp',
      walk2: '/assets/characters/pink-ao-dai/walk2.webp',
      kneelDown: '/assets/characters/pink-ao-dai/kneelDown.webp',
      kneel: '/assets/characters/pink-ao-dai/kneel.webp',
      forehead: '/assets/characters/pink-ao-dai/forehead.webp',
      bowMid: '/assets/characters/pink-ao-dai/bowMid.webp',
      prostrate: '/assets/characters/pink-ao-dai/prostrate.webp',
      prostrateDeep: '/assets/characters/pink-ao-dai/prostrateDeep.webp'
    }
  };
  const CENTRAL_CHARACTER_STORAGE_KEY = 'temple.centralCharacter';
  const CHARACTER_KEYS = Object.keys(CHARACTER_SPRITE_SETS) as Array<keyof typeof CHARACTER_SPRITE_SETS>;
  const characterSelector = document.getElementById('centralCharacterSelect') as HTMLSelectElement | null;
  const characterRotationToggle = document.getElementById('centralCharacterRotationEnabled') as HTMLInputElement | null;
  const characterRotationOptions = Array.from(document.querySelectorAll<HTMLInputElement>('[data-character-rotation-option]'));
  const characterSyncStatus = document.getElementById('centralCharacterSyncStatus');
  const initialStoredCharacter = localStorage.getItem(CENTRAL_CHARACTER_STORAGE_KEY);
  let hasReceivedCentralCharacterState = false;
  let lastServerCharacterSettings: Record<string, unknown> | null = null;
  let characterSaveTimer = 0;

  function setCentralCharacter(characterKey: string, persist = false) {
    const key = Object.prototype.hasOwnProperty.call(CHARACTER_SPRITE_SETS, characterKey)
      ? characterKey as keyof typeof CHARACTER_SPRITE_SETS
      : 'aoLam';
    const spriteSet = CHARACTER_SPRITE_SETS[key];
    const stack = document.getElementById('centralSpriteStack');
    stack?.querySelectorAll<HTMLImageElement>('.pose-frame').forEach((frame) => {
      const pose = frame.dataset.pose as keyof typeof spriteSet | undefined;
      if (pose && spriteSet[pose]) frame.src = spriteSet[pose];
    });
    const selector = document.getElementById('centralCharacterSelect') as HTMLSelectElement | null;
    if (selector) selector.value = key;
    if (persist) localStorage.setItem(CENTRAL_CHARACTER_STORAGE_KEY, key);
  }

  function selectedRotationPool(): string[] {
    return characterRotationOptions.filter(option => option.checked).map(option => option.value);
  }

  function applyCentralCharacterSettings(settings: Record<string, unknown>, characterOverride?: string): void {
    const serverCharacter = typeof settings.centralCharacter === 'string' ? settings.centralCharacter : 'aoLam';
    const character = characterOverride || serverCharacter;
    if (!playbackState?.current) setCentralCharacter(character, true);
    else if (characterSelector) characterSelector.value = character;
    if (characterRotationToggle) characterRotationToggle.checked = Boolean(settings.centralCharacterRotationEnabled);
    const pool = Array.isArray(settings.centralCharacterRotationPool) ? settings.centralCharacterRotationPool : CHARACTER_KEYS;
    characterRotationOptions.forEach(option => { option.checked = pool.includes(option.value); });
    lastServerCharacterSettings = {
      centralCharacter: character,
      centralCharacterRotationEnabled: Boolean(settings.centralCharacterRotationEnabled),
      centralCharacterRotationPool: pool.filter((key): key is string => typeof key === 'string')
    };
    if (characterSyncStatus) characterSyncStatus.textContent = 'Đã đồng bộ với các màn hình Live và OBS.';
  }

  function queueCentralCharacterSettingsSave(): void {
    if (!characterSelector || !characterRotationToggle || !characterSyncStatus) return;
    characterSyncStatus.textContent = 'Đang đồng bộ lựa chọn nhân vật…';
    window.clearTimeout(characterSaveTimer);
    characterSaveTimer = window.setTimeout(async () => {
      const settings = {
        centralCharacter: characterSelector.value,
        centralCharacterRotationEnabled: characterRotationToggle.checked,
        centralCharacterRotationPool: selectedRotationPool()
      };
      if (settings.centralCharacterRotationEnabled && settings.centralCharacterRotationPool.length < 2) {
        characterSyncStatus.textContent = 'Chọn ít nhất 2 nhân vật để xoay tua.';
        toast('Xoay tua cần ít nhất hai nhân vật.');
        if (lastServerCharacterSettings) applyCentralCharacterSettings(lastServerCharacterSettings);
        return;
      }
      try {
        const result = await rpc('temple.updateSettings', settings);
        if (result?.settings) applyCentralCharacterSettings(result.settings);
      } catch (error) {
        characterSyncStatus.textContent = 'Chưa đồng bộ được. Kiểm tra xác thực RPC.';
        toast(error instanceof Error ? error.message : 'Không đồng bộ được nhân vật.');
        if (lastServerCharacterSettings) applyCentralCharacterSettings(lastServerCharacterSettings);
      }
    }, 180);
  }

  function syncCentralCharacterSettings(settings: Record<string, unknown>): void {
    if (!hasReceivedCentralCharacterState) {
      hasReceivedCentralCharacterState = true;
      const useLegacySelection = settings.centralCharacterConfigured !== true
        && initialStoredCharacter
        && Object.prototype.hasOwnProperty.call(CHARACTER_SPRITE_SETS, initialStoredCharacter)
        && params.get('obs') !== '1'
        && Boolean(characterSelector);
      applyCentralCharacterSettings(settings, useLegacySelection ? initialStoredCharacter : undefined);
      if (useLegacySelection) queueCentralCharacterSettingsSave();
      return;
    }
    applyCentralCharacterSettings(settings);
  }

  const spriteUrls = new Set(Object.values(CHARACTER_SPRITE_SETS).flatMap((set) => Object.values(set)));
  spriteUrls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  const initialCharacter = initialStoredCharacter && Object.prototype.hasOwnProperty.call(CHARACTER_SPRITE_SETS, initialStoredCharacter)
    ? initialStoredCharacter
    : 'aoLam';
  setCentralCharacter(initialCharacter);
  characterSelector?.addEventListener('change', () => {
    setCentralCharacter(characterSelector.value, true);
    queueCentralCharacterSettingsSave();
  });
  characterRotationToggle?.addEventListener('change', queueCentralCharacterSettingsSave);
  characterRotationOptions.forEach(option => option.addEventListener('change', queueCentralCharacterSettingsSave));

  async function simulateRoomViewers(count: number): Promise<void> {
    const status = document.getElementById('simulatedViewersStatus');
    const buttons = ['btnSimulateViewers', 'btnClearSimulatedViewers'].map(id => document.getElementById(id) as HTMLButtonElement | null);
    buttons.forEach(button => { if (button) button.disabled = true; });
    try {
      if (!Number.isInteger(count) || count < 0 || count > 200) throw new Error('Nhập số nguyên từ 0 đến 200.');
      if (status) status.textContent = 'Đang cập nhật người giả lập…';
      const state = await rpc('temple.setSimulatedViewers', { count });
      updateUIState(state);
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Không tạo được người giả lập.';
    } finally {
      buttons.forEach(button => { if (button) button.disabled = false; });
    }
  }
  document.getElementById('btnSimulateViewers')?.addEventListener('click', () => {
    const input = document.getElementById('simulatedViewerCount') as HTMLInputElement;
    void simulateRoomViewers(input.value.trim() ? Number(input.value) : NaN);
  });
  document.getElementById('btnClearSimulatedViewers')?.addEventListener('click', () => { void simulateRoomViewers(0); });
  document.getElementById('btnSimulateChat')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const user = document.getElementById('simulatedChatUser') as HTMLSelectElement;
    const input = document.getElementById('simulatedChatText') as HTMLInputElement;
    const status = document.getElementById('simulatedChatStatus');
    button.disabled = true;
    try {
      await rpc('temple.previewViewerChat', { uniqueId: user.value, comment: input.value });
      if (status) status.textContent = 'Đã gửi bong bóng đến nhân vật và các màn Live/OBS.';
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Không gửi được chat thử.';
    } finally { button.disabled = !user.value; }
  });

  const roomArrivalLayer = document.createElement('div');
  roomArrivalLayer.className = 'room-arrival-layer';
  stage9x16?.appendChild(roomArrivalLayer);
  let seatedViewerKeys = new Set<string>();
  const roomArrivals = new Map<string, { walker: HTMLElement; animation: Animation; stop: () => void }>();

  function syncRoomArrivals(viewers): void {
    const seats = Array.from(document.querySelectorAll<HTMLElement>('#congregationHall .hall-seat, #vipCushionsLayer .vip-devotee-slot'));
    const currentKeys = new Set<string>(viewers.map(viewer => viewerKey(viewer)));
    for (const [key, arrival] of roomArrivals) {
      if (!currentKeys.has(key)) { arrival.stop(); arrival.animation.cancel(); arrival.walker.remove(); roomArrivals.delete(key); }
    }
    let entryIndex = 0;
    viewers.forEach(viewer => {
      const key = viewerKey(viewer);
      const seat = seats.find(item => item.dataset.viewer === key);
      if (!seat) return;
      seat.title = `${viewer.name}\n@${viewer.uniqueId}\n${Number(viewer.merit || 0).toLocaleString('vi-VN')} công đức${viewer.isSimulated ? '\nNgười giả lập' : ''}`;
      if (roomArrivals.has(key)) { seat.classList.add('is-entering'); return; }
      if (seatedViewerKeys.has(key) || presentationPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      seat.classList.add('is-entering');
      const frames = crowdFrames(viewer);
      const walker = document.createElement('div');
      walker.className = 'room-arrival-walker';
      walker.dataset.viewerArrival = key;
      const sprite = document.createElement('img');
      sprite.src = frames.walk1; sprite.alt = '';
      const label = document.createElement('div');
      label.className = 'room-arrival-name';
      const avatar = document.createElement('span');
      avatar.innerHTML = avatarMarkup(viewer);
      const name = document.createElement('strong'); name.textContent = viewer.name;
      label.append(avatar, name); walker.append(sprite, label); roomArrivalLayer.append(walker);
      const targetX = Number(seat.dataset.x), targetY = Number(seat.dataset.y);
      const targetTransform = seat.style.transform || 'translate(-50%, -100%)';
      const delay = entryIndex++ * 140;
      const animation = walker.animate([
        { left:'540px', top:'1840px', transform:'translate(-50%, -100%) scale(.85)', opacity:0, offset:0 },
        { left:'540px', top:'1760px', transform:'translate(-50%, -100%) scale(.85)', opacity:1, offset:.12 },
        { left:'540px', top:`${targetY + 80}px`, transform:targetTransform, opacity:1, offset:.72 },
        { left:`${targetX}px`, top:`${targetY}px`, transform:targetTransform, opacity:1, offset:1 }
      ], { duration:2400, delay, easing:'linear', fill:'both' });
      let stepTimer = 0, settleTimer = 0;
      const startTimer = window.setTimeout(() => {
        let step = 0;
        stepTimer = window.setInterval(() => { sprite.src = ++step % 2 ? frames.walk2 : frames.walk1; }, 185);
      }, delay);
      const stop = () => { window.clearTimeout(startTimer); window.clearInterval(stepTimer); window.clearTimeout(settleTimer); };
      roomArrivals.set(key, { walker, animation, stop });
      void animation.finished.then(() => {
        window.clearInterval(stepTimer); sprite.src = frames.kneelDown;
        settleTimer = window.setTimeout(() => {
          document.querySelectorAll<HTMLElement>('[data-viewer]').forEach(item => { if (item.dataset.viewer === key) item.classList.remove('is-entering'); });
          stop(); walker.remove(); roomArrivals.delete(key);
        }, 180);
      }).catch(() => { stop(); walker.remove(); });
    });
    seatedViewerKeys = currentKeys;
  }

  function pulseHallBowing(user = '') {
    const seats = Array.from(document.querySelectorAll<HTMLElement>('#congregationHall .hall-seat:not(.is-entering), #vipCushionsLayer .vip-devotee-slot:not(.is-entering)'));
    if (!seats.length) return;
    const key = String(user).trim().toLocaleLowerCase('vi');
    const focused = key ? seats.find(el => el.dataset.viewerName === key) : undefined;
    const crowd = seats.filter((_, index) => index % 3 === 0 && seats[index] !== focused);
    const targets = focused ? [focused, ...crowd] : crowd;
    targets.slice(0, 76).forEach((seat, index) => {
      const img = seat.querySelector<HTMLImageElement>('.devotee-sprite');
      if (!img) return;
      const frames = crowdFrames({ character: img.dataset.character });
      const delay = (index % 22) * 36;
      effectLater(() => {
        seat.classList.remove('is-bowing');
        void img.offsetWidth;
        seat.classList.add('is-bowing');
        img.src = frames.forehead;
        effectLater(() => { img.src = frames.bowMid; }, 190);
        effectLater(() => { img.src = frames.prostrateDeep; }, 380);
        effectLater(() => { img.src = frames.kneel; }, 760);
        effectLater(() => seat.classList.remove('is-bowing'), 1180);
      }, delay);
    });
  }

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  // Chuyển đổi tức thời giữa 8 khung hình đã giải mã sẵn trên GPU (KHÔNG BAO GIỜ BỊ MẤT HÌNH)
  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  // Chuỗi 8 khung hình Đảnh lễ Tam Bái mượt mà (Hạ gối -> Chắp tay ngực -> Đưa lên trán -> Nghiêng 45° -> Chống tay -> Lạy sát đất -> Ngẩng lên)
  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');            // 1. Chắp tay đưa lên trán
      schedulePose(t0 + 170, 'bowMid');        // 2. Cúi gập lưng 45°
      schedulePose(t0 + 330, 'prostrate');     // 3. Vươn hai tay chống xuống đệm
      schedulePose(t0 + 490, 'prostrateDeep'); // 4. Lạy sát đất (Ngũ thể đầu địa)
      schedulePose(t0 + 860, 'prostrate');     // 5. Bắt đầu nâng đầu lên
      schedulePose(t0 + 1020, 'bowMid');       // 6. Nâng lưng lên góc 45°
      schedulePose(t0 + 1180, 'kneel');        // 7. Ngồi quỳ thẳng lưng
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  // Hiệu ứng thí chủ ĐỨNG ĐI BỘ từng bước dọc thảm đỏ rồi Hạ gối Quỳ Đảnh Lễ (trên cùng 1 nhân vật, không bao giờ mất hình)
  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    // Khởi động bước đi từ cuối thảm đỏ lên chính điện
    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 10; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    // Khi bước tới trước Lư Hương (2.05s): dừng bước, hạ gối quỳ xuống đệm và bắt đầu Đảnh lễ 3 lạy
    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 2100)
    );
    playThreeBowsSequence(2050);
  }

  function replayCardArrival(element: HTMLElement | null, className: string): void {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');
    const centralEl = document.getElementById('centralWorshipper');

    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || 'Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;
    replayCardArrival(centralEl, 'cards-arriving');

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(user || 'Thí Chủ').trim().charAt(0).toUpperCase();
      }
    }

    if (doThreeBows) {
      clearProstrationTimers();
      if (centralEl) centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    const sideHalos = [document.getElementById('leftBuddhaHalo'), document.getElementById('rightBuddhaHalo')];
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    sideHalos.forEach(halo => {
      if (!halo) return;
      halo.classList.add('flare');
      setTimeout(() => halo.classList.remove('flare'), 3600);
    });
    particles.spawnBellWave(540, 300, 2);

    // Cập nhật dòng thông báo dưới thanh HUD
    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
    replayCardArrival(document.getElementById('hudActiveNotice'), 'is-updating');
  }

  // 6. Cập nhật toàn bộ giao diện theo State từ Server
  let scheduledCeremonyId = '';

  function stopPresentation(): void {
    window.clearTimeout(playbackStartTimer); scheduledCeremonyId = '';
    clearProstrationTimers(); ritualEffectTimers.forEach(timer => window.clearTimeout(timer)); ritualEffectTimers.clear();
    audio.stopTts(); clearViewerChats();
    window.clearTimeout(fortuneTimer); window.clearTimeout(grandTimer);
    document.getElementById('fortuneModal')?.classList.remove('visible');
    document.getElementById('grandCeremonyBanner')?.classList.remove('visible');
    document.getElementById('centralWorshipper')?.classList.remove('walking-up');
    document.getElementById('skyLanternsLayer')?.replaceChildren();
    document.getElementById('sacredLightBeam')?.classList.remove('intense');
    document.querySelectorAll('.flare').forEach(element => element.classList.remove('flare'));
    particles.soundWaves.length = 0; particles.burstParticles.length = 0; particles.floatingTexts.length = 0;
    document.querySelectorAll<HTMLElement>('#congregationHall .hall-seat, #vipCushionsLayer .vip-devotee-slot').forEach(seat => {
      seat.classList.remove('is-bowing', 'is-chatting');
      const image = seat.querySelector<HTMLImageElement>('.devotee-sprite');
      if (image) image.src = crowdFrames({ character: image.dataset.character }).kneel;
    });
    if (presentationPaused) {
      window.clearTimeout(welcomeTimer); welcomeQueue.length = 0; welcoming = false;
      document.getElementById('welcomeCard')?.classList.remove('visible');
    }
    for (const [key, arrival] of roomArrivals) { arrival.stop(); arrival.animation.cancel(); arrival.walker.remove(); roomArrivals.delete(key); }
    document.querySelectorAll('.is-entering').forEach(seat => seat.classList.remove('is-entering'));
    setCentralPose('kneel');
  }

  function syncPlayback(status: any): void {
    if (!status) return;
    const wasActive = Boolean(playbackState?.current);
    playbackState = status;
    presentationPaused = Boolean(status.paused);
    particles.paused = presentationPaused;
    document.body.classList.toggle('presentation-paused', presentationPaused);
    if (latestUIState) {
      latestUIState.playback = status;
      latestUIState.settings.presentationPaused = presentationPaused;
      syncLiveOperations(latestUIState);
      audio.applyRemoteSettings(latestUIState.settings);
    }
    if (presentationPaused) { stopPresentation(); return; }
    const active = status.current;
    if (!active) { if (wasActive || scheduledCeremonyId) stopPresentation(); return; }
    const event = active.event;
    if (!event?.id || playedCeremonies.has(event.id) || scheduledCeremonyId === event.id || active.endsAt <= Date.now()) return;
    window.clearTimeout(playbackStartTimer); scheduledCeremonyId = event.id;
    playbackStartTimer = window.setTimeout(() => {
      scheduledCeremonyId = '';
      if (presentationPaused || playbackState?.current?.event?.id !== event.id) return;
      playedCeremonies.add(event.id);
      if (playedCeremonies.size > 500) playedCeremonies.delete(playedCeremonies.values().next().value);
      triggerRitualVisuals({ ...event, startsAt: active.startsAt, endsAt: active.endsAt, elapsedMs: Math.max(0, Date.now() - active.startsAt) });
    }, Math.max(0, active.startsAt - Date.now()));
  }

  function updateUIState(st) {
    if (!st) return;
    st.serverConnected = true;
    latestUIState = st;
    presentationPaused = Boolean(st.settings?.presentationPaused);
    audio.applyRemoteSettings(st.settings || {});
    const stageBackground = st.settings?.stageBackgroundUrl || '/assets/tam-the-sanctuary-stage.png';
    document.querySelectorAll<HTMLImageElement>('.sanctuary-bg-img').forEach(image => {
      if (image.getAttribute('src') !== stageBackground) image.src = stageBackground;
    });
    if (stageWrapper) { stageWrapper.style.backgroundImage = 'none'; stageWrapper.style.backgroundColor = '#56371d'; }
    if (stage9x16) { stage9x16.style.backgroundImage = 'none'; stage9x16.style.backgroundColor = '#27190b'; }
    document.body.classList.toggle('presentation-paused', presentationPaused);
    syncPlayback(st.playback);
    syncLiveOperations(st);
    syncVoiceControls(st.tts || {}, st.settings?.ttsVoice, st.settings?.ttsVoiceRotation);
    syncMusicControls(st.settings);
    if (st.settings?.ttsVoice) audio.ttsVoice = st.settings.ttsVoice;
    syncCentralCharacterSettings(st.settings || {});

    document.getElementById('statIncense').textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    renderIncenseSticks(st.activeIncenseSticks || 9, st.settings?.smokeDensity);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    const roomViewers = Array.isArray(st.roomViewers) ? st.roomViewers : [];
    renderVipCushions(roomViewers);
    renderCongregationHall(roomViewers);
    syncRoomArrivals(roomViewers);
    const simulationStatus = document.getElementById('simulatedViewersStatus');
    if (simulationStatus) simulationStatus.textContent = st.simulatedViewerCount
      ? `Đang có ${st.simulatedViewerCount} người test · ${roomViewers.length}/200 ghế đang dùng.`
      : 'Chưa có người giả lập.';
    const chatUser = document.getElementById('simulatedChatUser') as HTMLSelectElement | null;
    if (chatUser) {
      const selected = chatUser.value;
      const simulated = roomViewers.filter(viewer => viewer.isSimulated);
      const signature = simulated.map(viewer => viewer.uniqueId).join('|');
      if (chatUser.dataset.users !== signature) {
        chatUser.replaceChildren(...simulated.map(viewer => new Option(viewer.name, viewer.uniqueId)));
        if (!simulated.length) chatUser.add(new Option('Tạo người test trước', ''));
        if (simulated.some(viewer => viewer.uniqueId === selected)) chatUser.value = selected;
        chatUser.dataset.users = signature;
      }
      chatUser.disabled = !simulated.length;
      const send = document.getElementById('btnSimulateChat') as HTMLButtonElement | null;
      if (send) send.disabled = !simulated.length;
    }

    // Cập nhật Bảng TẤM LÒNG THÀNH ở góc dưới phải (Top 4)
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('') || '<p class="leader-empty">Chờ tấm lòng đầu tiên</p>';
    }

    // Trạng thái kết nối TikTok Live
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    if (st.tiktok?.connected) {
      liveDot.classList.add('connected');
      liveText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} mắt`;
    } else if (st.tiktok?.connecting) {
      liveDot.classList.remove('connected');
      liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
    } else {
      liveDot.classList.remove('connected');
      liveText.textContent = st.settings?.autoSim
        ? 'CHÁNH ĐIỆN TAM THẾ • TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI'
        : 'CHÁNH ĐIỆN TAM THẾ • ĐẠO TRÀNG 200 CHỖ';
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? 'Giả lập tương tác: BẬT'
        : 'Giả lập tương tác: TẮT';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }
    if (st.settings) {
      const sfx = document.getElementById('sfxVolume') as HTMLInputElement | null;
      if (sfx && typeof st.settings.sfxVolume === 'number') sfx.value = String(Math.round(st.settings.sfxVolume * 100));
      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol') as HTMLInputElement | null;
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol') as HTMLInputElement | null;
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
    }


    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      feed.innerHTML = st.recentEvents
        .slice(0, 8)
        .map((ev) => `<article class="event-feed-item" data-kind="${escapeHtml(ev.type || 'other')}"><span class="event-feed-icon" aria-hidden="true">${eventIcon(ev.type)}</span><span class="event-feed-content"><span class="event-feed-copy">${formatEventSummary(ev)}</span><time>${eventTime(ev.timestamp)}</time></span></article>`)
        .join('');
    }
  }

  function eventIcon(type: string): string {
    const icons: Record<string, string> = { burnIncense: 'incense', strikeWoodenFish: 'fish', ringBell: 'bell', sendPrayer: 'prayer', offerGift: 'lotus', grandCeremony: 'ceremony', drawFortune: 'fortune' };
    return ritualIcon(icons[type] || 'lotus');
  }

  function eventTime(timestamp?: string): string {
    if (!timestamp) return 'Vừa xong';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Vừa xong' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'burnIncense':
        return `<strong>${escapeHtml(ev.user)}</strong> dâng ${ev.count} nén nhang <em>+${ev.merit} CĐ</em>`;
      case 'strikeWoodenFish':
        return `<strong>${escapeHtml(ev.user)}</strong> gõ mõ ${ev.count} nhịp <em>+${ev.merit} CĐ</em>`;
      case 'ringBell':
        return `<strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung <em>+${ev.merit} CĐ</em>`;
      case 'sendPrayer':
        return `<strong>${escapeHtml(ev.user)}</strong> cầu phúc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `<strong>${escapeHtml(ev.user)}</strong> dâng <em>${escapeHtml(ev.giftName)}</em> · +${ev.merit} CĐ`;
      case 'drawFortune':
        return `<strong>${escapeHtml(ev.user)}</strong> gieo Quẻ số ${ev.fortune?.number} <em>${escapeHtml(ev.fortune?.rank || '')}</em>`;
      default:
        return `<strong>${escapeHtml(ev.user || 'Thí chủ')}</strong> tương tác`;
    }
  }

  // 7. Xử lý hiệu ứng khi có Nghi Thức mới
  let fortuneTimer = null;
  let grandTimer = null;

  function triggerRitualVisuals(ev) {
    if (!ev || presentationPaused) return;
    if (typeof ev.centralCharacter === 'string') setCentralCharacter(ev.centralCharacter, true);
    audio.stopTts();
    if (ev.ttsText && (!ev.ttsPrepared || ev.ttsUrl)) {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi', url: ev.ttsUrl, startsAt: ev.startsAt });
    }
    if (ev.type === 'announcement') return;
    if (ev.elapsedMs > 1000) {
      updateCentralWorshipper(ev.user, ev.avatar, `Nghi thức đang diễn ra (+${ev.merit || 0} CĐ)`, ev.wish, false);
      setCentralPose('kneel');
      if (ev.type === 'drawFortune') showFortuneModal(ev.user, ev.fortune);
      return;
    }
    pulseHallBowing(ev.user);

    switch (ev.presentation || ev.type) {
      case 'burnIncense': {
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 680);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 650, '#ffe082');
        animateWalkerOnCarpet(ev.user, ev.avatar, `Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'strikeWoodenFish': {
        for(let i=0;i<Math.min(12,Math.max(1,Number(ev.count)||1));i++)effectLater(()=>{ void audio.playWoodenFish(); },i*220);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        updateCentralWorshipper(ev.user, ev.avatar, `Gõ mõ (${ev.count} nhịp)`, ev.wish, false);
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        particles.spawnBellWave(540, 440, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 710, '#ffb74d');
        animateWalkerOnCarpet(ev.user, ev.avatar, `Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'offerGift': {
        audio.playIncenseChime();
        audio.playTempleBell(0.85);
        particles.spawnIncenseBurst(540, 680);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 630, '#fff3b0');
        animateWalkerOnCarpet(ev.user, ev.avatar, `Dâng ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        effectLater(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        showFortuneModal(ev.user, ev.fortune);
        updateCentralWorshipper(ev.user, ev.avatar, `Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`, ev.fortune?.meaning || '', true);
        clearTimeout(fortuneTimer);
        fortuneTimer = setTimeout(() => document.getElementById('fortuneModal')?.classList.remove('visible'), Math.max(5500, (ev.endsAt || Date.now() + 15000) - Date.now()));
        break;
      }
    }
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
    document.getElementById('fortuneRankBadge').textContent = fortune.rank.toUpperCase();
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Thí chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn: ${fortune.meaning}\n\nGợi ý hôm nay: ${fortune.advice || 'Dành một phút chiêm nghiệm.'}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal').classList.remove('visible');
  });

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = giftName.toUpperCase();
    document.getElementById('grandSub').textContent = `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    if (!window.TempleAuth?.getToken()) {
      setTimeout(connectWebSocket, 5000);
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onopen = () => {
      const token = window.TempleAuth.getToken();
      if (!token) {
        ws.close(4401, 'RPC token required');
        return;
      }
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'auth',
        params: { token }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.error) toast(msg.error.message || 'Không thực hiện được thao tác.');
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'temple.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.playback) syncPlayback({ ...playbackState, current: msg.params.playback });
        } else if (msg.method === 'temple.playback') {
          syncPlayback(msg.params);
        } else if (msg.method === 'temple.viewerCount') {
          if (latestUIState) {
            latestUIState.tiktok.viewerCount = msg.params.viewerCount;
            if (msg.params.liveSession) latestUIState.liveSession = msg.params.liveSession;
            const text = document.getElementById('liveStatusText');
            if (text && latestUIState.tiktok.connected) text.textContent = `LIVE @${latestUIState.tiktok.username} • ${msg.params.viewerCount} mắt`;
            syncLiveOperations(latestUIState);
          }
        } else if (msg.method === 'tts.status') {
          syncVoiceControls(msg.params || {});
        } else if (msg.method === 'temple.chat') {
          if (!presentationPaused) showViewerChat(msg.params);
        } else if (msg.method === 'temple.member') {
          if (!presentationPaused) queueWelcome(msg.params);
        } else if (msg.method === 'tts.play') {
          if (msg.params?.url && !presentationPaused) {
            audio.enqueueTts(msg.params.text || 'Nam mô A Di Đà Phật', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url
            });
          }
        }
      } catch (error) { console.warn('[Live update]', error); }
    };

    ws.onclose = (event) => {
      const interrupted = playbackState?.current?.event?.id;
      if (interrupted) playedCeremonies.delete(interrupted);
      stopPresentation();
      if (latestUIState) { latestUIState.serverConnected = false; syncLiveOperations(latestUIState); }
      if (event.code === 4401) {
        window.TempleAuth?.logout();
        const status = document.getElementById('authStatus');
        if (status) status.textContent = 'Token không còn hợp lệ. Lấy token mới trong terminal rồi xác thực lại.';
        return;
      }
      setTimeout(connectWebSocket, window.TempleAuth?.getToken() ? 3000 : 5000);
    };
  }
  window.addEventListener('temple-auth-changed', () => {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, 'Authentication changed');
      return;
    }
    if (window.TempleAuth?.getToken()) connectWebSocket();
  });
  connectWebSocket();

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    if (!window.TempleAuth?.getToken()) {
      const authStatus = document.getElementById('authStatus');
      if (authStatus) authStatus.textContent = 'Nhập RPC token từ terminal để gửi lệnh.';
      return { error: { message: 'RPC token required' } };
    }
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    try {
    const res = await window.TempleAuth.fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.error) toast(data.error.message || 'Không thực hiện được thao tác.');
    if (data?.result?.state) updateUIState(data.result.state);

    return data;
    } catch (error) { toast('Mất kết nối máy chủ. Kiểm tra cửa sổ npm run dev.'); return { error: { message: String(error) } }; }
  }

  function getFormInput() {
    const user =
      (document.getElementById('inputDevoteeName') as HTMLInputElement | null)?.value.trim() ||
      'Khách Demo';
    const wish =
      (document.getElementById('inputDevoteeWish') as HTMLInputElement | null)?.value.trim() ||
      'Cầu cho gia đình bình an, tài lộc hanh thông';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 1 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 5 });
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  document.getElementById('btnRpcGiftLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.grandCeremony', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Kim Long Chầu Phật',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
    const username = (document.getElementById('inputTikTokUser') as HTMLInputElement | null)?.value.trim();
    if (!username) return;
    callRpc('live.connect', { username });
  });

  // Khởi tạo và gắn sự kiện thanh trượt chỉnh âm lượng Nhạc nền & Giọng đọc
  const sliderMusicVol = document.getElementById('sliderMusicVol') as HTMLInputElement | null;
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number((e.currentTarget as HTMLInputElement).value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number((e.currentTarget as HTMLInputElement).value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol') as HTMLInputElement | null;
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number((e.currentTarget as HTMLInputElement).value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number((e.currentTarget as HTMLInputElement).value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
