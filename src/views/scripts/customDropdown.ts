/**
 * Custom Sanctuary Dropdown Component for Tam Thế Studio
 * Replaces native browser <select> with an authentic lacquer & parchment dropdown
 * fully synced with underlying <select> values and change events.
 */

const CHEVRON_SVG = `<svg class="custom-select-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
  <path d="M5 7.5L10 12.5L15 7.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const CHECK_SVG = `<svg class="custom-select-option-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

let activeDropdown: HTMLElement | null = null;

function positionActiveDropdown(): void {
  if (!activeDropdown) return;

  const trigger = activeDropdown.querySelector<HTMLElement>('.custom-select-trigger');
  const dropdown = activeDropdown.querySelector<HTMLElement>('.custom-select-dropdown');
  if (!trigger || !dropdown) return;

  const rect = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const width = Math.max(0, Math.min(rect.width, viewportWidth - 24));
  const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
  const desiredHeight = Math.min(260, Math.max(72, dropdown.scrollHeight));
  const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 12);
  const spaceAbove = Math.max(0, rect.top - 12);
  const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
  const availableSpace = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(72, Math.min(260, availableSpace));
  const visibleHeight = Math.min(desiredHeight, maxHeight);
  const top = openAbove
    ? Math.max(12, rect.top - visibleHeight - 5)
    : Math.min(rect.bottom + 5, viewportHeight - visibleHeight - 12);

  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '9999';
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  dropdown.style.width = `${width}px`;
  dropdown.style.maxHeight = `${maxHeight}px`;
}

function closeAllDropdowns(): void {
  document.querySelectorAll<HTMLElement>('.temple-custom-select.is-open').forEach(el => {
    el.classList.remove('is-open');
    el.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  });
  activeDropdown = null;
}

export function enhanceSelect(select: HTMLSelectElement): HTMLElement {
  // If already enhanced, return the existing wrapper
  const existing = select.parentElement?.closest<HTMLElement>('.temple-custom-select');
  if (existing) return existing;

  const wrapper = document.createElement('div');
  wrapper.className = 'temple-custom-select';

  // Insert wrapper before select, then move select inside wrapper
  select.parentNode?.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('custom-select-native');

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'custom-select-label';

  const chevronSpan = document.createElement('span');
  chevronSpan.innerHTML = CHEVRON_SVG;

  trigger.appendChild(labelSpan);
  trigger.appendChild(chevronSpan);
  wrapper.appendChild(trigger);

  // Dropdown list
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown';
  dropdown.setAttribute('role', 'listbox');
  wrapper.appendChild(dropdown);

  function syncFromSelect(): void {
    trigger.disabled = select.disabled;
    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    labelSpan.textContent = selectedOption ? selectedOption.text : 'Chọn...';

    // Rebuild options in dropdown
    dropdown.replaceChildren();
    if (select.options.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'custom-select-empty';
      emptyItem.textContent = 'Không có tùy chọn';
      dropdown.appendChild(emptyItem);
      return;
    }

    Array.from(select.options).forEach((opt, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.setAttribute('role', 'option');
      const isSelected = opt.selected || select.value === opt.value;
      if (isSelected) {
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.setAttribute('aria-selected', 'false');
      }

      const textSpan = document.createElement('span');
      textSpan.textContent = opt.text;
      item.appendChild(textSpan);

      const checkSpan = document.createElement('span');
      checkSpan.innerHTML = CHECK_SVG;
      item.appendChild(checkSpan);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (select.value !== opt.value) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncFromSelect();
        closeAllDropdowns();
        trigger.focus();
      });

      dropdown.appendChild(item);
    });
  }

  // Hook value property setter on this specific select element
  const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(select, 'value', {
    get() {
      return originalDescriptor?.get?.call(this);
    },
    set(val) {
      originalDescriptor?.set?.call(this, val);
      syncFromSelect();
    },
    configurable: true
  });

  // Toggle open
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.disabled) return;
    const isOpen = wrapper.classList.contains('is-open');
    closeAllDropdowns();
    if (!isOpen) {
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      activeDropdown = wrapper;
      // Scroll selected item into view
      const selectedItem = dropdown.querySelector('.custom-select-option.is-selected') as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
      positionActiveDropdown();
    }
  });

  // Keyboard navigation
  trigger.addEventListener('keydown', (e) => {
    if (trigger.disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (!wrapper.classList.contains('is-open')) {
        wrapper.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        activeDropdown = wrapper;
        positionActiveDropdown();
      }
      const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>('.custom-select-option'));
      const currentIndex = options.findIndex(opt => opt.classList.contains('is-selected'));
      let nextIndex = currentIndex;
      if (e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      }
      if (options[nextIndex]) {
        options[nextIndex].focus();
      }
    } else if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  // Watch for mutations on native select (options added/removed, disabled state)
  const observer = new MutationObserver(() => syncFromSelect());
  observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  // Native change listener
  select.addEventListener('change', () => syncFromSelect());

  // Initial sync
  syncFromSelect();

  return wrapper;
}

const UPLOAD_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
  <path d="M10 14V3M10 3L6 7M10 3L14 7M3 13v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function enhanceFileInput(input: HTMLInputElement, buttonLabel = 'Chọn tệp'): HTMLElement {
  const existing = input.parentElement?.closest<HTMLElement>('.temple-file-picker');
  if (existing) return existing;

  const wrapper = document.createElement('div');
  wrapper.className = 'temple-file-picker';

  input.parentNode?.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  input.classList.add('custom-file-native');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'temple-file-btn';
  btn.innerHTML = UPLOAD_SVG;
  const label = document.createElement('span');
  label.textContent = buttonLabel;
  btn.append(label);

  const fileName = document.createElement('span');
  fileName.className = 'temple-file-name';
  fileName.textContent = 'Chưa chọn tệp';

  wrapper.appendChild(btn);
  wrapper.appendChild(fileName);

  btn.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      fileName.textContent = file.name;
      fileName.classList.add('has-file');
    } else {
      fileName.textContent = 'Chưa chọn tệp';
      fileName.classList.remove('has-file');
    }
  });

  return wrapper;
}

export function initCustomComponents(): void {
  document.querySelectorAll<HTMLSelectElement>('select').forEach(enhanceSelect);
  document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => {
    enhanceFileInput(input, input.id === 'musicFile' ? 'Chọn tệp âm thanh' : 'Chọn tệp');
  });
}

// Global outside click and escape handler
document.addEventListener('click', (e) => {
  if (activeDropdown && !activeDropdown.contains(e.target as Node)) {
    closeAllDropdowns();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
});

window.addEventListener('resize', positionActiveDropdown, { passive: true });
document.addEventListener('scroll', positionActiveDropdown, { capture: true, passive: true });

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCustomComponents);
} else {
  initCustomComponents();
}
