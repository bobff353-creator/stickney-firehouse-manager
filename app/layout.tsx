import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stickney Fire Department Operations Portal",
  description: "Official operations, staffing, daily logbook, personnel, and payroll portal for the Stickney Fire Department.",
  manifest: "/manifest.webmanifest?v=2",
  appleWebApp: { capable: true, title: "SFD Operations", statusBarStyle: "black-translucent" },
  themeColor: "#0f2e45",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/stickney-fd-patch.jpg?v=2",
    shortcut: "/stickney-fd-patch.jpg?v=2",
    apple: "/stickney-fd-patch.jpg?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
