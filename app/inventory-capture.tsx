"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cameraError, requestRearCamera, scannedVin, stopCamera } from './inventory-camera';
import './inventory-capture.css';

type Props = { title: string; mode: 'photo' | 'vin' | 'equipment'; onClose: () => void; onPhoto?: (file: File) => void; onCode?: (code: string) => void };

/** Photos/barcodes remain on the device until the existing form's explicit Save action. */
export default function InventoryCapture(props: Props) {
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const panel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const scanner = useRef<{ stop: () => void } | null>(null);
  const generation = useRef(0);
  const completed = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('Starting camera… If asked, allow camera access.');
  const [failed, setFailed] = useState(false);
  const mode = props.mode;

  function stop() {
    session.current?.abort();
    scanner.current?.stop(); scanner.current = null;
    stopCamera(stream.current); stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  function close() { generation.current++; stop(); latest.current.onClose(); }
  function acceptCode(raw: string) {
    if (completed.current) return;
    const code = mode === 'vin' ? scannedVin(raw) : raw.trim();
    if (!code) { setMessage(mode === 'vin' ? 'That barcode is not a valid 17-character VIN. Scan the VIN barcode, not the parts label, or enter the VIN manually.' : 'No equipment code was found. Try again.'); return; }
    completed.current = true; stop(); latest.current.onCode?.(code);
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const controller = new AbortController(); session.current = controller;
    let ownedStream: MediaStream | null = null;
    let ownedScanner: { stop: () => void } | null = null;
    const current = ++generation.current;
    completed.current = false;
    void (async () => {
      try {
        const media = await requestRearCamera(controller.signal);
        if (controller.signal.aborted) { stopCamera(media); return; }
        ownedStream = media; stream.current = media;
        const element = video.current;
        if (!element) { stopCamera(media); return; }
        if (mode === 'photo') { element.srcObject = media; await element.play(); }
        else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (controller.signal.aborted) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(media, element, result => {
            if (result && !controller.signal.aborted && current === generation.current) acceptCode(result.getText());
          });
          ownedScanner = controls;
          if (controller.signal.aborted) controls.stop(); else scanner.current = controls;
        }
        if (!controller.signal.aborted) setMessage(mode === 'photo' ? 'Keep the whole subject in view, then capture.' : 'Hold the barcode steady with space around every edge. Move back if it is blurry.');
      } catch (error) {
        stopCamera(ownedStream);
        if (stream.current === ownedStream) stream.current = null;
        if (!controller.signal.aborted) { setReady(false); setFailed(true); setMessage(cameraError(error)); }
      }
    })();
    return () => { generation.current++; controller.abort(); ownedScanner?.stop(); stopCamera(ownedStream); if (stream.current === ownedStream) stream.current = null; if (scanner.current === ownedScanner) scanner.current = null; };
    // Callbacks use refs so parent refreshes cannot restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, mode]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    stop(); setReady(false); setFailed(false); setProcessing(true);
    if (mode === 'photo') { completed.current = true; latest.current.onPhoto?.(file); return; }
    setMessage('Reading the barcode photo on this device…');
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      if (current === generation.current) acceptCode(result.getText());
    } catch {
      if (current === generation.current) { setFailed(true); setMessage('No readable barcode found. Take a sharp, close photo of the entire barcode in good light, or enter the code manually. Printed VIN letters alone are not a barcode.'); }
    } finally { URL.revokeObjectURL(url); if (current === generation.current) setProcessing(false); }
  }

  async function capture() {
    const element = video.current;
    if (!element || !ready || processing || !element.videoWidth || !element.videoHeight) return;
    const current = generation.current;
    setProcessing(true);
    try {
      const canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to capture the camera image. Use Take photo below.');
      context.drawImage(element, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
      if (!blob) throw new Error('The image could not be captured. Please retry.');
      if (current !== generation.current) return;
      completed.current = true; stop(); latest.current.onPhoto?.(new File([blob], `apparatus-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch (error) { if (current === generation.current) { setFailed(true); setMessage(cameraError(error)); } }
    finally { if (current === generation.current) setProcessing(false); }
  }

  return createPortal(<div className="inventory-capture-overlay"><div className="inventory-capture-dialog" role="dialog" aria-modal="true" aria-label={props.title} ref={panel} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <header><h2>{props.title}</h2><button type="button" onClick={close}>Close camera</button></header>
    <p>{mode === 'photo' ? 'Capture now, then review and save the photo in the form.' : mode === 'vin' ? 'Scan the VIN barcode—not just the printed letters. You can also type the 17-character VIN in the form.' : 'Scan a barcode or QR label to find or fill equipment. Scanning does not save changes.'}</p>
    <video ref={video} autoPlay playsInline muted onPlaying={() => setReady(true)} onEmptied={() => setReady(false)} aria-label="Rear camera preview" />
    <p className={failed ? 'capture-error' : ''} role="status">{message}</p>
    {mode === 'photo' && <button className="capture-primary" type="button" disabled={!ready || processing} onClick={() => void capture()}>{processing ? 'Capturing…' : 'Capture photo'}</button>}
    <div className="capture-alternatives">
      <button type="button" disabled={processing} onClick={() => { stop(); setReady(false); setFailed(false); setProcessing(false); setMessage('Starting camera… If asked, allow camera access.'); setAttempt(value => value + 1); }}>Retry camera</button>
      <label>Take {mode === 'photo' ? 'photo' : 'barcode photo'}<input type="file" accept="image/*" capture="environment" disabled={processing} onClick={() => { stop(); setReady(false); setMessage('Camera paused for photo selection. Select Retry camera to resume.'); }} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choosePhoto(file); }} /></label>
      <label>Choose photo<input type="file" accept="image/*" disabled={processing} onClick={() => { stop(); setReady(false); setMessage('Camera paused for photo selection. Select Retry camera to resume.'); }} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choosePhoto(file); }} /></label>
      {mode !== 'photo' && <button type="button" onClick={close}>Enter code manually</button>}
    </div>
    <small>{mode === 'photo' ? 'Nothing uploads until you select Save photo for review.' : 'Barcode recognition stays on this device. No extra scanning service or subscription.'}</small>
  </div></div>, document.body);
}
