function createGiftTracker({ now = Date.now } = {}) {
  const streaks = new Map();
  const messages = new Map();
  const id = value => value == null || String(value) === '0' ? '' : String(value);
  function take(data, userId) {
    const time = now();
    for (const [key, value] of streaks) if (time - value.time > 600_000) streaks.delete(key);
    for (const [key, value] of messages) if (time - value > 600_000) messages.delete(key);
    const messageId = id(data.common?.msgId ?? data.msgId);
    if (messageId && messages.has(messageId)) return null;
    if (messageId) messages.set(messageId, time);
    const gift = { ...(data.extendedGiftInfo || {}), ...(data.giftDetails || {}), ...(data.gift || {}) };
    const giftId = id(data.giftId ?? gift.id) || 'unknown';
    const group = id(data.groupId);
    const repeat = Math.max(1, Math.floor(Number(data.repeatCount ?? data.comboCount) || 1));
    const type = Number(data.giftType ?? gift.giftType ?? gift.type);
    const isStreak = type === 1 || (!Number.isFinite(type) && (group || data.repeatEnd === false || repeat > 1));
    let quantity = repeat;
    if (isStreak) {
      const key = `${userId}:${giftId}:${group || 'active'}`;
      let previous = streaks.get(key);
      if (!group && previous?.ended && repeat === 1 && !data.repeatEnd) previous = null;
      quantity = repeat - (previous?.count || 0);
      streaks.set(key, { count: Math.max(repeat, previous?.count || 0), ended: Boolean(data.repeatEnd) || previous?.ended, time });
      if (quantity <= 0) return null;
    }
    while (streaks.size > 2000) streaks.delete(streaks.keys().next().value);
    while (messages.size > 4000) messages.delete(messages.keys().next().value);
    const unitCoins = Math.max(1, Number(gift.diamondCount ?? data.diamondCount) || 1);
    return { giftId, quantity, coins: unitCoins * quantity, name: String(gift.name || data.giftName || gift.describe || 'Quà tặng') };
  }
  return { take, clear() { streaks.clear(); messages.clear(); } };
}
module.exports = { createGiftTracker };
