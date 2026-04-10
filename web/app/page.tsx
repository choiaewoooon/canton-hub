"use client";

import { useState } from "react";
import Navbar from "@/components/nav/navbar";

export default function Dashboard() {
  const [lang, setLang] = useState("ko");

  return (
    <div className="min-h-screen bg-canton-bg">
      <Navbar lang={lang} onLangChange={setLang} connected={false} />
      <main className="max-w-[1200px] mx-auto px-6 py-5">
        <p className="text-zinc-500">Dashboard components coming soon...</p>
      </main>
    </div>
  );
}
