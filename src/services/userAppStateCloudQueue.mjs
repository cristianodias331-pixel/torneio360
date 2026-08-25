import {
  getUserAppStateCloudDelay,
  getUserAppStateSyncSignature,
} from "../domain/userAppStateSync.mjs";

export function createUserAppStateCloudQueue({
  savePayload,
  isOffline = () => false,
  now = () => Date.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (timer) => clearTimeout(timer),
  onError = () => {},
} = {}) {
  if (typeof savePayload !== "function") {
    throw new TypeError("createUserAppStateCloudQueue requer savePayload.");
  }

  let timer = null;
  let writeInFlight = false;
  let pendingPayload = null;
  let lastSignature = "";
  let lastSavedAt = 0;
  let disposed = false;

  function clearScheduledFlush() {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  }

  function seed(payload, savedAt = now()) {
    if (!payload) return;
    lastSignature = getUserAppStateSyncSignature(payload);
    lastSavedAt = savedAt;
  }

  async function flush() {
    if (disposed || writeInFlight || isOffline()) return;
    const payload = pendingPayload;
    if (!payload) return;

    const signature = getUserAppStateSyncSignature(payload);
    if (signature === lastSignature) {
      pendingPayload = null;
      return;
    }

    pendingPayload = null;
    writeInFlight = true;
    try {
      await savePayload(payload);
      lastSignature = signature;
      lastSavedAt = now();
    } catch (error) {
      onError(error);
      if (!pendingPayload) pendingPayload = payload;
      lastSavedAt = now();
    } finally {
      writeInFlight = false;
      if (!disposed && pendingPayload) queue(pendingPayload);
    }
  }

  function queue(payload, { force = false } = {}) {
    if (disposed || !payload) return;
    pendingPayload = payload;
    const delay = getUserAppStateCloudDelay({
      payload,
      lastSignature,
      lastSavedAt,
      now: now(),
      force,
    });

    clearScheduledFlush();
    if (delay === null) {
      pendingPayload = null;
      return;
    }
    if (delay === 0) {
      void flush();
      return;
    }

    timer = schedule(() => {
      timer = null;
      return flush();
    }, delay);
  }

  function dispose() {
    disposed = true;
    pendingPayload = null;
    clearScheduledFlush();
  }

  return { dispose, flush, queue, seed };
}
