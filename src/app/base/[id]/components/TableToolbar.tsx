"use client";

import { ChevronDown, LayoutGrid } from "lucide-react";

const toolbarItems = [
  "Hide fields",
  "Filter",
  "Group",
  "Sort",
  "Color",
  "Share and sync",
];

export default function TableToolbar() {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-[13px]">
      {/* left – Grid view pill */}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-[13px] text-gray-900 shadow-sm hover:bg-gray-50"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-gray-700" />
        <span>Grid view</span>
        <ChevronDown className="h-3 w-3 text-gray-500" />
      </button>

      {/* right – tools */}
      <div className="flex items-center gap-4 text-[13px] text-gray-600">
        {toolbarItems.map((label) => (
          <button
            key={label}
            type="button"
            className="inline-flex items-center gap-1 hover:text-gray-900"
          >
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
