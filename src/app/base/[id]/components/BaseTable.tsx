 "use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type PartialKeys,
  type VirtualizerOptions,
} from "@tanstack/virtual-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { FiChevronDown, FiCircle, FiPaperclip, FiPlus, FiType, FiUser } from "react-icons/fi";
import type React from "react";

type FieldType = "TEXT" | "NUMBER" | "BOOLEAN";

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
  valueBoolean: boolean | null;
};

type RecordShape = {
  id: string;
  cells: CellShape[];
};

type ColumnValue = string | number | boolean | null | undefined;
type RowData = Record<string, ColumnValue> & { __recordId: string; __rowIndex: number };

const displayValue = (value: ColumnValue) => {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
};
const VIRTUAL_ROW_HEIGHT = 32;
const VIRTUAL_OVERSCAN = 8;
const FIRST_COL_STICKY_CLASS = "left-[56px]";
const FIRST_SEPARATOR_LEFT_CLASS = "left-[236px]";
const TEXT_COL_CLASS = "w-[180px] min-w-[180px]";
const NUMBER_COL_CLASS = "w-[180px] min-w-[180px]";

const useIsomorphicLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

// Local wrapper to avoid React flushSync warnings when @tanstack/react-virtual requests sync updates.
function useVirtualizerWithoutFlushSync<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    "observeElementRect" | "observeElementOffset" | "scrollToFn"
  >,
): Virtualizer<TScrollElement, TItemElement> {
  const rerender = useReducer(() => ({}), {})[1];

  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
    onChange: (instance, sync) => {
      if (sync) {
        const schedule = () => rerender();
        if (typeof queueMicrotask === "function") {
          queueMicrotask(schedule);
        } else {
          void Promise.resolve().then(schedule);
        }
      } else {
        rerender();
      }
      options.onChange?.(instance, sync ?? false);
    },
  };

  const [instance] = useState(
    () => new Virtualizer<TScrollElement, TItemElement>(resolvedOptions),
  );

  instance.setOptions(resolvedOptions);

  useIsomorphicLayoutEffect(() => instance._didMount(), [instance]);
  useIsomorphicLayoutEffect(() => instance._willUpdate());

  return instance;
}

const readCellValue = (field: FieldShape, cell?: CellShape | null): ColumnValue => {
  if (!cell) return null;
  if (field.type === "NUMBER") return cell.valueNumber ?? null;
  if (field.type === "BOOLEAN") return cell.valueBoolean ?? null;

  return cell.valueText ?? null;
};

const normalizeValueForField = (
  rawValue: string,
  field?: FieldShape,
): string | number | null | boolean | undefined => {
  if (rawValue === "") return null;

  if (field?.type === "NUMBER") {
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (field?.type === "BOOLEAN") {
    if (rawValue === "1") return true;
    if (rawValue === "0") return false;
    return undefined;
  }

  return rawValue;
};

const valuesEqual = (
  a: string | number | boolean | null,
  b: string | number | boolean | null,
) => {
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
  onCellChange?: (recordId: string, fieldId: string, value: string | number | boolean | null) => void;
  onEditValueChange?: (
    recordId: string,
    fieldId: string,
    value: string | number | boolean | null | undefined,
  ) => void;
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
      valueBoolean: null,
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
  onEditValueChange,
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
  const dataRef = useRef<RowData[]>(data);
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
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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
      const nextData = buildRows(useFields, useRecords);
      const previousRowsByRecordId = new Map(
        dataRef.current.map((row) => [row.__recordId, row]),
      );
      const mergedData = fieldsChanged
        ? nextData.map((row) => {
            const previous = previousRowsByRecordId.get(row.__recordId);
            if (!previous) return row;
            const preserved = { ...row };
            useFields.forEach((field) => {
              if (Object.prototype.hasOwnProperty.call(previous, field.id)) {
                preserved[field.id] = previous[field.id];
              }
            });
            return preserved;
          })
        : nextData;
      setLocalFields(useFields);
      setLocalRecords(useRecords);
      setColumnOrder(useFields.map((f) => f.id));
      setData(mergedData);
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
    if (distanceFromBottom <= VIRTUAL_ROW_HEIGHT * 70) {
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
            { fieldId: newFieldId, valueText: null, valueNumber: null, valueBoolean: null },
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
    (recordId: string, fieldId: string): string | number | boolean | null => {
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
        const [editValue, setEditValue] = useState<string>(displayValue(cellValue));
        const rowIndex = row.original.__rowIndex ?? row.index;
        const colIndex = visibleColumnOrder.indexOf(key);
        const recordId = row.original.__recordId;
        const field = fieldLookup[key];
        const canonicalValue = getCanonicalValue(recordId, key);
        const isNumberField = field?.type === "NUMBER";
        const isBooleanField = field?.type === "BOOLEAN";
        const isOptimisticField = String(key).startsWith("temp-field-");
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
          const next = displayValue(cellValue);
          // Avoid overwriting the user's in-progress edit with a stale server value.
          if (isEditing && editValue !== next) return;
          setEditValue(next);
        }, [cellValue, isEditing, editValue]);

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
              className={`flex h-full w-full min-h-[24px] items-stretch rounded-[3px] border border-transparent transition-colors ${
                isActive
                  ? "border-[#1e73ff] ring-2 ring-[#1e73ff] ring-offset-0"
                  : "focus-within:border-[#1e73ff] focus-within:ring-1 focus-within:ring-[#1e73ff] focus-within:ring-offset-0"
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
                  inputMode={isBooleanField ? "numeric" : undefined}
                  pattern={isBooleanField ? "[01]" : undefined}
                  maxLength={isBooleanField ? 1 : undefined}
                  disabled={isOptimisticField}
                  className="w-full bg-transparent border-0 px-0 py-0 text-[13px] leading-[18px] text-gray-900 outline-none focus:outline-none focus:ring-0 disabled:cursor-wait disabled:text-gray-400"
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
                    if (isOptimisticField) return;
                    if (!isEditing) {
                      setEditingCell({ rowIndex, colId: String(key) });
                    }
                    const rawValue = e.target.value;
                    const nextValue = isBooleanField
                      ? rawValue === ""
                        ? ""
                        : /^[01]+$/.test(rawValue)
                          ? rawValue.at(-1)!
                          : editValue
                      : rawValue;
                    // Debug the raw input to track echoes.
                    console.log("[cell-debug/input]", {
                      recordId,
                      fieldId: key,
                      rawValue,
                      nextValue,
                      canonicalValue,
                    });
                  setEditValue(nextValue);
                    const normalizedForField = normalizeValueForField(nextValue, field);
                    onEditValueChange?.(
                      recordId,
                      key,
                      normalizedForField === undefined
                        ? nextValue === ""
                          ? null
                          : nextValue
                        : normalizedForField,
                    );
                    if (field?.type === "BOOLEAN") {
                      if (normalizedForField !== undefined && _onCellChange) {
                        _onCellChange(recordId, key, normalizedForField);
                      }
                    }
                    setData((old) => {
                      const copy = [...old];
                      const current = copy[rowIndex];
                      if (!current) return old;
                      copy[rowIndex] = { ...current, [key]: nextValue };
                      return copy;
                    });
                    // For optimistic rows/fields, commit immediately so edits are queued before IDs swap.
                    if (recordId.startsWith("temp-") || String(key).startsWith("temp-")) {
                      if (normalizedForField !== undefined && _onCellChange) {
                        _onCellChange(recordId, key, normalizedForField);
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
              className="flex items-center gap-1.5"
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
              <span className="text-[11px] text-[#98a2b3]">{letter}</span>
              {icon}
              <span className="truncate font-medium text-[#111827]">{headerName}</span>
            </div>
          ),
          cell: makeEditableCell(key),
        };
      },
    );

    const rowNumberCol: ColumnDef<RowData, ColumnValue> = {
      id: "rowNumber",
      header: () => (
        <div className="flex h-full items-center justify-center pl-2">
          <div className="h-3.5 w-3.5 rounded-[4px] border border-[#cdd3de] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />
        </div>
      ),
      cell: ({ row }) => {
        const recordId = row.original.__recordId;
        const absoluteIndex = row.original.__rowIndex ?? row.index;
        const isSelected = selectedRowsRef.current.has(recordId);
        const isActiveRow = activeCellRef.current?.rowIndex === absoluteIndex;
        const showCheckbox = hoveredRowRef.current === absoluteIndex || isSelected || isActiveRow;
        return (
          <div className="flex items-center justify-center text-[12px] text-[#667085]">
            {showCheckbox ? (
              <input
                type="checkbox"
                className="rounded border-[#d9dde8] accent-[#2f6fed] cursor-pointer"
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
                  setSelectedRows((prev) => {
                    if (prev.has(recordId)) return prev;
                    const next = new Set(prev);
                    next.add(recordId);
                    return next;
                  });
                  openContextMenu(e.clientX, e.clientY, recordId);
                }}
              />
            ) : (
              (absoluteIndex ?? 0) + 1
            )}
          </div>
        );
      },
      size: 54,
    };

    const addFieldCol: ColumnDef<RowData, ColumnValue> = {
      id: "addField",
      header: () => (
        <div className="flex h-8 items-center justify-center px-1.5">
          <button
            ref={addFieldButtonRef}
            onClick={() => {
              const anchor = computeAddFieldAnchor({ height: 180, width: 180 });
              if (anchor) setAddFieldAnchor(anchor);
              setPendingFieldType(null);
              setPendingFieldName("");
              setAddFieldMenuOpen((p) => !p);
            }}
            className="flex h-6 w-10 items-center justify-center bg-white text-[#667085] hover:bg-[#f2f4f8]"
            aria-label="Add column"
            type="button"
          >
            <FiPlus className="h-5 w-5" />
          </button>
        </div>
      ),
      cell: () => null,
      size: 44,
      enableSorting: false,
    };

    return [rowNumberCol, ...cols, addFieldCol];
  }, [
    visibleColumnOrder,
    fieldLookup,
    _onCellChange,
    onEditValueChange,
    getCanonicalValue,
    updateActiveCell,
    handleCellNavigation,
    _onActiveCellIndexChange,
    computeAddFieldAnchor,
    openContextMenu,
    data.length,
  ]);


  const rowVirtualizer = useVirtualizerWithoutFlushSync({
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
  //   console.log('Virtualization Status:', {
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
    if (isRowNumber || isAddField) return "w-[56px] min-w-[56px] text-center";
    const field = fieldLookup[columnId];
    const isNumber = field?.type?.toString().toUpperCase() === "NUMBER";
    return isNumber ? NUMBER_COL_CLASS : TEXT_COL_CLASS;
  };

  const firstDataColumnId = visibleColumnOrder[0];
  const stickyClass = (columnId: string, isHeader = false) => {
    if (columnId === "rowNumber") {
      return `${isHeader ? "sticky left-0 z-30" : "sticky left-0 z-10"} bg-inherit`;
    }
    if (firstDataColumnId && columnId === firstDataColumnId) {
      return `${isHeader ? `sticky ${FIRST_COL_STICKY_CLASS} z-20` : `sticky ${FIRST_COL_STICKY_CLASS} z-[5]`} bg-inherit`;
    }
    return "";
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

  const formatNumber = useCallback((n: number) => n.toLocaleString(), []);
  const totalLabel = totalCount ? formatNumber(totalCount) : null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" ref={tableWrapperRef}>
      {/* ACTUAL TABLE */}
      <div
        className="relative flex-1 overflow-auto bg-[#f9fafc]"
        ref={scrollContainerRef}
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          scrollPositionRef.current = scrollTop;
          lastScrollTopRef.current = scrollTop;
          maybeLoadMore();
        }}
      >
        <div className={`pointer-events-none absolute top-0 bottom-0 ${FIRST_SEPARATOR_LEFT_CLASS} w-px bg-[#e6e8ef] z-0`} />
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-white z-0" />
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#cfd4de] border-t-[#1b6ef3]" />
          </div>
        )}
        <table className="table-fixed border-separate border-spacing-0 text-[13px] w-max">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-white hover:bg-[#f8fafc]">
                {headerGroup.headers.map((header) => {
                  const headerHover =
                    hoveredHeader === header.id ? "bg-[#eef2f7]" : "";
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
                      className={`relative h-8 border-b ${header.id === "rowNumber" ? "" : "border-r"} border-[#e6e8ef] text-left text-[12px] font-medium text-[#475467] ${widthClass(header.id)} ${stickyClass(header.id, true)} bg-white hover:bg-[#f8fafc] ${headerHover} ${headerHighlight}`}
                      onMouseEnter={() => setHoveredHeader(header.id)}
                      onMouseLeave={() => {
                        setHoveredHeader(null);
                        if (headerMenu !== header.id) return;
                      }}
                    >
                      <div className="flex h-8 items-center justify-between px-2">
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
                          className="absolute z-30 mt-1 w-56 rounded-lg border border-[#e6e8ef] bg-white shadow-xl text-gray-700"
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
              const isActiveRow = activeCell?.rowIndex === absoluteIndex;
              return (
                <tr
                  key={row.id}
                  className={rowHovered || isActiveRow ? "bg-[#f8fafc]" : "bg-white"}
                  onMouseEnter={() => setHoveredRow(absoluteIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedRows((prev) => {
                      if (prev.has(recordId)) return prev;
                      const next = new Set(prev);
                      next.add(recordId);
                      return next;
                    });
                    openContextMenu(e.clientX, e.clientY, recordId);
                  }}
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
                              : isActiveRow
                                ? "bg-[#f8fafc]"
                                : "hover:bg-[#f8fafc]";
                    return (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === "addField"
                            ? `${widthClass(cell.column.id)} ${stickyClass(cell.column.id)} bg-[#f9fafc] p-0 border-0`
                            : `border-b ${cell.column.id === "rowNumber" ? "" : "border-r"} border-[#e6e8ef] align-middle ${widthClass(cell.column.id)} ${stickyClass(cell.column.id)}`
                        }
                      >
                        {cell.column.id === "addField" ? null : (
                          <div className={`h-full ${highlightClass}`}>
                            <div className="px-2 py-1 text-[13px]">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td colSpan={table.getVisibleLeafColumns().length} className="p-0 border-0 bg-[#f9fafc]">
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
                  className={
                    column.id === "addField"
                      ? `${widthClass(column.id)} ${stickyClass(column.id)} bg-[#f9fafc] p-0 border-0`
                      : `border-b ${column.id === "rowNumber" ? "" : "border-r"} border-[#e6e8ef] align-middle ${widthClass(column.id)} ${stickyClass(column.id)}`
                  }
                >
                  {column.id === "rowNumber" ? (
                    <div className="flex h-8 items-center justify-center text-[13px]">
                      <button
                        onClick={addRow}
                        className="flex h-7 w-7 items-center justify-center bg-white text-[#667085] hover:bg-[#f2f4f8]"
                        aria-label="Add row"
                        type="button"
                        data-add-field-name="false"
                        data-add-field-menu="false"
                      >
                        <FiPlus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : column.id === "addField" ? null : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        className="sticky bottom-0 left-0 right-0 z-20 flex h-9 items-center justify-between border-t border-[#e6e8ef] bg-white px-4 text-[12px] text-[#667085]"
      >
        <div>
          {totalLabel ? `${totalLabel} records` : "0 record"}
        </div>
      </div>

      {addFieldMenuOpen && addFieldAnchor && (
        <div
          data-add-field-menu="true"
          className="fixed z-40 w-40 rounded-lg border border-[#e6e8ef] bg-white shadow-lg text-sm text-gray-800"
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
          <button
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-gray-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAddFieldMenuOpen(false);
              const anchor = computeAddFieldAnchor({ height: 180, width: 180 });
              if (anchor) setAddFieldAnchor(anchor);
              setPendingFieldType("BOOLEAN");
              setPendingFieldName("");
            }}
          >
            Boolean
          </button>
        </div>
      )}

      {pendingFieldType && addFieldAnchor && (
        <div
          data-add-field-name="true"
              className="fixed z-50 w-60 rounded-lg border border-[#e6e8ef] bg-white shadow-lg text-sm text-gray-800"
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
                className="mt-1 w-full rounded border border-[#d9dde8] px-2 py-1 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
                placeholder={`Field ${localFields.length + 1}`}
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-1 rounded border border-[#d9dde8] text-gray-700 hover:bg-gray-50"
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
          className="fixed z-50 w-72 rounded-lg border border-[#e6e8ef] bg-white shadow-lg text-sm text-gray-800"
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
              className="w-full rounded border border-[#d9dde8] px-2 py-2 text-gray-800 focus:border-[#2557e0] focus:outline-none focus:ring-2 focus:ring-[#2557e0]/20"
              placeholder="Field name"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border border-[#d9dde8] text-gray-700 hover:bg-gray-50"
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
          className="fixed z-50 w-72 max-h-[80vh] overflow-auto rounded-lg border border-[#e6e8ef] bg-white shadow-lg text-sm text-gray-800"
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
