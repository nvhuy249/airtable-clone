"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import BaseCard from "./components/BaseCard";
import Banner from "./components/Banner";
import QuickActions from "./components/QuickActions";
import { signOut } from "next-auth/react";

type Props = {
  user: any;
  bases: any[];
};

export default function PageClient({ user, bases }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false)

  const expanded = sidebarOpen || sidebarHover

  return (
    <div className="min-h-screen bg-[#f7f8fa] pt-[64px]">
      <Sidebar expanded={expanded} onMouseEnter={() => setSidebarHover(true)} onMouseLeave={() => setSidebarHover(false)} />

      <div className="pl-16">
        <Topbar
          user={user}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="px-14 pt-10 pb-20 max-w-screen-xl mx-auto">
          <h1 className="text-3xl font-semibold mb-6">Home</h1>

          <Banner />
          
          <QuickActions />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {bases.map((b) => (
              <BaseCard key={b.id} base={b} />
            ))}
          </div>
        </main>
      </div>
      {process.env.NODE_ENV === "development" && (
        <button
            onClick={() => signOut()}
            className="fixed bottom-4 right-4 z-[9999] bg-red-500 text-white px-3 py-1 rounded shadow hover:bg-red-600"
        >
            Sign out
        </button>
      )}
    </div>
  );
}
