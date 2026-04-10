import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canton Hub — Real-time Canton Network Dashboard",
  description: "Track CC price, B/M ratio, network activity, and governance in real-time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-canton-bg text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
