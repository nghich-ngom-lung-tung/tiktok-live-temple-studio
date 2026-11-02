export const TTS_VOICE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  baotrang: 'Bảo Trang',
  giahuy: 'Gia Huy',
  hamy: 'Hà My',
  huuduc: 'Hữu Đức',
  kimoanh: 'Kim Oanh',
  maichi: 'Mai Chi',
  quangminh: 'Quang Minh',
  tiendat: 'Tiến Đạt'
});

export function ttsVoiceLabel(id: string): string {
  return TTS_VOICE_NAMES[id] || id;
}
