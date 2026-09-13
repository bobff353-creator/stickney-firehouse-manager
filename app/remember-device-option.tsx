"use client";
import { useId } from "react";
import "./remember-device.css";

export default function RememberDeviceOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const description = useId();
  return <div className="remember-device-option">
    <label><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-describedby={description}/><span>Remember this device for 7 days</span></label>
    <small id={description}>Personal, screen-locked devices only—not shared station computers. Sign out to forget this device.</small>
  </div>;
}
