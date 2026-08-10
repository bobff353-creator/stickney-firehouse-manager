import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAD Dispatch",
  description: "Computer-Aided Dispatch: closest-unit dispatching, live vehicle location, real-time incident notes, mutual-aid webhooks, and fire-alarm monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
