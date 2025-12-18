"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  EyeOff,
  Filter,
  Menu,
  Palette,
  Plus,
  Search,
  Eye,
  X,
  Trash2,
  GripVertical,
} from "lucide-react";
import { GridViewIcon } from "./icons/GridViewIcon";
import { Table, Share2 } from "lucide-react";

type Field = { id: string; name: string; order: number; type?: "TEXT" | "NUMBER" };

interface TableToolbarProps {
  viewName?: string;
  views?: { id: string; name: string }[];
  activeViewId?: string;
  onRenameViewAction?: (id: string, name: string) => void;
  onDeleteViewAction?: (id: string) => void;
  onDuplicateViewAction?: (id: string) => void;
  fields: Field[];
  hiddenFieldIds: string[];
  onToggleField: (fieldId: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
  filters: {
    connector: "and" | "or";
    conditions: Condition[];
  };
  onFiltersChange: (filters: { connector: "and" | "or"; conditions: Condition[] }) => void;
  sorts: SortState;
  onSortsChange: (state: SortState, commit?: boolean) => void;
  onSeedRows?: (count: number) => void;
  isSeedingRows?: boolean;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  viewSidebarOpen: boolean;
  viewSidebarPinned: boolean;
  onToggleViewSidebar: () => void;
  onViewSidebarHoverChange: (open: boolean) => void;
}

export type Operator =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export type Condition = {
  id: string;
  fieldId: string;
  operator: Operator;
  value: string;
};

export type SortItem = { id: string; fieldId: string; direction: "asc" | "desc" };
export type SortState = { items: SortItem[]; auto: boolean };

const toolbarItems = [
  { label: "Group", Icon: Table },
  { label: "Color", Icon: Palette },
  { label: "Share and sync", Icon: Share2 },
];

const reorderById = <T extends { id: string }>(list: T[], fromId: string, toId: string) => {
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return list;
  next.splice(toIndex, 0, moved);
  return next;
};

export default function TableToolbar({
  fields,
  hiddenFieldIds,
  onToggleField,
  onHideAll,
  onShowAll,
  viewName,
  views = [],
  activeViewId,
  onRenameViewAction,
  onDeleteViewAction,
  onDuplicateViewAction,
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
  onSeedRows,
  isSeedingRows,
  globalSearch,
  onGlobalSearchChange,
  viewSidebarOpen: _viewSidebarOpen,
  viewSidebarPinned,
  onToggleViewSidebar,
  onViewSidebarHoverChange,
}: TableToolbarProps) {
  const [open, setOpen] = useState(false);
  const [viewActionsOpen, setViewActionsOpen] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);
  const [localSorts, setLocalSorts] = useState<SortState>(sorts);
  const [draggingSortId, setDraggingSortId] = useState<string | null>(null);
  const [sortDragOverId, setSortDragOverId] = useState<string | null>(null);
  const [draggingFilterId, setDraggingFilterId] = useState<string | null>(null);
  const [filterDragOverId, setFilterDragOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const viewActionsRef = useRef<HTMLDivElement | null>(null);
  const viewActionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const sortTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchTriggerRef = useRef<HTMLButtonElement | null>(null);

  const orderedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (
        viewActionsRef.current?.contains(e.target as Node) ||
        viewActionsTriggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (
        filterRef.current?.contains(e.target as Node) ||
        filterTriggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (
        sortRef.current?.contains(e.target as Node) ||
        sortTriggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (
        searchRef.current?.contains(e.target as Node) ||
        searchTriggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
      setViewActionsOpen(false);
      setFilterOpen(false);
      setSortOpen(false);
      setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    setLocalSorts(sorts);
  }, [sorts]);

  const startEditing = (id: string, name: string) => {
    setEditingViewId(id);
    setEditingName(name);
  };

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

  const isHidden = (id: string) => hiddenFieldIds.includes(id);
  const commitFilters = (next: typeof localFilters) => {
    setLocalFilters(next);
    onFiltersChange(next);
  };

  const handleSortReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextItems = reorderById(localSorts.items, sourceId, targetId);
    if (nextItems === localSorts.items) return;
    const next = { ...localSorts, items: nextItems };
    setLocalSorts(next);
    if (next.auto) onSortsChange(next, true);
  };

  const handleFilterReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextConditions = reorderById(localFilters.conditions, sourceId, targetId);
    if (nextConditions === localFilters.conditions) return;
    const next = { ...localFilters, conditions: nextConditions };
    setLocalFilters(next);
    onFiltersChange(next);
  };

  const operatorOptionsForField = (field?: Field) => {
    const normalizedType = (field?.type ?? "").toString().toUpperCase();
    const isNumber = normalizedType === "NUMBER";
    if (isNumber) {
      return [
        { value: "greater_than" as Operator, label: "is greater than..." },
        { value: "less_than" as Operator, label: "is less than..." },
        { value: "greater_than_or_equal" as Operator, label: "is greater than or equal to..." },
        { value: "less_than_or_equal" as Operator, label: "is less than or equal to..." },
        { value: "is" as Operator, label: "is..." },
        { value: "is_not" as Operator, label: "is not..." },
        { value: "is_empty" as Operator, label: "is empty" },
        { value: "is_not_empty" as Operator, label: "is not empty" },
      ];
    }
    return [
      { value: "contains" as Operator, label: "contains..." },
      { value: "not_contains" as Operator, label: "does not contain..." },
      { value: "is" as Operator, label: "is..." },
      { value: "is_not" as Operator, label: "is not..." },
      { value: "is_empty" as Operator, label: "is empty" },
      { value: "is_not_empty" as Operator, label: "is not empty" },
    ];
  };

  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-10 items-center justify-between border-b border-[#e6e8ef] bg-white px-3 text-[13px] text-[#344054]">
      {/* left: Grid view pill + actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:text-[#344054] hover:bg-[#f2f4f8] transition-colors"
          onClick={onToggleViewSidebar}
          onMouseEnter={() => onViewSidebarHoverChange(true)}
          onMouseLeave={() => onViewSidebarHoverChange(false)}
          aria-pressed={viewSidebarPinned}
          aria-label="Toggle view sidebar"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
          <span className="sr-only">Toggle views</span>
        </button>
        <div className="relative inline-block">
          <button
            ref={viewActionsTriggerRef}
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2 text-[#111827] hover:bg-[#f2f4f8]"
          onClick={() => setViewActionsOpen((p) => !p)}
          onDoubleClick={() => {
            if (!activeViewId) return;
            startEditing(activeViewId, viewName ?? "Grid view");
          }}
        >
          <GridViewIcon className="h-3.5 w-3.5 text-[#1b6ef3]" />
            {editingViewId === activeViewId ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitEditing();
                  }
                  if (e.key === "Escape") {
                    setEditingViewId(null);
                    setEditingName("");
                  }
                }}
                className="w-32 rounded-[3px] px-2 py-0.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-grey-300"
              />
            ) : (
              <span>{viewName ?? "Grid view"}</span>
            )}
            <ChevronDown className="h-3 w-3 text-[#667085]" strokeWidth={1.75} />
          </button>
          {viewActionsOpen && (
            <div
              ref={viewActionsRef}
              className="absolute left-0 top-full z-40 mt-2 w-56 rounded-lg border border-[#e6e8ef] bg-white shadow-xl"
            >
              <div className="px-3 py-2 text-[13px] text-gray-800 font-medium border-b border-[#e6e8ef]">
                {viewName ?? "Current view"}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50"
                onClick={() => {
                  if (activeViewId && viewName) {
                    startEditing(activeViewId, viewName);
                  }
                  setViewActionsOpen(false);
                }}
              >
                <GridViewIcon className="h-3.5 w-3.5 text-[#1b6ef3]" />
                <span>Rename view</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50"
                onClick={() => {
                  if (activeViewId) onDuplicateViewAction?.(activeViewId);
                  setViewActionsOpen(false);
                }}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Duplicate view</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (activeViewId) onDeleteViewAction?.(activeViewId);
                  setViewActionsOpen(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Delete view</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* right: tools */}
      <div className="relative flex items-center gap-1 text-[13px] text-[#667085]">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[#111827] hover:bg-[#f2f4f8]"
          disabled={isSeedingRows}
          onClick={() => onSeedRows?.(100_000)}
        >
          {isSeedingRows ? "Seeding..." : "Add 100k rows"}
        </button>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[#f2f4f8]"
          onClick={() => setOpen((p) => !p)}
        >
          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          <span>Hide fields</span>
        </button>

        <button
          ref={filterTriggerRef}
          type="button"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[#f2f4f8] ${
            localFilters.conditions.length
              ? "text-emerald-700 border border-emerald-200 bg-emerald-50"
              : ""
          }`}
          onClick={() => setFilterOpen((p) => !p)}
        >
          <Filter className="h-4 w-4 text-[#667085] hover:text-[#344054]" strokeWidth={1.75} />
          <span>
            {localFilters.conditions.length
              ? (() => {
                  const primary = localFilters.conditions[0];
                  const fieldName =
                    orderedFields.find((f) => f.id === primary?.fieldId)?.name ?? "field";
                  return `Filtered by ${fieldName}${localFilters.conditions.length > 1 ? "..." : ""}`;
                })()
              : "Filter"}
          </span>
        </button>

        <button
          ref={sortTriggerRef}
          type="button"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[#f2f4f8] ${localSorts.items.length ? "text-orange-600 border border-orange-200 bg-orange-50" : ""}`}
          onClick={() => setSortOpen((p) => !p)}
        >
          <ArrowUpDown className="h-4 w-4" strokeWidth={1.75} />
          <span>{localSorts.items.length ? `Sorted by ${localSorts.items.length} field${localSorts.items.length > 1 ? "s" : ""}` : "Sort"}</span>
        </button>

        {toolbarItems.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[#f2f4f8]"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}

        <div className="relative">
          <button
            ref={searchTriggerRef}
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:text-[#344054] hover:bg-[#f2f4f8]"
            onClick={() => setSearchOpen((p) => !p)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </button>

          {searchOpen && (
            <div
              ref={searchRef}
              className="absolute right-0 top-full z-40 mt-0 flex w-[360px] items-center gap-2 rounded-b-lg rounded-t-none border border-[#e6e8ef] bg-white px-3 py-2 shadow-lg"
            >
              <input
                autoFocus
                type="text"
                placeholder="Find in view..."
                className="h-9 flex-1 rounded-md border border-[#d9dde8] bg-white px-3 text-[13px] text-[#344054] placeholder:text-[#98a2b3] focus:outline-white focus:ring-0"
                value={globalSearch}
                onChange={(e) => {
                  const next = e.target.value;
                  onGlobalSearchChange(next);
                }}
              />
              <button
                type="button"
                className="h-9 rounded-md bg-black px-3 text-[12px] font-medium text-white hover:bg-neutral-800"
              >
                Ask Omni
              </button>
              <button
                type="button"
                className="p-1 text-[#98a2b3] hover:text-[#344054]"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        {open && (
          <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 z-40 w-72 rounded-lg border border-[#e6e8ef] bg-white shadow-xl"
          >
            <div className="px-3 py-2 text-[13px] text-gray-600 flex items-center justify-between border-b">
              <span className="font-medium text-gray-800">Hide fields</span>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setOpen(false)}
                aria-label="Close hide fields menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-auto px-3 py-2 text-[13px]">
              {orderedFields.map((field) => {
                const hidden = isHidden(field.id);
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => onToggleField(field.id)}
                    className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${hidden ? "bg-gray-300" : "bg-emerald-500"}`}
                      />
                      <span className={`text-gray-800 ${hidden ? "line-through text-gray-500" : ""}`}>
                        {field.name}
                      </span>
                    </div>
                    {hidden ? (
                      <Eye className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t px-3 py-2">
              <button
                type="button"
                onClick={onHideAll}
                className="rounded border border-[#e6e8ef] px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                Hide all
              </button>
              <button
                type="button"
                onClick={onShowAll}
                className="rounded border border-[#e6e8ef] px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                Show all
              </button>
            </div>
          </div>
        )}

        {sortOpen && (
          <div
            ref={sortRef}
            className="absolute left-0 top-full mt-2 z-40 w-80 rounded-lg border border-[#e6e8ef] bg-white shadow-xl"
          >
            <div className="px-3 py-2 text-[13px] text-gray-700 flex items-center justify-between border-b">
              <span className="font-medium text-gray-800">Sort by</span>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setSortOpen(false)}
                aria-label="Close sort menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-2 text-[13px] text-gray-700 space-y-3 max-h-80 overflow-y-auto">
              {localSorts.items.length === 0 ? (
                <div className="space-y-2">
                  {orderedFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-2 hover:bg-gray-50 text-left"
                      onClick={() => {
                        const next: SortState = {
                          ...localSorts,
                          items: [{ id: `sort-${Date.now()}`, fieldId: field.id, direction: "asc" }],
                        };
                        setLocalSorts(next);
                        onSortsChange(next, next.auto);
                      }}
                    >
                      <span className="text-gray-500">
                        {field.type?.toString().toUpperCase() === "NUMBER" ? "1" : "A"}
                      </span>
                      <span className="text-gray-800">{field.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {localSorts.items.map((item, _idx) => {
                    const fieldForItem =
                      orderedFields.find((f) => f.id === item.fieldId) ?? orderedFields[0];
                    const isNumber = (fieldForItem?.type ?? "").toString().toUpperCase() === "NUMBER";
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 rounded px-1 transition-all duration-150 ${
                          sortDragOverId === item.id ? "ring-1 ring-orange-300 bg-orange-50 translate-y-[1px]" : ""
                        } ${draggingSortId === item.id ? "opacity-70 cursor-grabbing" : ""}`}
                        onDragOver={(e) => {
                          if (!draggingSortId || draggingSortId === item.id || localSorts.items.length < 2) return;
                          e.preventDefault();
                          setSortDragOverId(item.id);
                        }}
                        onDragLeave={() => {
                          if (sortDragOverId === item.id) setSortDragOverId(null);
                        }}
                        onDrop={(e) => {
                          if (!draggingSortId || localSorts.items.length < 2) return;
                          e.preventDefault();
                          const sourceId = e.dataTransfer.getData("text/plain") || draggingSortId;
                          handleSortReorder(sourceId, item.id);
                          setSortDragOverId(null);
                          setDraggingSortId(null);
                        }}
                      >
                        <select
                          value={item.fieldId}
                          onChange={(e) => {
                            const next: SortState = {
                              ...localSorts,
                              items: localSorts.items.map((s) =>
                                s.id === item.id ? { ...s, fieldId: e.target.value } : s,
                              ),
                            };
                            setLocalSorts(next);
                            if (localSorts.auto) onSortsChange(next, true);
                          }}
                          className="flex-1 rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                        >
                          {orderedFields.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.direction}
                          onChange={(e) => {
                            const next: SortState = {
                              ...localSorts,
                              items: localSorts.items.map((s) =>
                                s.id === item.id ? { ...s, direction: e.target.value as "asc" | "desc" } : s,
                              ),
                            };
                            setLocalSorts(next);
                            if (localSorts.auto) onSortsChange(next, true);
                          }}
                          className="min-w-[110px] rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                        >
                          {isNumber ? (
                            <>
                              <option value="asc">Small → Large</option>
                              <option value="desc">Large → Small</option>
                            </>
                          ) : (
                            <>
                              <option value="asc">A → Z</option>
                              <option value="desc">Z → A</option>
                            </>
                          )}
                        </select>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-gray-100 text-gray-600"
                          aria-label="Remove sort"
                          onClick={() => {
                          const next: SortState = {
                            ...localSorts,
                            items: localSorts.items.filter((s) => s.id !== item.id),
                          };
                            setLocalSorts(next);
                            const shouldCommit = localSorts.auto || next.items.length === 0;
                            if (shouldCommit) onSortsChange(next, shouldCommit);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {localSorts.items.length > 1 && (
                          <span
                            className={`p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing ${
                              draggingSortId === item.id ? "cursor-grabbing" : ""
                            }`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", item.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingSortId(item.id);
                            }}
                            onDragEnd={() => {
                              setDraggingSortId(null);
                              setSortDragOverId(null);
                            }}
                            aria-label="Drag to reorder sort"
                            role="button"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-gray-800 hover:underline"
                    onClick={() => {
                      const field = orderedFields[0];
                      if (!field) return;
                      const next: SortState = {
                        ...localSorts,
                        items: [
                          ...localSorts.items,
                          { id: `sort-${Date.now()}`, fieldId: field.id, direction: "asc" },
                        ],
                      };
                      setLocalSorts(next);
                      if (localSorts.auto) onSortsChange(next, true);
                    }}
                  >
                    <span className="font-bold text-gray-900">+</span> Add another sort
                  </button>
                </div>
              )}
            </div>

            <div className="border-t px-3 py-2 space-y-2">
              <label className="flex items-center gap-2 text-[13px] text-gray-800">
                <input
                  type="checkbox"
                  checked={localSorts.auto}
                  onChange={(e) => {
                const next: SortState = { ...localSorts, auto: e.target.checked };
                    setLocalSorts(next);
                    onSortsChange(next, next.auto);
                  }}
                  className="rounded border-[#d9dde8] text-blue-600"
                />
                Automatically sort records
              </label>

              {!localSorts.auto && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-[13px]"
                    onClick={() => onSortsChange(localSorts, true)}
                  >
                    Sort
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {filterOpen && (
          <div
            ref={filterRef}
            className="absolute left-0 top-full mt-2 z-40 w-[480px] max-w-[95vw] rounded-lg border border-[#e6e8ef] bg-white shadow-xl"
          >
            <div className="px-4 py-3 text-[13px] text-gray-700 border-b flex items-center justify-between">
              <span className="font-medium text-gray-800">In this view, show records</span>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filter menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3 text-[13px] text-gray-700 space-y-3 max-h-96 overflow-y-auto">
              {localFilters.conditions.length === 0 ? (
                <div className="text-gray-500">No filter conditions are applied</div>
              ) : (
                <div className="space-y-2">
                  {localFilters.conditions.map((condition, idx) => (
                    <div
                      key={condition.id}
                      className={`flex items-center gap-1 rounded px-1 transition-all duration-150 ${
                        filterDragOverId === condition.id ? "ring-1 ring-emerald-300 bg-emerald-50 translate-y-[1px]" : ""
                      } ${draggingFilterId === condition.id ? "opacity-70 cursor-grabbing" : ""}`}
                      onDragOver={(e) => {
                        if (!draggingFilterId || draggingFilterId === condition.id || localFilters.conditions.length < 2) return;
                        e.preventDefault();
                        setFilterDragOverId(condition.id);
                      }}
                      onDragLeave={() => {
                        if (filterDragOverId === condition.id) setFilterDragOverId(null);
                      }}
                      onDrop={(e) => {
                        if (!draggingFilterId || localFilters.conditions.length < 2) return;
                        e.preventDefault();
                        const sourceId = e.dataTransfer.getData("text/plain") || draggingFilterId;
                        handleFilterReorder(sourceId, condition.id);
                        setFilterDragOverId(null);
                        setDraggingFilterId(null);
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-[110px]">
                        {idx === 0 ? (
                          <>
                            <span className="text-gray-600">Where</span>
                          </>
                        ) : (
                          localFilters.conditions.length > 1 && (
                            <select
                              value={localFilters.connector}
                              onChange={(e) => {
                                const next = {
                                  connector: e.target.value as "and" | "or",
                                  conditions: localFilters.conditions,
                                };
                                commitFilters(next);
                              }}
                              className="rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                            >
                              <option value="and">and</option>
                              <option value="or">or</option>
                            </select>
                          )
                        )}
                      </div>

                      <div className="flex flex-1 items-center gap-1 rounded border border-[#e6e8ef] px-1 py-2 bg-white min-w-0">
                        {(() => {
                          const fieldForCondition = orderedFields.find((f) => f.id === condition.fieldId);
                          const operatorOptions = operatorOptionsForField(fieldForCondition);
                          const selectValue =
                            operatorOptions.some((o) => o.value === condition.operator)
                              ? condition.operator
                              : operatorOptions[0]?.value ?? "contains";
                          return (
                            <>
                        <select
                          value={condition.fieldId}
                          onChange={(e) => {
                            const nextFieldId = e.target.value;
                            const nextField = orderedFields.find((f) => f.id === nextFieldId);
                            const optionsForNext = operatorOptionsForField(nextField);
                            const nextOperator =
                              optionsForNext.find((o) => o.value === condition.operator)?.value ??
                              optionsForNext[0]?.value ??
                              "contains";
                            const next = {
                              ...localFilters,
                              conditions: localFilters.conditions.map((c) =>
                                c.id === condition.id
                                  ? { ...c, fieldId: nextFieldId, operator: nextOperator }
                                  : c,
                              ),
                            };
                            commitFilters(next);
                          }}
                          className="min-w-[80px] rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                        >
                          {orderedFields.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={selectValue}
                            onChange={(e) => {
                              const nextOperator = e.target.value as Operator;
                              const nextConditions = localFilters.conditions.map((c) =>
                                c.id === condition.id
                                  ? {
                                    ...c,
                                    operator: nextOperator,
                                    value:
                                      nextOperator === "is_empty" || nextOperator === "is_not_empty"
                                        ? ""
                                        : c.value,
                                  }
                                : c,
                            );
                            const next = { ...localFilters, conditions: nextConditions };
                            setLocalFilters(next);
                            if (nextOperator === "is_empty" || nextOperator === "is_not_empty") {
                              commitFilters(next);
                            }
                          }}
                          className="min-w-[80px] rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                        >
                          {operatorOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                          </>
                          );
                        })()}

                        <input
                          type="text"
                          value={condition.value ?? ""}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            commitFilters({
                              connector: localFilters.connector,
                              conditions: localFilters.conditions.map((c) =>
                                c.id === condition.id ? { ...c, value: nextVal } : c,
                              ),
                            });
                          }}
                          placeholder="Enter a value"
                          className="min-w-[80px] rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                          disabled={
                            condition.operator === "is_empty" || condition.operator === "is_not_empty"
                          }
                        />

                        <button
                          type="button"
                          className="p-1 rounded hover:bg-gray-100 text-gray-600"
                          aria-label="Delete condition"
                          onClick={() =>
                            commitFilters({
                              connector: localFilters.connector,
                              conditions: localFilters.conditions.filter((c) => c.id !== condition.id),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {localFilters.conditions.length > 1 && (
                        <span
                          className={`p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing ${
                            draggingFilterId === condition.id ? "cursor-grabbing" : ""
                          }`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", condition.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingFilterId(condition.id);
                            }}
                            onDragEnd={() => {
                              setDraggingFilterId(null);
                              setFilterDragOverId(null);
                            }}
                            aria-label="Drag to reorder condition"
                            role="button"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-1 text-[13px] text-gray-700">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-gray-800 hover:underline"
                  onClick={() => {
                    const defaultField = orderedFields[0];
                    if (!defaultField) return;
                    setLocalFilters((prev) => ({
                      ...prev,
                      conditions: [
                        ...prev.conditions,
                        {
                          id: `cond-${Date.now()}`,
                          fieldId: defaultField.id,
                          operator: defaultField.type === "NUMBER" ? "greater_than" : "contains",
                          value: "",
                        },
                      ],
                    }));
                  }}
                >
                  <span className="font-bold text-gray-900">+</span> Add condition
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-gray-800 hover:underline"
                  onClick={() => {
                    const defaultField = orderedFields[0];
                    if (!defaultField) return;
                    setLocalFilters({
                      connector: "and",
                      conditions: [
                        {
                          id: `cond-${Date.now()}`,
                          fieldId: defaultField.id,
                          operator: "contains",
                          value: "",
                        },
                      ],
                    });
                  }}
                >
                  <span className="font-bold text-gray-900">+</span> Add condition group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
