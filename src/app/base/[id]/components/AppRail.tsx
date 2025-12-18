"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { FiHelpCircle, FiBell } from "react-icons/fi";

export default function AppRail({ userInitial }: { userInitial: string }) {
  return (
    <div className="w-12 bg-white border-r border-[#e6e8ef] flex flex-col items-center py-3 h-screen gap-2">
      <Link
        href="/"
        className="group relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f2f4f8]"
        title="Back to home"
        aria-label="Back to home"
      >
        <Image
          src="/airtable-logo-black.png"
          alt="Airtable home"
          width={24}
          height={24}
          className="h-5 w-5 text-[#667085] transition-opacity duration-150 group-hover:opacity-0"
          priority
        />
        <ArrowLeft className="absolute h-[18px] w-[18px] text-[#344054] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </Link>

      <div className="h-8 w-8 mt-1 border border-dashed border-[#e6e8ef] rounded-md" />

      <div className="flex-1" />

      <button className="h-8 w-8 flex items-center justify-center text-[#667085] hover:text-[#344054] hover:bg-[#f2f4f8] rounded-md">
        <FiHelpCircle className="h-[18px] w-[18px]" />
      </button>

      <button className="h-8 w-8 flex items-center justify-center text-[#667085] hover:text-[#344054] hover:bg-[#f2f4f8] rounded-md">
        <FiBell className="h-[18px] w-[18px]" />
      </button>

      <div className="h-9 w-9 rounded-full bg-rose-600 text-white flex items-center justify-center mt-2">
        {userInitial}
      </div>
    </div>
  );
}
