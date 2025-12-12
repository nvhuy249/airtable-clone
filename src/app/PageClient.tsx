"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import BaseCard from "./components/BaseCard";
import Banner from "./components/Banner";
import QuickActions from "./components/QuickActions";
import CreateBaseModal from "./components/CreateBaseModal";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { api } from "~/trpc/react"; 

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
  { label: "Today", value: "today" },
  { label: "In the past 7 days", value: "7days" },
  { label: "In the past 30 days", value: "30days" },
  { label: "Anytime", value: "any" },
];

export default function PageClient({ user, bases }: PageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [filter, setFilter] = useState("any");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [basesState, setBasesState] = useState<Base[]>(bases);

  const router = useRouter();

  // Sidebar expand logic
  const expanded = sidebarOpen || sidebarHover;

  // Push content only when *clicked*, not on hover
  const contentMargin = sidebarOpen ? "ml-64" : "ml-16";

  // Fake date filtering demo — update when you have timestamps
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
    onMutate: async ({ id }): Promise<{ prev: Base[] }> => {
      const prev = basesState;
      setBasesState((old) => old.filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) setBasesState(ctx.prev);
    },
  });

  const handleCreateEmptyBase = () => {
    if (createBase.isPending) return;
    createBase.mutate({
      name: "Untitled Base",
    });
    setCreateOpen(false);
  };

  const handleDeleteBase = (id: string) => {
    deleteBase.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] pt-[64px]">
      {/* SIDEBAR */}
      <Sidebar
        expanded={expanded}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        onCreateBase={() => setCreateOpen(true)}
      />

      {/* MAIN CONTENT WRAPPER */}
      <div className={`transition-all duration-300 ${contentMargin}`}>
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen((p) => !p)} />

        <main className="px-14 pt-10 pb-20 max-w-screen-xl mx-auto">
          <h1 className="text-3xl font-semibold mb-6">Home</h1>

          <Banner />

          <QuickActions />

          {/* SECTION HEADER (Filter + View Toggle) */}
          <div className="flex items-center justify-between mt-10 mb-4">
            {/* Filter Dropdown */}
            <div className="relative">
              <select
                className="px-3 py-1 text-sm text-gray-500 cursor-pointer"
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
            <div className="flex gap-3">
              <button
                onClick={() => setView("list")}
                className={`cursor-pointer px-2 py-1 rounded ${
                  view === "list"
                    ? "bg-gray-200"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                ☰
              </button>
              <button
                onClick={() => setView("grid")}
                className={`cursor-pointer px-2 py-1 rounded ${
                  view === "grid"
                    ? "bg-gray-200"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                ⊞
              </button>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredBases.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <p className="text-lg font-medium mb-2">
                You haven’t opened anything recently
              </p>
              <p className="mb-4 text-sm">
                Apps that you have recently opened will appear here.
              </p>
              <button className="cursor-pointer px-4 py-2 bg-white border rounded-md shadow-sm hover:bg-gray-50">
                Go to all workspaces
              </button>
            </div>
          ) : (
            <>
              {/* GRID VIEW */}
              {view === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

      {/* SIGN OUT BUTTON */}
      <button
        onClick={() => signOut()}
        className="fixed bottom-4 right-4 z-[9999] bg-red-500 text-white px-3 py-1 rounded shadow hover:bg-red-600"
      >
        Sign out
      </button>
    </div>
  );
}
