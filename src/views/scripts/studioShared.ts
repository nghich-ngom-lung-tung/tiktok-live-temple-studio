export async function rpc(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const res = await window.TempleAuth.fetch('/rpc', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || data.error || `Lỗi kết nối (${res.status})`);
  if (data.result?.ok === false) throw new Error(data.result.error || 'Không thực hiện được yêu cầu.');
  return data.result;
}
let toastTimer: number;
export function toast(message: string): void {
  let el = document.getElementById('studioToast');
  if (!el) { el=document.createElement('div'); el.id='studioToast'; el.className='toast'; el.setAttribute('role','status'); document.body.append(el); }
  el.textContent=message; el.hidden=false; clearTimeout(toastTimer); toastTimer=window.setTimeout(()=>el.hidden=true,6000);
}
export function initTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tab-group]').forEach(group=> {
    const buttons=Array.from(group.querySelectorAll<HTMLButtonElement>('[data-tab]'));
    const activate=(button: HTMLButtonElement)=> {
      buttons.forEach(b=>{ const active=b===button; b.setAttribute('aria-selected',String(active)); b.tabIndex=active?0:-1; document.getElementById(b.dataset.tab).hidden=!active; });
    };
    buttons.forEach((button,index)=> {
      button.setAttribute('role','tab'); button.setAttribute('aria-controls',button.dataset.tab);
      button.addEventListener('click',()=>activate(button));
      button.addEventListener('keydown',e=>{ if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return; e.preventDefault(); const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length; activate(buttons[next]); buttons[next].focus(); });
    });
    if(buttons[0])activate(buttons[0]);
  });
}
export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
