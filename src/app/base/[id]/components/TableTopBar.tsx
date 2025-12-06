"use client";

import { useState } from "react";
import {
  ChevronDown,
  Check,
  EyeOff,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import TableToolbar from "./TableToolbar";

interface TableTopBarProps {
  tables: { id: string; name: string }[];
  activeTableId: string;
  onChangeTable: (id: string) => void;
}

export default function TableTopBar({
  tables,
  activeTableId,
  onChangeTable,
}: TableTopBarProps) {
  return (
    <div className="relative flex items-center justify-between h-10 px-5 border-b border-gray-200 bg-white text-sm">
      {/* LEFT: table switcher + Add or import */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-1 px-3 py-1 rounded border border-transparent hover:border-gray-300"
        >
          <span className="font-medium">
            {activeTable ? activeTable.name : "Tables"}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <button className="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-50">
          + Add or import
        </button>
      </div>

      {/* RIGHT: tools */}
      <TableToolbar />

      {open && (
        <div className="absolute top-10 left-4 z-40 w-72 rounded-lg border border-gray-200 bg-white shadow-xl text-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 text-sm text-gray-500">
            <Search className="h-4 w-4" />
            <input
              placeholder="Find a table"
              className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-auto py-2 text-sm">
            {tables.map((t) => {
              const isActive = t.id === activeTableId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onChangeTable(t.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${isActive ? "font-semibold text-gray-900" : "text-gray-800"}`}
                >
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <Check className="h-4 w-4 text-blue-500" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <span>{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <EyeOff className="h-4 w-4" />
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-200">
            <button
              onClick={() => {
                onAddTable();
                setOpen(false);
              }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-sm text-gray-700"
            >
              <Plus className="h-4 w-4" /> Add table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
