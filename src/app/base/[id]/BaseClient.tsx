"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FiChevronDown,
  FiFilter,
  FiGrid,
  FiEyeOff,
  FiShare2,
  FiPaperclip,
  FiUser,
  FiType,
  FiPlus,
  FiCircle,
  FiMoreVertical,
  FiArrowUp,
  FiArrowDown,
  FiDroplet,
  FiHelpCircle,
  FiBell,
} from "react-icons/fi";

type RowData = {
  id: number;
  name: string;
  notes: string;
  assignee: string;
  status: string;
  attachments: string;
  attachmentNotes: string;
} & Record<string, string | number>;

interface BaseClientProps {
  baseId: string;
  baseName: string;
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
  user,
}: BaseClientProps) {
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";

  // ---------- DATA ----------
  const seedRows = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: "",
    notes: "",
    assignee: "",
    status: "",
    attachments: "",
    attachmentNotes: "Required field(s) are missing",
  }));

  const [data, setData] = useState<RowData[]>(seedRows);

  // ---------- COLUMNS (dynamic) ----------
  type ColumnKey = (keyof RowData & string) | `custom_${number}`;
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>([
    "name",
    "notes",
    "assignee",
    "status",
    "attachments",
    "attachmentNotes",
  ]);

  const columns = useMemo<ColumnDef<RowData, any>[]>(() => {
    const makeEditableCell =
      (key: ColumnKey): ColumnDef<RowData>["cell"] =>
      ({ row, getValue }) => {
        const rowIndex = row.index;
        const colIndex = columnOrder.indexOf(key);
        const cellValue = getValue() as string | number | undefined;

        return (
          <input
            className="w-full h-full px-2 py-1 text-sm outline-none bg-transparent"
            value={cellValue ?? ""}
            data-row-index={rowIndex}
            data-col-index={colIndex}
            onChange={(e) => {
              setData((old) => {
                const copy = [...old];
                (copy[rowIndex] as Record<string, string | number>)[key] =
                  e.target.value;
                return copy;
              });
            }}
            onKeyDown={(e) => {
              handleCellNavigation(e, rowIndex, colIndex);
            }}
          />
        );
      };

    const baseColumns: {
      id: ColumnKey;
      header: ColumnDef<RowData>["header"];
    }[] = [
      {
        id: "name",
        header: () => (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">A</span>
            <span className="font-medium text-gray-700">Name</span>
          </div>
        ),
      },
      {
        id: "notes",
        header: () => (
          <div className="flex items-center gap-2">
            <FiType className="text-gray-500 text-sm" />
            <span className="font-medium text-gray-700">Notes</span>
          </div>
        ),
      },
      {
        id: "assignee",
        header: () => (
          <div className="flex items-center gap-2">
            <FiUser className="text-gray-500 text-sm" />
            <span className="font-medium text-gray-700">Assignee</span>
          </div>
        ),
      },
      {
        id: "status",
        header: () => (
          <div className="flex items-center gap-2">
            <FiCircle className="text-gray-400 text-[10px]" />
            <span className="font-medium text-gray-700">Status</span>
          </div>
        ),
      },
      {
        id: "attachments",
        header: () => (
          <div className="flex items-center gap-2">
            <FiPaperclip className="text-gray-500 text-sm" />
            <span className="font-medium text-gray-700">Attachments</span>
          </div>
        ),
      },
      {
        id: "attachmentNotes",
        header: () => (
          <div className="flex items-center gap-2">
            <FiCircle className="text-gray-400 text-[10px]" />
            <span className="font-medium text-gray-700 truncate">
              Attachment...
            </span>
          </div>
        ),
      },
    ];

    const cols: ColumnDef<RowData, any>[] = baseColumns
      .filter((c) => columnOrder.includes(c.id))
      .map((c) => ({
        accessorKey: c.id,
        header: c.header,
        cell: makeEditableCell(c.id),
      }));

    // selection checkbox column
    const selectionCol: ColumnDef<RowData, any> = {
      id: "select",
      header: () => (
        <div className="flex items-center justify-center">
          <input
            aria-label="Select all rows"
            type="checkbox"
            className="rounded border-gray-300 accent-blue-600"
          />
        </div>
      ),
      cell: () => (
        <div className="flex items-center justify-center">
          <input
            aria-label="Select row"
            type="checkbox"
            className="rounded border-gray-300 accent-blue-600"
          />
        </div>
      ),
      size: 46,
      enableSorting: false,
    };

    // first column: row number
    const rowNumberCol: ColumnDef<RowData, any> = {
      id: "rowNumber",
      header: "",
      cell: ({ row }) => (
        <div className="text-xs text-gray-500 text-center">
          {row.index + 1}
        </div>
      ),
      size: 50,
    };

    // trailing quick add column button (visual only)
    const addFieldCol: ColumnDef<RowData, any> = {
      id: "addField",
      header: () => (
        <div className="flex items-center justify-center">
          <button className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50">
            <FiPlus />
          </button>
        </div>
      ),
      cell: () => <div className="h-4" />,
      size: 60,
      enableSorting: false,
    };

    return [selectionCol, rowNumberCol, ...cols, addFieldCol];
  }, [columnOrder, setData]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ---------- CELL NAVIGATION ----------
  const handleCellNavigation = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    const key = e.key;
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (key === "ArrowRight" || (key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      targetCol = colIndex + 1;
    } else if (key === "ArrowLeft" || (key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      targetCol = colIndex - 1;
    } else if (key === "ArrowDown") {
      e.preventDefault();
      targetRow = rowIndex + 1;
    } else if (key === "ArrowUp") {
      e.preventDefault();
      targetRow = rowIndex - 1;
    } else {
      return; // let other keys behave normally
    }

    const selector = `input[data-row-index="${targetRow}"][data-col-index="${targetCol}"]`;
    const next = document.querySelector<HTMLInputElement>(selector);
    if (next) {
      next.focus();
      next.select();
    }
  };

  // ---------- UI ACTIONS ----------
  const addRow = () => {
    setData((old) => [
      ...old,
      {
        id: old.length + 1,
        name: "",
        notes: "",
        assignee: "",
        status: "",
        attachments: "",
        attachmentNotes: "Required field(s) are missing",
      },
    ]);
  };

  const addColumn = () => {
    const newKey = `custom_${columnOrder.length}` as ColumnKey;
    setColumnOrder((old) => [...old, newKey]);
    setData((old) =>
      old.map((row) => ({
        ...row,
        [newKey]: faker.commerce.productName(),
      })),
    );
  };

  // ---------- LAYOUT ----------
  return (
    <div
      className="flex flex-col h-screen bg-[#f7f8fb] text-gray-800"
      data-base-id={baseId}
      data-user-id={user?.id}
    >
      {/* Top ribbon */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm overflow-hidden">
            <Image
              src="/airtable-logo.png"
              alt="Airtable logo"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-base">{baseName}</span>
            <FiChevronDown className="text-gray-500" />
          </div>
          <div className="ml-6 flex gap-5 text-sm text-gray-600">
            <button className="pb-[6px] border-b-2 border-black font-medium text-gray-900">
              Data
            </button>
            <button className="pb-[6px] hover:text-black">Automations</button>
            <button className="pb-[6px] hover:text-black">Interfaces</button>
            <button className="pb-[6px] hover:text-black">Forms</button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1 rounded-full border text-gray-600 bg-gray-50">
            Trial: 13 days left
          </div>
          <button className="px-3 py-1 border rounded-full text-gray-600 hover:bg-gray-50">
            Launch
          </button>
          <button className="px-3 py-1 border rounded-full text-gray-700 font-medium hover:bg-gray-50">
            Share
          </button>
        </div>
      </div>

      {/* Table header bar: table name + view, controls */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-white">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-medium">Table 1</span>
            <FiChevronDown className="text-gray-500" />
          </div>

          <button className="flex items-center gap-1 px-3 py-1 rounded border text-xs bg-white hover:bg-gray-50">
            <FiGrid className="text-gray-600" />
            <span>Grid view</span>
            <FiChevronDown className="text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button className="px-3 py-1 rounded border hover:bg-gray-50">
            + Add or import
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Leftmost app rail */}
        <div className="w-16 border-r bg-white flex flex-col items-center py-4">
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:opacity-90 overflow-hidden"
              aria-label="Back to home"
            >
              <Image
                src="/airtable-logo.png"
                alt="Airtable logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </Link>
            <div className="h-9 w-9 rounded-full border-2 border-dashed border-gray-300" />
          </div>

          <div className="flex-1" />

          <div className="flex flex-col items-center gap-3 pb-2">
            <button
              aria-label="Help"
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-600"
            >
              <FiHelpCircle />
            </button>
            <button
              aria-label="Notifications"
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-600"
            >
              <FiBell />
            </button>
            <div className="h-9 w-9 rounded-full bg-rose-600 text-white flex items-center justify-center text-sm font-semibold">
              {userInitial}
            </div>
          </div>
        </div>

        {/* Main content with view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left view sidebar */}
          <div className="w-64 border-r bg-white text-sm flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <button className="text-blue-600 text-xs font-medium hover:text-blue-700">
                + Create new...
              </button>
              <FiMoreVertical className="text-gray-300" />
            </div>
            <div className="px-4 py-3 text-xs text-gray-500 border-b">
              Find a view
            </div>
            <div className="px-3 py-2 text-xs bg-[#eef3ff] flex items-center gap-2 border-l-2 border-blue-500 font-medium text-blue-600">
              <FiGrid className="text-blue-600" />
              <span>Grid view</span>
            </div>
          </div>

          {/* Table container */}
          <div className="flex-1 flex flex-col">
            {/* column tools bar */}
            <div className="flex items-center justify-between px-5 py-2 text-xs border-b bg-white text-gray-600">
              <div className="flex items-center gap-5">
                <button className="flex items-center gap-2 hover:text-black">
                  <FiEyeOff className="text-gray-500" /> Hide fields
                </button>
                <button className="flex items-center gap-2 hover:text-black">
                  <FiFilter className="text-gray-500" /> Filter
                </button>
                <button className="flex items-center gap-2 hover:text-black">
                  <FiGrid className="text-gray-500" /> Group
                </button>
                <button className="flex items-center gap-2 hover:text-black">
                  <div className="flex items-center gap-[2px] text-gray-500">
                    <FiArrowUp />
                    <FiArrowDown className="-mt-[2px]" />
                  </div>
                  Sort
                </button>
                <button className="flex items-center gap-2 hover:text-black">
                  <FiDroplet className="text-gray-500" /> Color
                </button>
                <button className="flex items-center gap-2 hover:text-black">
                  <FiShare2 className="text-gray-500" /> Share and sync
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addColumn}
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                >
                  + Add column
                </button>
                <button
                  onClick={addRow}
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                >
                  + Add row
                </button>
              </div>
            </div>

            {/* ACTUAL TABLE */}
            <div className="flex-1 overflow-auto bg-[#f7f8fb]">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="bg-[#f5f6fa]">
                      {headerGroup.headers.map((header) => {
                        const isSelection = header.id === "select";
                        const isRowNumber = header.id === "rowNumber";
                        const isAddField = header.id === "addField";
                        const widthClass = isSelection
                          ? "w-12 text-center"
                          : isRowNumber
                            ? "w-12 text-center"
                            : isAddField
                              ? "w-16 text-center"
                              : "min-w-[160px]";
                        return (
                          <th
                            key={header.id}
                            className={`border-b border-r border-gray-200 text-left text-xs font-medium text-gray-600 ${widthClass}`}
                          >
                            <div className="px-2 py-2">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="bg-white even:bg-[#fbfbfe]">
                      {row.getVisibleCells().map((cell) => {
                        const isSelection = cell.column.id === "select";
                        const isRowNumber = cell.column.id === "rowNumber";
                        const isAddField = cell.column.id === "addField";
                        const widthClass = isSelection
                          ? "w-12 text-center"
                          : isRowNumber
                            ? "w-12 text-center"
                            : isAddField
                              ? "w-16 text-center"
                              : "min-w-[160px]";

                        return (
                          <td
                            key={cell.id}
                            className={`border-b border-r border-gray-200 align-middle ${widthClass}`}
                          >
                            <div className="px-2 py-[6px]">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* bottom bar */}
            <div className="flex items-center justify-between px-5 py-3 text-xs border-t bg-white text-gray-600">
              <div>{data.length} records</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addRow}
                  className="px-3 py-1 rounded-full border hover:bg-gray-50"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
