"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Import,
  Pen,
  EyeOff,
  SlidersHorizontal,
  Copy,
  CalendarClock,
  AlignLeft,
  Shield,
  X,
  Trash2,
  Plus,
} from "lucide-react";

interface TableTopBarProps {
  tables: { id: string; name: string }[];
  activeTableId: string;
  onChangeTable: (id: string) => void;
  onAddTable: () => void;
  onRenameTable: (id: string, name: string) => void;
  onDeleteTable: (id: string) => void;
}

const menuItems = [
  { label: "Import data", icon: Import },
  { label: "Rename table", icon: Pen },
  { label: "Hide table", icon: EyeOff },
  { label: "Manage fields", icon: SlidersHorizontal },
  { label: "Duplicate table", icon: Copy },
  { label: "Configure date dependencies", icon: CalendarClock },
  { label: "Edit table description", icon: AlignLeft },
  { label: "Edit table permissions", icon: Shield },
  { label: "Clear data", icon: X },
  { label: "Delete table", icon: Trash2, danger: true },
];

export default function TableTopBar({
  tables,
  activeTableId,
  onChangeTable,
  onAddTable,
  onRenameTable,
  onDeleteTable,
}: TableTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuWrapperRef = useRef<HTMLDivElement | null>(null);
  const addMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const activeTable = useMemo(() => tables.find((t) => t.id === activeTableId), [tables, activeTableId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuWrapperRef.current?.contains(e.target as Node) === false) {
        setMenuOpen(false);
      }
      if (addMenuWrapperRef.current?.contains(e.target as Node) === false) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex items-center justify-between h-10 px-4 border-b border-gray-200 bg-[#f7f7fa] text-sm relative">
      {/* table tabs + add/import */}
      <div className="flex items-center gap-2 text-sm">
        <div ref={menuWrapperRef} className="relative flex items-center gap-1">
          {tables.map((t) => {
            const isActive = t.id === activeTableId;
            return (
              <button
                key={t.id}
                onClick={() => onChangeTable(t.id)}
                className={`px-3 py-1 rounded-sm border text-sm ${
                  isActive
                    ? "bg-white border-gray-300 font-medium"
                    : "bg-[#f7f7fa] border-transparent hover:border-gray-300"
                }`}
              >
                {t.name}
                {isActive && (
                  <ChevronDown
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((p) => !p);
                    }}
                    className="ml-1 h-4 w-4 text-gray-600 inline-block align-middle"
                  />
                )}
              </button>
            );
          })}

          {menuOpen && (
            <div
              className="absolute left-0 top-8 z-40 w-72 rounded-lg border border-gray-200 bg-white shadow-xl text-sm text-gray-800"
            >
              <div className="py-2">
                {menuItems.map(({ label, icon: Icon, danger }) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (label === "Rename table") {
                        const nextName = window.prompt(
                          "Rename table",
                          activeTable?.name ?? "",
                        );
                        const trimmed = nextName?.trim();
                        if (trimmed && activeTable?.id) {
                          onRenameTable(activeTable.id, trimmed);
                        }
                        setMenuOpen(false);
                        return;
                      }
                      if (danger && activeTable?.id) {
                        onDeleteTable(activeTable.id);
                        setMenuOpen(false);
                        return;
                      }
                      setMenuOpen(false);
                    }}
                    className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50`}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div ref={addMenuWrapperRef} className="relative flex items-center gap-1">
          <button
            onClick={() => setAddMenuOpen((p) => !p)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-sm border border-transparent hover:border-gray-300"
            aria-label="Add table menu"
          >
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>
          <button className="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-50">
            + Add or import
          </button>

          {addMenuOpen && (
            <div
              className="absolute left-0 top-8 z-40 w-56 rounded-lg border border-gray-200 bg-white shadow-xl text-sm text-gray-800"
            >
              <button
                onClick={() => {
                  onAddTable();
                  setAddMenuOpen(false);
                }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                <span>Add table</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
