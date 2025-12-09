"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  EyeOff,
  Filter,
  LayoutGrid,
  Palette,
  Search,
  Share2,
  Table,
  Eye,
  X,
  Trash2,
} from "lucide-react";

type Field = { id: string; name: string; order: number; type?: "TEXT" | "NUMBER" };

interface TableToolbarProps {
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
}

type Operator =
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

export default function TableToolbar({
  fields,
  hiddenFieldIds,
  onToggleField,
  onHideAll,
  onShowAll,
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
  onSeedRows,
  isSeedingRows,
}: TableToolbarProps) {
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);
  const [localSorts, setLocalSorts] = useState<SortState>(sorts);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const sortTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      setOpen(false);
      setFilterOpen(false);
      setSortOpen(false);
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

  const isHidden = (id: string) => hiddenFieldIds.includes(id);
  const commitFilters = (next: typeof localFilters) => {
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

  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-[13px]">
      {/* left: Grid view pill */}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-[13px] text-gray-900 shadow-sm hover:bg-gray-50"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-gray-700" />
        <span>Grid view</span>
        <ChevronDown className="h-3 w-3 text-gray-500" />
      </button>

      {/* right: tools */}
      <div className="relative flex items-center gap-4 text-[13px] text-gray-600">
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-gray-900 font-semibold"
          disabled={isSeedingRows}
          onClick={() => onSeedRows?.(100_000)}
        >
          {isSeedingRows ? "Seeding..." : "Add 100k rows"}
        </button>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex items-center gap-1 hover:text-gray-900"
          onClick={() => setOpen((p) => !p)}
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hide fields</span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>

        <button
          ref={filterTriggerRef}
          type="button"
          className="inline-flex items-center gap-1 hover:text-gray-900"
          onClick={() => setFilterOpen((p) => !p)}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filter</span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>

        <button
          ref={sortTriggerRef}
          type="button"
          className={`inline-flex items-center gap-1 hover:text-gray-900 ${localSorts.items.length ? "text-orange-600 border border-orange-200 bg-orange-50 px-2 py-1 rounded" : ""}`}
          onClick={() => setSortOpen((p) => !p)}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{localSorts.items.length ? `Sorted by ${localSorts.items.length} field${localSorts.items.length > 1 ? "s" : ""}` : "Sort"}</span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>

        {toolbarItems.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            className="inline-flex items-center gap-1 hover:text-gray-900"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}

        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-gray-900"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </button>

        {open && (
          <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 z-40 w-72 rounded-lg border border-gray-200 bg-white shadow-xl"
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
                className="rounded border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                Hide all
              </button>
              <button
                type="button"
                onClick={onShowAll}
                className="rounded border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                Show all
              </button>
            </div>
          </div>
        )}

        {sortOpen && (
          <div
            ref={sortRef}
            className="absolute left-0 top-full mt-2 z-40 w-80 rounded-lg border border-gray-200 bg-white shadow-xl"
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
                        if (localSorts.auto) onSortsChange(next, true);
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
                      <div key={item.id} className="flex items-center gap-2">
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
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-800"
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
                          className="min-w-[110px] rounded border border-gray-300 px-2 py-1 text-gray-800"
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
                            if (localSorts.auto) onSortsChange(next, true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                    if (next.auto) onSortsChange(next, true);
                  }}
                  className="rounded border-gray-300 text-blue-600"
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
            className="absolute left-0 top-full mt-2 z-40 w-[480px] max-w-[95vw] rounded-lg border border-gray-200 bg-white shadow-xl"
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
                    <div key={condition.id} className="flex items-center gap-1">
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
                                setLocalFilters(next);
                              }}
                              className="rounded border border-gray-300 px-2 py-1 text-gray-800"
                            >
                              <option value="and">and</option>
                              <option value="or">or</option>
                            </select>
                          )
                        )}
                      </div>

                      <div className="flex flex-1 items-center gap-1 rounded border border-gray-200 px-1 py-2 bg-white min-w-0">
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
                          className="min-w-[80px] rounded border border-gray-300 px-2 py-1 text-gray-800"
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
                          className="min-w-[80px] rounded border border-gray-300 px-2 py-1 text-gray-800"
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
                          className="min-w-[80px] rounded border border-gray-300 px-2 py-1 text-gray-800"
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
