const PRUNE_ABOVE = 1_000;

/** Fixed-window request counter per client. Expired windows are dropped so the map cannot grow without bound. */
export function createRequestLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(clientId: string, now = Date.now()): boolean {
      if (windows.size > PRUNE_ABOVE) {
        for (const [key, window] of windows) {
          if (now - window.startedAt >= windowMs) windows.delete(key);
        }
      }
      const current = windows.get(clientId);
      if (!current || now - current.startedAt >= windowMs) {
        windows.set(clientId, { startedAt: now, count: 1 });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
    get size() {
      return windows.size;
    },
  };
}
