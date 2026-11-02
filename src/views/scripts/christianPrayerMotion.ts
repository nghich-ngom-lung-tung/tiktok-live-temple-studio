export const CHRISTIAN_WALK_MS = 4600;
export const CHRISTIAN_ALTAR_Y = 1020;
const PRAYER_TYPES = new Set(['prayer', 'candle', 'communion', 'peace', 'thanksgiving']);

export function prayerOpacityFrames(duration: number, bowed: boolean) {
  const edge = Math.min(.3, 1000 / Math.max(1, duration));
  return [
    { opacity: bowed ? 0 : 1, offset: 0 },
    { opacity: bowed ? 1 : 0, offset: edge },
    { opacity: bowed ? 1 : 0, offset: 1 - edge },
    { opacity: bowed ? 0 : 1, offset: 1 }
  ];
}

// All clients use the same server start/end, including arrivals and reloads.
export function createChristianPrayerMotion(stage: HTMLElement | null) {
  let current: { beginAt: number; endsAt: number } | null = null;
  const animated = new Map<Element, Animation[]>();
  function clear() {
    for (const animations of animated.values()) animations.forEach(animation => animation.cancel());
    animated.clear(); current = null;
    stage?.removeAttribute('data-prayer-motion');
  }
  function addPair(root: Element, standingSelector: string, bowedSelector: string) {
    if (!current || animated.has(root) || Date.now() >= current.endsAt) return;
    const standing = root.querySelector(standingSelector);
    const bowed = root.querySelector(bowedSelector);
    if (!standing || !bowed) return;
    const duration = Math.max(2000, current.endsAt - current.beginAt);
    const elapsed = Date.now() - current.beginAt;
    const animations = [[standing, false], [bowed, true]].map(([element, isBowed]) => {
      const animation = (element as Element).animate(prayerOpacityFrames(duration, Boolean(isBowed)), {
        duration, easing: 'ease-in-out', fill: 'both'
      });
      animation.currentTime = elapsed;
      return animation;
    });
    animated.set(root, animations);
  }
  function addCrowd(node?: Element) {
    if (!current) return;
    const nodes = node ? [node] : Array.from(stage?.querySelectorAll('.attendee.is-standing') || []);
    for (const item of nodes) if (item.classList.contains('is-standing')) addPair(item, '.attendee-seat-sprite', '.attendee-bow-sprite');
  }
  return {
    clear, addCrowd,
    start(event: Record<string, any>, actor: Element) {
      clear();
      if (!PRAYER_TYPES.has(event.type) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      current = { beginAt: Number(event.startsAt || Date.now()) + CHRISTIAN_WALK_MS, endsAt: Number(event.endsAt || Date.now() + 10000) };
      stage?.setAttribute('data-prayer-motion', event.type);
      addPair(actor, '.ritual-actor-stand', '.ritual-actor-bow');
      addCrowd();
    }
  };
}
