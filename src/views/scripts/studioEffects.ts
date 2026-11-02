const paths:Record<string,string>={
 incense:'<path d="M8 24h16l-2 5H10l-2-5ZM12 24V10m4 14V7m4 17V10M12 6c-3-3 3-3 0-6m4 5c-3-3 3-3 0-5m4 6c-3-3 3-3 0-6"/>',
 prayer:'<path d="M9 8h14l3 9-3 9H9l-3-9 3-9Zm7-5v5m0 18v4M9 13h14M9 21h14M16 8v18"/>',
 cross:'<path d="M16 3v26M7 11h18"/>',
 bible:'<path d="M4 6h4a8 8 0 0 1 8 8v13a8 8 0 0 0-8-6H4V6Zm24 0h-4a8 8 0 0 0-8 8v13a8 8 0 0 1 8-6h4V6ZM22 9v6m-3-3h6"/>',
 heart:'<path d="M16 28S4 21 4 12a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 9-12 16-12 16Z"/>',
 gift:'<path d="M4 13h24v16H4zM2 8h28v5H2zM16 8v21m0-21C8 8 7 2 11 2c3 0 5 4 5 6Zm0 0c8 0 9-6 5-6-3 0-5 4-5 6Z"/>',
 person:'<circle cx="16" cy="10" r="6"/><path d="M5 29c0-7 4-11 11-11s11 4 11 11"/>',
 link:'<path d="M13 20 9 24a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 0m4 1 4-4a5 5 0 0 1 7 7l-6 6a5 5 0 0 1-7 0m-10 3 12-12"/>',
 save:'<path d="M5 3h18l5 5v21H4V3Zm4 0v9h14V4M9 29V17h14v12"/>',
 chat:'<path d="M4 5h24v18H15l-8 6v-6H4zM9 12h14m-14 5h9"/>',
 trash:'<path d="M5 8h22M12 8V4h8v4m4 0-1 21H9L8 8m5 5v11m6-11v11"/>',
 fish:'<path d="M5 20c0-6 5-10 12-10s11 4 11 10c0 5-5 8-12 8S5 25 5 20Zm4-1 13-1M5 5l11 9M3 3l3 1-2 3-2-2"/>',
 bell:'<path d="M7 22h18c-3-4-2-5-3-10a6 6 0 0 0-12 0c-1 5 0 6-3 10ZM13 26c1 3 5 3 6 0M16 3V1M3 10l2 2m24-2-2 2"/>',
 fortune:'<path d="M8 13h16l-2 17H10L8 13Zm4 0L10 3l4-1 2 11m1 0 2-11 4 1-3 10M12 20h8m-7 4h6"/>',
 lotus:'<path d="M16 28C6 26 2 20 3 13c6 0 10 3 13 8 3-5 7-8 13-8 1 7-3 13-13 15ZM16 24C9 20 10 10 16 4c6 6 7 16 0 20Z"/>',
 ceremony:'<path d="M5 27 3 12l7 5 6-13 6 13 7-5-2 15H5ZM8 31h16"/>',
 welcome:'<path d="M3 11c4-3 9-3 13-3s9 0 13 3M6 8h20M8 11v16M24 11v16M12 11v7h8v-7M4 27h24M12 15h8"/>',
 sound:'<path d="M4 13h5l7-6v18l-7-6H4zM21 11a7 7 0 0 1 0 10m3-14a12 12 0 0 1 0 18"/>',
 play:'<path d="m11 7 14 9-14 9z"/>'
};
export function ritualIcon(key:string):string {return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]||paths.lotus}</svg>`;}
const actions=[['burnIncense','btnRpcIncense','incense','Dâng 3 nén hương'],['sendPrayer','btnRpcLantern','prayer','Gửi một lời an lành'],['strikeWoodenFish','btnRpcWoodenFish','fish','Nhịp mõ tỉnh tâm'],['ringBell','btnRpcBell','bell','Chuông ngân thanh tịnh'],['drawFortune','btnRpcFortune','fortune','Một lời chiêm nghiệm'],['offerGift','btnRpcGiftLotus','lotus','Thành tâm kính lễ'],['grandCeremony','btnRpcGrandCeremony','ceremony','Đại lễ trang nghiêm'],['previewWelcome','btnWelcomePreview','welcome','Đón người hữu duyên']];
for(const [method,id,icon,hint] of actions){document.querySelectorAll<HTMLButtonElement>(`[data-rpc-method="temple.${method}"],#${id}`).forEach(button=>{const title=button.textContent.trim();button.classList.add('ritual-action');button.dataset.ritual=icon;button.innerHTML=`<span class="ritual-icon">${ritualIcon(icon)}</span><span class="ritual-label"><strong>${title}</strong><small>${hint}</small></span><span class="ritual-arrow" aria-hidden="true">↗</span>`;});}
document.querySelectorAll<HTMLButtonElement>('.ritual-action').forEach(button=>button.setAttribute('aria-label',button.querySelector('strong')?.textContent||button.textContent));
document.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button:not(:disabled)');if(!button)return;button.classList.remove('is-pressed');void button.offsetWidth;button.classList.add('is-pressed');setTimeout(()=>button.classList.remove('is-pressed'),650);});
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.addEventListener('click',()=>{const panel=document.getElementById(button.dataset.tab);if(panel&&!matchMedia('(prefers-reduced-motion: reduce)').matches)panel.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'});}));

document.querySelectorAll<HTMLElement>('.hud-icon[data-icon],.hotspot-icon[data-icon],.top-stat-icon[data-icon],.sfx-card-icon[data-icon],.sfx-title-icon[data-icon],.sfx-card-play[data-icon],.welcome-mark[data-icon],.christian-icon[data-icon]').forEach(el=>el.innerHTML=ritualIcon(el.dataset.icon));
