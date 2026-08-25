export function createLatestEntitySignalProcessor({
  getEntityId,
  isDeleted = () => false,
  loadEntity,
  onDelete,
  onUpdate,
  onError = () => {},
} = {}) {
  if (typeof getEntityId !== "function" || typeof loadEntity !== "function") {
    throw new TypeError("O processador de sinais requer getEntityId e loadEntity.");
  }

  const runningById = new Map();
  let disposed = false;

  function getSignal(payload) {
    return payload?.new || payload?.old || payload;
  }

  async function reconcile(entityId, state) {
    do {
      state.pending = false;
      const signal = state.latestSignal;
      try {
        if (isDeleted(signal)) {
          await onDelete?.(entityId, signal);
          continue;
        }

        const entity = await loadEntity(entityId, signal);
        if (disposed) return;
        if (entity) await onUpdate?.(entity, entityId, signal);
        else await onDelete?.(entityId, signal);
      } catch (error) {
        onError(error, entityId, signal);
      }
    } while (!disposed && state.pending);
  }

  function handle(payload) {
    if (disposed) return Promise.resolve();
    const signal = getSignal(payload);
    const entityId = getEntityId(signal);
    if (!entityId) return Promise.resolve();

    const key = String(entityId);
    const running = runningById.get(key);
    if (running) {
      running.latestSignal = signal;
      running.pending = true;
      return running.promise;
    }

    const state = { latestSignal: signal, pending: false, promise: null };
    state.promise = reconcile(entityId, state)
      .finally(() => {
        if (runningById.get(key) === state) runningById.delete(key);
      });
    runningById.set(key, state);
    return state.promise;
  }

  function dispose() {
    disposed = true;
    runningById.clear();
  }

  return { dispose, handle };
}
