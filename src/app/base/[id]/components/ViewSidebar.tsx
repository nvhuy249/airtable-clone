"use client";

import { LayoutGrid, Plus, Search, MoreVertical } from "lucide-react";

export default function ViewSidebar({ loading = false }: { loading?: boolean }) {
  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white text-[13px]">
      {/* "+ Create new..." */}
      <button
        type="button"
        disabled={loading}
        className="flex items-center gap-2 px-4 pt-3 pb-2 text-gray-800 hover:bg-gray-50"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Create new...</span>
      </button>

      {/* "Find a view" row */}
      <button
        type="button"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:bg-gray-50"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Find a view</span>
      </button>

      {/* active "Grid view" item */}
      {!loading && (
        <div className="mt-1 px-0">
          <div className="relative">
            {/* blue left bar */}
            <div className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-[#2557e0]" />
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-r-md bg-gray-200 pl-4 pr-2 py-2 text-[13px] text-black"
            >
              <span className="flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grid view</span>
              </span>
              <MoreVertical className="h-3.5 w-3.5 text-[#2557e0]" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
