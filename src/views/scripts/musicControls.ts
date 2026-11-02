import { rpc, toast, escapeHtml } from './studioShared';
export const tracks = [
  {id:'lotus',title:'Sen tĩnh',mood:'Chuông nhẹ · nền ấm, chậm'},
  {id:'rain',title:'Mưa mái chùa',mood:'Mưa mềm · chuông thưa'},
  {id:'stream',title:'Suối an nhiên',mood:'Dòng nước · âm nền sâu'},
  {id:'bamboo',title:'Gió qua trúc',mood:'Gió nhẹ · giai điệu thoáng'},
  {id:'night',title:'Đêm tịch lặng',mood:'Âm trầm · khoảng nghỉ dài'},
  {id:'dawn',title:'Bình minh',mood:'Âm sáng · giai điệu chậm'}
];
let engine:any, selected='lotus', rotate=false, localUrl='';
const select=document.getElementById('musicTrack') as HTMLSelectElement|null;
const auto=document.getElementById('musicAutoRotate') as HTMLInputElement|null;
const preview=document.getElementById('musicPreview') as HTMLAudioElement|null;
select?.replaceChildren(...tracks.map(t=>new Option(t.title,t.id)));
const list=document.getElementById('musicLibrary');
if(list) list.innerHTML=tracks.map((t,i)=>`<button class="track-row" data-track="${t.id}" aria-pressed="false"><span class="track-number">0${i+1}</span><span>${escapeHtml(t.title)}<small>${escapeHtml(t.mood)}</small></span><span>0:48</span></button>`).join('');
async function choose(id:string) { try { await rpc('temple.updateSettings',{musicTrack:id}); localUrl && URL.revokeObjectURL(localUrl); localUrl=''; syncMusicControls({musicTrack:id,musicAutoRotate:rotate}); toast(`Đã chọn ${tracks.find(t=>t.id===id)?.title}.`); } catch(e) { toast(e.message); if(select)select.value=selected; } }
select?.addEventListener('change',()=>void choose(select.value));
list?.addEventListener('click',e=>{ const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-track]'); if(b)void choose(b.dataset.track); });
auto?.addEventListener('change',async()=>{ const value=auto.checked; try{ await rpc('temple.updateSettings',{musicAutoRotate:value}); rotate=value; if(engine)engine.bgAudio.loop=!rotate; }catch(e){auto.checked=rotate;toast(e.message);} });
document.getElementById('btnMusicNext')?.addEventListener('click',()=>void choose(tracks[(tracks.findIndex(t=>t.id===selected)+1)%tracks.length].id));
document.getElementById('btnMusicPreview')?.addEventListener('click',()=>{ if(!preview)return; preview.src=localUrl||`/assets/phat-giao/music/${selected}.wav`; preview.play().catch(()=>toast('Bấm phát trên thanh nghe thử để bật âm thanh.')); });
(document.getElementById('musicFile') as HTMLInputElement|null)?.addEventListener('change',e=>{ const file=(e.target as HTMLInputElement).files?.[0]; if(!file)return; if(!file.type.startsWith('audio/')||file.size>50*1024*1024){toast('Chọn file âm thanh dưới 50 MB.');return;} if(localUrl)URL.revokeObjectURL(localUrl); localUrl=URL.createObjectURL(file); if(engine)engine.setMusicSource(localUrl); if(preview){preview.src=localUrl;preview.play().catch(()=>{});} const note=document.getElementById('musicFileStatus'); if(note)note.textContent=`File riêng: ${file.name}. Chỉ phát ở tab này; tải lại trang để dùng thư viện.`; });
export function bindMusicEngine(value:any):void {
  engine=value;
  engine.bgAudio.addEventListener('ended',()=>{
    if(!rotate||localUrl||!engine.bgAudio.ended)return;
    const source = new URL(engine.bgAudio.currentSrc || engine.bgAudio.src, location.href).pathname;
    const expectedTrack = tracks.find(track => source.endsWith(`/${track.id}.wav`))?.id;
    if (expectedTrack) void rpc('temple.advanceMusic',{expectedTrack}).catch(error=>toast(error.message));
  });
  syncMusicControls({musicTrack:selected,musicAutoRotate:rotate});
}
export function syncMusicControls(settings:any):void { const next=tracks.some(t=>t.id===settings?.musicTrack)?settings.musicTrack:selected; const changed=next!==selected; selected=next; rotate=Boolean(settings?.musicAutoRotate); if(changed&&localUrl){URL.revokeObjectURL(localUrl);localUrl='';} if(select)select.value=selected; if(auto)auto.checked=rotate; document.querySelectorAll<HTMLElement>('[data-track]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.track===selected))); if(engine){engine.bgAudio.loop=localUrl?true:!rotate;if(!localUrl)engine.setMusicSource(`/assets/phat-giao/music/${selected}.wav`);} }
