"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { FiHelpCircle, FiBell } from "react-icons/fi";

export default function AppRail({ userInitial }: { userInitial: string }) {
  return (
    <div className="w-16 bg-white border border-gray-300 flex flex-col items-center py-4 h-screen">
      <Link
        href="/"
        className="group relative flex h-10 w-10 items-center justify-center rounded-lg"
        title="Back to home"
        aria-label="Back to home"
      >
        <Image
          src="/airtable-logo-black.png"
          alt="Airtable home"
          width={24}
          height={24}
          className="h-6 w-6 transition-opacity duration-150 group-hover:opacity-0"
          priority
        />
        <ArrowLeft className="absolute h-5 w-5 text-gray-800 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </Link>

      <div className="h-10 w-10 border-2 border-dashed rounded-lg mt-3" />

      <div className="flex-1" />

      <button className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded-full">
        <FiHelpCircle />
      </button>

      <button className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded-full">
        <FiBell />
      </button>

      <div className="h-9 w-9 rounded-full bg-rose-600 text-white flex items-center justify-center mt-2">
        {userInitial}
      </div>
    </div>
  );
}
