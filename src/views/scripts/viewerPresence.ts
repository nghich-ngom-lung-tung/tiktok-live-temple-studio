import { escapeHtml } from './studioShared';
export function viewerKey(viewer:any):string { return String(viewer?.uniqueId || viewer?.name || viewer?.user || '').toLocaleLowerCase('vi'); }
export function avatarMarkup(viewer:any):string {
  if(!viewer)return '';
  let url='';
  try {const candidate=new URL(String(viewer.avatar||''),location.origin);if(viewer.avatar&&['http:','https:'].includes(candidate.protocol))url=candidate.href;}catch{}
  return `<span class="viewer-face">${escapeHtml(String(viewer.name||viewer.user||'T').charAt(0))}${url?`<img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="eager">`:''}</span>`;
}
document.addEventListener('error',e=>{const img=e.target as HTMLImageElement;if(img.tagName==='IMG'&&img.parentElement?.classList.contains('viewer-face'))img.hidden=true;},true);
const bubbles=new Map<string,{element:HTMLElement;timer:number}>();
let trackingFrame = 0;
export function clearViewerChats(): void {
  for (const key of [...bubbles.keys()]) removeBubble(key);
  if (trackingFrame) cancelAnimationFrame(trackingFrame);
  trackingFrame = 0;
}
function removeBubble(key: string): void {
  const entry = bubbles.get(key);
  if (!entry) return;
  window.clearTimeout(entry.timer); entry.element.remove(); bubbles.delete(key);
  document.querySelectorAll<HTMLElement>('[data-viewer]').forEach(seat => {
    if (seat.dataset.viewer === key) seat.classList.remove('is-chatting');
  });
}

function trackChatBubbles(): void {
  trackingFrame = 0;
  const stage = document.getElementById('stage9x16');
  if (!stage || !bubbles.size) return;
  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / stage.offsetWidth;
  if (scale <= 0) { trackingFrame = requestAnimationFrame(trackChatBubbles); return; }
  const anchors = Array.from(stage.querySelectorAll<HTMLElement>('[data-viewer], [data-viewer-arrival]'));
  const placed: {left:number;top:number;width:number;height:number}[] = [];
  for (const [key, entry] of bubbles) {
    const walker = anchors.find(el => el.dataset.viewerArrival === key && el.getBoundingClientRect().width > 0);
    const seat = anchors.find(el => el.dataset.viewer === key);
    const anchor = walker || seat;
    if (!anchor) { entry.element.style.visibility = 'hidden'; continue; }
    const rect = anchor.getBoundingClientRect();
    const centerX = (rect.left + rect.width / 2 - stageRect.left) / scale;
    const width = entry.element.offsetWidth, height = entry.element.offsetHeight;
    const left = Math.max(18, Math.min(stage.offsetWidth - width - 18, centerX - width / 2));
    let top = Math.max(100, (rect.top - stageRect.top) / scale - height - 20);
    for (const previous of placed) {
      if (left < previous.left + previous.width + 8 && left + width > previous.left - 8
        && top < previous.top + previous.height + 8 && top + height > previous.top - 8) {
        top = Math.max(100, previous.top - height - 14);
      }
    }
    entry.element.style.left = `${left}px`;
    entry.element.style.top = `${top}px`;
    entry.element.style.setProperty('--bubble-tail-left', `${Math.max(20, Math.min(width - 35, centerX - left - 9))}px`);
    entry.element.style.visibility = 'visible';
    seat?.classList.add('is-chatting');
    placed.push({ left, top, width, height });
  }
  trackingFrame = requestAnimationFrame(trackChatBubbles);
}

export function showViewerChat(data:any):void {
  if(!data?.comment)return;
  const stage=document.getElementById('stage9x16');if(!stage)return;
  const key=viewerKey(data);
  if (!key) return;
  removeBubble(key);
  if(bubbles.size>=6){const oldest=bubbles.keys().next().value;if(oldest)removeBubble(oldest);}
  const bubble=document.createElement('div');bubble.className='viewer-chat-bubble';
  bubble.style.visibility='hidden'; bubble.dataset.chatViewer=key;
  bubble.setAttribute('role','status');
  const name=document.createElement('strong');name.textContent=String(data.user||'Thí chủ');
  const text=document.createElement('span');text.textContent=String(data.comment).slice(0,240);bubble.append(name,text);stage.append(bubble);
  const timer=window.setTimeout(()=>removeBubble(key),6500);bubbles.set(key,{element:bubble,timer});
  if(!trackingFrame)trackChatBubbles();
}
