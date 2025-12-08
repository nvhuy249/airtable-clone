"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";
import type { Condition as FilterCondition, SortItem, SortState } from "./components/TableToolbar";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type TableById = RouterOutputs["table"]["byId"];
type TableField = TableById["fields"][number];
type TableRecord = TableById["records"][number];
type TableCell = TableRecord["cells"][number];

const makeEmptyCell = (recordId: string, fieldId: string): TableCell => ({
  id: `temp-cell-${recordId}-${fieldId}`,
  recordId,
  fieldId,
  valueText: null,
  valueNumber: null,
});

const OPTIMISTIC_FIELD_PREFIX = "temp-field-";

const makeEmptyRecord = (fields: TableField[]): TableRecord => {
  const recordId = `temp-record-${Date.now()}`;
  return {
    id: recordId,
    cells: fields.map((field) => makeEmptyCell(recordId, field.id)),
  };
};

interface BaseClientProps {
  baseId: string;
  baseName: string;
  tables: { id: string; name: string }[];
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function BaseClient({
  baseId,
  baseName,
  tables,
  user,
}: BaseClientProps) {
  type AddRecordContext = { previous?: TableById; tableId: string; optimisticId?: string };
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";
  const [tablesState, setTablesState] = useState(tables);
  const [activeTableId, setActiveTableId] = useState(
    tables[0]?.id ?? baseId,
  );

  const utils = api.useUtils();
  const tableQuery = api.table.byId.useQuery(
    { id: activeTableId },
    {
      enabled: Boolean(activeTableId),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60 * 1000,
    },
  );
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([]);
  const cancelledOptimisticFieldIds = useRef<Set<string>>(new Set());
  const pendingRecordEdits = useRef<
    Map<string, { fieldId: string; value: string | number | null }[]>
  >(new Map());
  const [filters, setFilters] = useState<{ connector: "and" | "or"; conditions: FilterCondition[] }>({
    connector: "and",
    conditions: [],
  });
  const [sortUi, setSortUi] = useState<SortState>({ items: [], auto: true });
  const [appliedSorts, setAppliedSorts] = useState<SortItem[]>([]);

  useEffect(() => {
    setHiddenFieldIds([]);
  }, [activeTableId]);

  const createTable = api.table.create.useMutation({
    onSuccess: (table) => {
      setTablesState((prev) => [...prev, { id: table.id, name: table.name }]);
      setActiveTableId(table.id);
      utils.table.byId.setData({ id: table.id }, table);
    },
  });

  const deleteTable = api.table.delete.useMutation({
    onSuccess: ({ tableId }) => {
      setTablesState((prev) => {
        const next = prev.filter((t) => t.id !== tableId);
        if (activeTableId === tableId) {
          setActiveTableId(next[0]?.id ?? "");
        }
        return next;
      });
      utils.table.byId.setData({ id: tableId }, undefined);
    },
  });

  const renameTable = api.table.rename.useMutation({
    onSuccess: (table) => {
      setTablesState((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, name: table.name } : t)),
      );
      utils.table.byId.setData({ id: table.id }, (prev) =>
        prev ? { ...prev, name: table.name } : prev,
      );
    },
  });

  const updateCell = api.table.updateCell.useMutation({
    onMutate: async () => {
      const previous = utils.table.byId.getData({ id: activeTableId });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous) return;
      utils.table.byId.setData({ id: activeTableId }, context.previous);
    },
    onSuccess: (cell) => {
      utils.table.byId.setData({ id: activeTableId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map((record) => {
            if (record.id !== cell.recordId) return record;
            const hasCell = record.cells.some(
              (c) => c.id === cell.id || c.fieldId === cell.fieldId,
            );
            const cells = hasCell
              ? record.cells.map((c) =>
                  c.id === cell.id || c.fieldId === cell.fieldId
                    ? { ...c, valueText: cell.valueText, valueNumber: cell.valueNumber }
                    : c,
                )
              : [...record.cells, cell];
            return { ...record, cells };
          }),
        };
      });
    },
  });

  const addField = api.table.addField.useMutation({
    onMutate: async (variables) => {
      await utils.table.byId.cancel({ id: variables.tableId });
      const previous = utils.table.byId.getData({ id: variables.tableId });
      if (!previous) return { previous, tableId: variables.tableId };

      const order = previous.fields.length;
      const optimisticFieldId = `${OPTIMISTIC_FIELD_PREFIX}${Date.now()}`;
      const optimisticField: TableField = {
        id: optimisticFieldId,
        name: variables.name?.trim() ?? `Field ${order + 1}`,
        type: variables.type ?? "TEXT",
        order,
        isHidden: false,
      };

      const fields = [...previous.fields, optimisticField].sort((a, b) => a.order - b.order);
      const records = previous.records.map((record) => {
        const hasCell = record.cells.some((cell) => cell.fieldId === optimisticFieldId);
        if (hasCell) return record;
        return {
          ...record,
          cells: [...record.cells, makeEmptyCell(record.id, optimisticFieldId)],
        };
      });

      utils.table.byId.setData({ id: variables.tableId }, { ...previous, fields, records });

      return { previous, tableId: variables.tableId, optimisticFieldId };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
    },
    onSuccess: ({ field }, _variables, context) => {
      if (!context?.tableId) return;
      if (context.optimisticFieldId && cancelledOptimisticFieldIds.current.has(context.optimisticFieldId)) {
        cancelledOptimisticFieldIds.current.delete(context.optimisticFieldId);
        return;
      }
      utils.table.byId.setData({ id: context.tableId }, (prev: TableById | undefined) => {
        if (!prev) return prev;
        const replaceId = context.optimisticFieldId ?? field.id;
        const fields = [...prev.fields.filter((f) => f.id !== replaceId), field].sort(
          (a, b) => a.order - b.order,
        );
        const records = prev.records.map((record) => {
          const updatedCells = record.cells.map((cell) =>
            cell.fieldId === replaceId ? { ...cell, fieldId: field.id } : cell,
          );
          const hasCell = updatedCells.some((cell) => cell.fieldId === field.id);
          return hasCell
            ? { ...record, cells: updatedCells }
            : {
                ...record,
                cells: [...updatedCells, makeEmptyCell(record.id, field.id)],
              };
        });
        return { ...prev, fields, records };
      });
    },
  });

  const renameField = api.table.renameField.useMutation({
    onMutate: async ({ fieldId, name }) => {
      if (!activeTableId) return { previous: undefined, tableId: undefined };
      await utils.table.byId.cancel({ id: activeTableId });
      const previous = utils.table.byId.getData({ id: activeTableId });
      if (!previous) return { previous, tableId: activeTableId };
      const fields = previous.fields.map((f) => (f.id === fieldId ? { ...f, name } : f));
      utils.table.byId.setData({ id: activeTableId }, { ...previous, fields });
      return { previous, tableId: activeTableId };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous || !ctx.tableId) return;
      utils.table.byId.setData({ id: ctx.tableId }, ctx.previous);
    },
    onSuccess: ({ field, tableId }) => {
      utils.table.byId.setData({ id: tableId }, (prev) =>
        prev
          ? { ...prev, fields: prev.fields.map((f) => (f.id === field.id ? field : f)) }
          : prev,
      );
    },
  });

  const addRecord = api.table.addRecord.useMutation({
    onMutate: async ({ tableId }) => {
      await utils.table.byId.cancel({ id: tableId });
      const previous = utils.table.byId.getData({ id: tableId });
      if (!previous) return { previous, tableId } satisfies AddRecordContext;

      const optimisticRecord = makeEmptyRecord(previous.fields);

      utils.table.byId.setData({ id: tableId }, { ...previous, records: [...previous.records, optimisticRecord] });

      return { previous, tableId, optimisticId: optimisticRecord.id } satisfies AddRecordContext;
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
      if (context.optimisticId) {
        pendingRecordEdits.current.delete(context.optimisticId);
      }
    },
    onSuccess: ({ record }, _variables, context) => {
      if (!context?.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, (prev: TableById | undefined) => {
        if (!prev) return prev;
        const optimisticId = context.optimisticId;
        const hadOptimistic = Boolean(
          optimisticId && prev.records.some((r) => r.id === optimisticId),
        );

        const recordsWithRealId = hadOptimistic
          ? prev.records.map((r) =>
              r.id === optimisticId
                ? {
                    ...r,
                    id: record.id,
                    cells: r.cells.map((cell) => ({ ...cell, recordId: record.id })),
                  }
                : r,
            )
          : prev.records;

        const hasReal = recordsWithRealId.some((r) => r.id === record.id);
        const fallbackRecord: TableRecord = {
          id: record.id,
          cells: prev.fields.map((field) => makeEmptyCell(record.id, field.id)),
        };
        const nextRecords = hasReal ? recordsWithRealId : [...recordsWithRealId, fallbackRecord];

        return { ...prev, records: nextRecords };
      });

       if (context.optimisticId) {
         const queued = pendingRecordEdits.current.get(context.optimisticId);
         if (queued?.length) {
           pendingRecordEdits.current.delete(context.optimisticId);
           queued.forEach(({ fieldId, value }) => {
             updateCell.mutate({ recordId: record.id, fieldId, value });
           });
         }
       }
    },
  });

  const deleteField = api.table.deleteField.useMutation({
    onMutate: async ({ fieldId }) => {
      if (!activeTableId) return { previous: undefined, tableId: undefined };
      await utils.table.byId.cancel({ id: activeTableId });
      const previous = utils.table.byId.getData({ id: activeTableId });
      if (!previous) return { previous, tableId: activeTableId };

      const fields = previous.fields.filter((f) => f.id !== fieldId);
      const records = previous.records.map((record) => ({
        ...record,
        cells: record.cells.filter((c) => c.fieldId !== fieldId),
      }));

      utils.table.byId.setData({ id: activeTableId }, { ...previous, fields, records });

      return { previous, tableId: activeTableId };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
    },
    onSuccess: ({ fieldId, tableId }) => {
      utils.table.byId.setData({ id: tableId }, (prev) => {
        if (!prev) return prev;
        const fields = prev.fields.filter((f) => f.id !== fieldId);
        const records = prev.records.map((record) => ({
          ...record,
          cells: record.cells.filter((c) => c.fieldId !== fieldId),
        }));
        return { ...prev, fields, records };
      });
    },
  });

  const deleteRecords = api.table.deleteRecords.useMutation({
    onMutate: async ({ recordIds }) => {
      if (!activeTableId) return { previous: undefined, tableId: undefined };
      await utils.table.byId.cancel({ id: activeTableId });
      const previous = utils.table.byId.getData({ id: activeTableId });
      if (!previous) return { previous, tableId: activeTableId };

      const records = previous.records.filter((r) => !recordIds.includes(r.id));
      utils.table.byId.setData({ id: activeTableId }, { ...previous, records });

      return { previous, tableId: activeTableId };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
    },
    onSuccess: ({ recordIds, tableId }) => {
      utils.table.byId.setData({ id: tableId }, (prev) =>
        prev
          ? {
              ...prev,
              records: prev.records.filter((r) => !recordIds.includes(r.id)),
            }
          : prev,
      );
    },
  });

  const handleAddTable = () => {
    const nextIndex = tablesState.length + 1;
    createTable.mutate({ baseId, name: `Table ${nextIndex}` });
  };

  const applyFilters = (records: TableRecord[], fields: TableField[]) => {
    if (!filters.conditions.length) return records;

    const fieldLookup = fields.reduce<Record<string, TableField>>(
      (acc, f) => ({ ...acc, [f.id]: f }),
      {},
    );

    const checkCondition = (record: TableRecord, condition: FilterCondition) => {
      const field = fieldLookup[condition.fieldId];
      if (!field) return false;
      const cell = record.cells.find((c) => c.fieldId === condition.fieldId);
      const isNumber = field.type === "NUMBER";
      if (isNumber) {
        const numVal = (() => {
          if (typeof cell?.valueNumber === "number") return cell.valueNumber;
          const parsed = Number(cell?.valueText ?? "");
          return Number.isNaN(parsed) ? null : parsed;
        })();
        const target = Number(condition.value ?? "");
        const hasNumber = numVal !== null && !Number.isNaN(numVal);

        switch (condition.operator) {
          case "greater_than":
            return hasNumber && !Number.isNaN(target) && numVal > target;
          case "less_than":
            return hasNumber && !Number.isNaN(target) && numVal < target;
          case "greater_than_or_equal":
            return hasNumber && !Number.isNaN(target) && numVal >= target;
          case "less_than_or_equal":
            return hasNumber && !Number.isNaN(target) && numVal <= target;
          case "is":
            return hasNumber && !Number.isNaN(target) && numVal === target;
          case "is_not":
            return hasNumber && !Number.isNaN(target) && numVal !== target;
          case "is_empty":
            return !hasNumber;
          case "is_not_empty":
            return hasNumber;
          default:
            return true;
        }
      }

      const rawValue = cell?.valueText ?? cell?.valueNumber ?? null;
      const value = rawValue == null ? "" : String(rawValue).toLowerCase();
      const needle = (condition.value ?? "").toLowerCase();

      switch (condition.operator) {
        case "contains":
          return value.includes(needle);
        case "not_contains":
          return !value.includes(needle);
        case "is":
          return value === needle;
        case "is_not":
          return value !== needle;
        case "is_empty":
          return value === "";
        case "is_not_empty":
          return value !== "";
        default:
          return true;
      }
    };

    return records.filter((record) => {
      const results = filters.conditions.map((cond) => checkCondition(record, cond));
      return filters.connector === "and"
        ? results.every(Boolean)
        : results.some(Boolean);
    });
  };

  const applySorts = (records: TableRecord[], fields: TableField[]) => {
    if (!appliedSorts.length) return records;
    const fieldLookup = fields.reduce<Record<string, TableField>>(
      (acc, f) => ({ ...acc, [f.id]: f }),
      {},
    );
    const sorted = [...records];
    sorted.sort((a, b) => {
      for (const sort of appliedSorts) {
        const field = fieldLookup[sort.fieldId];
        if (!field) continue;
        const cellA = a.cells.find((c) => c.fieldId === sort.fieldId);
        const cellB = b.cells.find((c) => c.fieldId === sort.fieldId);
        const isNumber = field.type === "NUMBER";
        const valA = isNumber
          ? cellA?.valueNumber ?? Number(cellA?.valueText ?? NaN)
          : (cellA?.valueText ?? cellA?.valueNumber ?? "") ?? "";
        const valB = isNumber
          ? cellB?.valueNumber ?? Number(cellB?.valueText ?? NaN)
          : (cellB?.valueText ?? cellB?.valueNumber ?? "") ?? "";

        let comp = 0;
        if (isNumber) {
          const aNum = typeof valA === "number" && !Number.isNaN(valA) ? valA : Number.NEGATIVE_INFINITY;
          const bNum = typeof valB === "number" && !Number.isNaN(valB) ? valB : Number.NEGATIVE_INFINITY;
          comp = aNum === bNum ? 0 : aNum < bNum ? -1 : 1;
        } else {
          const aStr = (valA ?? "").toString().toLowerCase();
          const bStr = (valB ?? "").toString().toLowerCase();
          comp = aStr.localeCompare(bStr);
        }
        if (comp !== 0) {
          return sort.direction === "asc" ? comp : -comp;
        }
      }
      return 0;
    });
    return sorted;
  };

  const handleDeleteTable = (id: string) => {
    deleteTable.mutate({ tableId: id });
  };

  const handleRenameTable = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const previous = tablesState.find((t) => t.id === id)?.name;

    setTablesState((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
    utils.table.byId.setData({ id }, (prev) => (prev ? { ...prev, name: trimmed } : prev));

    renameTable.mutate(
      { tableId: id, name: trimmed },
      {
        onError: () => {
          if (!previous) return;
          setTablesState((prev) =>
            prev.map((t) => (t.id === id ? { ...t, name: previous } : t)),
          );
          utils.table.byId.setData(
            { id },
            (prev) => (prev ? { ...prev, name: previous } : prev),
          );
        },
      },
    );
  };

  const handleCellChange = (recordId: string, fieldId: string, value: string | number | null) => {
    if (!activeTableId) return;

    const isOptimisticRecord = recordId.startsWith("temp-record");

    utils.table.byId.setData({ id: activeTableId }, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        records: prev.records.map((record) =>
          record.id === recordId
            ? {
                ...record,
                cells: record.cells.map((cell) =>
                  cell.fieldId === fieldId
                    ? {
                        ...cell,
                        valueText: typeof value === "number" ? null : value ?? null,
                        valueNumber: typeof value === "number" ? value : null,
                      }
                    : cell,
                ),
              }
            : record,
        ),
      };
    });

    if (isOptimisticRecord) {
      const existingEdits = pendingRecordEdits.current.get(recordId) ?? [];
      pendingRecordEdits.current.set(recordId, [...existingEdits, { fieldId, value }]);
      return;
    }

    updateCell.mutate(
      { recordId, fieldId, value },
    );
  };

  const [activeCellIndex, setActiveCellIndex] = useState<[number, number] | null>([0,0]);

  return (
    <div className="flex h-screen bg-[#f7f7fb]">
      {/* LEFT APP RAIL */}
      <AppRail userInitial={userInitial} />

      {/* RIGHT MAIN AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP BAR = logo + base name + Data/Automations/Interfaces/Forms + right buttons */}
        <div className="flex items-center justify-between px-5 py-3 border border-gray-200 bg-white">
          {/* LEFT: logo + base name */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <Image
              src="/airtable-logo.png"
              alt="Airtable logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded border border-gray-300 p-1 cursor-pointer"
              onClick={() => (window.location.href = "/")}
              priority
            />
            <div className="font-semibold text-sm">{baseName}</div>
          </div>

          {/* CENTER: Data / Automations / Interfaces / Forms */}
          <div className="flex-1 flex justify-center">
            <div className="flex gap-5 text-sm text-gray-600">
              <button className="pb-[8px] border-b-2 border-black font-medium text-black">
                Data
              </button>
              <button className="pb-[8px] hover:text-black">Automations</button>
              <button className="pb-[8px] hover:text-black">Interfaces</button>
              <button className="pb-[8px] hover:text-black">Forms</button>
            </div>
          </div>

          {/* RIGHT: trial / launch / share */}
          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1 rounded-full border border-gray-300 bg-gray-50">
              Trial: 13 days left
            </div>
            <button className="px-3 py-1 border rounded-full">Launch</button>
            <button className="px-3 py-1 border rounded-full font-medium">
              Share
            </button>
          </div>
        </div>

        {/* TABLE HEADER STRIP = table switcher + toolbar */}
        <TableTopBar
          tables={tablesState}
          activeTableId={activeTableId}
          onChangeTable={setActiveTableId}
          onAddTable={handleAddTable}
          onRenameTable={handleRenameTable}
          onDeleteTable={handleDeleteTable}
        />

        <TableToolbar
          fields={tableQuery.data?.fields ?? []}
          hiddenFieldIds={hiddenFieldIds}
          filters={filters}
          sorts={{ items: sortUi.items, auto: sortUi.auto }}
          onToggleField={(fieldId) =>
            setHiddenFieldIds((prev) =>
              prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId],
            )
          }
          onHideAll={() => {
            const ids = (tableQuery.data?.fields ?? []).map((f) => f.id);
            setHiddenFieldIds(ids);
          }}
          onShowAll={() => setHiddenFieldIds([])}
          onFiltersChange={setFilters}
          onSortsChange={(next, commit) => {
            setSortUi(next);
            if (commit || next.auto) {
              setAppliedSorts(next.items);
            }
          }}
        />

        {/* BODY: view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: view sidebar */}
          <ViewSidebar />

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <BaseTable
              fields={tableQuery.data?.fields ?? []}
              records={applySorts(
                applyFilters(tableQuery.data?.records ?? [], tableQuery.data?.fields ?? []),
                tableQuery.data?.fields ?? [],
              )}
              hiddenFieldIds={hiddenFieldIds}
              isLoading={tableQuery.isLoading}
              onCellChange={handleCellChange}
              onAddColumn={(type = "TEXT", name) => {
                if (!activeTableId || addField.isPending) return;
                addField.mutate({
                  tableId: activeTableId,
              type,
                  name,
                });
              }}
              onAddRow={() => {
                if (!activeTableId || addRecord.isPending) return;
                addRecord.mutate({ tableId: activeTableId });
              }}
              onDeleteColumn={(fieldId) => {
                if (!fieldId || deleteField.isPending) return;
                if (fieldId.startsWith(OPTIMISTIC_FIELD_PREFIX)) {
                  cancelledOptimisticFieldIds.current.add(fieldId);
                  utils.table.byId.setData({ id: activeTableId }, (prev) => {
                    if (!prev) return prev;
                    const fields = prev.fields.filter((f) => f.id !== fieldId);
                    const records = prev.records.map((record) => ({
                      ...record,
                      cells: record.cells.filter((c) => c.fieldId !== fieldId),
                    }));
                    return { ...prev, fields, records };
                  });
                  return;
                }
                deleteField.mutate({ fieldId });
              }}
              onDeleteRecords={(recordIds) => {
                if (!recordIds.length || deleteRecords.isPending || !activeTableId)
                  return;
                deleteRecords.mutate({ recordIds });
              }}
              onRenameColumn={(fieldId, name) => {
                if (!activeTableId || renameField.isPending) return;
                renameField.mutate({ fieldId, name });
              }}
              activeCellIndex={activeCellIndex}
              onActiveCellIndexChange={setActiveCellIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
