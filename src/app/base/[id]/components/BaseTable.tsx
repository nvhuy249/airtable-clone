 "use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
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
type RowData = Record<string, ColumnValue> & { __recordId: string; __rowIndex: number };

const displayValue = (value: ColumnValue) => (value == null ? "" : String(value));
const VIRTUAL_ROW_HEIGHT = 42;
const VIRTUAL_OVERSCAN = 8;

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

const shallowFieldsEqual = (a: FieldShape[], b: FieldShape[]) =>
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

interface BaseTableProps {
  fields: FieldShape[];
  records: RecordShape[];
  hiddenFieldIds?: string[];
  filteredFieldIds?: string[];
  sortedFieldIds?: string[];
  isLoading?: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  onAddColumn?: (type?: FieldType, name?: string) => void;
  onRenameColumn?: (fieldId: string, name: string) => void;
  onAddRow?: () => void;
  onDeleteColumn?: (fieldId: string) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  searchTerm?: string;
  onCellChange?: (recordId: string, fieldId: string, value: string | number | null) => void;
  activeCellIndex?: [number, number] | null;
  onActiveCellIndexChange?: (coords: [number, number] | null) => void;
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

function buildRows(fields: FieldShape[], records: RecordShape[], startIndex = 0): RowData[] {
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  return records.map((record, idx) => {
    const row: RowData = { __recordId: record.id, __rowIndex: startIndex + idx };
    sortedFields.forEach((field) => {
      const cell = record.cells.find((c) => c.fieldId === field.id);
      const value = readCellValue(field, cell);
      row[field.id] = value ?? "";
    });
    return row;
  });
}

function createEmptyRow(fields: FieldShape[]): RowData {
  const row: RowData = { __recordId: `temp-${Date.now()}`, __rowIndex: -1 };
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
  filteredFieldIds = [],
  sortedFieldIds = [],
  searchTerm = "",
  isLoading,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
  totalCount,
  onAddColumn,
  onRenameColumn,
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
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colId: string } | null>(null);

  const [addFieldMenuOpen, setAddFieldMenuOpen] = useState(false);
  const [pendingFieldType, setPendingFieldType] = useState<FieldType | null>(null);
  const [pendingFieldName, setPendingFieldName] = useState("");
  const [addFieldAnchor, setAddFieldAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [renamingFieldId, setRenamingFieldId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [renameAnchor, setRenameAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const skipRefocusRef = useRef(false);
  const hoveredRowRef = useRef<number | null>(null);
  const selectedRowsRef = useRef<Set<string>>(new Set());
  const activeCellRef = useRef<typeof activeCell>(null);
  const addFieldButtonRef = useRef<HTMLButtonElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const addFieldNameInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedFieldsRef = useRef<FieldShape[]>(DEFAULT_FIELDS);
  const appliedRecordsRef = useRef<RecordShape[]>(DEFAULT_RECORDS);
  const lastScrollTopRef = useRef<number>(0);
  const prevRecordCountRef = useRef<number>(DEFAULT_RECORDS.length);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hiddenSet = useMemo(() => new Set(hiddenFieldIds), [hiddenFieldIds]);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      setScrollElement(scrollContainerRef.current);
    }
  }, []);
  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.cancelable) return;
      e.preventDefault();
      node.scrollBy({ top: e.deltaY * 0.25, behavior: "auto" });
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  const openContextMenu = useCallback(
    (clientX: number, clientY: number, recordId: string) => {
      const padding = 8;
      const menuWidth = 320;
      const menuHeight = 420;
      const maxX = Math.max(padding, window.innerWidth - menuWidth - padding);
      const maxY = Math.max(padding, window.innerHeight - menuHeight - padding);
      const x = Math.min(Math.max(clientX, padding), maxX);
      const y = Math.min(Math.max(clientY, padding), maxY);
      setContextMenu({ x, y, recordId });
    },
    [],
  );

  useEffect(() => {
    if (pendingFieldType && addFieldNameInputRef.current) {
      addFieldNameInputRef.current.focus();
      addFieldNameInputRef.current.setSelectionRange(
        addFieldNameInputRef.current.value.length,
        addFieldNameInputRef.current.value.length,
      );
    }
  }, [pendingFieldType]);

  useEffect(() => {
    if (!renamingFieldId || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.setSelectionRange(
      renameInputRef.current.value.length,
      renameInputRef.current.value.length,
    );
  }, [renamingFieldId]);

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
      const target = e.target as HTMLElement | null;
      const insideAddMenus = !!(
        target &&
        (target.closest('[data-add-field-menu="true"]') ??
          target.closest('[data-add-field-name="true"]') ??
          addFieldButtonRef.current?.contains(target))
      );
      const insideRename = !!(
        target &&
        (target.closest('[data-rename-field="true"]') ??
          target.closest('[data-rename-trigger="true"]'))
      );

      const insideTable =
        target && tableWrapperRef.current
          ? tableWrapperRef.current.contains(target)
          : false;
      const insideCell =
        target && tableWrapperRef.current
          ? Boolean(target.closest('[data-cell-container="true"]'))
          : false;

      if (!insideTable || !insideCell) {
        skipRefocusRef.current = true;
        setActiveCell(null);
        setEditingCell(null);
        _onActiveCellIndexChange?.(null);
      }

      if ((addFieldMenuOpen || pendingFieldType) && !insideAddMenus) {
        setAddFieldMenuOpen(false);
        setPendingFieldType(null);
        setPendingFieldName("");
        setAddFieldAnchor(null);
      }

      if (renamingFieldId && !insideRename) {
        setRenamingFieldId(null);
        setRenamingValue("");
        setRenameAnchor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [addFieldMenuOpen, pendingFieldType, _onActiveCellIndexChange, renamingFieldId]);

  useEffect(() => {
    const useFields = [...(fields ?? DEFAULT_FIELDS)].sort((a, b) => a.order - b.order);
    const useRecords = records ?? DEFAULT_RECORDS;
    const fieldsChanged = !shallowFieldsEqual(appliedFieldsRef.current, useFields);
    const recordsChanged =
      appliedRecordsRef.current.length !== useRecords.length ||
      appliedRecordsRef.current.some((record, idx) => record !== useRecords[idx]);

    // Bail early if nothing material changed to avoid render loops.
    if (!fieldsChanged && !recordsChanged) return;

    const prevRecords = appliedRecordsRef.current;
    const prevCount = prevRecordCountRef.current ?? 0;

    const isAppend =
      !fieldsChanged &&
      prevRecords.length === prevCount &&
      useRecords.length > prevCount &&
      prevRecords.every((record, idx) => record === useRecords[idx]);

    appliedFieldsRef.current = useFields;
    appliedRecordsRef.current = useRecords;

    // Full rebuild when fields change, records shrink/replace, or no append path.
    const doFullRebuild = fieldsChanged || !isAppend;
    if (doFullRebuild) {
      setLocalFields(useFields);
      setLocalRecords(useRecords);
      setColumnOrder(useFields.map((f) => f.id));
      setData(buildRows(useFields, useRecords));
      prevRecordCountRef.current = useRecords.length;
      lastScrollTopRef.current = 0;
      setSelectedRows(new Set());
      setContextMenu(null);
      // Keep add-field name input focused if open
      if (pendingFieldType && addFieldNameInputRef.current) {
        addFieldNameInputRef.current.focus();
        addFieldNameInputRef.current.setSelectionRange(
          addFieldNameInputRef.current.value.length,
          addFieldNameInputRef.current.value.length,
        );
      }
      setActiveCell((prev) => {
        if (!prev) return prev;
        const columnStillExists = useFields.some((f) => f.id === prev.colId);
        const rowStillExists = prev.rowIndex >= 0 && prev.rowIndex < useRecords.length;
        return columnStillExists && rowStillExists ? prev : null;
      });
      if (renamingFieldId && !useFields.some((f) => f.id === renamingFieldId)) {
        setRenamingFieldId(null);
        setRenamingValue("");
        setRenameAnchor(null);
      }
      return;
    }

    // Append-only path: only build the new rows to avoid re-processing all data.
    const newRecords = useRecords.slice(prevCount);
    if (!newRecords.length) return;

    setLocalRecords((prev) => [...prev, ...newRecords]);
    setData((prev) => [...prev, ...buildRows(useFields, newRecords, prevCount)]);
    prevRecordCountRef.current = useRecords.length;
  }, [fields, records, pendingFieldType, renamingFieldId]);

  hoveredRowRef.current = hoveredRow;
  selectedRowsRef.current = selectedRows;
  activeCellRef.current = activeCell;
  const editingCellRef = useRef<typeof editingCell>(null);
  editingCellRef.current = editingCell;

  const computeAddFieldAnchor = useCallback(
    (options?: { height?: number; width?: number }) => {
      const button = addFieldButtonRef.current;
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      const viewportPadding = 8;
      const menuHeight = options?.height ?? 220;
      const menuWidth = options?.width ?? 240;
      const maxTop = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding);
      const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
      const top = Math.min(rect.bottom + 6, maxTop);
      const left = Math.min(rect.left, maxLeft);
      return { top, left };
    },
    [],
  );
  useEffect(() => {
    if (!pendingFieldType) return;
    const anchor = computeAddFieldAnchor({ height: 260, width: 260 });
    if (anchor) setAddFieldAnchor(anchor);
  }, [computeAddFieldAnchor, pendingFieldType]);
  const maybeLoadMore = useCallback(() => {
    if (!onLoadMore || !hasMore || isFetchingMore) return;
    const node = scrollContainerRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
    if (distanceFromBottom <= VIRTUAL_ROW_HEIGHT * 50) {
      onLoadMore();
    }

  }, [hasMore, isFetchingMore, onLoadMore]);
  const addRow = useCallback(() => {
    if (onAddRow) {
      setAddFieldMenuOpen(false);
      setPendingFieldType(null);
      setPendingFieldName("");
      setAddFieldAnchor(null);
      setRenamingFieldId(null);
      setRenameAnchor(null);
      onAddRow();
      return;
    }
    setAddFieldMenuOpen(false);
    setPendingFieldType(null);
    setPendingFieldName("");
    setAddFieldAnchor(null);
    setRenamingFieldId(null);
    setRenameAnchor(null);
    const newRecord = createEmptyRecord(localFields);
    setLocalRecords((prev) => [...prev, newRecord]);
    setData((old) => [...old, createEmptyRow(localFields)]);
  }, [localFields, onAddRow]);

  const addColumn = useCallback(
    (type?: FieldType, name?: string) => {
      if (onAddColumn) {
        onAddColumn(type, name);
        return;
      }
      const newFieldId = `custom_${Date.now()}`;
      const trimmedName = name?.trim();
      const newField: FieldShape = {
        id: newFieldId,
        name: trimmedName ?? `Field ${localFields.length + 1}`,
        type: type ?? "TEXT",
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
    },
    [localFields.length, onAddColumn],
  );

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

  const commitRename = useCallback(
    (fieldId: string, nextName: string) => {
      setRenamingFieldId(null);
      const trimmed = nextName.trim();
      const current = fieldLookup[fieldId]?.name;
      if (!trimmed || trimmed === current) {
        setRenamingValue("");
        setRenameAnchor(null);
        return;
      }
      if (onRenameColumn) {
        onRenameColumn(fieldId, trimmed);
      } else {
        setLocalFields((prev) =>
          prev.map((f) => (f.id === fieldId ? { ...f, name: trimmed } : f)),
        );
      }
      setRenamingValue("");
      setRenameAnchor(null);
    },
    [fieldLookup, onRenameColumn],
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

  const normalizedSearchTerm = (searchTerm ?? "").trim().toLowerCase();
  const filteredFieldIdSet = useMemo(() => new Set(filteredFieldIds), [filteredFieldIds]);
  const sortedFieldIdSet = useMemo(() => new Set(sortedFieldIds), [sortedFieldIds]);
  const highlightedCellKeys = useMemo(() => {
    if (!normalizedSearchTerm) return new Set<string>();
    const matches = new Set<string>();

    localRecords.forEach((record) => {
      record.cells.forEach((cell) => {
        const field = fieldLookup[cell.fieldId];
        if (!field) return;
        const value = readCellValue(field, cell);
        if (value == null) return;
        if (String(value).toLowerCase().includes(normalizedSearchTerm)) {
          matches.add(`${record.id}:${cell.fieldId}`);
        }
      });
    });

    return matches;
  }, [fieldLookup, localRecords, normalizedSearchTerm]);

  const visibleColumnOrder = useMemo(
    () => columnOrder.filter((id) => !hiddenSet.has(id)),
    [columnOrder, hiddenSet],
  );

  useEffect(() => {
    if (!activeCell) return;
    const selector = `input[data-row-index="${activeCell.rowIndex}"][data-col-id="${activeCell.colId}"]`;
    const next = document.querySelector<HTMLInputElement>(selector);
    if (!next) return;
    if (document.activeElement === next) return;
    next.focus();
  }, [activeCell, visibleColumnOrder]);

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
    (rowIndex: number, colIndex: number, enterEditMode = false) => {
      const colId = visibleColumnOrder[colIndex];
      if (colId === undefined) return;
      if (activeCell?.rowIndex === rowIndex && activeCell?.colId === colId) {
        if (enterEditMode) {
          setEditingCell({ rowIndex, colId });
        }
        return;
      }
      setActiveCell({ rowIndex, colId });
      setEditingCell(enterEditMode ? { rowIndex, colId } : null);
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
    isInEditMode: boolean,
  ) => {
    if (colIndex < 0 || visibleColumnOrder.length === 0) return;

    const key = e.key;
    
    // In edit mode, only Tab and Enter navigate
    if (isInEditMode) {
      if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
        // Allow normal text navigation
        return;
      }
      
      if (key === "Tab") {
        e.preventDefault();
        let targetRow = rowIndex;
        let targetCol = colIndex;
        const lastCol = visibleColumnOrder.length - 1;
        const clampRow = (r: number) => Math.min(Math.max(r, 0), rowCount - 1);
        
        if (e.shiftKey) {
          targetCol = colIndex - 1;
          if (targetCol < 0) {
            targetCol = lastCol;
            targetRow = clampRow(rowIndex - 1);
          }
        } else {
          targetCol = colIndex + 1;
          if (targetCol > lastCol) {
            targetCol = 0;
            targetRow = clampRow(rowIndex + 1);
          }
        }
        
        skipRefocusRef.current = true;
        updateActiveCell(targetRow, targetCol, false);
        return;
      }
      
      if (key === "Enter" || key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
        return;
      }
      
      return;
    }

    // Navigation mode - all arrows and tab work
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
    } else if (key === "Enter") {
      e.preventDefault();
      setEditingCell({ rowIndex, colId: visibleColumnOrder[colIndex]! });
      return;
    } else {
      return;
    }

    if (targetCol < 0 || targetCol > lastCol) return;

    skipRefocusRef.current = true;
    updateActiveCell(targetRow, targetCol, false);

    const selector = `input[data-row-index="${targetRow}"][data-col-index="${targetCol}"]`;
    const next = document.querySelector<HTMLInputElement>(selector);
    if (next) {
      next.focus();
    }
  },
  [visibleColumnOrder, updateActiveCell],
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
        const rowIndex = row.original.__rowIndex ?? row.index;
        const colIndex = visibleColumnOrder.indexOf(key);
        const recordId = row.original.__recordId;
        const field = fieldLookup[key];
        const canonicalValue = getCanonicalValue(recordId, key);
        const isNumberField = field?.type === "NUMBER";
        const hasMountedRef = useRef(false);
        const isActive =
          activeCellRef.current?.rowIndex === rowIndex &&
          activeCellRef.current?.colId === String(key);
        const isEditing =
          editingCellRef.current?.rowIndex === rowIndex &&
          editingCellRef.current?.colId === String(key);

        useEffect(() => {
          if (!isActive) return;
          const input = inputRef.current;
          if (!input) return;
          if (document.activeElement === input) return;
          input.focus();
        }, [isActive, editValue]);

        useEffect(() => {
          setEditValue(cellValue == null ? "" : String(cellValue));
        }, [cellValue]);

        const commitChange = (pendingValue?: string) => {
          if (!_onCellChange) return;
          const valueToCommit = pendingValue ?? editValue;
          const normalized = normalizeValueForField(valueToCommit, field);
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

        useEffect(() => {
          if (!isActive) return;
          if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
          }
          const timer = window.setTimeout(() => {
            if (!_onCellChange) return;
            const normalized = normalizeValueForField(editValue, field);
            if (normalized === undefined) return;
            if (valuesEqual(normalized ?? null, canonicalValue ?? null)) return;
            _onCellChange(recordId, key, normalized);
          }, 700);
          return () => window.clearTimeout(timer);
        }, [editValue, isActive, field, canonicalValue, recordId]);

          return (
            <div
              className={`flex h-full min-h-[36px] items-stretch border border-transparent transition-colors ${
                isActive
                  ? "border-[#1e73ff] ring-2 ring-[#1e73ff]"
                  : "focus-within:border-[#1e73ff] focus-within:ring-1 focus-within:ring-[#1e73ff]"
              }`}
              data-cell-container="true"
              onClick={() => {
                updateActiveCell(rowIndex, colIndex, false);
                inputRef.current?.focus();
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                // 1. Enter edit mode
                updateActiveCell(rowIndex, colIndex, true);
                setEditingCell({ rowIndex, colId: String(key) });

                // 2. Delay focus long enough for editing state to apply
                requestAnimationFrame(() => {
                  const input = inputRef.current;
                  if (!input) return;

                  input.focus();

                  // 3. Ensure NO auto-select from double-click
                  const length = input.value.length;
                  input.setSelectionRange(length, length); // place caret at end
                });
              }}
            >
              <div className="flex flex-auto">
                <input
                  ref={inputRef}
                  type={isNumberField ? "number" : "text"}
                  className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 px-[6px] py-[6px] text-sm leading-5 text-gray-900"
                  style={{ caretColor: isEditing ? 'auto' : 'transparent' }}
                  placeholder=" "
                  value={editValue}
                  data-row-index={rowIndex}
                  data-col-index={colIndex}
                  data-col-id={String(key)}
                  onFocus={() => {
                    if (!isActive) {
                      updateActiveCell(rowIndex, colIndex, false);
                    }
                  }}
                  onChange={(e) => {
                    if (!isEditing) {
                      setEditingCell({ rowIndex, colId: String(key) });
                    }
                    const nextValue = e.target.value;
                    setEditValue(nextValue);
                    setData((old) => {
                      const copy = [...old];
                      const current = copy[rowIndex];
                      if (!current) return old;
                      copy[rowIndex] = { ...current, [key]: nextValue };
                      return copy;
                    });
                    // For optimistic rows/fields, commit immediately so edits are queued before IDs swap.
                    if (recordId.startsWith("temp-") || String(key).startsWith("temp-")) {
                      const normalized = normalizeValueForField(nextValue, field);
                      if (normalized !== undefined && _onCellChange) {
                        _onCellChange(recordId, key, normalized);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    commitChange();
                    const clickedOutside = skipRefocusRef.current;
                    skipRefocusRef.current = false;
                    const related = e.relatedTarget as HTMLElement | null;
                    const isOutsideTable =
                      related && tableWrapperRef.current
                        ? !tableWrapperRef.current.contains(related)
                        : false;
                    if (isOutsideTable || clickedOutside) {
                      setActiveCell(null);
                      setEditingCell(null);
                      _onActiveCellIndexChange?.(null);
                      return;
                    }
                    if (isActive) {
                      requestAnimationFrame(() => {
                        if (document.activeElement !== inputRef.current) {
                          inputRef.current?.focus();
                        }
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    // Typing any character enters edit mode
                    if (!isEditing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                      setEditingCell({ rowIndex, colId: String(key) });
                      return;
                    }

                    // Handle navigation
                    if (
                      e.key === "ArrowUp" ||
                      e.key === "ArrowDown" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Tab" ||
                      e.key === "Enter" ||
                      e.key === "Escape"
                    ) {
                      handleCellNavigation(e, rowIndex, colIndex, data.length, isEditing);
                      return;
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
            <div
              className="flex items-center gap-2"
              data-rename-trigger="true"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setHeaderMenu(null);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setRenameAnchor({
                  top: rect.bottom + 6,
                  left: rect.left,
                  width: rect.width,
                });
                setRenamingFieldId(key);
                setRenamingValue(headerName);
              }}
            >
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
        const absoluteIndex = row.original.__rowIndex ?? row.index;
        const isSelected = selectedRowsRef.current.has(recordId);
        const showCheckbox = hoveredRowRef.current === absoluteIndex || isSelected;
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
                  openContextMenu(e.clientX, e.clientY, recordId);
                }}
              />
            ) : (
              (absoluteIndex ?? 0) + 1
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
            ref={addFieldButtonRef}
            onClick={() => {
              const anchor = computeAddFieldAnchor({ height: 180, width: 180 });
              if (anchor) setAddFieldAnchor(anchor);
              setPendingFieldType(null);
              setPendingFieldName("");
              setAddFieldMenuOpen((p) => !p);
            }}
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
    fieldLookup,
    _onCellChange,
    getCanonicalValue,
    updateActiveCell,
    handleCellNavigation,
    _onActiveCellIndexChange,
    computeAddFieldAnchor,
    openContextMenu,
    data.length,
  ]);


  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  });

  useEffect(() => {
    if (scrollElement && data.length > 0) {
      // Force the virtualizer to recalculate by notifying it of a scroll
      const element = scrollContainerRef.current;
      if (element) {
        // Save current scroll position
        const currentScroll = element.scrollTop;
        // Trigger recalculation by scrolling slightly
        element.scrollTop = currentScroll + 0.1;
        element.scrollTop = currentScroll;
      }
    }
  }, [data.length, scrollElement]);

  useEffect(() => {
    if (scrollElement && data.length > 0) {
      // Critical: Force virtualizer to recalculate total size
      rowVirtualizer?.measure();
      // Also force it to recalculate its internal measurements
      if (typeof rowVirtualizer?.calculateRange === 'function') {
        rowVirtualizer.calculateRange();
      }
    }
  }, [data.length, scrollElement, rowVirtualizer]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const virtualRows = rowVirtualizer.getVirtualItems();

  // useEffect(() => {
  //   console.log('🔍 Virtualization Status:', {
  //     'Total data rows': data.length,
  //     'Virtual items rendered': virtualRows.length,
  //     'Savings': `${((1 - virtualRows.length / data.length) * 100).toFixed(1)}%`,
  //     'First visible row': virtualRows[0]?.index,
  //     'Last visible row': virtualRows[virtualRows.length - 1]?.index,
  //   });
  // }, [data.length, virtualRows.length]);

  const table = useReactTable({
    data: data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const allRows = table.getRowModel().rows;
  const tableRows = virtualRows
    .map((virtualRow) => allRows[virtualRow.index])
    .filter((row): row is NonNullable<typeof row> => row !== undefined);

  // const tableRows = table.getRowModel().rows;
  const topSpacerHeight = virtualRows.length ? virtualRows[0]!.start : 0;
  const bottomSpacerHeight = virtualRows.length && rowVirtualizer
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
    : 0;

  const scrollPositionRef = useRef(0);

  const prevDataLengthRef = useRef(data.length);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const prevLength = prevDataLengthRef.current;
    const currentLength = data.length;
    
    // If data grew (new page loaded), restore scroll
    if (currentLength > prevLength && prevLength > 0) {
      const savedScroll = scrollPositionRef.current;
      if (savedScroll > 0) {
        container.scrollTop = savedScroll;
      }
    }
    
    prevDataLengthRef.current = currentLength;
  }, [data.length]);

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

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    const overflowRight = rect.right - window.innerWidth + padding;
    const overflowBottom = rect.bottom - window.innerHeight + padding;
    let nextX = contextMenu.x;
    let nextY = contextMenu.y;
    if (overflowRight > 0) {
      nextX = Math.max(padding, contextMenu.x - overflowRight);
    }
    if (overflowBottom > 0) {
      nextY = Math.max(padding, contextMenu.y - overflowBottom);
    }
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu({ ...contextMenu, x: nextX, y: nextY });
    }
  }, [contextMenu]);

  const loadedCount = records?.length ?? 0;
  const formatNumber = useCallback((n: number) => n.toLocaleString(), []);
  const totalLabel = totalCount ? formatNumber(totalCount) : null;
  const loadedLabel = formatNumber(loadedCount);
  const statusText = isLoading
    ? "Loading records..."
    : totalLabel
      ? hasMore
        ? `Loaded ${loadedLabel} / ${totalLabel} records`
        : `Showing ${loadedLabel} of ${totalLabel} records`
      : hasMore
        ? `Loaded ${loadedLabel}`
        : `Showing ${loadedLabel}`;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" ref={tableWrapperRef}>
      {/* ACTUAL TABLE */}
      <div
        className="flex-1 overflow-auto bg-white border-t border-gray-300"
        ref={scrollContainerRef}
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          scrollPositionRef.current = scrollTop;
          lastScrollTopRef.current = scrollTop;
          maybeLoadMore();
        }}
      >
        <table className="table-auto border-separate border-spacing-0 text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-white">
                {headerGroup.headers.map((header) => {
                  const headerHover =
                    hoveredHeader === header.id ? "bg-[#eef0f5]" : "";
                  const isFieldHeader = columnOrder.includes(header.id);
                  const isFilterColumn = isFieldHeader && filteredFieldIdSet.has(header.id);
                  const isSortColumn = isFieldHeader && sortedFieldIdSet.has(header.id);
                  const headerHighlight = isFilterColumn
                    ? "bg-emerald-50"
                    : isSortColumn
                      ? "bg-orange-50"
                      : "";
                  const showArrow =
                    isFieldHeader &&
                    (hoveredHeader === header.id || headerMenu === header.id);
                  return (
                    <th
                      key={header.id}
                      className={`relative border-b border-r border-gray-200 text-left text-xs font-medium text-gray-600 ${widthClass(header.id)} ${headerHover} ${headerHighlight}`}
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
            {topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td colSpan={table.getVisibleLeafColumns().length} style={{ height: topSpacerHeight }} className="p-0 border-0" />
              </tr>
            )}
            {tableRows.map((row) => {
              const absoluteIndex = row.original.__rowIndex ?? row.index;
              const rowHovered = hoveredRow === absoluteIndex;
              const recordId = row.original.__recordId;
              const isSelected = selectedRows.has(recordId);
              return (
                <tr
                  key={row.id}
                  className={`${rowHovered ? "bg-[#f1f3f7]" : "bg-white"} ${isSelected ? "border border-blue-50" : ""}`}
                  onMouseEnter={() => setHoveredRow(absoluteIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ height: VIRTUAL_ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const cellKey = `${recordId}:${cell.column.id}`;
                    const isFilterColumn = filteredFieldIdSet.has(cell.column.id);
                    const isSortColumn = sortedFieldIdSet.has(cell.column.id);
                    const isHighlighted = highlightedCellKeys.has(cellKey);
                    const highlightClass = isHighlighted
                      ? "bg-amber-200 hover:bg-amber-200"
                      : isFilterColumn
                        ? "bg-emerald-50 hover:bg-emerald-100"
                        : isSortColumn
                          ? "bg-orange-50 hover:bg-orange-100"
                          : "hover:bg-[#f5f6fa]";
                    return (
                      <td
                        key={cell.id}
                        className={`border-b border-r border-gray-200 align-middle ${widthClass(cell.column.id)}`}
                      >
                        <div className={`px-1 py-[2px] text-sm ${highlightClass}`}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td colSpan={table.getVisibleLeafColumns().length} className="p-0 border-0">
                <div
                  className="relative w-full"
                  style={{ height: Math.max(bottomSpacerHeight, hasMore || isFetchingMore ? 24 : 0) }}
                >
                  {(hasMore || isFetchingMore) && (
                    <div
                      ref={loadMoreRef}
                      className="absolute inset-x-0 bottom-0 px-3 py-3 text-center text-xs text-gray-600"
                    >
                      {isFetchingMore ? "Loading more records..." : "Scroll to load more records"}
                    </div>
                  )}
                </div>
              </td>
            </tr>
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
                data-add-field-name="false"
                data-add-field-menu="false"
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
          {statusText}
        </div>
      </div>

      {addFieldMenuOpen && addFieldAnchor && (
        <div
          data-add-field-menu="true"
          className="fixed z-40 w-40 rounded-lg border border-gray-200 bg-white shadow-lg text-sm text-gray-800"
          style={{ top: addFieldAnchor.top, left: addFieldAnchor.left }}
        >
          <div className="px-3 py-2 border-b text-gray-700 font-medium">New field type</div>
          <button
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-gray-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAddFieldMenuOpen(false);
              const anchor = computeAddFieldAnchor({ height: 180, width: 180 });
              if (anchor) setAddFieldAnchor(anchor);
              setPendingFieldType("TEXT");
              setPendingFieldName("");
            }}
          >
            Text
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-gray-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAddFieldMenuOpen(false);
              const anchor = computeAddFieldAnchor({ height: 180, width: 180 });
              if (anchor) setAddFieldAnchor(anchor);
              setPendingFieldType("NUMBER");
              setPendingFieldName("");
            }}
          >
            Number
          </button>
        </div>
      )}

      {pendingFieldType && addFieldAnchor && (
        <div
          data-add-field-name="true"
              className="fixed z-50 w-60 rounded-lg border border-gray-200 bg-white shadow-lg text-sm text-gray-800"
          style={{ top: addFieldAnchor.top, left: addFieldAnchor.left }}
        >
          <div className="px-3 py-2 border-b text-gray-700 font-medium">
            New {pendingFieldType === "NUMBER" ? "number" : "text"} field
          </div>
          <div className="px-3 py-2 space-y-2">
            <label className="block text-xs text-gray-600">
              Field name (optional)
              <input
                ref={addFieldNameInputRef}
                type="text"
                value={pendingFieldName}
                onChange={(e) => setPendingFieldName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-800"
                placeholder={`Field ${localFields.length + 1}`}
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setPendingFieldType(null);
                  setPendingFieldName("");
                  setAddFieldMenuOpen(false);
                  setAddFieldAnchor(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  addColumn(pendingFieldType, pendingFieldName);
                  setPendingFieldType(null);
                  setPendingFieldName("");
                  setAddFieldAnchor(null);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingFieldId && renameAnchor && (
        <div
          data-rename-field="true"
          className="fixed z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg text-sm text-gray-800"
          style={{ top: renameAnchor.top, left: renameAnchor.left }}
        >
          <div className="px-3 py-2 border-b text-gray-700 font-medium">Rename field</div>
          <div className="px-3 py-2 space-y-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename(renamingFieldId, renamingValue);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenamingFieldId(null);
                  setRenamingValue("");
                  setRenameAnchor(null);
                }
              }}
              onBlur={() => commitRename(renamingFieldId, renamingValue)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-gray-800"
              placeholder="Field name"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setRenamingFieldId(null);
                  setRenamingValue("");
                  setRenameAnchor(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => commitRename(renamingFieldId, renamingValue)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 w-72 max-h-[80vh] overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm text-gray-800"
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
