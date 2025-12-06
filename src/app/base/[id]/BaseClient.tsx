"use client";

import { useState } from "react";
import Image from "next/image";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type TableById = RouterOutputs["table"]["byId"];

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
    { enabled: Boolean(activeTableId) },
  );

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

  const addField = api.table.addField.useMutation({
    onSuccess: ({ field, cells }) => {
      utils.table.byId.setData({ id: activeTableId }, (prev: TableById | undefined) => {
        if (!prev) return prev;
        const fields = [...prev.fields, field].sort((a, b) => a.order - b.order);
        const records = prev.records.map((record) => {
          const cell = cells.find((c) => c.recordId === record.id);
          return cell ? { ...record, cells: [...record.cells, cell] } : record;
        });
        return { ...prev, fields, records };
      });
    },
  });

  const addRecord = api.table.addRecord.useMutation({
    onSuccess: ({ record, cells }) => {
      utils.table.byId.setData({ id: activeTableId }, (prev: TableById | undefined) =>
        prev
          ? {
              ...prev,
              records: [
                ...prev.records,
                {
                  ...record,
                  cells,
                },
              ],
            }
          : prev,
      );
    },
  });

  const deleteField = api.table.deleteField.useMutation({
    onSuccess: ({ fieldId }) => {
      utils.table.byId.setData({ id: activeTableId }, (prev) => {
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
    setTablesState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t)),
    );
  };

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

        <TableToolbar />

        {/* BODY: view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: view sidebar */}
          <ViewSidebar />

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <BaseTable
              fields={tableQuery.data?.fields ?? []}
              records={tableQuery.data?.records ?? []}
              isLoading={tableQuery.isLoading}
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
                deleteField.mutate({ fieldId });
              }}
              onDeleteRecords={(recordIds) => {
                if (!recordIds.length || deleteRecords.isPending || !activeTableId)
                  return;
                deleteRecords.mutate({ recordIds });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
