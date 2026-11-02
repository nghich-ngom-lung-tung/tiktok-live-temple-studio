export type ChristianPlayback = {
  current: { event: Record<string, any>; startsAt: number; endsAt: number } | null;
  pendingCount: number; preparing: boolean; paused: boolean; skipped?: number;
};

// The server owns the timeline, including recovery after a page reload.
export function createChristianPlayback({ play, stop, changed }: {
  play: (event: Record<string, any>) => void;
  stop: () => void;
  changed: (status: ChristianPlayback) => void;
}) {
  let status: ChristianPlayback | null = null;
  let timer = 0;
  let endTimer = 0;
  let scheduled = '';
  let playing = '';
  const played = new Set<string>();
  function cancel() {
    window.clearTimeout(timer);
    window.clearTimeout(endTimer);
    timer = 0; scheduled = ''; playing = '';
    stop();
  }
  return {
    sync(next: ChristianPlayback) {
      if (!next) return;
      status = next;
      changed(next);
      const current = next.current;
      if (next.paused || !current || current.endsAt <= Date.now()) {
        if (playing || scheduled || next.paused) cancel();
        return;
      }
      const id = current.event?.id;
      if (!id || played.has(id) || scheduled === id) return;
      cancel();
      scheduled = id;
      timer = window.setTimeout(() => {
        scheduled = ''; timer = 0;
        if (status?.paused || status?.current?.event?.id !== id || current.endsAt <= Date.now()) return;
        playing = id;
        played.add(id);
        if (played.size > 500) played.delete(played.values().next().value);
        play({ ...current.event, startsAt: current.startsAt, endsAt: current.endsAt, elapsedMs: Math.max(0, Date.now() - current.startsAt) });
        endTimer = window.setTimeout(cancel, Math.max(0, current.endsAt - Date.now()));
      }, Math.max(0, current.startsAt - Date.now()));
    },
    stop: cancel
  };
}
