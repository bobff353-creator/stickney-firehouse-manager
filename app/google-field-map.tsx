"use client";

import { useEffect, useRef, useState } from "react";

type Point = { lat: number; lng: number };
type GoogleCenter = { lat(): number; lng(): number };
type GoogleListener = { remove(): void };
type GoogleMapInstance = {
  addListener(event: string, handler: () => void): GoogleListener;
  getCenter(): GoogleCenter | undefined;
  getZoom(): number | undefined;
  setCenter(center: Point): void;
  setMapTypeId(mapTypeId: string): void;
  setOptions(options: Record<string, unknown>): void;
  setZoom(zoom: number): void;
};
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  };
};

let loader: Promise<GoogleMapsApi> | null = null;
const authenticationFailureListeners = new Set<() => void>();
const cleanMapStyles = [
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station", elementType: "all", stylers: [{ visibility: "off" }] },
];

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (loader) return loader;
  loader = new Promise<GoogleMapsApi>((resolve, reject) => {
    const callbackName = "__stickneyGoogleMapsReady";
    const callbackWindow = window as unknown as Window & Record<string, unknown>;
    callbackWindow.gm_authFailure = () => {
      authenticationFailureListeners.forEach((listener) => listener());
      reject(new Error("Google Maps key authorization failed."));
    };
    callbackWindow[callbackName] = () => {
      if (window.google?.maps?.Map) resolve(window.google);
      else reject(new Error("Google Maps did not initialize."));
    };
    const script = document.createElement("script");
    script.id = "stickney-google-maps-loader";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${callbackName}&v=weekly&auth_referrer_policy=origin`;
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });
  return loader;
}

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

export default function GoogleFieldMap({
  apiKey,
  center,
  zoom,
  imagery,
  interactive,
  onReady,
  onViewChange,
}: {
  apiKey: string;
  center: Point;
  zoom: number;
  imagery: "aerial" | "street";
  interactive: boolean;
  onReady: (ready: boolean) => void;
  onViewChange: (center: Point, zoom: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const onReadyRef = useRef(onReady);
  const onViewChangeRef = useRef(onViewChange);
  const initialView = useRef({ center, zoom, imagery, interactive });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
    onViewChangeRef.current = onViewChange;
  }, [onReady, onViewChange]);

  useEffect(() => {
    let active = true;
    let idleListener: GoogleListener | null = null;
    const initial = initialView.current;
    const handleAuthenticationFailure = () => {
      if (!active) return;
      map.current = null;
      setReady(false);
      onReadyRef.current(false);
    };
    authenticationFailureListeners.add(handleAuthenticationFailure);
    void loadGoogleMaps(apiKey).then((google) => {
      if (!active || !element.current) return;
      const instance = new google.maps.Map(element.current, {
        center: initial.center,
        zoom: initial.zoom,
        mapTypeId: initial.imagery === "aerial" ? "satellite" : "roadmap",
        clickableIcons: false,
        disableDoubleClickZoom: false,
        fullscreenControl: true,
        gestureHandling: initial.interactive ? "greedy" : "none",
        keyboardShortcuts: initial.interactive,
        mapTypeControl: false,
        minZoom: 14,
        maxZoom: 21,
        rotateControl: false,
        scaleControl: true,
        styles: cleanMapStyles,
        streetViewControl: false,
        zoomControl: true,
      });
      map.current = instance;
      idleListener = instance.addListener("idle", () => {
        const nextCenter = instance.getCenter();
        const nextZoom = instance.getZoom();
        if (!nextCenter || nextZoom == null) return;
        onViewChangeRef.current(
          { lat: nextCenter.lat(), lng: nextCenter.lng() },
          Math.max(14, Math.min(21, Math.round(nextZoom))),
        );
      });
      setReady(true);
      onReadyRef.current(true);
    }).catch(() => {
      if (!active) return;
      setReady(false);
      onReadyRef.current(false);
    });
    return () => {
      active = false;
      authenticationFailureListeners.delete(handleAuthenticationFailure);
      idleListener?.remove();
      map.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const current = instance.getCenter();
    if (!current || Math.abs(current.lat() - center.lat) > 0.0000001 || Math.abs(current.lng() - center.lng) > 0.0000001) {
      instance.setCenter(center);
    }
    if (instance.getZoom() !== zoom) instance.setZoom(zoom);
    instance.setMapTypeId(imagery === "aerial" ? "satellite" : "roadmap");
    instance.setOptions({
      gestureHandling: interactive ? "greedy" : "none",
      keyboardShortcuts: interactive,
      scrollwheel: interactive,
      draggable: interactive,
      disableDoubleClickZoom: !interactive,
      styles: cleanMapStyles,
    });
  }, [center, imagery, interactive, zoom]);

  return <div ref={element} className={`google-map-base${ready ? " ready" : ""}`} aria-label="Google map"/>;
}
