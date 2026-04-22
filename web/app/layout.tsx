import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canton Hub — Real-time Canton Network Dashboard",
  description: "Track CC price, B/M ratio, network activity, and governance in real-time.",
  icons: {
    icon: "/logo-badkids.jpg",
    shortcut: "/logo-badkids.jpg",
    apple: "/logo-badkids.jpg",
  },
};

// Blocking script that runs before hydration to apply the persisted theme
// class to <html>, preventing flash-of-wrong-theme. Default is dark.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('canton-hub-theme');
    if (t !== 'light') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-canton-bg text-zinc-200 antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
