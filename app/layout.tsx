import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./suite-theme.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    title: "Inventory | Stickney Fire Department",
    description: "Visual apparatus checks, equipment inventory, maintenance, stock, and readiness workflows built for fire and EMS operations.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
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
  return <html lang="en"><body>{children}</body></html>;
}
