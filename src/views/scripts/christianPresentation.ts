import { escapeHtml } from './studioShared';
import { ritualIcon } from './studioEffects';
import { createChristianPrayerMotion, CHRISTIAN_WALK_MS, CHRISTIAN_ALTAR_Y } from './christianPrayerMotion';

const SCENES: Record<string, { label: string; title: string; icon: string }> = {
  prayer: { label: 'LỜI CẦU NGUYỆN', title: 'Cùng dâng lời cầu nguyện', icon: 'cross' },
  scripture: { label: 'SUY NGẪM KINH THÁNH', title: 'Lời suy ngẫm hôm nay', icon: 'bible' },
  candle: { label: 'THẮP NẾN TẠ ƠN', title: 'Một ngọn nến, một lời tạ ơn', icon: 'cross' },
  bell: { label: 'CHUÔNG THÁNH ĐƯỜNG', title: 'Chuông ngân, lòng hướng về Chúa', icon: 'bell' },
  thanksgiving: { label: 'TRI ÂN HỒNG ÂN', title: 'Dâng lời tri ân', icon: 'heart' },
  gift: { label: 'CẢM ƠN TẤM LÒNG', title: 'Một món quà yêu thương', icon: 'gift' },
  communion: { label: 'HIỆP THÔNG ĐẠI LỄ', title: 'Cùng cộng đoàn hiệp thông', icon: 'cross' },
  peace: { label: 'BÌNH AN CHO BẠN', title: 'Gửi một lời chúc bình an', icon: 'heart' },
  welcome: { label: 'CHÀO ĐÓN TÂN KHÁCH', title: 'Cảm ơn bạn đã hiện diện', icon: 'person' },
  announcement: { label: 'THÔNG ĐIỆP', title: 'Lời nhắn từ người điều hành', icon: 'sound' }
};

export function createChristianPresentation(stage: HTMLElement | null) {
  const card = document.getElementById('scriptureCard');
  let actor: HTMLElement | null = null;
  let person: HTMLElement | null = null;
  let currentEvent: Record<string, any> | null = null;
  let hiddenAttendee: HTMLElement | null = null;
  let returnAnimation: Animation | null = null;
  const animations = new Set<Animation>();
  const prayerMotion = createChristianPrayerMotion(stage);
  function clear() {
    returnAnimation?.cancel(); returnAnimation = null;
    prayerMotion.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    hiddenAttendee?.classList.remove('is-ritual-hidden'); hiddenAttendee = null;
    actor?.remove(); actor = null;
    person?.remove(); person = null;
    currentEvent = null;
    card?.classList.remove('is-ritual-active');
    card?.removeAttribute('data-ritual');
  }
  function finish(resolveReturnTarget: (event: Record<string, any>) => { x: number; y: number; scale: number; attendee?: HTMLElement | null } | null) {
    const node = actor;
    const event = currentEvent;
    if (!node || !event || !stage) { clear(); return; }
    prayerMotion.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    person?.remove(); person = null;
    card?.classList.remove('is-ritual-active');
    card?.removeAttribute('data-ritual');
    currentEvent = null;

    const target = resolveReturnTarget(event);
    if (!target) { clear(); return; }
    hiddenAttendee = target.attendee?.isConnected ? target.attendee : null;
    hiddenAttendee?.classList.add('is-ritual-hidden');
    node.classList.remove('has-arrived', 'is-resting');
    node.classList.add('is-returning');
    const targetTransform = `translate(-50%,-100%) scale(${target.scale})`;
    const settle = () => {
      if (actor !== node) return;
      const attendee = hiddenAttendee;
      hiddenAttendee = null;
      if (attendee?.isConnected) {
        attendee.classList.remove('is-ritual-hidden');
        node.remove(); actor = null;
      } else {
        node.classList.remove('is-returning');
        node.classList.add('has-arrived', 'is-resting');
      }
      returnAnimation = null;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.left = `${target.x}px`;
      node.style.top = `${target.y}px`;
      node.style.transform = targetTransform;
      settle();
      return;
    }
    const animation = node.animate([
      { left: '540px', top: `${CHRISTIAN_ALTAR_Y}px`, transform: 'translate(-50%,-100%) scale(.75)', opacity: 1, offset: 0 },
      { left: '540px', top: `${Math.round((CHRISTIAN_ALTAR_Y + target.y) / 2)}px`, transform: 'translate(-50%,-100%) scale(.82)', opacity: 1, offset: .64 },
      { left: `${target.x}px`, top: `${target.y}px`, transform: targetTransform, opacity: 1, offset: .92 },
      { left: `${target.x}px`, top: `${target.y}px`, transform: targetTransform, opacity: hiddenAttendee ? 0 : 1, offset: 1 }
    ], { duration: 2600, easing: 'cubic-bezier(.35,0,.4,1)', fill: 'forwards' });
    returnAnimation = animation;
    void animation.finished.then(settle).catch(() => {});
  }
  const text = (id: string, value: unknown) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value || '');
  };
  return {
    clear, addCrowd: prayerMotion.addCrowd,
    finish(resolveReturnTarget: (event: Record<string, any>) => { x: number; y: number; scale: number; attendee?: HTMLElement | null } | null) {
      finish(resolveReturnTarget);
    },
    show(event: Record<string, any>) {
      clear();
      if (!stage || !card) return;
      const scene = SCENES[event.type];
      if (!scene) return;
      currentEvent = event;
      const user = String(event.user || 'Người điều hành');
      const avatar = event.avatar ? `<img src="${escapeHtml(event.avatar)}" alt="">` : escapeHtml(user.charAt(0).toLocaleUpperCase('vi'));
      person = document.createElement('div');
      person.className = 'ritual-card-person';
      person.innerHTML = `<span class="ritual-card-icon">${ritualIcon(scene.icon)}</span><span class="ritual-card-avatar">${avatar}</span><strong>${escapeHtml(user)}</strong><span class="ritual-card-status">ĐANG HIỆP THÔNG</span>`;
      card.prepend(person);
      card.classList.add('is-ritual-active');
      card.dataset.ritual = event.type;
      text('messageKicker', event.type === 'scripture' ? `${event.theme || scene.label} · ${event.reference || ''}` : scene.label);
      text('messageTitle', event.title || (event.type === 'gift' ? event.giftName || scene.title : scene.title));
      text('messageBody', event.wish || event.reflection || event.ttsText || 'Cùng dành một phút hướng lòng về Chúa.');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const elapsed = Math.max(0, Number(event.elapsedMs) || 0);
      if (!reduced) {
        const reveal = card.animate([
          { opacity: 0, transform: 'translateY(-24px) scale(.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 650, easing: 'cubic-bezier(.16,.8,.25,1)', fill: 'both' });
        reveal.currentTime = Math.min(650, elapsed);
        animations.add(reveal);
      }
      if (event.type === 'announcement') return;
      const sex = event.character === 'woman' ? 'nu' : 'nam';
      const node = document.createElement('div');
      actor = node;
      node.className = `ritual-actor ritual-actor-${event.type}`;
      node.style.top = `${CHRISTIAN_ALTAR_Y}px`;
      node.setAttribute('aria-label', `${user} · ${scene.label.toLocaleLowerCase('vi')}`);
      node.innerHTML = `<div class="ritual-actor-shadow"></div><div class="ritual-actor-walk" style="background-image:url('/assets/thien-chua-giao/characters/tin-huu-${sex}-di-8-khung.png')"></div><img class="ritual-actor-stand" src="/assets/thien-chua-giao/characters/tin-huu-${sex}.png" alt=""><img class="ritual-actor-bow" src="/assets/thien-chua-giao/characters/tin-huu-${sex}-cui-dau-v1.png" alt=""><span class="ritual-actor-name"><span>${avatar}</span><strong>${escapeHtml(user)}</strong></span>`;
      stage.append(node);
      prayerMotion.start(event, node);
      const stand = () => { if (actor === node) node.classList.add('has-arrived'); };
      if (reduced || elapsed >= CHRISTIAN_WALK_MS) { stand(); return; }
      const walk = node.animate([
        { transform: 'translate(-50%,-100%) translateY(800px) scale(1.12)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%,-100%) translateY(730px) scale(1.08)', opacity: 1, offset: .1 },
        { transform: 'translate(-50%,-100%) translateY(360px) scale(.92)', opacity: 1, offset: .55 },
        { transform: 'translate(-50%,-100%) translateY(0) scale(.75)', opacity: 1, offset: 1 }
      ], { duration: CHRISTIAN_WALK_MS, easing: 'linear', fill: 'both' });
      walk.currentTime = elapsed;
      animations.add(walk);
      void walk.finished.then(stand).catch(() => {});
    }
  };
}
