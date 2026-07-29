"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./google-field-map";

type Point = { lat: number; lng: number };
type Panorama = {
  setVisible(visible: boolean): void;
};

export default function GoogleStreetView({
  apiKey,
  position,
  label,
  fallbackUrl,
}: {
  apiKey: string;
  position: Point;
  label: string;
  fallbackUrl: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const panorama = useRef<Panorama | null>(null);
  const [failed, setFailed] = useState(false);
  const { lat, lng } = position;

  useEffect(() => {
    let active = true;
    void loadGoogleMaps(apiKey).then((google) => {
      if (!active || !element.current) return;
      panorama.current = new google.maps.StreetViewPanorama(element.current, {
        position: { lat, lng },
        pov: { heading: 0, pitch: 0 },
        addressControl: false,
        clickToGo: true,
        fullscreenControl: true,
        motionTracking: false,
        motionTrackingControl: false,
        panControl: true,
        scrollwheel: true,
        showRoadLabels: true,
        visible: true,
        zoom: 0,
        zoomControl: true,
      });
      setFailed(false);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      panorama.current?.setVisible(false);
      panorama.current = null;
    };
  }, [apiKey, lat, lng]);

  if (failed) return <div className="respond-empty overlay"><strong>Street View could not load</strong><span>Open the active-call location directly in Google Maps.</span><a href={fallbackUrl} target="_blank" rel="noreferrer">Open Street View ↗</a></div>;
  return <div ref={element} className="respond-street-view" role="img" aria-label={`Street View near ${label}`}/>;
}
