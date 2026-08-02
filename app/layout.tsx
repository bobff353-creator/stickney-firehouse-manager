import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import "./suite-theme.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2b40",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    title: "Inventory | Stickney Fire Department",
    description: "Visual apparatus checks, equipment inventory, maintenance, stock, and readiness workflows built for fire and EMS operations.",
    applicationName: "Stickney Firehouse Manager",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Stickney Firehouse",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/pwa-96.png", type: "image/png", sizes: "96x96" },
        { url: "/icons/pwa-192.png", type: "image/png", sizes: "192x192" },
      ],
      shortcut: "/icons/pwa-96.png",
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "Inventory",
      description: "See it. Check it. Keep it ready.",
      type: "website",
      url: origin,
      images: [{ url: socialImage, width: 1748, height: 915, alt: "Stickney Fire Department Inventory" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Inventory",
      description: "See it. Check it. Keep it ready.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Script src="/pwa-register.js" strategy="afterInteractive" />
    </html>
  );
}
