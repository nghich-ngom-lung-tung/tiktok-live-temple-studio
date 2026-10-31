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
