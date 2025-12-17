"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import BaseCard from "./components/BaseCard";
import Banner from "./components/Banner";
import QuickActions from "./components/QuickActions";
import CreateBaseModal from "./components/CreateBaseModal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import {
  FiSquare,
  FiMenu,
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";

import type { Base } from "./components/BaseCard";

interface PageClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  bases: Base[];
}

const FILTERS = [
  { label: "today", value: "today" },
  { label: "in the past 7 days", value: "7days" },
  { label: "in the past 30 days", value: "30days" },
  { label: "anytime", value: "any" },
];

const PENDING_DELETED_KEY = "airtable:pending-deleted-bases";
const PENDING_DELETED_TTL = 5 * 60 * 1000; // 5 minutes

type PendingDelete = { id: string; ts: number };
type RenameState = { id: string; value: string } | null;
type GroupedBases = { label: string; items: Base[] };

const loadPendingDeleted = (): Map<string, number> => {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(PENDING_DELETED_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as PendingDelete[];
    const now = Date.now();
    const map = new Map<string, number>();
    for (const entry of parsed) {
      if (!entry?.id || typeof entry.ts !== "number") continue;
      if (now - entry.ts < PENDING_DELETED_TTL) {
        map.set(entry.id, entry.ts);
      }
    }
    // prune stale entries if needed
    if (map.size !== parsed.length) {
      const arr = Array.from(map.entries()).map(([id, ts]) => ({ id, ts }));
      window.localStorage.setItem(PENDING_DELETED_KEY, JSON.stringify(arr));
    }
    return map;
  } catch {
    return new Map();
  }
};

const persistPendingDeleted = (map: Map<string, number>) => {
  if (typeof window === "undefined") return;
  const arr = Array.from(map.entries()).map(([id, ts]) => ({ id, ts }));
  try {
    window.localStorage.setItem(PENDING_DELETED_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage failures
  }
};

const formatLastOpened = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Opened just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Opened just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Opened ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Opened ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Opened ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Opened ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `Opened ${years} year${years === 1 ? "" : "s"} ago`;
};

const groupBasesByRecency = (items: Base[]): GroupedBases[] => {
  const now = Date.now();
  const groups: Record<"today" | "week" | "older", Base[]> = {
    today: [],
    week: [],
    older: [],
  };

  for (const base of items) {
    const date = base.updatedAt ? new Date(base.updatedAt) : new Date(base.createdAt);
    const diffDays = (now - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) groups.today.push(base);
    else if (diffDays < 7) groups.week.push(base);
    else groups.older.push(base);
  }

  return [
    { label: "Today", items: groups.today },
    { label: "Past 7 days", items: groups.week },
    { label: "Earlier", items: groups.older },
  ].filter((g) => g.items.length > 0);
};

export default function PageClient({ user, bases }: PageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameState, setRenameState] = useState<RenameState>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);

  const [filter, setFilter] = useState("any");
  const [view, setView] = useState<"grid" | "list">("grid");
  const pendingDeletedRef = useRef<Map<string, number>>(loadPendingDeleted());
  const [basesState, setBasesState] = useState<Base[]>(() => {
    const pending = pendingDeletedRef.current;
    return bases.filter((b) => !pending.has(b.id));
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = loadPendingDeleted();
    if (!pending.size) return;
    pendingDeletedRef.current = pending;
    setBasesState((prev) => prev.filter((b) => !pending.has(b.id)));
  }, []);

  const router = useRouter();

  // Sidebar expand logic
  const expanded = sidebarOpen || sidebarHover;

  // Pad content instead of margin to avoid horizontal overflow when expanded
  const contentPadding = sidebarOpen ? "pl-[256px]" : "pl-16";

  // Fake date filtering demo â€” update when you have timestamps
  const filteredBases = useMemo(() => {
    const now = Date.now();
    return basesState.filter((base) => {
      const ts = new Date(base.updatedAt ?? base.createdAt).getTime();
      if (Number.isNaN(ts)) return true;
      const days = (now - ts) / (1000 * 60 * 60 * 24);
      if (filter === "today") return days < 1;
      if (filter === "7days") return days < 7;
      if (filter === "30days") return days < 30;
      return true; // "any"
    });
  }, [basesState, filter]);

  const createBase = api.base.create.useMutation({
    onMutate: async ({ name }) => {
      const tempId = "temp-base-" + Date.now();

        const optimistic: Base = {
        id: tempId,
        name,
        tables: [
          { id: "temp-table-", name: "Table 1" }
        ],
        ownerId: user.id,                     
        createdAt: new Date(),                
        updatedAt: new Date(),                
      };

      const previous = basesState;
      setBasesState((prev) => [optimistic, ...prev]);
      void router.push(`/base/loading`);

      return { previous, tempId };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.previous) setBasesState(ctx.previous);      
    },

    onSuccess: (realBase, _v, ctx) => {
      setBasesState((prev) =>
        prev.map((b) =>
          b.id === ctx.tempId ? realBase : b
        )
      );
      void router.replace(`/base/${realBase.id}`);
    },
  });

  const renameBase = api.base.rename.useMutation({
    onMutate: async ({ id, name }) => {
      const prev = basesState;
      setBasesState((old) => old.map((b) => (b.id === id ? { ...b, name } : b)));
      setRenameState(null);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      setPendingRenameId(null);
      if (ctx?.prev) setBasesState(ctx.prev);
    },
    onSuccess: (updated, vars) => {
      setPendingRenameId(null);
      setBasesState((old) =>
        old.map((b) =>
          b.id === vars.id
            ? {
                ...b,
                name: updated.name ?? vars.name,
                updatedAt: updated.updatedAt ?? b.updatedAt,
              }
            : b,
        ),
      );
    },
    onSettled: () => {
      setPendingRenameId(null);
      setRenameState(null);
    },
  });

  const deleteBase = api.base.delete.useMutation({
    onMutate: async ({ id }): Promise<{ prev: Base[]; id: string }> => {
      const prev = basesState;
      pendingDeletedRef.current.set(id, Date.now());
      persistPendingDeleted(pendingDeletedRef.current);
      setBasesState((old) => old.filter((b) => b.id !== id));
      return { prev, id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.id) pendingDeletedRef.current.delete(ctx.id);
      persistPendingDeleted(pendingDeletedRef.current);
      if (ctx?.prev) setBasesState(ctx.prev);
    },
    onSuccess: (_data, vars) => {
      pendingDeletedRef.current.delete(vars.id);
      persistPendingDeleted(pendingDeletedRef.current);
    },
  });

  const handleCreateEmptyBase = () => {
    if (createBase.isPending) return;

    setCreateOpen(false);
    
    void router.push("/base/loading");
    
    createBase.mutate({
      name: "Untitled Base",
    });
  };

  const handleStartRename = (base: Base) => {
    setRenameState({ id: base.id, value: base.name || "Untitled Base" });
  };

  const handleRenameChange = (value: string) => {
    setRenameState((prev) => (prev ? { ...prev, value } : prev));
  };

  const handleSubmitRename = (id: string) => {
    const next = (renameState?.value ?? "").trim() || "Untitled Base";
    setPendingRenameId(id);
    renameBase.mutate({ id, name: next });
  };

  const handleCancelRename = () => {
    setRenameState(null);
  };

  const handleDeleteBase = (id: string) => {
    deleteBase.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] pt-[64px] text-[13px] text-[#1f2933] overflow-x-hidden">
      {/* SIDEBAR */}
      <Sidebar
        expanded={expanded}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        onCreateBase={() => setCreateOpen(true)}
      />

      {/* MAIN CONTENT WRAPPER */}
      <div className={`transition-all duration-300 pr-6 ${contentPadding}`}>
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen((p) => !p)} />

        <main className="w-full max-w-[1800px] mr-auto pl-10 pt-10 pb-16 space-y-6">
          <h1 className="text-[28px] font-semibold text-[#1f2933] leading-[1.1]">Home</h1>

          <Banner />

          <QuickActions />

          {/* SECTION HEADER (Filter + View Toggle) */}
          <div className="flex items-center justify-between pt-4">
            {/* Filter Dropdown */}
            <div className="relative">
              <span className="text-gray-500">Opened</span>
              <select
                className="py-1.5 text-[13px] text-gray-500 bg-[#f8f9fb] hover:border-[#d9dbe0] focus:outline-none"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* View Toggle Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded-full border ${
                  view === "list"
                    ? "border-[#d8dce5] bg-white text-[#1f2933]"
                    : "border-transparent bg-transparent text-[#6b7280] hover:bg-white/70 hover:border-[#e6e8eb]"
                }`}
              >
                <FiMenu className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-1.5 rounded-full border ${
                  view === "grid"
                    ? "border-[#d8dce5] bg-white text-[#1f2933]"
                    : "border-transparent bg-transparent text-[#6b7280] hover:bg-white/70 hover:border-[#e6e8eb]"
                }`}
              >
                <FiSquare className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredBases.length === 0 ? (
            <div className="text-center py-20 text-[#6b7280]">
              <p className="text-[16px] font-semibold mb-2 text-[#1f2933]">
                Nothing recent matches your current filters
              </p>
              <p className="mb-4 text-[13px]">
                Remove filters to see more results
              </p>
            </div>
          ) : (
            <>
              {/* GRID VIEW */}
              {view === "grid" && (
                <div className="space-y-6">
                  {groupBasesByRecency(filteredBases).map((group) => (
                    <div key={group.label} className="space-y-3">
                      <div className="text-[12px] text-[#6b7280]">{group.label}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.items.map((base) => (
                          <BaseCard
                            key={base.id}
                            base={base}
                            isRenaming={renameState?.id === base.id}
                            renameValue={renameState?.id === base.id ? renameState.value : undefined}
                            renamePending={renameBase.isPending && pendingRenameId === base.id}
                            onRenameStart={() => handleStartRename(base)}
                            onRenameChange={handleRenameChange}
                            onRenameSubmit={() => handleSubmitRename(base.id)}
                            onRenameCancel={handleCancelRename}
                            onDelete={handleDeleteBase}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LIST VIEW */}
              {view === "list" && (
                <div className="mt-2 rounded-xl bg-[#f8f9fb]">
                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 py-3 text-[12px] text-[#6b7280]">
                    <span>Name</span>
                    <span>Last opened</span>
                    <span>Workspace</span>
                  </div>
                  <div className="space-y-2 py-2">
                    {groupBasesByRecency(filteredBases).map((group) => (
                      <div key={group.label} className="px-3">
                        <div className="text-[12px] text-[#6b7280] mb-1">{group.label}</div>
                        <div className="space-y-1">
                          {group.items.map((base) => (
                            <BaseListRow
                              key={base.id}
                              base={base}
                              lastOpenedLabel={formatLastOpened(base.updatedAt ?? base.createdAt)}
                              workspaceLabel="My First Workspace"
                              isRenaming={renameState?.id === base.id}
                              renameValue={renameState?.id === base.id ? renameState.value : undefined}
                              renamePending={renameBase.isPending && pendingRenameId === base.id}
                              onRenameStart={() => handleStartRename(base)}
                              onRenameChange={handleRenameChange}
                              onRenameSubmit={() => handleSubmitRename(base.id)}
                              onRenameCancel={handleCancelRename}
                              onDelete={handleDeleteBase}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <CreateBaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreateEmptyBase={handleCreateEmptyBase}
      />
    </div>
  );
}

function BaseListRow({
  base,
  lastOpenedLabel,
  workspaceLabel,
  isRenaming,
  renameValue,
  renamePending,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: {
  base: Base;
  lastOpenedLabel: string;
  workspaceLabel: string;
  isRenaming: boolean;
  renameValue?: string;
  renamePending?: boolean;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => {
    const trimmed = base.name?.trim();
    if (!trimmed) return "Un";
    return trimmed.slice(0, 2).padEnd(2, " ").toUpperCase();
  }, [base.name]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isRenaming) return;
    setMenuOpen(false);
    const id = window.setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [isRenaming]);

  return (
    <div className="relative" ref={menuRef}>
      <div className="group grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#e9edf3]">
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="h-9 w-9 rounded-lg bg-[#eef2f7] text-[#4b5563] flex items-center justify-center text-[13px] font-semibold border border-[#e6e8eb]">
            {initials}
          </div>
          {!isRenaming ? (
            <Link
              href={`/base/${base.id}`}
              className="text-[14px] font-medium text-[#1f2933] hover:underline truncate"
            >
              {base.name || "Untitled Base"}
            </Link>
          ) : (
            <input
              ref={renameInputRef}
              value={renameValue ?? base.name ?? "Untitled Base"}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRenameSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onRenameCancel();
                }
              }}
              onBlur={onRenameSubmit}
              aria-label="Rename base"
              className="text-[14px] font-medium text-[#1f2933] bg-white border border-[#5c9bfd] rounded px-2 py-1 w-full max-w-[220px] outline-none shadow-[0_0_0_2px_rgba(92,155,253,0.15)]"
              disabled={renamePending}
            />
          )}
          <div className="ml-auto flex-shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen((prev) => !prev);
              }}
              className="h-8 w-8 rounded-full border border-[#e6e8eb] flex items-center justify-center hover:bg-[#f2f4f7] text-[#6b7280]"
              aria-label="Open base actions"
              aria-expanded={menuOpen}
            >
              <FiMoreHorizontal />
            </button>
          </div>
        </div>
        <div className="text-[12px] text-[#6b7280]">{lastOpenedLabel}</div>
        <div className="text-[12px] text-[#6b7280]">{workspaceLabel}</div>
      </div>

      {menuOpen && (
        <div className="absolute right-2 top-11 z-30 w-44 rounded-lg border border-[#e6e8eb] bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onRenameStart();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-[13px] hover:bg-gray-50 text-left text-[#1f2933]"
          >
            <FiEdit2 className="text-[#6b7280]" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete(base.id);
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-[13px] hover:bg-gray-50 text-left text-red-600"
          >
            <FiTrash2 />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
