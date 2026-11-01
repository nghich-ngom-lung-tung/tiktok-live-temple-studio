const svgNamespace = 'http://www.w3.org/2000/svg';
const filterId = 'studioGooeyNavFilter';
const canvasPadding = 64;
const pillColor = '#f5e7c8';
const sparkColors = ['#f1cf78', '#e7aa78', '#fff1ce'];

type NavRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

type PillMotion = {
  rect: NavRect;
  out: boolean;
  start: number;
  duration: number;
};

type Particle = {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  radius: number;
  color: string;
  start: number;
  duration: number;
};

type GooeyItem = HTMLAnchorElement | HTMLButtonElement;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (value: number): number => 1 - Math.pow(1 - value, 3);

function ensureGooeyFilter(): void {
  if (document.getElementById(filterId)) return;

  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;pointer-events:none';

  const defs = document.createElementNS(svgNamespace, 'defs');
  const filter = document.createElementNS(svgNamespace, 'filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-120%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '340%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const blur = document.createElementNS(svgNamespace, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '3.5');
  blur.setAttribute('result', 'blur');

  const threshold = document.createElementNS(svgNamespace, 'feColorMatrix');
  threshold.setAttribute('in', 'blur');
  threshold.setAttribute('mode', 'matrix');
  threshold.setAttribute(
    'values',
    '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9',
  );
  threshold.setAttribute('result', 'goo');

  const composite = document.createElementNS(svgNamespace, 'feComposite');
  composite.setAttribute('in', 'SourceGraphic');
  composite.setAttribute('in2', 'goo');
  composite.setAttribute('operator', 'atop');

  filter.append(blur, threshold, composite);
  defs.append(filter);
  svg.append(defs);
  document.body.prepend(svg);
}

function enhanceNavigation(nav: HTMLElement): void {
  const items = Array.from(nav.querySelectorAll<GooeyItem>(':scope > a[href], :scope > button[data-tab]'));
  if (items.length < 2) return;

  let currentItem = items.find((item) => item.getAttribute('aria-current') === 'page'
    || item.getAttribute('aria-selected') === 'true') ?? items[0];
  nav.classList.add('gooey-nav');

  const canvasClip = document.createElement('span');
  canvasClip.className = 'gooey-nav-canvas-clip';
  canvasClip.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'gooey-nav-canvas';
  canvasClip.append(canvas);
  nav.prepend(canvasClip);

  const context = canvas.getContext('2d');
  if (!context) {
    canvasClip.remove();
    nav.classList.remove('gooey-nav');
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const geometry = new Map<GooeyItem, NavRect>();
  const pills: PillMotion[] = [];
  let particles: Particle[] = [];
  let animationFrame = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let displayedItem = currentItem;
  let pointerItem: GooeyItem | null = null;
  let focusedItem: GooeyItem | null = null;

  const drawPill = (x: number, y: number, width: number, height: number): void => {
    if (width <= 0 || height <= 0) return;

    const gradient = context.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#fff3d8');
    gradient.addColorStop(0.58, pillColor);
    gradient.addColorStop(1, '#e9ce91');

    context.save();
    context.beginPath();
    context.roundRect(x, y, width, height, Math.min(width / 2, height / 2));
    context.shadowColor = 'rgba(241, 205, 122, 0.38)';
    context.shadowBlur = 11;
    context.fillStyle = gradient;
    context.fill();
    context.restore();
  };

  const clearCanvas = (): void => {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  };

  const drawStatic = (): void => {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    pills.length = 0;
    particles = [];
    nav.classList.remove('gooey-moving');
    clearCanvas();

    const rect = geometry.get(displayedItem);
    if (rect) drawPill(rect.x, rect.y, rect.w, rect.h);
  };

  const paint = (now: number): void => {
    clearCanvas();

    for (const motion of pills) {
      if (now < motion.start) continue;
      const progress = clamp((now - motion.start) / motion.duration);
      const scale = motion.out ? 1 - easeOut(progress) : easeOut(progress);
      const width = motion.rect.w * Math.max(0.001, scale);
      const height = motion.rect.h * (0.55 + 0.45 * scale);
      drawPill(
        motion.rect.cx - width / 2,
        motion.rect.cy - height / 2,
        width,
        height,
      );
    }

    for (const particle of particles) {
      if (now < particle.start) continue;
      const progress = clamp((now - particle.start) / particle.duration);
      const t = easeOut(progress);
      const inverse = 1 - t;
      const x = inverse * inverse * inverse * particle.sx
        + 3 * inverse * inverse * t * particle.c1x
        + 3 * inverse * t * t * particle.c2x
        + t * t * t * particle.ex;
      const y = inverse * inverse * inverse * particle.sy
        + 3 * inverse * inverse * t * particle.c1y
        + 3 * inverse * t * t * particle.c2y
        + t * t * t * particle.ey;
      context.globalAlpha = Math.max(0, Math.min(1, progress / 0.14, (1 - progress) / 0.2));
      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }

    for (let index = pills.length - 1; index >= 0; index -= 1) {
      if (now >= pills[index].start + pills[index].duration) pills.splice(index, 1);
    }
    particles = particles.filter((particle) => now < particle.start + particle.duration);

    if (pills.length > 0 || particles.length > 0) {
      animationFrame = window.requestAnimationFrame(paint);
    } else {
      drawStatic();
    }
  };

  const resize = (): void => {
    const navRect = nav.getBoundingClientRect();
    if (navRect.width === 0 || navRect.height === 0) return;

    cssWidth = navRect.width + canvasPadding * 2;
    cssHeight = navRect.height + canvasPadding * 2;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    geometry.clear();
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      geometry.set(item, {
        x: rect.left - navRect.left + canvasPadding + 1,
        y: rect.top - navRect.top + canvasPadding + 1,
        w: Math.max(0, rect.width - 2),
        h: Math.max(0, rect.height - 2),
        cx: rect.left - navRect.left + canvasPadding + rect.width / 2,
        cy: rect.top - navRect.top + canvasPadding + rect.height / 2,
      });
    }

    drawStatic();
  };

  const moveTo = (target: GooeyItem, animate: boolean): void => {
    nav.classList.toggle('gooey-previewing', target !== currentItem);
    if (target === displayedItem) return;

    const from = geometry.get(displayedItem);
    const to = geometry.get(target);
    displayedItem = target;

    if (!from || !to || !animate || reducedMotion.matches) {
      drawStatic();
      return;
    }

    window.cancelAnimationFrame(animationFrame);
    pills.length = 0;
    particles = [];

    const now = performance.now();
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const duration = 520;
    const spread = 22;
    pills.push(
      { rect: from, out: true, start: now, duration: duration * 0.68 },
      { rect: to, out: false, start: now + duration * 0.28, duration: duration * 0.72 },
    );

    particles = Array.from({ length: 12 }, (_, index) => {
      const fraction = ((index * 7) % 13) / 12;
      const side = index % 2 === 0 ? -1 : 1;
      const sx = from.cx + (fraction - 0.5) * from.w * 0.6;
      const sy = from.cy + side * from.h * 0.18;
      const ex = to.cx + (fraction - 0.5) * to.w * 0.55;
      const ey = to.cy - side * to.h * 0.12;

      return {
        sx,
        sy,
        ex,
        ey,
        c1x: sx + dx * 0.27,
        c1y: sy - side * spread * (0.5 + fraction),
        c2x: ex - dx * 0.26,
        c2y: ey + side * spread * (0.3 + fraction),
        radius: 3.2 + (index % 4) * 0.75,
        color: sparkColors[index % sparkColors.length],
        start: now + (index / 12) * 115,
        duration: duration * (0.72 + 0.28 * fraction),
      };
    });

    nav.classList.add('gooey-moving');
    animationFrame = window.requestAnimationFrame(paint);
  };

  const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  observer?.observe(nav);

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) drawStatic();
  });

  for (const item of items) {
    item.addEventListener('pointerenter', () => {
      pointerItem = item;
      moveTo(item, true);
    });
    item.addEventListener('click', () => {
      currentItem = item;
      moveTo(item, true);
    });
  }

  nav.addEventListener('pointerleave', () => {
    pointerItem = null;
    moveTo(focusedItem ?? currentItem, true);
  });

  nav.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !items.includes(target as GooeyItem)) return;
    focusedItem = target as GooeyItem;
    if (target instanceof HTMLButtonElement && target.getAttribute('aria-selected') === 'true') {
      currentItem = target;
    }
    moveTo(target as GooeyItem, true);
  });

  nav.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && nav.contains(event.relatedTarget)) return;
    focusedItem = null;
    moveTo(pointerItem ?? currentItem, true);
  });

  nav.classList.add('gooey-ready');
  resize();
}

function initialiseNavigation(): void {
  ensureGooeyFilter();
  document.querySelectorAll<HTMLElement>('.studio-links, .tabs[data-tab-group]').forEach(enhanceNavigation);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseNavigation, { once: true });
} else {
  initialiseNavigation();
}

