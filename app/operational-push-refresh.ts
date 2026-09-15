/** Push is a wake-up hint only, never data or authority. Normal polling remains
 * the recovery path for devices without push or with an interrupted delivery.
 */
export function onOperationalPush(refresh: () => void, kind?: 'cad' | 'scheduler') {
  if (!('serviceWorker' in navigator)) return () => {};
  const changed = (event: MessageEvent) => {
    const value = event.data;
    if (value?.type === 'firehouse:records-changed' && ['cad', 'scheduler'].includes(value.kind) && (!kind || value.kind === kind)) refresh();
  };
  navigator.serviceWorker.addEventListener('message', changed);
  return () => navigator.serviceWorker.removeEventListener('message', changed);
}
