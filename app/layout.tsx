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
  title: "Firehouse Command | Department Operations Portal",
  description: "Secure department access for staffing, daily logs, policies, apparatus, inventory, scheduling, field operations, and payroll.",
  manifest: "/manifest.webmanifest?v=2",
  appleWebApp: { capable: true, title: "Firehouse Command", statusBarStyle: "black-translucent" },
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
