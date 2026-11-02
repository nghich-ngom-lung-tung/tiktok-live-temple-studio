export type ChristianPlayback = {
  current: { event: Record<string, any>; startsAt: number; endsAt: number; returnsAt?: number } | null;
  pendingCount: number; preparing: boolean; paused: boolean; skipped?: number;
};

// The server owns the timeline, including recovery after a page reload.
export function createChristianPlayback({ play, stop, changed, returning = () => {} }: {
  returning?: (event: Record<string, any>) => void;
  play: (event: Record<string, any>) => void;
  stop: (reason: 'pause' | 'cancel' | 'finish' | 'replace') => void;
  changed: (status: ChristianPlayback) => void;
}) {
  let status: ChristianPlayback | null = null;
  let timer = 0;
  let returnTimer = 0;
  let returned = false;
  let endTimer = 0;
  let scheduled = '';
  let playing = '';
  let playingEndsAt = 0;
  const played = new Set<string>();
  function beginReturn() {
    if (returned || !status?.current) return;
    returned = true;
    returning({ ...status.current.event, endsAt: status.current.endsAt });
  }
  function cancel(reason: 'pause' | 'cancel' | 'finish' | 'replace' = 'cancel') {
    window.clearTimeout(returnTimer);
    returned = false;
    window.clearTimeout(timer);
    window.clearTimeout(endTimer);
    timer = 0; endTimer = 0; scheduled = ''; playing = ''; playingEndsAt = 0;
    stop(reason);
  }
  return {
    sync(next: ChristianPlayback) {
      if (!next) return;
      status = next;
      changed(next);
      const current = next.current;
      if (next.paused) {
        cancel('pause');
        return;
      }
      if (!current || current.endsAt <= Date.now()) {
        if (playing || scheduled) cancel(current ? 'finish' : 'cancel');
        return;
      }
      const id = current.event?.id;
      if (!id) return;
      if (playing === id) {
        if (!returned && current.returnsAt) {
          window.clearTimeout(returnTimer);
          returnTimer = window.setTimeout(beginReturn, Math.max(0, current.returnsAt - Date.now()));
        }
        if (current.endsAt !== playingEndsAt) {
          playingEndsAt = current.endsAt;
          window.clearTimeout(endTimer);
          endTimer = window.setTimeout(() => cancel('finish'), Math.max(0, current.endsAt - Date.now()));
        }
        return;
      }
      if (played.has(id) || scheduled === id) return;
      cancel('replace');
      scheduled = id;
      timer = window.setTimeout(() => {
        scheduled = ''; timer = 0;
        const latest = status?.current;
        if (status?.paused || !latest || latest.event?.id !== id || latest.endsAt <= Date.now()) return;
        playing = id;
        playingEndsAt = latest.endsAt;
        played.add(id);
        if (played.size > 500) played.delete(played.values().next().value);
        if (latest.returnsAt) returnTimer = window.setTimeout(beginReturn, Math.max(0, latest.returnsAt - Date.now()));
        play({ ...latest.event, startsAt: latest.startsAt, endsAt: latest.endsAt, elapsedMs: Math.max(0, Date.now() - latest.startsAt) });
        endTimer = window.setTimeout(() => cancel('finish'), Math.max(0, latest.endsAt - Date.now()));
      }, Math.max(0, current.startsAt - Date.now()));
    },
    stop: cancel
  };
}
