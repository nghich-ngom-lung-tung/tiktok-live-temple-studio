export const VIP_CUSHION_COORDS = [250, 350, 450, 630, 730, 830].map((x, i) => ({ x, y: 858, rank: i + 1 }));
export const HALL_SEAT_COORDS: { side: 'L' | 'R'; row: number; col: number; x: number; y: number; scale: number }[] = [];
// Twelve rows of eight, plus one front seat, on each side: 97 + 97 + 6 VIP.
for (let row = 0; row < 13; row++) {
  const progress = row / 12;
  const inner = 420 - progress * 170;
  for (let col = 0; col < 8; col++) {
    if (row === 12 && col !== 3) continue;
    const x = Math.round(30 + col / 7 * (inner - 30));
    for (const side of ['L', 'R'] as const) HALL_SEAT_COORDS.push({ side, row, col, x: side === 'L' ? x : 1080-x, y: Math.round(965+progress*700), scale: +(0.29+progress*.025).toFixed(3) });
  }
}
export const HALL_VIEWER_SEAT_ORDER = HALL_SEAT_COORDS.map((_, i) => i).sort((a,b) => HALL_SEAT_COORDS[b].col-HALL_SEAT_COORDS[a].col || HALL_SEAT_COORDS[a].row-HALL_SEAT_COORDS[b].row || a-b);

// Sparse rooms use wider seating and larger people; packed rooms keep all 194 seats.
export function hallLayoutForCount(count: number) {
  const total = Math.max(0, Math.min(194, count));
  const columns = total <= 24 ? 2 : total <= 60 ? 3 : total <= 100 ? 5 : 8;
  const rows = Math.max(2, Math.ceil(total / (columns * 2)));
  const baseScale = total <= 24 ? .82 : total <= 60 ? .7 : total <= 100 ? .56 : .44;
  const depthScale = total <= 24 ? .24 : total <= 60 ? .2 : total <= 100 ? .16 : .12;
  const seats: typeof HALL_SEAT_COORDS = [];
  for (let row = 0; row < rows; row++) {
    const depth = row / (rows - 1);
    const inner = 400 - depth * 150;
    const outer = 65 - depth * 15;
    for (let col = columns - 1; col >= 0; col--) {
      const x = Math.round(outer + col / (columns - 1) * (inner - outer));
      for (const side of ['L', 'R'] as const) {
        if (seats.length >= total) break;
        seats.push({ side, row, col, x: side === 'L' ? x : 1080 - x,
          y: Math.round(1005 + depth * 640), scale: +(baseScale + depth * depthScale).toFixed(3) });
      }
    }
  }
  return seats;
}
