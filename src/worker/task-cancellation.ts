/**
 * Abort an in-flight provider request when its durable task stops being runnable.
 * A failed state read also aborts: the worker must not keep spending while it
 * cannot verify that the task is still authorised to run.
 */
export function watchTaskCancellation(
  readState: () => Promise<string | null>,
  controller: AbortController,
  intervalMs = 500
): () => void {
  let stopped = false;
  let checking = false;
  const timer = setInterval(() => {
    if (stopped || checking || controller.signal.aborted) return;
    checking = true;
    void readState().then((state) => {
      if (state !== "running") controller.abort();
    }).catch(() => {
      controller.abort();
    }).finally(() => {
      checking = false;
    });
  }, intervalMs);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
