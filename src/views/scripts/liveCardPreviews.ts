type PreviewKind = 'fortune' | 'devotee' | 'chat' | 'hud' | 'welcome' | 'grand';

const previewNames: Record<PreviewKind, string> = {
  fortune: 'Thẻ gieo quẻ',
  devotee: 'Tên & lời nguyện',
  chat: 'Bình luận người xem',
  hud: 'Dải HUD & công đức',
  welcome: 'Chào người vào phòng',
  grand: 'Banner đại lễ',
};

const previewHints: Record<PreviewKind, string> = {
  fortune: 'Mẫu kết quả gieo quẻ phủ nhẹ khung Live.',
  devotee: 'Tên thí chủ và lời nguyện hiện cạnh nhân vật.',
  chat: 'Bình luận của người xem bật lên cạnh đạo tràng.',
  hud: 'Dải HUD gồm lời báo, ba thẻ quà và bảng tấm lòng thành.',
  welcome: 'Bảng chào hiện khi có người mới vào phòng.',
  grand: 'Banner nổi bật cho tương tác Đại lễ Kim Long.',
};

const actionLabels: Partial<Record<PreviewKind, string>> = {
  devotee: 'Dâng hương • +15 Công Đức',
  hud: 'Dâng 3 nén hương • +15 Công Đức',
  grand: 'Đại lễ Kim Long • +14.950 Công Đức',
};

const stage = document.getElementById('livePreviewStage');
const frame = document.getElementById('livePreviewFrame');
const nameInput = document.getElementById('livePreviewUser') as HTMLInputElement | null;
const wishInput = document.getElementById('livePreviewWish') as HTMLTextAreaElement | null;
const label = document.getElementById('livePreviewLabel');
const hint = document.getElementById('livePreviewHint');

if (stage && frame && nameInput && wishInput) {
  let activePreview: PreviewKind = 'fortune';

  const updateSampleCopy = (): void => {
    const user = nameInput.value.trim() || 'Khách Demo';
    const wish = wishInput.value.trim() || 'Cầu bình an và sức khỏe cho gia đình.';

    stage.querySelectorAll<HTMLElement>('[data-preview-user]').forEach((node) => {
      node.textContent = user;
    });
    stage.querySelectorAll<HTMLElement>('[data-preview-avatar]').forEach((node) => {
      node.textContent = Array.from(user)[0] || 'K';
    });
    stage.querySelectorAll<HTMLElement>('[data-preview-wish]').forEach((node) => {
      node.textContent = node.classList.contains('worshipper-wish-bubble') ? `“${wish}”` : wish;
    });

    const action = actionLabels[activePreview];
    if (action) {
      stage.querySelectorAll<HTMLElement>('[data-preview-action]').forEach((node) => {
        node.textContent = action;
      });
    }
  };

  const setPreview = (kind: PreviewKind): void => {
    activePreview = kind;
    stage.dataset.preview = kind;
    if (label) label.textContent = previewNames[kind];
    if (hint) hint.textContent = previewHints[kind];
    document.querySelectorAll<HTMLButtonElement>('[data-live-preview]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.livePreview === kind));
    });
    updateSampleCopy();
  };

  document.querySelectorAll<HTMLButtonElement>('[data-live-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.livePreview as PreviewKind | undefined;
      if (kind && kind in previewNames) setPreview(kind);
    });
  });

  nameInput.addEventListener('input', updateSampleCopy);
  wishInput.addEventListener('input', updateSampleCopy);

  document.getElementById('btnReplayLivePreview')?.addEventListener('click', () => {
    stage.classList.remove('is-replaying');
    void stage.offsetWidth;
    stage.classList.add('is-replaying');
    window.setTimeout(() => stage.classList.remove('is-replaying'), 650);
  });

  const resizePreview = (): void => {
    const scale = frame.clientWidth / 1080;
    stage.style.setProperty('--live-preview-scale', String(scale));
  };

  resizePreview();
  new ResizeObserver(resizePreview).observe(frame);
  updateSampleCopy();
}
