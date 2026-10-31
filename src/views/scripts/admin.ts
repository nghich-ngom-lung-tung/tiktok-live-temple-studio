import { ritualIcon } from './studioEffects';
import { syncVoiceControls } from './voiceControls';
import { syncMusicControls } from './musicControls';
import { initTabs, rpc, toast, escapeHtml } from './studioShared';
import { syncNarrationControls } from './narrationControls';
initTabs();
const $=(id:string)=>document.getElementById(id);
const value=(id:string)=>($(id) as HTMLInputElement).value.trim();
let refreshing=false, deck:any[]=[], libraryLoaded=false, authCollapsed=false;
async function run(method:string,params:Record<string,unknown>={},button?:HTMLButtonElement):Promise<any> {
 if(button)button.disabled=true;
 try { const result=await rpc(method,params); $('rpcOutput').textContent=JSON.stringify(result,null,2); toast('Đã thực hiện.'); void refreshStatus(); return result; }
 catch(e){$('rpcOutput').textContent=e.message;toast(e.message);throw e;} finally{if(button)button.disabled=false;}
}
const ritualInput=()=>({user:value('rpcUser')||'Khách Demo',wish:value('rpcWish')});
document.querySelectorAll<HTMLButtonElement>('[data-rpc-method]').forEach(button=>button.addEventListener('click',()=>{ $('actionStatus').textContent='Đang gửi tương tác…'; run(button.dataset.rpcMethod,{...ritualInput(),...JSON.parse(button.dataset.rpcParams||'{}')},button).then(()=>$('actionStatus').textContent='Đã gửi tương tác tới màn Live.').catch(e=>$('actionStatus').textContent=e.message); }));
$('btnConn').onclick=()=>void run('live.connect',{username:value('ttUser')},$('btnConn') as HTMLButtonElement).catch(()=>{});
$('btnDisc').onclick=()=>void run('live.disconnect',{},$('btnDisc') as HTMLButtonElement).catch(()=>{});
$('btnSendComment').onclick=()=>void run('temple.comment',{...ritualInput(),comment:value('simComment')},$('btnSendComment') as HTMLButtonElement).catch(()=>{});
$('btnResetMerit').onclick=()=>{if(window.confirm('Đặt lại toàn bộ công đức và danh sách thí chủ?'))void run('temple.resetMerit').catch(()=>{});};
function renderFortunes():void {
 const search=value('fortuneSearch').toLocaleLowerCase('vi'),category=value('fortuneCategory');
 const filtered=deck.filter(f=>(category==='all'||f.category===category)&&`${f.number} ${f.title} ${f.meaning}`.toLocaleLowerCase('vi').includes(search));
 $('fortuneCount').textContent=`${filtered.length} / 100 quẻ`;
 $('fortuneLibrary').innerHTML=filtered.length?filtered.map(f=>`<article class="fortune-card"><span class="eyebrow">Quẻ ${String(f.number).padStart(2,'0')} · ${escapeHtml(f.categoryLabel)}</span><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.meaning)}</p><p class="advice">${escapeHtml(f.advice)}</p><button class="btn" data-listen="${f.number}">Nghe lời giải</button></article>`).join(''):'<p class="muted">Không tìm thấy quẻ phù hợp. Thử từ khóa khác.</p>';
}
$('fortuneSearch').addEventListener('input',renderFortunes);$('fortuneCategory').addEventListener('change',renderFortunes);
$('fortuneLibrary').addEventListener('click',async e=>{
 const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-listen]');if(!button)return;
 const fortune=deck.find(f=>f.number===Number(button.dataset.listen));if(!fortune)return;button.disabled=true;$('fortuneAudioStatus').textContent=`Đang tạo giọng đọc: ${fortune.title}…`;
 try{const result=await rpc('temple.speak',{text:fortune.reading,broadcast:false});const url=await window.TempleAuth.fetchAudioBlobUrl(result.url);const audio=$('fortuneAudio') as HTMLAudioElement;if(audio.dataset.blobUrl)URL.revokeObjectURL(audio.dataset.blobUrl);audio.dataset.blobUrl=url;audio.src=url;await audio.play();$('fortuneAudioStatus').textContent=`Đang nghe: ${fortune.title}. Chỉ phát tại trình duyệt này.`;}catch(e){$('fortuneAudioStatus').textContent=e.message;}finally{button.disabled=false;}
});
async function refreshStatus():Promise<void> {
 if(refreshing)return;refreshing=true;
 try {
  if(!window.TempleAuth.getToken()){$('statusBanner').textContent='Chưa xác thực';$('statusBanner').dataset.state='';return;}
  const st=await rpc('temple.getState');if(!authCollapsed){(document.getElementById('authGate') as HTMLDetailsElement).open=false;authCollapsed=true;}syncVoiceControls(st.tts||{},st.settings?.ttsVoice,st.settings?.ttsVoiceRotation);syncMusicControls(st.settings);syncNarrationControls(st.settings);
  for(const [id,key] of [['totalIncense','totalIncense'],['totalMerit','totalMerit']])$(id).textContent=Number(st[key]||0).toLocaleString('vi-VN');
  $('viewerCount').textContent=st.tiktok?.connected?Number(st.tiktok.viewerCount||0).toLocaleString('vi-VN'):'—';
  $('statusBanner').textContent=st.tts?.ready?'ZeroTTS sẵn sàng':st.tts?.status==='error'?'Giọng đọc gặp lỗi':'Giọng đọc đang khởi động';$('statusBanner').dataset.state=st.tts?.ready?'ok':st.tts?.status==='error'?'error':'loading';
  $('tiktokStatus').textContent=st.tiktok?.connected?`Đang Live @${st.tiktok.username}`:st.tiktok?.connecting?'Đang kết nối…':'Chưa kết nối';$('tiktokStatus').dataset.state=st.tiktok?.connected?'ok':'';$('tiktokError').textContent=st.tiktok?.lastError||'';
  const events=(st.recentEvents||[]).slice(0,5);const labels={burnIncense:'dâng hương',sendPrayer:'thả hoa đăng',drawFortune:'gieo quẻ',ringBell:'thỉnh chuông',offerGift:'dâng lễ',grandCeremony:'cử hành đại lễ',strikeWoodenFish:'gõ mõ'};
  const activityIcons:Record<string,string>={burnIncense:'incense',sendPrayer:'prayer',drawFortune:'fortune',ringBell:'bell',offerGift:'lotus',grandCeremony:'ceremony',strikeWoodenFish:'fish'};
  $('recentActivity').innerHTML=events.length?events.map(e=>`<li class="event-summary-item" data-kind="${escapeHtml(e.type||'other')}"><span class="event-feed-icon" aria-hidden="true">${ritualIcon(activityIcons[e.type]||'lotus')}</span><span class="event-summary-copy"><span><strong>${escapeHtml(e.user)}</strong> ${labels[e.type]||'tương tác'}${e.fortune?` · Quẻ ${Number(e.fortune.number)}`:''}</span><time>${e.timestamp&&!Number.isNaN(new Date(e.timestamp).getTime())?new Date(e.timestamp).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'Vừa xong'}</time></span></li>`).join(''):'<li class="event-summary-empty">Chưa có tương tác trong phiên này.</li>';
  if(!libraryLoaded){deck=await rpc('temple.listFortunes');libraryLoaded=true;renderFortunes();}
 }catch(e){$('statusBanner').textContent='Chưa kết nối được';$('statusBanner').dataset.state='error';}finally{refreshing=false;}
}
window.addEventListener('temple-auth-changed',()=>{libraryLoaded=false;authCollapsed=false;void refreshStatus();});void refreshStatus();window.setInterval(()=>void refreshStatus(),5000);
