export function createTvExitVisibility(update: (visible: boolean) => void, schedule: (callback: () => void, delay: number) => number, cancel: (id: number) => void) {
  let timer: number | undefined;
  let disposed = false;
  update(false);
  return {
    reveal() {
      if (disposed) return;
      if (timer !== undefined) cancel(timer);
      update(true);
      timer = schedule(() => { timer = undefined; if (!disposed) update(false); }, 3000);
    },
    dispose() { disposed = true; if (timer !== undefined) cancel(timer); },
  };
}
