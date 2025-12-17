"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, LayoutGrid, MoreVertical, Plus, Search, Star, Trash2 } from "lucide-react";

type ViewSidebarProps = {
  loading?: boolean;
  views?: { id: string; name: string }[];
  activeViewId?: string | null;
  onSelectViewAction?: (viewId: string) => void;
  onCreateViewAction?: () => void;
  onRenameViewAction?: (id: string, name: string) => void;
  onDeleteViewAction?: (id: string) => void;
  onDuplicateViewAction?: (id: string) => void;
  onReorderViewAction?: (orderedIds: string[]) => void;
};

export default function ViewSidebar({
  loading = false,
  views = [],
  activeViewId,
  onSelectViewAction,
  onCreateViewAction,
  onRenameViewAction,
  onDeleteViewAction,
  onDuplicateViewAction,
  onReorderViewAction,
}: ViewSidebarProps) {
  const [search, setSearch] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    viewId: string | null;
    x: number;
    y: number;
  }>({ viewId: null, x: 0, y: 0 });
  const [draggingViewId, setDraggingViewId] = useState<string | null>(null);
  const [dragOverViewId, setDragOverViewId] = useState<string | null>(null);

  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        createMenuRef.current?.contains(e.target as Node) ||
        createTriggerRef.current?.contains(e.target as Node) ||
        contextMenuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setCreateMenuOpen(false);
      setContextMenu({ viewId: null, x: 0, y: 0 });
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const startEditing = (id: string, name: string) => {
    setEditingViewId(id);
    setEditingName(name);
  };

  const reorderById = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const next = [...views];
      const fromIndex = next.findIndex((v) => v.id === sourceId);
      const toIndex = next.findIndex((v) => v.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderViewAction?.(next.map((v) => v.id));
    },
    [views, onReorderViewAction],
  );

  const commitEditing = () => {
    if (editingViewId) {
      const next = editingName.trim();
      if (next && next !== views.find((v) => v.id === editingViewId)?.name) {
        onRenameViewAction?.(editingViewId, next);
      }
    }
    setEditingViewId(null);
    setEditingName("");
  };

  const filteredViews = useMemo(() => {
    if (!search.trim()) return views;
    const term = search.toLowerCase();
    return views.filter((v) => v.name.toLowerCase().includes(term));
  }, [search, views]);

  if (loading) {
    return (
      <aside className="flex h-full w-64 flex-shrink-0 border-r border-gray-200 bg-white" />
    );
  }

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white text-[13px]">
      <div className="relative w-full">
        <button
          ref={createTriggerRef}
          type="button"
          className="flex items-center w-full gap-2 px-4 pt-3 pb-2 text-gray-800 hover:bg-gray-50"
        onClick={() => setCreateMenuOpen((p) => !p)}
      >
          <Plus className="h-3.5 w-3.5" />
          <span>Create new...</span>
        </button>
        {createMenuOpen && (
          <div
            ref={createMenuRef}
            className="absolute left-3 top-10 z-40 w-56 rounded-lg border border-gray-200 bg-white shadow-xl"
          >
            <div className="px-3 py-2 text-[13px] text-gray-800 font-medium border-b">
              Create a view
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-900 hover:bg-gray-50"
              onClick={() => {
          onCreateViewAction?.();
          setCreateMenuOpen(false);
        }}
      >
              <LayoutGrid className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span className="font-medium">Grid</span>
                <span className="text-[12px] text-gray-500">Default table view</span>
              </div>
            </button>
            {[
              "Calendar",
              "Gallery",
              "Kanban",
              "Timeline",
              "List",
              "Gantt",
              "Form",
              "Section",
            ].map((label) => (
              <div
                key={label}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-400"
                title="Coming soon"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* "Find a view" row */}
      <div className="flex items-center gap-2 px-4 py-2 text-gray-500">
        <Search className="h-3.5 w-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a view"
          className="flex-1 bg-transparent text-gray-700 placeholder:text-gray-400 outline-none"
        />
      </div>

      {/* view list */}
      <div className="mt-1 flex-1 overflow-auto px-0">
        {filteredViews.map((view) => {
          const isActive = view.id === activeViewId;
          const isDragOver = dragOverViewId === view.id && draggingViewId !== view.id;
          return (
            <div
              key={view.id}
              className="px-0 group"
              onDragOver={(e) => {
                if (!draggingViewId || draggingViewId === view.id) return;
                e.preventDefault();
                setDragOverViewId(view.id);
              }}
              onDragLeave={() => {
                if (dragOverViewId === view.id) setDragOverViewId(null);
              }}
              onDrop={(e) => {
                if (!draggingViewId || draggingViewId === view.id) return;
                e.preventDefault();
                const sourceId = e.dataTransfer.getData("text/plain") || draggingViewId;
                reorderById(sourceId, view.id);
                setDragOverViewId(null);
                setDraggingViewId(null);
              }}
            >
              <div className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex w-full items-center justify-between rounded-r-md pl-2 pr-2 py-2 text-[13px] transition-all duration-150 ${
                    isActive ? "bg-gray-200 text-black" : "text-gray-800 hover:bg-gray-50"
                  } ${isDragOver ? "ring-1 ring-blue-200 translate-y-[1px]" : ""}`}
                  onClick={() => onSelectViewAction?.(view.id)}
                  onDoubleClick={() => startEditing(view.id, view.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ viewId: view.id, x: e.clientX, y: e.clientY });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectViewAction?.(view.id);
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <div className="relative h-4 w-4">
                      <LayoutGrid className="h-3.5 w-3.5 text-[#2557e0] group-hover:hidden" />
                      <Star className="absolute inset-0 h-3.5 w-3.5 text-gray-500 hidden group-hover:inline" />
                    </div>
                    {editingViewId === view.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditing();
                          if (e.key === "Escape") {
                            setEditingViewId(null);
                            setEditingName("");
                          }
                        }}
                        className="w-40 rounded border border-gray-300 px-2 py-0.5 text-[13px] focus:outline-none"
                      />
                    ) : (
                      <span className="truncate">{view.name}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setContextMenu({ viewId: view.id, x: rect.right, y: rect.bottom });
                      }}
                    >
                      <MoreVertical className="h-3.5 w-3.5 text-[#2557e0]" />
                    </button>
                    <button
                      type="button"
                      className={`cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-opacity ${
                        draggingViewId === view.id
                          ? "opacity-100 cursor-grabbing"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      draggable
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        setDraggingViewId(view.id);
                        e.dataTransfer.setData("text/plain", view.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingViewId(null);
                        setDragOverViewId(null);
                      }}
                      aria-label="Drag to reorder view"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!filteredViews.length ? (
          <div className="px-4 py-3 text-sm text-gray-500">No views yet</div>
        ) : null}
      </div>

      {contextMenu.viewId && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-xl"
          style={{ top: contextMenu.y + 4, left: contextMenu.x + 4 }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 text-gray-800"
            onClick={() => {
              // Favorites stub
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <span className="text-gray-500">★</span>
            <span>Add to favourites</span>
          </button>
          <div className="border-t" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 text-gray-800"
            onClick={() => {
              if (contextMenu.viewId) {
                    const currentName = views.find((v) => v.id === contextMenu.viewId)?.name ?? "";
                    startEditing(contextMenu.viewId, currentName);
                  }
                  setContextMenu({ viewId: null, x: 0, y: 0 });
                }}
          >
            <span className="text-gray-500">✎</span>
            <span>Rename view</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 text-gray-800"
            onClick={() => {
              if (contextMenu.viewId) onDuplicateViewAction?.(contextMenu.viewId);
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <span className="text-gray-500">⧉</span>
            <span>Duplicate view</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-red-50 text-red-600"
            onClick={() => {
              if (contextMenu.viewId) onDeleteViewAction?.(contextMenu.viewId);
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete view</span>
          </button>
        </div>
      )}
    </aside>
  );
}
