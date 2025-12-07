"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";
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
        type: (variables.type ?? "TEXT") as TableField["type"],
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

  const addRecord = api.table.addRecord.useMutation({
    onMutate: async ({ tableId }) => {
      await utils.table.byId.cancel({ id: tableId });
      const previous = utils.table.byId.getData({ id: tableId });
      if (!previous) return { previous, tableId };

      const optimisticRecord = makeEmptyRecord(previous.fields);

      utils.table.byId.setData({ id: tableId }, { ...previous, records: [...previous.records, optimisticRecord] });

      return { previous, tableId, optimisticId: optimisticRecord.id };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
    },
    onSuccess: ({ record }, _variables, context) => {
      if (!context?.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, (prev: TableById | undefined) => {
        if (!prev) return prev;
        const fallbackRecord: TableRecord = {
          id: record.id,
          cells: prev.fields.map((field) => makeEmptyCell(record.id, field.id)),
        };
        const records = prev.records.map((r) =>
          r.id === context.optimisticId ? { ...fallbackRecord } : r,
        );
        const hasReal = records.some((r) => r.id === record.id);
        const nextRecords = hasReal ? records : [...records, fallbackRecord];
        return { ...prev, records: nextRecords };
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

    updateCell.mutate(
      { recordId, fieldId, value },
    );
  };

  const [activeCellIndex, setActiveCellIndex] = useState<[number, number]>([0,0]);

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
        />

        {/* BODY: view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: view sidebar */}
          <ViewSidebar />

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <BaseTable
              fields={tableQuery.data?.fields ?? []}
              records={tableQuery.data?.records ?? []}
              hiddenFieldIds={hiddenFieldIds}
              isLoading={tableQuery.isLoading}
              onCellChange={handleCellChange}
              onAddColumn={() => {
                if (!activeTableId || addField.isPending) return;
                addField.mutate({ tableId: activeTableId });
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
              activeCellIndex={activeCellIndex}
              onActiveCellIndexChange={setActiveCellIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
