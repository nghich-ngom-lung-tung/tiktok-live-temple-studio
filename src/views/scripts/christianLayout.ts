export const CHRISTIAN_CAPACITY = 200;
// The last pew ends near Y=1280 in nha-tho-live.png (1080×1920 stage).
// Leave room for sprite padding/shadows: congregation feet stay on the open floor.
export const CHRISTIAN_CONGREGATION_FLOOR_Y = 1340;
export type ChristianSeat = { x: number; y: number; width: number; height: number; row: number };

// Seat indices come from arrival order: early arrivals take the upper rows,
// while later arrivals fill toward the camera, entirely in front of the pews.
export function christianLayoutForCount(value: number): ChristianSeat[] {
  const count = Math.max(0, Math.min(CHRISTIAN_CAPACITY, Math.floor(value) || 0));
  if (!count) return [];
  const columns = count <= 24 ? Math.min(4, Math.max(1, Math.ceil(count / 6))) : Math.min(10, Math.max(4, Math.ceil(count / 20)));
  const rowCount = Math.ceil(count / (columns * 2));
  const nearY = 1650;
  const farY = CHRISTIAN_CONGREGATION_FLOOR_Y;
  const depthSpan = Math.min(nearY - farY, (rowCount - 1) * (count <= 24 ? 120 : 60));
  const nearHeight = count <= 24 ? 320 : Math.max(300, 320 - (count - 24) * .2);
  return Array.from({ length: count }, (_, index) => {
    const depth = Math.floor(index / (columns * 2));
    const progress = rowCount > 1 ? depth / (rowCount - 1) : 0;
    const column = Math.floor(index % (columns * 2) / 2);
    const height = Math.round(nearHeight - (1 - progress) * depthSpan * (count <= 24 ? 70 / 570 : 70 / 310));
    const outer = 150 - progress * 50;
    const inner = 430 + progress * 10;
    const fraction = columns === 1 ? .5 : depth % 2 ? (column + .5) / columns : column / (columns - 1);
    const leftX = Math.round(inner - fraction * (inner - outer));
    return {
      x: index % 2 ? 1080 - leftX : leftX,
      y: Math.round(farY + progress * depthSpan),
      width: Math.round(height * .68), height, row: depth
    };
  });
}
