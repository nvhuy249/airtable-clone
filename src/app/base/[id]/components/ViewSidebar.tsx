"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, MoreVertical, Plus, Search, Star, Trash2, Pencil, Copy } from "lucide-react";
import { GridViewIcon } from "./icons/GridViewIcon";

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
      <aside className="flex h-full w-[280px] flex-shrink-0 border-r border-[#e6e8ef] bg-white" />
    );
  }

  return (
    <aside className="flex h-full w-[280px] flex-shrink-0 flex-col border-r border-[#e6e8ef] bg-white text-[13px]">
      <div className="relative w-full">
        <button
          ref={createTriggerRef}
          type="button"
          className="flex w-full items-center gap-2 px-4 pt-3 pb-2 text-[#111827] hover:bg-[#f6f7fb]"
        onClick={() => setCreateMenuOpen((p) => !p)}
      >
          <Plus className="h-3.5 w-3.5 text-[#667085]" />
          <span>Create new...</span>
        </button>
        {createMenuOpen && (
          <div
            ref={createMenuRef}
            className="absolute left-3 top-10 z-40 w-56 rounded-lg border border-[#e6e8ef] bg-white shadow-xl"
          >
            <div className="border-b border-[#e6e8ef] px-3 py-2 text-[13px] text-gray-800 font-medium">
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
              <GridViewIcon className="h-4 w-4 text-[#1b6ef3]" />
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
                <GridViewIcon className="h-4 w-4 text-[#1b6ef3]" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* "Find a view" row */}
      <div className="flex items-center gap-2 px-4 py-2 text-[#667085]">
        <Search className="h-3.5 w-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a view"
          className="flex-1 bg-transparent text-[#475467] placeholder:text-[#98a2b3] outline-none"
        />
      </div>

      {/* view list */}
      <div className="flex-1 overflow-auto px-0">
        {filteredViews.map((view) => {
          const isActive = view.id === activeViewId;
          const isDragOver = dragOverViewId === view.id && draggingViewId !== view.id;
          return (
            <div
              key={view.id}
              className="px-2 group"
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
                  className={`relative rounded-sm flex h-9 w-full items-center justify-between px-3 text-[13px] transition-all duration-150 ${
                    isActive
                      ? "bg-[#eef2f7] font-medium text-[#111827]"
                      : "text-[#475467] hover:bg-[#f6f7fb]"
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
                      <GridViewIcon className="h-4 w-4 text-[#1b6ef3] group-hover:hidden" />
                      <Star className="absolute inset-0 hidden h-3.5 w-3.5 text-[#667085] group-hover:inline" strokeWidth={1.75} />
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
                        className="w-40 rounded border border-[#d9dde8] px-2 py-1 text-[13px] focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                      />
                    ) : (
                      <span className="truncate">{view.name}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#667085] hover:text-[#344054]"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setContextMenu({ viewId: view.id, x: rect.right, y: rect.bottom });
                      }}
                    >
                      <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className={`cursor-grab active:cursor-grabbing p-1 text-[#98a2b3] hover:text-[#667085] transition-opacity ${
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
          className="fixed z-50 w-64 rounded-xl border border-[#d9dde3] bg-white shadow-xl"
          style={{ top: contextMenu.y + 4, left: contextMenu.x + 4 }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-[#111827] hover:bg-[#f5f7fb]"
            onClick={() => {
              // Favorites stub
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <Star className="h-4 w-4 text-[#667085]" strokeWidth={1.4} />
            <span className="flex-1">Add to &quot;My favorites&quot;</span>
            <span className="rounded-full bg-[#e8f1ff] px-2 py-0.5 text-[12px] text-[#2b6ff7]">Team</span>
          </button>
          <div className="mx-5 my-2 h-px bg-[#ebeef3] rounded-full" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-[#111827] hover:bg-[#f5f7fb]"
            onClick={() => {
              if (contextMenu.viewId) {
                const currentName = views.find((v) => v.id === contextMenu.viewId)?.name ?? "";
                startEditing(contextMenu.viewId, currentName);
              }
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <Pencil className="h-4 w-4 text-[#667085]" strokeWidth={1.4} />
            <span>Rename view</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-[#111827] hover:bg-[#f5f7fb]"
            onClick={() => {
              if (contextMenu.viewId) onDuplicateViewAction?.(contextMenu.viewId);
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <Copy className="h-4 w-4 text-[#667085]" strokeWidth={1.4} />
            <span>Duplicate view</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-[#d46a7a] hover:bg-[#fff5f5]"
            onClick={() => {
              if (contextMenu.viewId) onDeleteViewAction?.(contextMenu.viewId);
              setContextMenu({ viewId: null, x: 0, y: 0 });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.4} />
            <span>Delete view</span>
          </button>
        </div>
      )}
    </aside>
  );
}
