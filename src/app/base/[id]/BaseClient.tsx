"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";
import type { Condition as FilterCondition, SortItem, SortState, Operator } from "./components/TableToolbar";
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

// const makeEmptyRecord = (fields: TableField[]): TableRecord => {
//   const recordId = `temp-record-${Date.now()}`;
//   return {
//     id: recordId,
//     cells: fields.map((field) => makeEmptyCell(recordId, field.id)),
//   };
// };

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
  loading?: boolean;
}

type Table = {
  id: string;
  name: string;
};

export default function BaseClient({
  baseId,
  baseName,
  tables,
  user,
  loading = false,
}: BaseClientProps) {
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";
  const [tablesState, setTablesState] = useState<Table[]>(tables ?? []);
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
  const [filters, setFilters] = useState<{ connector: "and" | "or"; conditions: FilterCondition[] }>({
    connector: "and",
    conditions: [],
  });
  const [sortUi, setSortUi] = useState<SortState>({ items: [], auto: true });
  const [appliedSorts, setAppliedSorts] = useState<SortItem[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const RECORD_PAGE_SIZE = 50;

  const serializedFilters = useMemo(() => {
    // base filters from toolbar
    let final = {
      connector: filters.connector,
      conditions: filters.conditions.map(c => ({
        fieldId: c.fieldId,
        operator: c.operator,
        value: c.value ?? ""
      }))
    };

    if (globalSearch.trim() && tableQuery.data?.fields) {
      const searchText = globalSearch.trim();

      const searchConditions = tableQuery.data.fields.map((f) => ({
        id: `global-${f.id}-${Date.now()}`,
        fieldId: f.id,
        operator: "contains" as Operator,
        value: searchText,
      }));

      final = {
        connector: "or",
        conditions: [
          ...final.conditions,
          ...searchConditions,
        ],
      };
    }

    return final;
  }, [filters, globalSearch, tableQuery.data?.fields]);

  const serializedSorts = useMemo(
    () => appliedSorts.map((s) => ({ fieldId: s.fieldId, direction: s.direction })),
    [appliedSorts],
  );

  const recordsQueryInput = useMemo(() => {
    if (!activeTableId) return null;
    return {
      tableId: activeTableId,
      limit: RECORD_PAGE_SIZE,
      filters: serializedFilters,
      sorts: serializedSorts,
    };
  }, [activeTableId, serializedFilters, serializedSorts]);

  const recordsQuery = api.table.records.useInfiniteQuery(
    recordsQueryInput ?? {
      tableId: "__inactive__",
      limit: RECORD_PAGE_SIZE,
      filters: serializedFilters,
      sorts: serializedSorts,
    },
    {
      enabled: Boolean(recordsQueryInput),
      getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60 * 1000,
    },
  );

  const records = useMemo(
    () => {
      const allRecords = recordsQuery.data?.pages.flatMap((p) => p.records) ?? [];
      return allRecords;
    },
    [recordsQuery.data?.pages]
  );
  const totalCount = recordsQuery.data?.pages[0]?.total ?? undefined;
  const hasMore = Boolean(recordsQuery.hasNextPage);
  const isFetchingMore = recordsQuery.isFetchingNextPage;
  const isRecordsLoading = recordsQuery.isLoading || recordsQuery.isFetchingNextPage;
  const fetchNextPage = recordsQuery.fetchNextPage;
  const [seedRemaining, setSeedRemaining] = useState<number>(0);

  const [seedRefetchedOnce, setSeedRefetchedOnce] = useState(false);

  const seedRecords = api.table.seedRecords.useMutation({
    onSuccess: (result) => {
      const inserted = result?.inserted ?? 0;
      let nextRemaining = 0;
      setSeedRemaining((prev) => {
        nextRemaining = Math.max(prev - inserted, 0);
        return nextRemaining;
      });

      // Refresh once early so pagination picks up new nextCursor when we just created a lot of rows.
      if (!seedRefetchedOnce && nextRemaining > 0) {
        if (recordsQueryInput) {
          void utils.table.records.invalidate(recordsQueryInput);
        } else {
          void utils.table.records.invalidate();
        }
        setSeedRefetchedOnce(true);
      }

      if (nextRemaining === 0) {
        if (recordsQueryInput) {
          void utils.table.records.invalidate(recordsQueryInput);
        } else {
          void utils.table.records.invalidate();
        }
        if (activeTableId) {
          void utils.table.byId.invalidate({ id: activeTableId });
        }
        setSeedRefetchedOnce(false);
      }
    },
  });

  const continueSeeding = seedRemaining > 0 && !seedRecords.isPending;
  useEffect(() => {
    if (!activeTableId) return;
    if (!continueSeeding) return;
    const nextCount = Math.min(seedRemaining, 1_000);
    seedRecords.mutate({ tableId: activeTableId, count: nextCount, chunkSize: 1_000 });
  }, [activeTableId, continueSeeding, seedRecords, seedRemaining]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isFetchingMore) return;
    void fetchNextPage();
  }, [fetchNextPage, hasMore, isFetchingMore]);

  useEffect(() => {
    setHiddenFieldIds([]);
  }, [activeTableId]);

  const createTable = api.table.create.useMutation({
    onMutate: async ({ name }) => {
      const tempId = "temp-table-" + Date.now();

      const optimistic = {
        id: tempId,
        name: name ?? "New Table",
      };

      const previous = tablesState;

      setTablesState((prev) => [...prev, optimistic]);

      return { previous, tempId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        setTablesState(ctx.previous);
      }
    },

    onSuccess: (realTable, _vars, ctx) => {
      setTablesState((prev) =>
        prev.map((t) => (t.id === ctx.tempId ? realTable : t))
      );
      setActiveTableId(realTable.id);
    },
  });

  const deleteTable = api.table.delete.useMutation({
    onMutate: ({ tableId }) => {
      const previous = tablesState;

      const deletedIndex = previous.findIndex(t => t.id === tableId);

      const nextTables = previous.filter(t => t.id !== tableId);
      setTablesState(nextTables);

      if (tableId === activeTableId) {
        let newActiveId = "";

        if (nextTables.length > 0) {
          // 1. Try SAME index (table after deleted)
          newActiveId = nextTables[deletedIndex]?.id
            // 2. Or previous table
            ?? nextTables[deletedIndex - 1]?.id
            // 3. Or first table
            ?? nextTables[0]?.id
            // 4. Or empty
            ?? "";
        }

        setActiveTableId(newActiveId);
      }

      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) setTablesState(ctx.previous);
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

  const applyCellToCache = useCallback(
    (recordId: string, cell: TableCell) => {
      if (!recordsQueryInput) return;
      utils.table.records.setInfiniteData(recordsQueryInput, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            records: page.records.map((record) => {
              if (record.id !== recordId) return record;
      const hasCell = record.cells.some((c) => c.fieldId === cell.fieldId);
              const cells = hasCell
                ? record.cells.map((c) =>
                    c.fieldId === cell.fieldId ? { ...c, ...cell } : c,
                  )
                : [...record.cells, cell];
              return { ...record, cells };
            }),
          })),
        };
      });
    },
    [recordsQueryInput, utils.table.records],
  );

  const updateCell = api.table.updateCell.useMutation({
    onMutate: async (variables) => {
      if (!recordsQueryInput) return { previous: undefined };
      await utils.table.records.cancel(recordsQueryInput);
      const previous = utils.table.records.getInfiniteData(recordsQueryInput);

      const optimisticCell: TableCell = {
        id: `temp-cell-${variables.recordId}-${variables.fieldId}`,
        recordId: variables.recordId,
        fieldId: variables.fieldId,
        valueText: typeof variables.value === "number" ? null : (variables.value as string | null) ?? null,
        valueNumber: typeof variables.value === "number" ? variables.value : null,
      };
      applyCellToCache(variables.recordId, optimisticCell);

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous && recordsQueryInput) {
        utils.table.records.setInfiniteData(recordsQueryInput, context.previous);
      }
    },
    onSuccess: (cell) => {
      applyCellToCache(cell.recordId, cell);
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
    onMutate: async () => {
      if (!recordsQueryInput) return { previous: undefined };

      await utils.table.records.cancel(recordsQueryInput);

      const previous = utils.table.records.getInfiniteData(recordsQueryInput);

      const optimisticId = "temp-record-" + Date.now();
      const fields = tableQuery.data?.fields ?? [];

      const optimisticRecord = {
        id: optimisticId,
        cells: fields.map((f) => ({
          id: "temp-cell-" + optimisticId + "-" + f.id,
          recordId: optimisticId,
          fieldId: f.id,
          valueText: null,
          valueNumber: null,
        })),
      };

      utils.table.records.setInfiniteData(recordsQueryInput, (prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          pages: prev.pages.map((page, idx) =>
            idx === 0
              ? { ...page, records: [...page.records, optimisticRecord] }
              : page
          ),
        };
      });

      return { previous, optimisticId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        if (!recordsQueryInput) return { previous: undefined };
        utils.table.records.setInfiniteData(recordsQueryInput, ctx.previous);
      }
    },

    onSuccess: ({ record }, _vars, ctx) => {
      if (!recordsQueryInput) return { previous: undefined };
      utils.table.records.setInfiniteData(recordsQueryInput, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            records: page.records.map((r) =>
              r.id === ctx.optimisticId ? { ...r, id: record.id } : r
            ),
          })),
        };
      });
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
      if (recordsQueryInput) {
        utils.table.records.invalidate(recordsQueryInput).catch(() => undefined);
      } else {
        utils.table.records.invalidate().catch(() => undefined);
      }
    },
  });

  const deleteRecords = api.table.deleteRecords.useMutation({
    onMutate: async ({ recordIds }) => {
      if (!recordsQueryInput) return { previous: undefined };

      // Cancel outgoing fetches
      await utils.table.records.cancel(recordsQueryInput);

      // Snapshot previous state
      const previous = utils.table.records.getInfiniteData(recordsQueryInput);

      // Optimistically remove the record from all pages
      utils.table.records.setInfiniteData(recordsQueryInput, (prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            records: page.records.filter((r) => !recordIds.includes(r.id)), // ⭐ remove
          })),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback if failed
      if (ctx?.previous && recordsQueryInput) {
        utils.table.records.setInfiniteData(recordsQueryInput, ctx.previous);
      }
    },

    onSuccess: () => {
      // Optional: force refresh if server returns new pagination info
      // void utils.table.records.invalidate(recordsQueryInput);
    },
  });

  const handleAddTable = () => {
    const nextIndex = tablesState.length + 1;
    createTable.mutate({ baseId, name: `Table ${nextIndex}` });
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

    updateCell.mutate(
      { recordId, fieldId, value },
    );
  };

  const [activeCellIndex, setActiveCellIndex] = useState<[number, number] | null>(null);

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
        <div className={loading ? "pointer-events-none opacity-60" : ""}>
          <TableTopBar
            tables={loading ? [] : tablesState}
            activeTableId={loading ? "" : activeTableId}
            onChangeTable={setActiveTableId}
            onAddTable={handleAddTable}
            onRenameTable={handleRenameTable}
            onDeleteTable={handleDeleteTable}
          />
        </div>

        <div className={loading ? "pointer-events-none opacity-60" : ""}>
          <TableToolbar
            fields={loading ? [] : tableQuery.data?.fields ?? []}
            hiddenFieldIds={loading ? [] : hiddenFieldIds}
            filters={loading ? { connector: "and", conditions: [] } : filters}
            sorts={{ items: sortUi.items, auto: sortUi.auto }}

            onSeedRows={(count) => {
              if (loading) return;
              if (!activeTableId || seedRecords.isPending) return;
              const target = count || 100_000;
              setSeedRemaining(target);
              const firstChunk = Math.min(target, 1_000);
              seedRecords.mutate({
                tableId: activeTableId,
                count: firstChunk,
                chunkSize: 1_000,
              });
            }}

            isSeedingRows={loading || seedRecords.isPending || seedRemaining > 0}

            onToggleField={(fieldId) => {
              if (loading) return;
              setHiddenFieldIds((prev) =>
                prev.includes(fieldId)
                  ? prev.filter((id) => id !== fieldId)
                  : [...prev, fieldId],
              );
            }}

            onHideAll={() => {
              if (loading) return;
              const ids = (tableQuery.data?.fields ?? []).map((f) => f.id);
              setHiddenFieldIds(ids);
            }}

            onShowAll={() => {
              if (loading) return;
              setHiddenFieldIds([]);
            }}

            onFiltersChange={(next) => {
              if (loading) return;
              setFilters(next);
            }}

            onSortsChange={(next, commit) => {
              if (loading) return;
              setSortUi(next);
              if (commit || next.auto) {
                setAppliedSorts(next.items);
              }
            }}

            globalSearch={loading ? "" : globalSearch}
            onGlobalSearchChange={(v) => {
              if (loading) return;
              setGlobalSearch(v);
            }}
          />
        </div>

        {/* BODY: view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: view sidebar */}
          <ViewSidebar />

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Creating base…
            </div>
            ) : (
              <BaseTable
                fields={tableQuery.data?.fields ?? []}
                records={records}
                hiddenFieldIds={hiddenFieldIds}
                isLoading={tableQuery.isLoading || isRecordsLoading}
                hasMore={hasMore}
                isFetchingMore={isFetchingMore}
                onLoadMore={handleLoadMore}
                totalCount={totalCount}
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
                  if (!recordIds?.length || deleteRecords.isPending || !activeTableId) return;

                  // ⭐ Pass the full array to backend
                  deleteRecords.mutate({ recordIds });
                }}
                onRenameColumn={(fieldId, name) => {
                  if (!activeTableId || renameField.isPending) return;
                  renameField.mutate({ fieldId, name });
                }}
                activeCellIndex={activeCellIndex}
                onActiveCellIndexChange={setActiveCellIndex}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
