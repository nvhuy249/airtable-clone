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

type Field = { id: string; name: string; order: number };

interface TableToolbarProps {
  fields: Field[];
  hiddenFieldIds: string[];
  onToggleField: (fieldId: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
}

type Operator =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty";

type Condition = {
  id: string;
  fieldId: string;
  operator: Operator;
  value: string;
};

const toolbarItems = [
  { label: "Group", Icon: Table },
  { label: "Sort", Icon: ArrowUpDown },
  { label: "Color", Icon: Palette },
  { label: "Share and sync", Icon: Share2 },
];

export default function TableToolbar({
  fields,
  hiddenFieldIds,
  onToggleField,
  onHideAll,
  onShowAll,
}: TableToolbarProps) {
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [connector, setConnector] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      setOpen(false);
      setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isHidden = (id: string) => hiddenFieldIds.includes(id);

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
              {conditions.length === 0 ? (
                <div className="text-gray-500">No filter conditions are applied</div>
              ) : (
                <div className="space-y-2">
                  {conditions.map((condition, idx) => (
                    <div key={condition.id} className="flex items-center gap-1">
                      <div className="flex items-center gap-1 min-w-[110px]">
                        {idx === 0 ? (
                          <>
                            <span className="text-gray-600">Where</span>
                          </>
                        ) : (
                          conditions.length > 1 && (
                            <select
                              value={connector}
                              onChange={(e) => setConnector(e.target.value as "and" | "or")}
                              className="rounded border border-gray-300 px-2 py-1 text-gray-800"
                            >
                              <option value="and">and</option>
                              <option value="or">or</option>
                            </select>
                          )
                        )}
                      </div>

                      <div className="flex flex-1 items-center gap-1 rounded border border-gray-200 px-1 py-2 bg-white min-w-0">
                        <select
                          value={condition.fieldId}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((c) =>
                                c.id === condition.id ? { ...c, fieldId: e.target.value } : c,
                              ),
                            )
                          }
                          className="min-w-[80px] rounded border border-gray-300 px-2 py-1 text-gray-800"
                        >
                          {orderedFields.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={condition.operator}
                          onChange={(e) => {
                            const nextOperator = e.target.value as Operator;
                            setConditions((prev) =>
                              prev.map((c) =>
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
                              ),
                            );
                          }}
                          className="min-w-[80px] rounded border border-gray-300 px-2 py-1 text-gray-800"
                        >
                          <option value="contains">contains...</option>
                          <option value="not_contains">does not contain...</option>
                          <option value="is">is...</option>
                          <option value="is_not">is not...</option>
                          <option value="is_empty">is empty</option>
                          <option value="is_not_empty">is not empty</option>
                        </select>

                        <input
                          type="text"
                          value={condition.value ?? ""}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((c) =>
                                c.id === condition.id ? { ...c, value: e.target.value } : c,
                              ),
                            )
                          }
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
                            setConditions((prev) => prev.filter((c) => c.id !== condition.id))
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
                    setConditions((prev) => [
                      ...prev,
                      {
                        id: `cond-${Date.now()}`,
                        fieldId: defaultField.id,
                        operator: "contains",
                        value: "",
                      },
                    ]);
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
                    setConnector("and");
                    setConditions([
                      {
                        id: `cond-${Date.now()}`,
                        fieldId: defaultField.id,
                        operator: "contains",
                        value: "",
                      },
                    ]);
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
