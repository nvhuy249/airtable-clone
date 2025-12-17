"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import BaseCard from "./components/BaseCard";
import Banner from "./components/Banner";
import QuickActions from "./components/QuickActions";
import CreateBaseModal from "./components/CreateBaseModal";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react"; 
import { FiSquare, FiMenu } from "react-icons/fi";

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

export default function PageClient({ user, bases }: PageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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
  const filteredBases = basesState; // (modify when timestamps added)

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
                You haven&apos;t opened anything recently
              </p>
              <p className="mb-4 text-[13px]">
                Apps that you have recently opened will appear here.
              </p>
              <button className="cursor-pointer px-4 py-2 bg-white border border-[#e6e8eb] rounded-full shadow-sm hover:bg-[#f2f4f7] text-[13px] text-[#1f2933]">
                Go to all workspaces
              </button>
            </div>
          ) : (
            <>
              {/* GRID VIEW */}
              {view === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredBases.map((base) => (
                    <BaseCard
                      key={base.id}
                      base={base}
                      onDelete={handleDeleteBase}
                    />
                  ))}
                </div>
              )}

              {/* LIST VIEW */}
              {view === "list" && (
                <div className="space-y-2">
                  {filteredBases.map((base) => (
                    <div
                      key={base.id}
                      className="bg-white border p-4 rounded shadow-sm"
                    >
                      {base.name}
                    </div>
                  ))}
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
