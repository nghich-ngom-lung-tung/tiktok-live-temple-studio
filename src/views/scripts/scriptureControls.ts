import { rpc } from './studioShared';
type ScriptureItem = { id: string; number: number; reference: string; theme: string; category: string; categoryLabel: string; title: string; reflection: string };

export function createScriptureControls(selectId: string, reflectionId: string, resetId: string) {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  const reflection = document.getElementById(reflectionId) as HTMLTextAreaElement | null;
  const category = document.getElementById('scriptureCategory') as HTMLSelectElement | null;
  const random = document.getElementById('btnRandomScripture') as HTMLButtonElement | null;
  const count = document.getElementById('scriptureCatalogCount');
  const drafts = new Map<string, string>();
  let catalog: ScriptureItem[] = [];
  let current = '';
  let revision = 0;
  function saveDraft() { if (current && reflection) drafts.set(current, reflection.value); }
  function render() {
    if (!select || !reflection) return;
    current = select.value;
    reflection.value = drafts.get(current) ?? catalog.find(item => item.id === current)?.reflection ?? '';
  }
  function renderOptions(selected = select?.value) {
    if (!select) return;
    const items = catalog.filter(item => !category?.value || category.value === 'all' || item.category === category.value);
    select.replaceChildren(...items.map(item => new Option(`${String(item.number).padStart(3, '0')} · ${item.title} · ${item.reference}`, item.id)));
    if (items.some(item => item.id === selected)) select.value = selected!;
    if (count) count.textContent = `${items.length}/${catalog.length} lời suy ngẫm · ${new Set(catalog.map(item => item.category)).size} chủ đề. Mỗi lời có tham chiếu Kinh Thánh và có thể chỉnh sửa.`;
    render();
  }
  select?.addEventListener('change', () => { revision++; saveDraft(); render(); });
  category?.addEventListener('change', () => { revision++; saveDraft(); renderOptions(); });
  reflection?.addEventListener('input', () => { revision++; saveDraft(); });
  document.getElementById(resetId)?.addEventListener('click', () => { revision++; drafts.delete(current); render(); });
  random?.addEventListener('click', async () => {
    if (!select || !catalog.length) return;
    random.disabled = true;
    const requestRevision = revision;
    try {
      const picked = await rpc('christian.pickScripture', { category: category?.value || 'all' });
      if (requestRevision !== revision || !catalog.some(item => item.id === picked.id)) return;
      saveDraft(); select.value = picked.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error: any) { if (count) count.textContent = error.message || 'Chưa chọn được lời suy ngẫm.'; }
    finally { random.disabled = !catalog.length; }
  });
  return {
    getSelection() {
      const item = catalog.find(item => item.id === select?.value);
      return item ? { ...item, reflection: reflection?.value.trim() || item.reflection } : null;
    },
    load(items: ScriptureItem[]) {
      if (!select || !reflection) return;
      revision++; saveDraft(); catalog = items;
      if (category) {
        const previous = category.value;
        const topics = [...new Map(items.map(item => [item.category, item.categoryLabel])).entries()];
        category.replaceChildren(new Option('Tất cả chủ đề', 'all'), ...topics.map(([id, label]) => new Option(`${label} · ${items.filter(item => item.category === id).length} lời`, id)));
        category.value = topics.some(([id]) => id === previous) ? previous : 'all';
      }
      renderOptions();
      if (random) random.disabled = !items.length;
    }
  };
}
