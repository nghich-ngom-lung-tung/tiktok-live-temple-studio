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
export function showViewerChat(data:any):void {
  if(!data?.comment)return;
  const stage=document.getElementById('stage9x16');if(!stage)return;
  const key=viewerKey(data);
  const seat=Array.from(stage.querySelectorAll<HTMLElement>('[data-viewer]')).find(el=>el.dataset.viewer===key);
  const existing=bubbles.get(key);if(existing){clearTimeout(existing.timer);existing.element.remove();bubbles.delete(key);}
  if(bubbles.size>=4){const [oldKey,old]=bubbles.entries().next().value;clearTimeout(old.timer);old.element.remove();bubbles.delete(oldKey);}
  const bubble=document.createElement('div');bubble.className='viewer-chat-bubble';
  bubble.style.left=`${Math.max(28,Math.min(742,Number(seat?.dataset.x)||385))}px`;
  bubble.style.top=`${Math.max(850,(Number(seat?.dataset.y)||1110)-150)}px`;
  const name=document.createElement('strong');name.textContent=String(data.user||'Thí chủ');
  const text=document.createElement('span');text.textContent=String(data.comment).slice(0,120);bubble.append(name,text);stage.append(bubble);
  seat?.classList.add('is-chatting');
  const timer=window.setTimeout(()=>{bubble.remove();bubbles.delete(key);seat?.classList.remove('is-chatting');},6000);bubbles.set(key,{element:bubble,timer});
}
