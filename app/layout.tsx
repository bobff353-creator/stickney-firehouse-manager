import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";

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
    title: "Stickney Firehouse Manager",
    description: "The secure operations portal for Stickney Fire Department staffing, scheduling, daily logs, field operations, fleet, inventory, and readiness.",
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
      title: "Stickney Firehouse Manager",
      description: "Staffing, field operations, fleet, inventory, and readiness in one secure portal.",
      type: "website",
      url: origin,
      images: [{ url: socialImage, width: 1748, height: 915, alt: "Stickney Fire Department Inventory" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Stickney Firehouse Manager",
      description: "Staffing, field operations, fleet, inventory, and readiness in one secure portal.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/pwa-register.js" strategy="afterInteractive" />
        <Script src="/training-route.js" strategy="afterInteractive" />
        <Script src="/fleet-notices.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
