 "use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiCircle, FiPaperclip, FiPlus, FiType, FiUser } from "react-icons/fi";
import type React from "react";

type FieldType = "TEXT" | "NUMBER";

type FieldShape = {
  id: string;
  name: string;
  type: FieldType;
  order: number;
};

type CellShape = {
  id?: string;
  fieldId: string;
  valueText: string | null;
  valueNumber: number | null;
};

type RecordShape = {
  id: string;
  cells: CellShape[];
};

type ColumnValue = string | number | null | undefined;
type RowData = Record<string, ColumnValue> & { __recordId: string };

const displayValue = (value: ColumnValue) => (value == null ? "" : String(value));

const readCellValue = (field: FieldShape, cell?: CellShape | null): ColumnValue => {
  if (!cell) return null;
  return field.type === "NUMBER"
    ? cell.valueNumber ?? null
    : cell.valueText ?? cell.valueNumber ?? null;
};

const normalizeValueForField = (
  rawValue: string,
  field?: FieldShape,
): string | number | null | undefined => {
  if (field?.type !== "NUMBER") {
    return rawValue === "" ? null : rawValue;
  }
  if (rawValue === "") return null;
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

const valuesEqual = (a: string | number | null, b: string | number | null) => {
  if (a === null || b === null) return a === b;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a) === String(b);
};

const fieldsEqual = (a: FieldShape[], b: FieldShape[]) =>
  a.length === b.length &&
  a.every((field, idx) => {
    const other = b[idx];
    return (
      other &&
      field.id === other.id &&
      field.name === other.name &&
      field.type === other.type &&
      field.order === other.order
    );
  });

const recordsEqual = (a: RecordShape[], b: RecordShape[]) =>
  a.length === b.length &&
  a.every((record, idx) => {
    const other = b[idx];
    if (!other || record.id !== other.id || record.cells.length !== other.cells.length) {
      return false;
    }
    return record.cells.every((cell, cellIdx) => {
      const otherCell = other.cells[cellIdx];
      return (
        otherCell &&
        cell.fieldId === otherCell.fieldId &&
        cell.valueText === otherCell.valueText &&
        cell.valueNumber === otherCell.valueNumber
      );
    });
  });

interface BaseTableProps {
  fields: FieldShape[];
  records: RecordShape[];
  hiddenFieldIds?: string[];
  isLoading?: boolean;
  onAddColumn?: () => void;
  onAddRow?: () => void;
  onDeleteColumn?: (fieldId: string) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  onCellChange?: (recordId: string, fieldId: string, value: string | number | null) => void;
  activeCellIndex?: [number, number];
  onActiveCellIndexChange?: (coords: [number, number]) => void;
}

const DEFAULT_FIELDS: FieldShape[] = [
  { id: "default-name", name: "Name", type: "TEXT", order: 0 },
  { id: "default-notes", name: "Notes", type: "TEXT", order: 1 },
];
const DEFAULT_RECORD_COUNT = 5;
const DEFAULT_RECORDS: RecordShape[] = Array.from({ length: DEFAULT_RECORD_COUNT }).map((_, i) => ({
  id: `seed-${i}`,
  cells: [],
}));

function buildRows(fields: FieldShape[], records: RecordShape[]): RowData[] {
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  return records.map((record) => {
    const row: RowData = { __recordId: record.id };
    sortedFields.forEach((field) => {
      const cell = record.cells.find((c) => c.fieldId === field.id);
      const value = readCellValue(field, cell);
      row[field.id] = value ?? "";
    });
    return row;
  });
}

function createEmptyRow(fields: FieldShape[]): RowData {
  const row: RowData = { __recordId: `temp-${Date.now()}` };
  fields.forEach((f) => {
    row[f.id] = "";
  });
  return row;
}

function createEmptyRecord(fields: FieldShape[]): RecordShape {
  return {
    id: `temp-${Date.now()}`,
    cells: fields.map((field) => ({
      fieldId: field.id,
      valueText: null,
      valueNumber: null,
    })),
  };
}

export default function BaseTable({
  fields,
  records,
  hiddenFieldIds = [],
  isLoading,
  onAddColumn,
  onAddRow,
  onDeleteColumn,
  onDeleteRecords,
  onCellChange: _onCellChange,
  activeCellIndex: _activeCellIndex,
  onActiveCellIndexChange: _onActiveCellIndexChange,
}: BaseTableProps) {
  const [localFields, setLocalFields] = useState<FieldShape[]>(DEFAULT_FIELDS);
  const [localRecords, setLocalRecords] = useState<RecordShape[]>(DEFAULT_RECORDS);
  const [columnOrder, setColumnOrder] = useState<string[]>(
    DEFAULT_FIELDS.map((f) => f.id),
  );
  const [data, setData] = useState<RowData[]>(
    buildRows(DEFAULT_FIELDS, DEFAULT_RECORDS),
  );
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredHeader, setHoveredHeader] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    recordId: string;
  } | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colId: string } | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const appliedFieldsRef = useRef<FieldShape[]>(DEFAULT_FIELDS);
  const appliedRecordsRef = useRef<RecordShape[]>(DEFAULT_RECORDS);
  const hiddenSet = useMemo(() => new Set(hiddenFieldIds), [hiddenFieldIds]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    console.log("BaseTable hydrated");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("window keydown", {
          key: e.key,
          target: (e.target as HTMLElement | null)?.tagName,
          active: document.activeElement?.tagName,
          defaultPrevented: e.defaultPrevented,
        });
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  useEffect(() => {
    if (!_activeCellIndex) return;
    const [rowIndex, colIndex] = _activeCellIndex;
    const visible = columnOrder.filter((id) => !hiddenSet.has(id));
    const colId = visible[colIndex];
    if (colId === undefined) return;
    setActiveCell({ rowIndex, colId });
  }, [_activeCellIndex, columnOrder, hiddenSet]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!tableWrapperRef.current) return;
      if (!tableWrapperRef.current.contains(e.target as Node)) {
        setActiveCell(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!activeCell) return;
    const selector = `input[data-row-index="${activeCell.rowIndex}"][data-col-id="${activeCell.colId}"]`;
    const next = document.querySelector<HTMLInputElement>(selector);
    if (!next) return;
    if (document.activeElement === next) return;
    next.focus();
    next.select();
  }, [activeCell]);

  useEffect(() => {
    const useFields = (fields ?? DEFAULT_FIELDS).sort((a, b) => a.order - b.order);
    const useRecords = records ?? DEFAULT_RECORDS;

    const sameFields = fieldsEqual(appliedFieldsRef.current, useFields);
    const sameRecords = recordsEqual(appliedRecordsRef.current, useRecords);

    if (sameFields && sameRecords) return;

    if (process.env.NODE_ENV !== "production") {
      console.log("syncing table props -> local state", {
        fieldsChanged: !sameFields,
        recordsChanged: !sameRecords,
        fieldsCount: useFields.length,
        recordsCount: useRecords.length,
      });
    }

    appliedFieldsRef.current = useFields;
    appliedRecordsRef.current = useRecords;

    setLocalFields(useFields);
    setLocalRecords(useRecords);
    setColumnOrder(useFields.map((f) => f.id));
    setData(buildRows(useFields, useRecords));
    setSelectedRows(new Set());
    setContextMenu(null);
    setActiveCell(null);
  }, [fields, records]);
  const addRow = useCallback(() => {
    if (onAddRow) {
      onAddRow();
      return;
    }
    const newRecord = createEmptyRecord(localFields);
    setLocalRecords((prev) => [...prev, newRecord]);
    setData((old) => [...old, createEmptyRow(localFields)]);
  }, [localFields, onAddRow]);

  const addColumn = useCallback(() => {
    if (onAddColumn) {
      onAddColumn();
      return;
    }
    const newFieldId = `custom_${Date.now()}`;
    const newField: FieldShape = {
      id: newFieldId,
      name: `Field ${localFields.length + 1}`,
      type: "TEXT",
      order: localFields.length,
    };
    setLocalFields((prev) => [...prev, newField]);
    setColumnOrder((prev) => [...prev, newFieldId]);
    setLocalRecords((prev) =>
      prev.map((record) => ({
        ...record,
        cells: [
          ...record.cells,
          { fieldId: newFieldId, valueText: null, valueNumber: null },
        ],
      })),
    );
    setData((prev) => prev.map((row) => ({ ...row, [newFieldId]: "" })));
  }, [localFields.length, onAddColumn]);

  const removeColumn = useCallback(
    (colId: string) => {
      if (!columnOrder.includes(colId)) return;

      if (onDeleteColumn) {
        onDeleteColumn(colId);
        setHeaderMenu(null);
        return;
      }

      setColumnOrder((prev) => prev.filter((id) => id !== colId));
      setLocalFields((prev) => prev.filter((f) => f.id !== colId));
      setLocalRecords((prev) =>
        prev.map((record) => ({
          ...record,
          cells: record.cells.filter((c) => c.fieldId !== colId),
        })),
      );
      setData((prev) =>
        prev.map((row) => {
          const rest: RowData = { ...row };
          delete rest[colId];
          return rest;
        }),
      );
      setHeaderMenu(null);
    },
    [columnOrder, onDeleteColumn],
  );

  const selectedRecordIds = useMemo(() => {
    return Array.from(selectedRows).filter((id): id is string => Boolean(id));
  }, [selectedRows]);

  const fieldLookup = useMemo(
    () =>
      localFields.reduce<Record<string, FieldShape>>(
        (acc, field) => ({ ...acc, [field.id]: field }),
        {},
      ),
    [localFields],
  );

  const recordCellLookup = useMemo(() => {
    const lookup = new Map<string, CellShape>();
    localRecords.forEach((record) => {
      record.cells.forEach((cell) => {
        lookup.set(`${record.id}:${cell.fieldId}`, cell);
      });
    });
    return lookup;
  }, [localRecords]);

  const visibleColumnOrder = useMemo(
    () => columnOrder.filter((id) => !hiddenSet.has(id)),
    [columnOrder, hiddenSet],
  );

  const getCanonicalValue = useCallback(
    (recordId: string, fieldId: string): string | number | null => {
      const field = fieldLookup[fieldId];
      const cell = recordCellLookup.get(`${recordId}:${fieldId}`);
      if (!field || !cell) return null;
      const value = readCellValue(field, cell);
      return value ?? null;
    },
    [fieldLookup, recordCellLookup],
  );

  const updateActiveCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      const colId = visibleColumnOrder[colIndex];
      if (colId === undefined) return;
      if (activeCell?.rowIndex === rowIndex && activeCell?.colId === colId) return;
      setActiveCell({ rowIndex, colId });
      _onActiveCellIndexChange?.([rowIndex, colIndex]);
    },
    [visibleColumnOrder, _onActiveCellIndexChange, activeCell],
  );

  const handleCellNavigation = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowIndex: number,
      colIndex: number,
      rowCount: number,
    ) => {
      if (colIndex < 0 || visibleColumnOrder.length === 0) return;

      const key = e.key;
      let targetRow = rowIndex;
      let targetCol = colIndex;

      const lastCol = visibleColumnOrder.length - 1;
      const clampRow = (r: number) => Math.min(Math.max(r, 0), rowCount - 1);

      if (key === "ArrowRight" || (key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        targetCol = colIndex + 1;
        if (targetCol > lastCol) {
          targetCol = 0;
          targetRow = clampRow(rowIndex + 1);
        }
      } else if (key === "ArrowLeft" || (key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        targetCol = colIndex - 1;
        if (targetCol < 0) {
          targetCol = lastCol;
          targetRow = clampRow(rowIndex - 1);
        }
      } else if (key === "ArrowDown") {
        e.preventDefault();
        targetRow = clampRow(rowIndex + 1);
      } else if (key === "ArrowUp") {
        e.preventDefault();
        targetRow = clampRow(rowIndex - 1);
      } else {
        return;
      }

      if (targetCol < 0 || targetCol > lastCol) return;

      updateActiveCell(targetRow, targetCol);

      const selector = `input[data-row-index="${targetRow}"][data-col-index="${targetCol}"]`;
      const next = document.querySelector<HTMLInputElement>(selector);
      if (next) {
        next.focus();
        next.select();
      }
    },
    [visibleColumnOrder.length, updateActiveCell],
  );

  const columns = useMemo<ColumnDef<RowData, ColumnValue>[]>(() => {
    const makeEditableCell = (key: string) => {
      const EditableCell = ({
        row,
        getValue,
      }: CellContext<RowData, ColumnValue>) => {
        const inputRef = useRef<HTMLInputElement>(null);
        const cellValue = getValue();
        const [editValue, setEditValue] = useState<string>(cellValue == null ? "" : String(cellValue));
        const rowIndex = row.index;
    const colIndex = visibleColumnOrder.indexOf(key);
        const recordId = row.original.__recordId;
        const field = fieldLookup[key];
        const canonicalValue = getCanonicalValue(recordId, key);
        const isNumberField = field?.type === "NUMBER";
        const isActive =
          (activeCell?.rowIndex === rowIndex && activeCell?.colId === String(key)) ||
          (_activeCellIndex?.[0] === rowIndex && _activeCellIndex?.[1] === colIndex);

        useEffect(() => {
          setEditValue(cellValue == null ? "" : String(cellValue));
        }, [cellValue]);

        useEffect(() => {
          const input = inputRef.current;
          if (!input) return;
          const handleNativeKeyDown = (evt: KeyboardEvent) => {
            if (process.env.NODE_ENV !== "production") {
              console.log("native keydown", {
                key: evt.key,
                rowIndex,
                colIndex,
                fieldId: String(key),
                recordId,
                defaultPrevented: evt.defaultPrevented,
              });
            }
          };
          const handleNativeInput = (evt: Event) => {
            if (process.env.NODE_ENV !== "production") {
              const target = evt.target as HTMLInputElement | null;
              console.log("native input", {
                value: target?.value,
                rowIndex,
                colIndex,
                fieldId: String(key),
                recordId,
              });
            }
          };
          input.addEventListener("keydown", handleNativeKeyDown, true);
          input.addEventListener("input", handleNativeInput, true);
          return () => {
            input.removeEventListener("keydown", handleNativeKeyDown, true);
            input.removeEventListener("input", handleNativeInput, true);
          };
        }, [colIndex, recordId, rowIndex]);

        const commitChange = () => {
          if (!_onCellChange) return;
          const normalized = normalizeValueForField(editValue, field);
          if (normalized === undefined) {
            const resetValue = displayValue(canonicalValue);
            setEditValue(resetValue);
            setData((old) => {
              const copy = [...old];
              const current = copy[rowIndex];
              if (!current) return old;
              copy[rowIndex] = { ...current, [key]: resetValue };
              return copy;
            });
            return;
          }
          if (valuesEqual(normalized ?? null, canonicalValue ?? null)) {
            return;
          }
          _onCellChange(recordId, key, normalized);
        };

        return (
          <div
            className={`flex h-full min-h-[36px] items-stretch rounded-[3px] border border-transparent transition-colors ${
              isActive
                ? "border-[#1e73ff] ring-1 ring-[#1e73ff]"
                : "focus-within:border-[#1e73ff] focus-within:ring-1 focus-within:ring-[#1e73ff]"
            }`}
            onClick={() => {
              if (process.env.NODE_ENV !== "production") {
                console.log("cell container click", {
                  rowIndex,
                  colIndex,
                  fieldId: String(key),
                  recordId,
                });
              }
              updateActiveCell(rowIndex, colIndex);
              inputRef.current?.focus();
              inputRef.current?.select();
            }}
          >
            <div className="flex flex-auto">
              <input
                ref={inputRef}
                type={isNumberField ? "number" : "text"}
                className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 px-[6px] py-[6px] text-sm leading-5 text-gray-900"
                placeholder=" "
                value={editValue}
                data-row-index={rowIndex}
                data-col-index={colIndex}
                data-col-id={String(key)}
                onFocus={() => {
                  if (process.env.NODE_ENV !== "production") {
                    console.log("cell focus", { rowIndex, colIndex, fieldId: String(key), recordId });
                  }
                  updateActiveCell(rowIndex, colIndex);
                }}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (process.env.NODE_ENV !== "production") {
                    console.log("cell change", {
                      rowIndex,
                      colIndex,
                      fieldId: String(key),
                      recordId,
                      nextValue,
                    });
                  }
                  setEditValue(nextValue);
                  setData((old) => {
                    const copy = [...old];
                    const current = copy[rowIndex];
                    if (!current) return old;
                    copy[rowIndex] = { ...current, [key]: nextValue };
                    return copy;
                  });
                }}
                onBlur={(e) => {
                  if (process.env.NODE_ENV !== "production") {
                    console.log("cell blur", {
                      rowIndex,
                      colIndex,
                      fieldId: String(key),
                      recordId,
                      relatedTarget: (e.relatedTarget as HTMLElement | null)?.tagName,
                    });
                  }
                  commitChange();
                }}
                onKeyDown={(e) => {
                  if (process.env.NODE_ENV !== "production") {
                    console.log("cell keydown", {
                      key: e.key,
                      rowIndex,
                      colIndex,
                      fieldId: String(key),
                      recordId,
                      defaultPrevented: e.defaultPrevented,
                    });
                  }
                  if (
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown" ||
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "Tab"
                  ) {
                    handleCellNavigation(e, rowIndex, colIndex, data.length);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          </div>
        );
      };

      EditableCell.displayName = `EditableCell_${String(key)}`;
      return EditableCell;
    };


    const columnLetter = (index: number) =>
      String.fromCharCode("A".charCodeAt(0) + index);

    const cols: ColumnDef<RowData, ColumnValue>[] = visibleColumnOrder.map(
      (key, index) => {
        const field = fieldLookup[key];
        const headerName = field?.name ?? `Field ${index + 1}`;
        const letter = columnLetter(index);

        const icon =
          headerName.toLowerCase().includes("notes") ? (
            <FiType className="text-gray-500 text-sm" />
          ) : headerName.toLowerCase().includes("assignee") ? (
            <FiUser className="text-gray-500 text-sm" />
          ) : headerName.toLowerCase().includes("attachment") ? (
            <FiPaperclip className="text-gray-500 text-sm" />
          ) : headerName.toLowerCase().includes("status") ? (
            <FiCircle className="text-gray-400 text-[10px]" />
          ) : null;

        return {
          accessorKey: key,
          header: () => (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{letter}</span>
              {icon}
              <span className="font-medium text-gray-700 truncate">{headerName}</span>
            </div>
          ),
          cell: makeEditableCell(key),
        };
      },
    );

    const rowNumberCol: ColumnDef<RowData, ColumnValue> = {
      id: "rowNumber",
      header: "",
      cell: ({ row }) => {
        const recordId = row.original.__recordId;
        const isSelected = selectedRows.has(recordId);
        const showCheckbox = hoveredRow === row.index || isSelected;
        return (
          <div className="flex items-center justify-center text-xs text-gray-500">
            {showCheckbox ? (
              <input
                type="checkbox"
                className="rounded border-gray-300 accent-blue-600 cursor-pointer"
                checked={isSelected}
                onChange={(e) => {
                  setSelectedRows((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(recordId);
                    else next.delete(recordId);
                    return next;
                  });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedRows(new Set([recordId]));
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    recordId,
                  });
                }}
              />
            ) : (
              row.index + 1
            )}
          </div>
        );
      },
      size: 60,
    };

    const addFieldCol: ColumnDef<RowData, ColumnValue> = {
      id: "addField",
      header: () => (
        <div className="flex items-center justify-center">
          <button
            onClick={addColumn}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
            aria-label="Add column"
            type="button"
          >
            <FiPlus />
          </button>
        </div>
      ),
      cell: () => <div className="h-4" />,
      size: 60,
      enableSorting: false,
    };

    return [rowNumberCol, ...cols, addFieldCol];
  }, [
    visibleColumnOrder,
    addColumn,
    fieldLookup,
    hoveredRow,
    selectedRows,
    _activeCellIndex,
    _onCellChange,
    getCanonicalValue,
    activeCell,
    updateActiveCell,
    handleCellNavigation,
    _onActiveCellIndexChange,
    data.length,
  ]);


  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const widthClass = (columnId: string) => {
    const isRowNumber = columnId === "rowNumber";
    const isAddField = columnId === "addField";
    return isRowNumber
      ? "w-[60px] text-center"
      : isAddField
        ? "w-[60px] text-center"
        : "w-[140px]";
  };

  const closeHeaderMenu = () => setHeaderMenu(null);

  const targetRecordIds: string[] = useMemo(() => {
    if (selectedRecordIds.length) return selectedRecordIds;
    if (contextMenu?.recordId) return [contextMenu.recordId];
    return [];
  }, [contextMenu, selectedRecordIds]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" ref={tableWrapperRef}>
      {/* ACTUAL TABLE */}
      <div className="flex-1 overflow-auto bg-white border-t border-gray-300">
        <table className="table-auto border-separate border-spacing-0 text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[#f5f6fa]">
                {headerGroup.headers.map((header) => {
                  const headerHover =
                    hoveredHeader === header.id ? "bg-[#eef0f5]" : "";
                  const isFieldHeader = columnOrder.includes(header.id);
                  const showArrow =
                    isFieldHeader &&
                    (hoveredHeader === header.id || headerMenu === header.id);
                  return (
                    <th
                      key={header.id}
                      className={`relative border-b border-r border-gray-200 text-left text-xs font-medium text-gray-600 ${widthClass(header.id)} ${headerHover}`}
                      onMouseEnter={() => setHoveredHeader(header.id)}
                      onMouseLeave={() => {
                        setHoveredHeader(null);
                        if (headerMenu !== header.id) return;
                      }}
                    >
                      <div className="flex items-center justify-between px-3 py-[6px] text-sm hover:bg-[#eef0f5]">
                        <div className="flex-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </div>
                        {showArrow && header.id !== "addField" && (
                          <button
                            className="ml-2 text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHeaderMenu(
                                headerMenu === header.id ? null : header.id,
                              );
                            }}
                            aria-label="Open field menu"
                            type="button"
                          >
                            <FiChevronDown />
                          </button>
                        )}
                      </div>
                      {headerMenu === header.id && (
                        <div
                          className="absolute z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-xl text-gray-700"
                          onMouseLeave={closeHeaderMenu}
                        >
                          <div className="py-2 text-sm">
                            <HeaderMenuItem label="Edit field" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Duplicate field" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Insert left" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Insert right" onClick={closeHeaderMenu} />
                            <div className="my-1 border-t" />
                            <HeaderMenuItem label="Sort A -> Z" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Sort Z -> A" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Filter by this field" onClick={closeHeaderMenu} />
                            <HeaderMenuItem label="Hide field" onClick={closeHeaderMenu} />
                            <HeaderMenuItem
                              label="Delete field"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeColumn(header.column.id)}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowHovered = hoveredRow === row.index;
              const recordId = row.original.__recordId;
              const isSelected = selectedRows.has(recordId);
              return (
                <tr
                  key={row.id}
                  className={`${rowHovered ? "bg-[#f1f3f7]" : "bg-white even:bg-[#fbfbfe]"} ${isSelected ? "border border-blue-50" : ""}`}
                  onMouseEnter={() => setHoveredRow(row.index)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`border-b border-r border-gray-200 align-middle ${widthClass(cell.column.id)}`}
                    >
                  <div className="px-1 py-[2px] text-sm hover:bg-[#f5f6fa]">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-white">
              {table.getVisibleLeafColumns().map((column) => (
                <td
                  key={`add-row-${column.id}`}
                  className={`border-b border-r border-gray-200 align-middle ${widthClass(column.id)}`}
                >
                  <div className="px-3 py-[10px] text-sm">
                    {column.id === "rowNumber" ? (
                      <button
                        onClick={addRow}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                        aria-label="Add row"
                        type="button"
                      >
                        <FiPlus />
                      </button>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="shrink-0 sticky bottom-0 left-0 right-0 z-20 
        flex items-center justify-between
        px-5 py-3 text-xs border-t border-gray-300 bg-white text-gray-600">
        <div>
          {isLoading ? "Loading records..." : `${data.length} records`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="px-3 py-1 rounded-full border hover:bg-gray-50"
          >
            + Add
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg text-sm text-gray-800"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem label="Insert record above" />
          <MenuItem label="Insert record below" />
          <div className="border-t my-1" />
          <MenuItem label="Duplicate record" />
          <MenuItem label="Apply template" />
          <MenuItem label="Expand record" />
          <MenuItem label="Run field agent" />
          <div className="border-t my-1" />
          <MenuItem label="Add comment" />
          <MenuItem label="Copy record URL" />
          <MenuItem label="Send record" />
          <div className="border-t my-1" />
          <MenuItem
            label="Delete record"
            danger
            onClick={() => {
              if (!onDeleteRecords || targetRecordIds.length === 0) return;
              onDeleteRecords([targetRecordIds[0]!]);
              setContextMenu(null);
            }}
          />
          {onDeleteRecords && targetRecordIds.length > 1 && (
            <MenuItem
              label="Delete all selected records"
              danger
              onClick={() => {
                onDeleteRecords(targetRecordIds);
                setContextMenu(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface HeaderMenuItemProps {
  label: string;
  onClick: () => void;
  className?: string;
}

function HeaderMenuItem({ label, onClick, className }: HeaderMenuItemProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${className ?? ""}`}
    >
      {label}
    </button>
  );
}

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 ${
        danger ? "text-red-600 hover:text-red-700" : ""
      }`}
    >
      <span className="text-base">-</span>
      <span>{label}</span>
    </button>
  );
}
