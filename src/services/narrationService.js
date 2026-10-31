const { isBlockedSpamOrToxic } = require('../utils/textSanitizer');

const BASE_NARRATION = {
  incense: 'Nam mô A Di Đà Phật. Cảm tạ thí chủ {user} đã thành tâm dâng {count} nén hương. {wish}. Nguyện tâm an, lòng sáng.',
  prayer: 'Xin gửi lời nguyện của thí chủ {user}: {wish}. Chúc thí chủ giữ lòng thiện lành, bình an trong từng bước đi.',
  bell: 'Một tiếng chuông ngân, một phút trở về với hơi thở. Thí chủ {user} gửi lời nguyện: {wish}.',
  gift: 'Cảm tạ tấm lòng của thí chủ {user} với lễ vật {giftName}. Chúc thí chủ và gia đình an vui, biết sẻ chia và nâng đỡ nhau.',
  fortune: 'Thí chủ {user} vừa nhận {fortune}',
  woodenFish: 'Thí chủ {user} gõ {count} nhịp mõ. Xin dành một nhịp thở chậm, một ý nghĩ lành cho hôm nay.'
};
const EXTRA_NARRATION = {
  incense: [
    'Hương trầm vừa được dâng bởi thí chủ {user}. {wish}. Xin cùng giữ một ý niệm thiện lành.',
    'Cảm tạ {user} đã ghé chánh điện và dâng {count} nén hương. Nguyện mỗi bước chân đều có sự bình an.',
    'Một làn hương nhẹ, một tấm lòng thành. Xin đón lời nguyện của {user}: {wish}.',
    'Thí chủ {user} vừa thắp hương. Xin dành một hơi thở chậm, gửi lời chúc an vui đến mọi người.'
  ],
  prayer: [
    'Một ngọn hoa đăng mang lời nguyện của {user}: {wish}. Xin giữ ánh sáng của lòng tử tế trong tim.',
    'Đón tấm lòng thành của {user}. {wish}. Nguyện ngày hôm nay có thêm một điều an lành.',
    'Hoa đăng của {user} vừa được thả. Xin gửi lời chúc nhẹ lòng, vững tâm đến thí chủ và người thân.',
    'Thí chủ {user} gửi một lời nguyện: {wish}. Mong chúng ta cùng chăm sóc nhau bằng những việc nhỏ.'
  ],
  bell: [
    'Chuông chùa ngân lên theo lời thỉnh của {user}. Xin lắng lại một nhịp và trở về với hiện tại.',
    'Một tiếng chuông gửi đến {user} cùng mọi người đang hiện diện. Chúc tâm an và lòng rộng mở.',
    'Xin cùng {user} nghe tiếng chuông. Đặt xuống một điều lo, giữ lại một điều biết ơn.',
    'Tiếng chuông vừa ngân. {user} gửi lời nguyện: {wish}. Xin đón nhận bằng một tâm niệm hiền hòa.'
  ],
  gift: [
    'Xin trân trọng lễ vật {giftName} của {user}. Điều quý nhất là tấm lòng biết sẻ chia.',
    'Thí chủ {user} vừa dâng {giftName}. Kính chúc thí chủ một ngày thong thả, an vui.',
    'Cảm tạ {user} đã góp thêm một nét đẹp cho chánh điện với {giftName}. Xin gửi lời chúc bình an.',
    'Đón lễ vật {giftName} từ {user}. Nguyện lòng thiện được tiếp nối bằng những hành động tử tế.'
  ],
  fortune: [
    'Xin gửi thí chủ {user} một lời chiêm nghiệm. {fortune}',
    '{user} hữu duyên nhận một lời nhắc cho hôm nay. {fortune}',
    'Mời thí chủ {user} lắng nghe và tự chiêm nghiệm. {fortune}',
    'Một gợi ý nhỏ gửi đến {user}, để nhìn lại ngày hôm nay. {fortune}'
  ],
  woodenFish: [
    'Cùng {user} nghe {count} nhịp mõ, thả lỏng đôi vai và trở về với hơi thở.',
    'Mỗi nhịp mõ là một lời nhắc sống chậm. Xin cảm tạ {user}.',
    '{user} vừa gõ {count} nhịp mõ. Chúc mọi người giữ được sự tỉnh thức trong phút này.',
    'Âm thanh nhẹ nhàng gửi từ {user}. Xin dành một ý nghĩ lành cho người mình thương.'
  ]
};
const DEFAULT_NARRATION = Object.freeze(Object.fromEntries(Object.entries(BASE_NARRATION).map(([key, text]) => [key, [text, ...EXTRA_NARRATION[key]].join('\n')])));
const lastVariant = new Map();
const PLACEHOLDERS = ['user', 'wish', 'count', 'giftName', 'fortune'];

function validateTemplates(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Lời dẫn phải là một bộ mẫu hợp lệ.');
  const clean = {};
  for (const [key, text] of Object.entries(value)) {
    if (!Object.hasOwn(DEFAULT_NARRATION, key)) throw new Error('Loại lời dẫn không hợp lệ.');
    if (typeof text !== 'string' || !text.trim()) throw new Error('Lời dẫn không được để trống.');
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length > 6 || lines.some(line => line.length > 240)) throw new Error('Mỗi loại tối đa 6 câu, mỗi dòng tối đa 240 ký tự.');
    if (isBlockedSpamOrToxic(text)) throw new Error('Lời dẫn chứa nội dung không phù hợp.');
    const remainder = text.replace(/\{(user|wish|count|giftName|fortune)\}/g, '');
    if (/[{}]/.test(remainder)) throw new Error('Biến thay thế không hợp lệ. Dùng {user}, {wish}, {count}, {giftName}, {fortune}.');
    clean[key] = lines.join('\n').normalize('NFC');
  }
  return clean;
}

function renderNarration(settings, kind, values) {
  const lines = (settings.narrationTemplates?.[kind] || DEFAULT_NARRATION[kind]).split(/\r?\n/).filter(Boolean);
  const candidates = lines.filter(line => line !== lastVariant.get(kind));
  const template = candidates[Math.floor(Math.random() * candidates.length)] || lines[0];
  lastVariant.set(kind, template);
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? '')).slice(0, 1000);
}

module.exports = { DEFAULT_NARRATION, PLACEHOLDERS, validateTemplates, renderNarration };
