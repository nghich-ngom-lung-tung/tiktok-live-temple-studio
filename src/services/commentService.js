const { isBlockedSpamOrToxic, sanitizeUserName, sanitizeWishText } = require('../utils/textSanitizer');

function createCommentService({ rituals, onComment = () => {} }) {
  const Rituals = rituals;
  const commentCooldownMap = new Map();
  const bubbleCooldownMap = new Map();

function parseViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw || isBlockedSpamOrToxic(raw)) {
    return null;
  }

  const cleanUser = sanitizeUserName(user);
  const userKey = uniqueId || user || '';
  const now = Date.now();
  const cleanChat = raw.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 240);
  if (cleanChat && now - (bubbleCooldownMap.get(userKey) || 0) >= 200) {
    onComment({ user: cleanUser, uniqueId, avatar, comment: cleanChat });
    bubbleCooldownMap.set(userKey, now);
    if (bubbleCooldownMap.size > 1000) bubbleCooldownMap.delete(bubbleCooldownMap.keys().next().value);
  }
  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) return null;

  // Chống 1 người spam bình luận liên tục làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  if (userKey) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const lower = cleanWish.toLowerCase();

  // 1. Xin xăm / Gieo quẻ
  if (
    lower.includes('xin xăm') ||
    lower.includes('xin xam') ||
    lower.includes('gieo quẻ') ||
    lower.includes('gieo que') ||
    lower.includes('rút quẻ') ||
    lower.includes('rut que') ||
    /(?:^|[^\p{L}\p{N}])(?:quẻ|que)(?=$|[^\p{L}\p{N}])/u.test(lower)
  ) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 2. Thỉnh chuông
  if (lower.includes('chuông') || lower.includes('chuong') || lower.includes('thỉnh chuông')) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 3. Gõ mõ
  if (lower.includes('gõ mõ') || lower.includes('go mo') || lower.includes('tụng kinh')) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
  }

  // 4. Thắp hương / Bái Phật
  if (
    lower.includes('thắp hương') ||
    lower.includes('thap huong') ||
    lower.includes('dâng hương') ||
    lower.includes('dang huong') ||
    lower.includes('bái phật') ||
    lower.includes('bai phat') ||
    lower.includes('lạy phật') ||
    lower.includes('lay phat') ||
    /(?:^|[^\p{L}\p{N}])(?:hương|huong)(?=$|[^\p{L}\p{N}])/u.test(lower)
  ) {
    return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
  }

  // 5. Cầu nguyện / Thả đèn hoa đăng
  if (
    lower.includes('cầu') ||
    lower.includes('cau ') ||
    lower.includes('nguyện') ||
    lower.includes('nguyen') ||
    lower.includes('nam mô') ||
    lower.includes('nam mo') ||
    lower.includes('mô phật') ||
    lower.includes('mo phat') ||
    lower.includes('a di đà') ||
    lower.includes('a di da') ||
    lower.includes('bình an') ||
    lower.includes('tài lộc') ||
    lower.includes('chúc')
  ) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish });
}

const giftComboTracker = new Map();


  return { parseViewerComment };
}

module.exports = { createCommentService };
