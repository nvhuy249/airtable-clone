"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  CalendarClock,
  ChevronDown,
  Copy,
  EyeOff,
  HelpCircle,
  Import,
  Mail,
  Pen,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { FiPlus } from "react-icons/fi";

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
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamePosition, setRenamePosition] = useState<{ top: number; left: number } | null>(null);
  const menuWrapperRef = useRef<HTMLDivElement | null>(null);
  const addMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const renameWrapperRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const activeTable = useMemo(
    () => tables.find((t) => t.id === activeTableId),
    [tables, activeTableId],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuWrapperRef.current?.contains(e.target as Node) === false) {
        setMenuOpen(false);
      }
      if (addMenuWrapperRef.current?.contains(e.target as Node) === false) {
        setAddMenuOpen(false);
      }
      if (renameWrapperRef.current?.contains(e.target as Node) === false) {
        setRenameOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openRenameDialog = () => {
    if (!activeTable) return;
    if (activeTabRef.current) {
      const rect = activeTabRef.current.getBoundingClientRect();
      setRenamePosition({
        top: rect.bottom + 6,
        left: rect.left,
      });
    } else {
      setRenamePosition(null);
    }
    setRenameValue(activeTable.name);
    setRenameOpen(true);
    setMenuOpen(false);
  };

  const handleSubmitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !activeTable?.id) return;
    onRenameTable(activeTable.id, trimmed);
    setRenameOpen(false);
  };

  const trimmedRename = renameValue.trim();

  return (
    <>
      <div className="relative flex h-8 items-center justify-between border-[#e6e8ef] bg-[#f6f7fb] text-[13px]">
        <div className="h-full flex items-center gap-0">
          <div ref={menuWrapperRef} className="h-full relative flex items-center gap-0">
            {tables.map((t) => {
              const isActive = t.id === activeTableId;
              return (
                <button
                  key={t.id}
                  onClick={() => onChangeTable(t.id)}
                  ref={(node) => {
                    if (isActive) {
                      activeTabRef.current = node;
                    }
                  }}
                  className={`group relative flex h-8 items-center gap-1.5 rounded-t-[3px] border-t border-l border-r px-3 text-[13px] transition ${
                    isActive
                      ? "border-[#d9dde8] bg-white text-[#111827] font-medium shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                      : "border-transparent bg-transparent text-[#475467] hover:bg-white/60"
                  }`}
                >
                  <span className="max-w-[120px] truncate">{t.name}</span>
                  {isActive && (
                    <ChevronDown
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen((p) => !p);
                      }}
                      className="ml-0.5 h-3.5 w-3.5 text-[#667085]"
                      strokeWidth={1.75}
                    />
                  )}
                </button>
              );
            })}

            {menuOpen && (
              <div className="absolute left-0 top-11 z-40 w-72 rounded-lg border border-[#e6e8ef] bg-white text-[13px] text-gray-800 shadow-2xl">
                <div className="py-2">
                  {menuItems.map(({ label, icon: Icon, danger }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (label === "Rename table") {
                          openRenameDialog();
                          return;
                        }
                        if (danger && activeTable?.id) {
                          onDeleteTable(activeTable.id);
                          setMenuOpen(false);
                          return;
                        }
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 ${
                        danger ? "text-red-600" : ""
                      }`}
                    >
                      <Icon className="h-4 w-4 text-[#667085]" strokeWidth={1.75} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-[#e6e8ef]" />

          <div ref={addMenuWrapperRef} className="relative flex items-center gap-1.5">
            <button
              onClick={() => setAddMenuOpen((p) => !p)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#475467] hover:bg-white/60"
              aria-label="Add table"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1.5 text-[13px] text-[#475467] hover:bg-white/60 rounded-md"
              aria-label="Add or import"
            >
              <FiPlus className="h-3.5 w-3.5 text-[#667085]" strokeWidth={1.75} />
              <span>Add or import</span>
            </button>

            {addMenuOpen && (
              <div className="absolute left-0 top-11 z-40 w-56 rounded-lg border border-[#e6e8ef] bg-white text-[13px] text-gray-800 shadow-2xl">
                <button
                onClick={() => {
                  onAddTable();
                  setAddMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50"
              >
                  <Plus className="h-4 w-4 text-[#667085]" strokeWidth={1.75} />
                  <span>Add table</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {renameOpen && (
        <div
          ref={renameWrapperRef}
          className="fixed z-50 w-[340px] rounded-lg border border-[#e6e8ef] bg-white shadow-2xl"
          style={{
            top: renamePosition?.top ?? 52,
            left: renamePosition?.left ?? 16,
          }}
        >
          <div className="border-b border-[#e6e8ef] px-4 py-3 text-sm font-medium">
            Rename table
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitRename();
            }}
            className="space-y-4 px-4 py-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Table name
              </label>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-md border border-[#d9dde8] px-3 py-2 text-sm focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/30"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center text-xs font-medium text-gray-700">
                <span>What should each record be called?</span>
                <HelpCircle className="ml-1 h-4 w-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#d9dde8] bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <span>Record</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-gray-500">
                <div className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  <span>Add record</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span>Send records</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!trimmedRename || trimmedRename === activeTable?.name}
                className="rounded-md bg-[#2f7efb] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:bg-[#2f7efb]/50"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
