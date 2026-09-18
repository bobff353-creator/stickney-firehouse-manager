/** Camera ownership stays with the open dialog, including late permission responses. */
export function stopCamera(stream?: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export function requestRearCamera(signal: AbortSignal, devices = navigator.mediaDevices, timeoutMs = 20000): Promise<MediaStream> {
  if (signal.aborted) return Promise.reject(new DOMException('Camera closed', 'AbortError'));
  if (!devices?.getUserMedia) return Promise.reject(new Error('Live camera is unavailable here. Open the app in Safari or Chrome, or use Take photo / Choose photo below.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, stream?: MediaStream) => {
      if (settled) { stopCamera(stream); return; }
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(stream!);
    };
    const abort = () => finish(new DOMException('Camera closed', 'AbortError'));
    const timer = setTimeout(() => finish(new DOMException('Camera permission is still waiting. Allow camera access, then select Retry camera, or use Take photo below.', 'TimeoutError')), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException('Camera closed', 'AbortError');
      return devices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    }).then(stream => finish(undefined, stream), finish);
  });
}

export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission is blocked. Allow Camera for this site in your browser settings, then retry. You can also take or choose a photo below.';
  if (name === 'NotFoundError') return 'No camera was found. Use a phone camera or choose a photo below.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is busy or was interrupted. Close other camera apps, then retry, or choose a photo below.';
  return error instanceof Error ? error.message : 'The camera could not start. Retry or choose a photo below.';
}

export function scannedVin(raw: string): string | null {
  // Accept a VIN or an explicitly labelled VIN; never truncate arbitrary barcode data.
  const value = raw.trim().toUpperCase().replace(/^\]C[01]/, '').replace(/^VIN\s*[:#=]?\s*/, '').replace(/^\*|\*$/g, '').replace(/\s/g, '');
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value) ? value : null;
}
