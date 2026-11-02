import { TTS_VOICE_NAMES } from './ttsVoiceNames';

const select = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;
const status = document.getElementById('ttsVoiceStatus');
const preview = document.getElementById('btnVoicePreview') as HTMLButtonElement | null;
const rotationFieldset = document.getElementById('voiceRotationFieldset') as HTMLFieldSetElement | null;
const rotationList = document.getElementById('voiceRotationList');
const player = (document.getElementById('adminAudioPreview') || document.getElementById('voiceAudioPreview')) as HTMLAudioElement | null;
let saving = false, previewing = false, ready = false, savedVoice = 'maichi';
let availableVoices: string[] = [], savedRotation: string[] = [];
let draftRotation: string[] | null = null;
let savedRotationKey = '[]';

function renderRotationOptions(): void {
  if (!rotationList) return;
  rotationList.replaceChildren();
  if (!ready || availableVoices.length === 0) {
    const message = document.createElement('p');
    message.className = 'helper';
    message.textContent = 'Chờ ZeroTTS sẵn sàng để chọn giọng.';
    rotationList.append(message);
    return;
  }
  const selectedRotation = draftRotation ?? savedRotation;
  for (const voice of availableVoices) {
    const label = document.createElement('label');
    label.className = 'voice-choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = voice;
    input.checked = selectedRotation.includes(voice);
    input.disabled = saving;
    const caption = document.createElement('span');
    caption.textContent = TTS_VOICE_NAMES[voice] || voice;
    label.append(input, caption);
    rotationList.append(label);
  }
}

function updateDisabledState(): void {
  if (select) select.disabled = !ready || saving;
  if (preview) preview.disabled = !ready || saving || previewing;
  if (rotationFieldset) rotationFieldset.disabled = !ready || saving;
}

export function syncVoiceControls(
  tts: { ready?: boolean; voices?: string[]; voice?: string },
  selected?: string,
  rotation?: string[]
): void {
  if (!select) return;
  const wasReady = ready;
  ready = Boolean(tts?.ready);
  const nextVoices = Array.isArray(tts?.voices) ? tts.voices : [];
  const voicesChanged = JSON.stringify(nextVoices) !== JSON.stringify(availableVoices);
  if (voicesChanged) {
    availableVoices = nextVoices;
    select.replaceChildren(...availableVoices.map(voice => new Option(TTS_VOICE_NAMES[voice] || voice, voice)));
  }
  if (status && ready && !wasReady) status.textContent = 'ZeroTTS sẵn sàng. Chọn giọng mặc định hoặc bật luân phiên.';
  if (!saving) {
    savedVoice = selected || tts?.voice || savedVoice;
    select.value = savedVoice;
  }
  if (rotation) {
    const validRotation = rotation.filter((voice, index) => availableVoices.includes(voice) && rotation.indexOf(voice) === index);
    const key = JSON.stringify(validRotation);
    if (key !== savedRotationKey || voicesChanged) {
      savedRotation = validRotation;
      savedRotationKey = key;
      renderRotationOptions();
    }
  } else if (voicesChanged) {
    renderRotationOptions();
  }
  updateDisabledState();
}

select?.addEventListener('change', async () => {
  if (saving) return;
  saving = true;
  updateDisabledState();
  if (status) status.textContent = 'Đang lưu giọng mặc định...';
  try {
    const res = await window.TempleAuth.fetch('/rpc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'temple.updateSettings', params: { ttsVoice: select.value } })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || data.error || 'Không lưu được giọng đọc.');
    savedVoice = data.result.settings.ttsVoice;
    if (status) status.textContent = `Đã lưu giọng mặc định ${TTS_VOICE_NAMES[savedVoice] || savedVoice}.`;
  } catch (error) {
    select.value = savedVoice;
    if (status) status.textContent = error instanceof Error ? error.message : 'Không lưu được giọng đọc.';
  } finally {
    saving = false;
    updateDisabledState();
    renderRotationOptions();
  }
});

rotationList?.addEventListener('change', async event => {
  const changed = event.target as HTMLInputElement;
  if (changed.type !== 'checkbox' || saving) return;
  const nextRotation = Array.from(rotationList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .filter(input => input.checked).map(input => input.value);
  if (nextRotation.length === 1) {
    draftRotation = nextRotation;
    if (status) status.textContent = `Đã chọn ${TTS_VOICE_NAMES[nextRotation[0]] || nextRotation[0]}. Chọn thêm một giọng nữa để lưu và bật xoay vòng.`;
    renderRotationOptions();
    return;
  }
  draftRotation = nextRotation;
  saving = true;
  updateDisabledState();
  renderRotationOptions();
  if (status) status.textContent = nextRotation.length ? 'Đang lưu danh sách giọng luân phiên...' : 'Đang tắt xoay vòng...';
  try {
    const res = await window.TempleAuth.fetch('/rpc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'temple.updateSettings', params: { ttsVoiceRotation: nextRotation } })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || data.error || 'Không lưu được danh sách giọng.');
    savedRotation = data.result.settings.ttsVoiceRotation || [];
    savedRotationKey = JSON.stringify(savedRotation);
    if (status) status.textContent = savedRotation.length
      ? `Đang xoay vòng: ${savedRotation.map(voice => TTS_VOICE_NAMES[voice] || voice).join(' → ')}.`
      : `Đã tắt xoay vòng. Đang dùng ${TTS_VOICE_NAMES[savedVoice] || savedVoice}.`;
  } catch (error) {
    draftRotation = null;
    if (status) status.textContent = error instanceof Error ? error.message : 'Không lưu được danh sách giọng.';
  } finally {
    draftRotation = null;
    saving = false;
    updateDisabledState();
    renderRotationOptions();
  }
});

preview?.addEventListener('click', async () => {
  if (!select || !player) return;
  previewing = true;
  updateDisabledState();
  if (status) status.textContent = 'Đang tạo âm thanh nghe thử...';
  try {
    const input = document.getElementById('ttsDirectText') as HTMLInputElement | null;
    const text = input?.value.trim() || 'Xin kính chào quý vị. Kính chúc quý vị bình an và sức khỏe.';
    if (!text) throw new Error('Hãy nhập nội dung nghe thử.');
    const res = await window.TempleAuth.fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: select.value })
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.url) throw new Error(data.error || 'Không tạo được âm thanh.');
    const url = await window.TempleAuth.fetchAudioBlobUrl(data.url);
    if (player.dataset.blobUrl) URL.revokeObjectURL(player.dataset.blobUrl);
    player.dataset.blobUrl = url;
    player.src = url;
    await player.play();
    if (status) status.textContent = 'Đang phát nghe thử trên trình duyệt này.';
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : 'Không nghe thử được giọng đọc.';
  } finally {
    previewing = false;
    updateDisabledState();
  }
});

window.addEventListener('temple-auth-changed', () => {
  ready = false;
  player?.pause();
  updateDisabledState();
  renderRotationOptions();
  if (status) status.textContent = 'Xác thực và chờ ZeroTTS sẵn sàng để chọn giọng.';
});
