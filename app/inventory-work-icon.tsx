import type { ReactNode } from "react";

const workIcons = {
  home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-6h6v6" /></>,
  rig: <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-3m-5 0h1M8 17h7" /><circle cx="6" cy="17" r="2" fill="currentColor" /><circle cx="17" cy="17" r="2" fill="currentColor" /></>,
  check: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" fill="var(--crew-soft, #edf3f8)" /><path d="m9 13 2 2 4-4" /></>,
  repair: <path d="M14.5 6.5a4.2 4.2 0 0 0-5.9 5.4L3.6 17a2 2 0 0 0 2.8 2.8l5.1-5a4.2 4.2 0 0 0 5.4-5.9l-2.6 2.6-2.4-2.4z" />,
  equipment: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /><path d="m8 5.3 8 4.5" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 11-2l3 6M4 12l3 6a7 7 0 0 0 11-2" /></>,
  next: <path d="m9 6 6 6-6 6" />,
  done: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
} satisfies Record<string, ReactNode>;

export function InventoryWorkIcon({ name }: { name: keyof typeof workIcons }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{workIcons[name]}</svg>;
}
