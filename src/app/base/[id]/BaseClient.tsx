"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";
import type { Condition as FilterCondition, SortItem, SortState } from "./components/TableToolbar";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { defaultViewConfig } from "~/server/viewConfig";
import { ChevronDown } from "lucide-react";

type TableById = RouterOutputs["table"]["byId"];
type TableField = TableById["fields"][number];
type TableRecord = TableById["records"][number];
type TableCell = TableRecord["cells"][number];
type RecordsPage = RouterOutputs["table"]["records"];
type CellValue = string | number | boolean | null;
type PendingCellEdit = {
  recordId: string;
  fieldId: string;
  value: CellValue;
};
type CellUpdateQueueEntry = {
  pending: CellValue;
  inFlight: boolean;
};

const makeEmptyCell = (recordId: string, fieldId: string): TableCell => ({
  id: `temp-cell-${recordId}-${fieldId}`,
  recordId,
  fieldId,
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
});
const buildOptimisticCell = (
  recordId: string,
  fieldId: string,
  value: CellValue,
): TableCell => ({
  id: `temp-cell-${recordId}-${fieldId}`,
  recordId,
  fieldId,
  valueText: typeof value === "string" ? value : null,
  valueNumber: typeof value === "number" ? value : null,
  valueBoolean: typeof value === "boolean" ? value : null,
});

const OPTIMISTIC_FIELD_PREFIX = "temp-field-";
const makePendingKey = (recordId: string, fieldId: string) => `${recordId}:${fieldId}`;
const isOptimisticRecordId = (id: string) => id.startsWith("temp-record-");
const isOptimisticFieldId = (id: string) => id.startsWith(OPTIMISTIC_FIELD_PREFIX);

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

type PersistedState = {
  tableId?: string;
  viewByTable?: Record<string, string>;
};

const buildStorageKey = (baseId: string) => `airtable:last-state:${baseId}`;
const buildPendingEditsStorageKey = (tableId: string) => `airtable:pending-edits:${tableId}`;

const normalizeAndSortViews = <T extends { id: string; order?: number }>(views: T[]) =>
  [...views]
    .map((view, idx) => ({ ...view, order: view.order ?? idx }))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || (a.id ?? "").localeCompare(b.id ?? ""),
    );

const serializeFilters = (f: { connector: "and" | "or"; conditions: FilterCondition[] }) =>
  JSON.stringify({
    connector: f.connector,
    conditions: f.conditions.map((c) => ({
      fieldId: c.fieldId,
      operator: c.operator,
      value: c.value ?? "",
    })),
  });

function BaseClientContent({
  baseId,
  baseName,
  tables,
  user,
  loading = false,
}: BaseClientProps) {
  // Server already ensured auth; rely on provided user to gate queries client-side.
  const isAuthed = Boolean(user?.id);
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";
  const [tablesState, setTablesState] = useState<Table[]>(tables ?? []);
  const [activeTableId, setActiveTableId] = useState(
    tables[0]?.id ?? baseId,
  );
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const isOptimisticTableId = activeTableId?.startsWith("temp-table-") ?? false;
  const storageKey = useMemo(() => buildStorageKey(baseId), [baseId]);
  const hasHydratedRef = useRef(false);
  const persistedViewMapRef = useRef<Record<string, string>>({});
  const pendingCellEditsRef = useRef<Map<string, PendingCellEdit>>(new Map());
  const cellUpdateQueuesRef = useRef<Map<string, CellUpdateQueueEntry>>(new Map());
  const lastLocalCellValueRef = useRef<Map<string, CellValue>>(new Map());
  const optimisticRecordIdMapRef = useRef<Map<string, string>>(new Map());
  const optimisticFieldIdMapRef = useRef<Map<string, string>>(new Map());
  const initialPrefetchingRef = useRef(false);
  const shouldRefetchRecordsRef = useRef(true);
  const lastSearchByViewRef = useRef<Record<string, string>>({});
  const lastFiltersByViewRef = useRef<Record<string, string>>({});
  const lastHiddenByViewRef = useRef<Record<string, string>>({});
  const lastSortsByViewRef = useRef<Record<string, string>>({});
  const dirtyCellKeysRef = useRef<Set<string>>(new Set());
  const pendingEditPersistHandleRef = useRef<number | null>(null);
  const hydratedPendingEditsRef = useRef<Set<string>>(new Set());
  const hiddenPersistHandleRef = useRef<number | null>(null);
  const sortPersistHandleRef = useRef<number | null>(null);
  const forceHydrateViewRef = useRef(false);
  const lastActiveViewIdRef = useRef<string | null>(null);
  const [viewSidebarPinned, setViewSidebarPinned] = useState(true);
  const [viewSidebarHoverOpen, setViewSidebarHoverOpen] = useState(false);

  const serializeHidden = useCallback((ids: string[]) => JSON.stringify(ids ?? []), []);
  const serializeSorts = useCallback((items: SortItem[]) => JSON.stringify(items ?? []), []);

  const viewSidebarOpen = viewSidebarPinned || viewSidebarHoverOpen;

  const logPendingState = useCallback(
    (_event: string, _payload: Record<string, unknown> = {}) => {
      void _event;
      void _payload;
    },
    [],
  );

  const logQueueSnapshot = useCallback(
    (event: string) => {
      const sampleQueue = Array.from(cellUpdateQueuesRef.current.entries())
        .slice(0, 5)
        .map(([key, value]) => ({
          key,
          pending: value.pending,
          inFlight: value.inFlight,
        }));
      const sampleEdits = Array.from(pendingCellEditsRef.current.values())
        .slice(0, 5)
        .map((edit) => ({
          recordId: edit.recordId,
          fieldId: edit.fieldId,
          value: edit.value,
        }));
      logPendingState(event, { sampleQueue, sampleEdits });
    },
    [logPendingState],
  );

  const normalizeLocalValue = useCallback(
    (val: CellValue | undefined) =>
      val === null || val === undefined
        ? null
        : typeof val === "number" || typeof val === "boolean"
          ? val
          : String(val),
    [],
  );

  const persistLocalEditsToStorage = useCallback((tableId?: string) => {
    if (typeof window === "undefined") return;
    const targetTableId = tableId ?? activeTableId;
    if (!targetTableId) return;
    const storageKey = buildPendingEditsStorageKey(targetTableId);
    const payload: { recordId: string; fieldId: string; value: CellValue }[] = [];
    dirtyCellKeysRef.current.forEach((key) => {
      const [recordId, fieldId] = key.split(":");
      if (!recordId || !fieldId) return;
      if (isOptimisticRecordId(recordId) || isOptimisticFieldId(fieldId)) {
        // Optimistic IDs can't be restored after a hard refresh because the mapping is lost.
        dirtyCellKeysRef.current.delete(key);
        return;
      }
      payload.push({
        recordId,
        fieldId,
        value: normalizeLocalValue(lastLocalCellValueRef.current.get(key)),
      });
    });
    try {
      if (payload.length === 0) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors (e.g., disabled storage or quota).
    }
  }, [activeTableId, normalizeLocalValue]);

  const schedulePersistLocalEdits = useCallback(() => {
    const targetTableId = activeTableId;
    if (pendingEditPersistHandleRef.current) {
      window.clearTimeout(pendingEditPersistHandleRef.current);
    }
    pendingEditPersistHandleRef.current = window.setTimeout(() => {
      pendingEditPersistHandleRef.current = null;
      persistLocalEditsToStorage(targetTableId);
    }, 120);
  }, [activeTableId, persistLocalEditsToStorage]);

  const utils = api.useUtils();
  const tableQuery = api.table.byId.useQuery(
    { id: activeTableId },
    {
      enabled: isAuthed && !!Boolean(activeTableId) && !loading && !isOptimisticTableId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60 * 1000,
    },
  );
  const viewListQuery = api.view.list.useQuery(
    { tableId: activeTableId },
    {
      enabled: isAuthed && !!Boolean(activeTableId) && !loading && !isOptimisticTableId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000,
    },
  );
  const createView = api.view.create.useMutation({
    onSuccess: (view) => {
      setActiveViewId(view.id);
      utils.view.list.setData({ tableId: view.tableId }, (prev) =>
        normalizeAndSortViews(prev ? [...prev, view] : [view]),
      );
      if (recordsQueryInput) {
        void utils.table.records.invalidate(recordsQueryInput);
      }
    },
  });
  const updateView = api.view.update.useMutation({
    onMutate: () => ({ shouldRefetchRecords: shouldRefetchRecordsRef.current }),
    onSuccess: (view, _variables, context) => {
      if (viewListQuery.data && activeTableId) {
        utils.view.list.setData({ tableId: activeTableId }, (prev) =>
          prev?.map((v) => (v.id === view.id ? { ...v, ...view } : v)) ?? prev,
        );
      }
      if (context?.shouldRefetchRecords && recordsQueryInput) {
        void utils.table.records.invalidate(recordsQueryInput);
      }
    },
    onSettled: () => {
      shouldRefetchRecordsRef.current = true;
    },
  });
  const deleteView = api.view.delete.useMutation({
    onSuccess: ({ viewId, tableId }) => {
      utils.view.list.setData({ tableId }, (prev) =>
        prev?.filter((v) => v.id !== viewId),
      );
      if (activeViewId === viewId) {
        const remaining = viewListQuery.data?.filter((v) => v.id !== viewId) ?? [];
        setActiveViewId(remaining[0]?.id ?? null);
      }
      if (recordsQueryInput) {
        void utils.table.records.invalidate(recordsQueryInput);
      }
    },
  });
  const reorderViews = api.view.reorder.useMutation({
    onMutate: async ({ tableId, orderedIds }) => {
      await utils.view.list.cancel({ tableId });
      const previous = utils.view.list.getData({ tableId });
      if (previous) {
        const ordered = orderedIds
          .map((id) => previous.find((v) => v.id === id))
          .filter(Boolean) as typeof previous;
        if (ordered.length === previous.length) {
          utils.view.list.setData(
            { tableId },
            normalizeAndSortViews(
              ordered.map((v, idx) => ({
                ...v,
                order: idx,
              })),
            ),
          );
        }
      }
      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        utils.view.list.setData({ tableId: variables.tableId }, context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      void utils.view.list.invalidate({ tableId: variables.tableId });
    },
  });
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([]);
  const cancelledOptimisticFieldIds = useRef<Set<string>>(new Set());
  const [filters, setFilters] = useState<{ connector: "and" | "or"; conditions: FilterCondition[] }>({
    connector: "and",
    conditions: [],
  });
  const [appliedFilters, setAppliedFilters] = useState<{
    connector: "and" | "or";
    conditions: FilterCondition[];
  }>({ connector: "and", conditions: [] });
  const [sortUi, setSortUi] = useState<SortState>({ items: [], auto: true });
  const [appliedSorts, setAppliedSorts] = useState<SortItem[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const RECORD_PAGE_SIZE = 500;
  const RECORD_WINDOW_PAGE_SIZE = 300;
  const INITIAL_EAGER_RECORD_TARGET = 1_500;
  const filterDebounceHandleRef = useRef<number | null>(null);

  const buildViewConfig = useCallback(
    (overrides?: {
      filters?: { connector: "and" | "or"; conditions: FilterCondition[] };
      sorts?: SortItem[];
      search?: string;
      hiddenFieldIds?: string[];
    }) => {
      const nextFilters = overrides?.filters ?? filters;
      const nextSorts = overrides?.sorts ?? appliedSorts;
      const nextSearch = overrides?.search ?? globalSearch;
      const nextHidden = overrides?.hiddenFieldIds ?? hiddenFieldIds;

      return {
        filters: {
          connector: nextFilters.connector,
          conditions: nextFilters.conditions.map((c) => ({
            fieldId: c.fieldId,
            operator: c.operator,
            value: c.value ?? "",
          })),
        },
        sorts: nextSorts.map((s) => ({ fieldId: s.fieldId, direction: s.direction })),
        search: nextSearch,
        hiddenFieldIds: nextHidden,
      };
    },
    [appliedSorts, filters, globalSearch, hiddenFieldIds],
  );

  const buildQueryViewConfig = useCallback(() => {
    const trimmedSearch = globalSearch.trim();
    return {
      filters: {
        connector: appliedFilters.connector,
        conditions: appliedFilters.conditions.map((c) => ({
          fieldId: c.fieldId,
          operator: c.operator,
          value: c.value ?? "",
        })),
      },
      sorts: appliedSorts.map((s) => ({ fieldId: s.fieldId, direction: s.direction })),
      search: trimmedSearch,
      hiddenFieldIds,
    };
  }, [appliedFilters, appliedSorts, globalSearch, hiddenFieldIds]);

  const queryViewConfig = useMemo(() => buildQueryViewConfig(), [buildQueryViewConfig]);
  const [recordsWindow, setRecordsWindow] = useState<{
    offset: number;
    records: RecordsPage["records"];
  } | null>(null);
  const [isFetchingRecordsWindow, setIsFetchingRecordsWindow] = useState(false);
  const recordsWindowRef = useRef<typeof recordsWindow>(null);
  const inFlightRecordWindowOffsetRef = useRef<number | null>(null);
  const queuedRecordWindowOffsetRef = useRef<number | null>(null);
  const emptyRecordWindowOffsetsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    recordsWindowRef.current = recordsWindow;
  }, [recordsWindow]);

  const recordsQueryInput = useMemo(() => {
    if (!activeTableId || isOptimisticTableId) return null;
    return {
      tableId: activeTableId,
      limit: RECORD_PAGE_SIZE,
      viewId: activeViewId ?? undefined,
      viewConfig: queryViewConfig,
      globalSearch: queryViewConfig.search,
    };
  }, [RECORD_PAGE_SIZE, activeTableId, activeViewId, isOptimisticTableId, queryViewConfig]);

  useEffect(() => {
    setRecordsWindow(null);
    recordsWindowRef.current = null;
    inFlightRecordWindowOffsetRef.current = null;
    queuedRecordWindowOffsetRef.current = null;
    emptyRecordWindowOffsetsRef.current.clear();
    setIsFetchingRecordsWindow(false);
  }, [recordsQueryInput]);

  const activeView = useMemo(
    () => viewListQuery.data?.find((v) => v.id === activeViewId),
    [activeViewId, viewListQuery.data],
  );

  const duplicateView = useCallback(
    (sourceId: string) => {
      if (!activeTableId || createView.isPending) return;
      const source = viewListQuery.data?.find((v) => v.id === sourceId);
      if (!source) return;
      createView.mutate({
        tableId: activeTableId,
        name: `${source.name} copy`,
        config: source.config ?? defaultViewConfig,
      });
    },
    [activeTableId, createView, viewListQuery.data],
  );

  const toggleViewSidebarPinned = useCallback(() => {
    setViewSidebarPinned((prev) => {
      const next = !prev;
      if (!next) {
        setViewSidebarHoverOpen(false);
      }
      return next;
    });
  }, []);

  const handleViewSidebarHoverChange = useCallback(
    (isHovering: boolean) => {
      if (viewSidebarPinned) return;
      setViewSidebarHoverOpen(isHovering);
    },
    [viewSidebarPinned],
  );

  useEffect(() => {
    if (hasHydratedRef.current) return;
    if (typeof window === "undefined") return;

    hasHydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      persistedViewMapRef.current = parsed.viewByTable ?? {};

      const storedTableId = parsed.tableId;
      if (storedTableId && tablesState.some((t) => t.id === storedTableId)) {
        setActiveTableId(storedTableId);
        const storedViewId = parsed.viewByTable?.[storedTableId];
        if (storedViewId) {
          setActiveViewId(storedViewId);
        }
      }
    } catch {
      // If parsing fails, ignore and continue with defaults.
    }
  }, [storageKey, tablesState]);

  useEffect(() => {
    setFilters({ connector: "and", conditions: [] });
    setAppliedFilters({ connector: "and", conditions: [] });
    setSortUi({ items: [], auto: true });
    setAppliedSorts([]);
    setGlobalSearch("");
    setHiddenFieldIds([]);
    setActiveViewId(null);
    forceHydrateViewRef.current = true;
  }, [activeTableId]);

  useEffect(() => {
    if (!activeViewId) return;
    if (lastActiveViewIdRef.current === activeViewId) return;
    lastActiveViewIdRef.current = activeViewId;
    forceHydrateViewRef.current = true;
  }, [activeViewId]);

  useEffect(() => {
    const storedViewId = persistedViewMapRef.current[activeTableId];
    if (storedViewId) {
      setActiveViewId(storedViewId);
    }
  }, [activeTableId]);

  useEffect(() => {
    if (!activeTableId || viewListQuery.isLoading) return;
    const views = viewListQuery.data ?? [];
    const storedViewId = persistedViewMapRef.current[activeTableId];
    const storedExists = storedViewId ? views.some((v) => v.id === storedViewId) : false;
    const hasActive = activeViewId ? views.some((v) => v.id === activeViewId) : false;
    const nextStoredViewId = storedExists ? storedViewId : null;

    if (!hasActive) {
      if (nextStoredViewId) {
        setActiveViewId(nextStoredViewId);
        return;
      }
      setActiveViewId(views[0]?.id ?? null);
    }
  }, [
    activeTableId,
    activeViewId,
    viewListQuery.data,
    viewListQuery.isLoading,
  ]);

  useEffect(() => {
    if (!activeView) return;
    const shouldForceHydrate = forceHydrateViewRef.current;
    const cfg = activeView.config ?? defaultViewConfig;

    const nextFilters = {
      connector: cfg.filters.connector,
      conditions: cfg.filters.conditions.map((c, idx) => ({
        id: `${c.fieldId}-${idx}`,
        fieldId: c.fieldId,
        operator: c.operator,
        value: c.value ?? "",
      })),
    };

    const nextSorts: SortItem[] = cfg.sorts.map((s, idx) => ({
      id: `${s.fieldId}-${idx}`,
      fieldId: s.fieldId,
      direction: s.direction,
    }));

    const serializedNextFilters = serializeFilters(nextFilters);
    const serializedLocalFilters = serializeFilters(filters);
    const lastLocalFilters = lastFiltersByViewRef.current[activeView.id];
    const hasNewerLocalFilters =
      lastLocalFilters !== undefined &&
      lastLocalFilters === serializedNextFilters &&
      serializedNextFilters !== serializedLocalFilters;
    const isStaleServerFilters =
      lastLocalFilters !== undefined && lastLocalFilters !== serializedNextFilters;

    if (shouldForceHydrate || (!hasNewerLocalFilters && !isStaleServerFilters)) {
      setFilters((prev) => {
        const prevSerialized = serializeFilters(prev);
        if (prevSerialized === serializedNextFilters) return prev;
        lastFiltersByViewRef.current[activeView.id] = serializedNextFilters;
        return nextFilters;
      });
      setAppliedFilters((prev) => {
        const prevSerialized = serializeFilters(prev);
        if (prevSerialized === serializedNextFilters) return prev;
        return {
          connector: nextFilters.connector,
          conditions: nextFilters.conditions.map((c) => ({ ...c })),
        };
      });
    }

    const serializedNextSorts = serializeSorts(nextSorts);
    const serializedLocalSorts = serializeSorts(appliedSorts);
    const lastLocalSorts = lastSortsByViewRef.current[activeView.id];
    const hasNewerLocalSorts =
      lastLocalSorts !== undefined &&
      lastLocalSorts === serializedNextSorts &&
      serializedNextSorts !== serializedLocalSorts;
    const isStaleServerSorts = lastLocalSorts !== undefined && lastLocalSorts !== serializedNextSorts;

    if (shouldForceHydrate || (!hasNewerLocalSorts && !isStaleServerSorts)) {
      setSortUi((prev) => {
        const nextAuto = prev.auto ?? true;
        const next = { ...prev, items: nextSorts, auto: nextAuto };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setAppliedSorts((prev) => (JSON.stringify(prev) === JSON.stringify(nextSorts) ? prev : nextSorts));
      lastSortsByViewRef.current[activeView.id] = serializedNextSorts;
    }
    const nextSearch = cfg.search ?? "";
    const lastLocalSearch = lastSearchByViewRef.current[activeView.id];
    const isServerEchoOfLocal = lastLocalSearch !== undefined && lastLocalSearch === nextSearch;
    const hasNewerLocalValue = isServerEchoOfLocal && nextSearch !== globalSearch;
    const isStaleServerSearch = lastLocalSearch !== undefined && lastLocalSearch !== nextSearch;

    if (shouldForceHydrate || (!hasNewerLocalValue && !isStaleServerSearch)) {
      setGlobalSearch((prev) => {
        lastSearchByViewRef.current[activeView.id] = nextSearch;
        return prev === nextSearch ? prev : nextSearch;
      });
    }
    const serializedNextHidden = serializeHidden(cfg.hiddenFieldIds ?? []);
    const lastLocalHidden = lastHiddenByViewRef.current[activeView.id];
    const currentSerializedHidden = serializeHidden(hiddenFieldIds);
    const shouldApplyHidden =
      shouldForceHydrate ||
      !lastLocalHidden ||
      lastLocalHidden === serializedNextHidden;

    if (shouldApplyHidden && currentSerializedHidden !== serializedNextHidden) {
      setHiddenFieldIds(cfg.hiddenFieldIds ?? []);
      lastHiddenByViewRef.current[activeView.id] = serializedNextHidden;
    }
    if (shouldForceHydrate) {
      forceHydrateViewRef.current = false;
    }
  }, [activeView, appliedSorts, filters, globalSearch, hiddenFieldIds, serializeHidden, serializeSorts]);

  useEffect(() => {
    return () => {
      if (filterDebounceHandleRef.current) {
        window.clearTimeout(filterDebounceHandleRef.current);
      }
      if (hiddenPersistHandleRef.current) {
        window.clearTimeout(hiddenPersistHandleRef.current);
      }
      if (sortPersistHandleRef.current) {
        window.clearTimeout(sortPersistHandleRef.current);
      }
      if (pendingEditPersistHandleRef.current) {
        window.clearTimeout(pendingEditPersistHandleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTableId) return;

    const hasActiveView = viewListQuery.data?.some((v) => v.id === activeViewId) ?? false;
    const nextViewByTable = hasActiveView && activeViewId
      ? { ...persistedViewMapRef.current, [activeTableId]: activeViewId }
      : persistedViewMapRef.current;

    persistedViewMapRef.current = nextViewByTable;

    if (typeof window === "undefined") return;
    const payload: PersistedState = {
      tableId: activeTableId,
      viewByTable: nextViewByTable,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors (e.g., quota exceeded or disabled storage).
    }
  }, [activeTableId, activeViewId, storageKey, viewListQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      persistLocalEditsToStorage();
      if (pendingCellEditsRef.current.size || cellUpdateQueuesRef.current.size) {
        logQueueSnapshot("beforeunload-with-pending");
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [logQueueSnapshot, persistLocalEditsToStorage]);

  const persistViewConfig = useCallback(
    (overrides?: {
      filters?: { connector: "and" | "or"; conditions: FilterCondition[] };
      sorts?: SortItem[];
      search?: string;
      hiddenFieldIds?: string[];
    }, options?: { skipRecordRefresh?: boolean }) => {
      if (!activeViewId) return;
      if (forceHydrateViewRef.current) return;
      const nextConfig = buildViewConfig(overrides);
      if (overrides?.filters) {
        lastFiltersByViewRef.current[activeViewId] = serializeFilters(overrides.filters);
      }
      if (overrides?.sorts) {
        lastSortsByViewRef.current[activeViewId] = serializeSorts(overrides.sorts);
      }
      if (overrides?.hiddenFieldIds) {
        lastHiddenByViewRef.current[activeViewId] = serializeHidden(overrides.hiddenFieldIds);
      }
      shouldRefetchRecordsRef.current = !(options?.skipRecordRefresh ?? false);
      updateView.mutate({ viewId: activeViewId, config: nextConfig });
    },
    [activeViewId, buildViewConfig, serializeHidden, serializeSorts, updateView],
  );

  const schedulePersistHidden = useCallback(
    (nextHidden: string[]) => {
      if (!activeViewId) return;
      if (hiddenPersistHandleRef.current) {
        window.clearTimeout(hiddenPersistHandleRef.current);
      }
      const serialized = serializeHidden(nextHidden);
      lastHiddenByViewRef.current[activeViewId] = serialized;
      hiddenPersistHandleRef.current = window.setTimeout(() => {
        persistViewConfig({ hiddenFieldIds: nextHidden }, { skipRecordRefresh: true });
        hiddenPersistHandleRef.current = null;
      }, 180);
    },
    [activeViewId, persistViewConfig, serializeHidden],
  );

  const schedulePersistSorts = useCallback(
    (nextSorts: SortItem[]) => {
      if (!activeViewId) return;
      if (sortPersistHandleRef.current) {
        window.clearTimeout(sortPersistHandleRef.current);
      }
      const serialized = serializeSorts(nextSorts);
      lastSortsByViewRef.current[activeViewId] = serialized;
      sortPersistHandleRef.current = window.setTimeout(() => {
        persistViewConfig({ sorts: nextSorts }, { skipRecordRefresh: true });
        sortPersistHandleRef.current = null;
      }, 180);
    },
    [activeViewId, persistViewConfig, serializeSorts],
  );

  useEffect(() => {
    if (!activeViewId) return;
    if (forceHydrateViewRef.current) return;
    const next = globalSearch;
    const last = lastSearchByViewRef.current[activeViewId];
    if (last === next) return;
    const handle = window.setTimeout(() => {
      lastSearchByViewRef.current[activeViewId] = next;
      persistViewConfig({ search: next }, { skipRecordRefresh: true });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [activeViewId, globalSearch, persistViewConfig]);

  const recordsQuery = api.table.records.useInfiniteQuery(
    recordsQueryInput ?? {
      tableId: "__inactive__",
      limit: RECORD_PAGE_SIZE,
      viewConfig: queryViewConfig,
    },
    {
      enabled:
        Boolean(recordsQueryInput) &&
        isAuthed &&
        !loading,
      getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      staleTime: 0,
    },
  );

  const records = useMemo(
    () => {
      const allRecords = recordsQuery.data?.pages.flatMap((p) => p.records) ?? [];
      return allRecords;
    },
    [recordsQuery.data?.pages]
  );
  const displayRecords = recordsWindow?.records ?? records;
  const displayRecordsStartIndex = recordsWindow?.offset ?? 0;
  const getCachedCellValue = useCallback(
    (recordId: string, fieldId: string) => {
      const pages = recordsQuery.data?.pages;
      if (!pages) return undefined;
      for (const page of pages) {
        const record = page.records.find((r) => r.id === recordId);
        if (!record) continue;
        const cell = record.cells.find((c) => c.fieldId === fieldId);
        if (!cell) return null;
        return normalizeLocalValue(cell.valueBoolean ?? cell.valueNumber ?? cell.valueText);
      }
      return undefined;
    },
    [normalizeLocalValue, recordsQuery.data?.pages],
  );
  const baseTotalCount = recordsQuery.data?.pages[0]?.total;
  const [totalDelta, setTotalDelta] = useState(0);
  useEffect(() => {
    setTotalDelta(0);
  }, [baseTotalCount, records.length]);
  const baseTotalNumber =
    baseTotalCount === undefined || baseTotalCount === null
      ? undefined
      : Number(baseTotalCount);
  const totalCountBase = Number.isFinite(baseTotalNumber) ? baseTotalNumber : records.length;
  const totalCount = Math.max(0, (totalCountBase ?? 0) + totalDelta);
  const hasMore = Boolean(recordsQuery.hasNextPage);
  const isFetchingMore = recordsQuery.isFetchingNextPage;
  const isRecordsLoading = recordsQuery.isLoading;
  const fetchNextPage = recordsQuery.fetchNextPage;

  // Eagerly pull enough pages to show ~1k rows up front, then let normal scrolling pick up the rest.
  useEffect(() => {
    if (initialPrefetchingRef.current) return;
    if (records.length >= INITIAL_EAGER_RECORD_TARGET) return;
    if (!hasMore || isFetchingMore) return;
    if (!recordsQuery.data?.pages?.length) return;

    initialPrefetchingRef.current = true;
    fetchNextPage()
      .catch(() => undefined)
      .finally(() => {
        initialPrefetchingRef.current = false;
      });
  }, [
    fetchNextPage,
    hasMore,
    INITIAL_EAGER_RECORD_TARGET,
    isFetchingMore,
    records.length,
    recordsQuery.data?.pages?.length,
  ]);

  const seedRecords = api.table.seedRecords.useMutation({
    onSuccess: (result) => {
      if (recordsQueryInput) {
        void utils.table.records.invalidate(recordsQueryInput);
      } else {
        void utils.table.records.invalidate();
      }

      if (result?.inserted && activeTableId) {
        void utils.table.byId.invalidate({ id: activeTableId });
      }
    },
  });

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isFetchingMore) return;
    void fetchNextPage();
  }, [fetchNextPage, hasMore, isFetchingMore]);

  const handleRequestRecordRange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!recordsQueryInput) return;

      if (records.length && startIndex >= 0 && endIndex < records.length) {
        if (recordsWindowRef.current) {
          recordsWindowRef.current = null;
          setRecordsWindow(null);
        }
        return;
      }

      const currentWindow = recordsWindowRef.current;
      if (
        currentWindow &&
        startIndex >= currentWindow.offset &&
        endIndex < currentWindow.offset + currentWindow.records.length
      ) {
        return;
      }

      const requestedMidpoint = Math.floor((startIndex + endIndex) / 2);
      const requestedOffset = Math.max(
        0,
        Math.floor(
          (requestedMidpoint - Math.floor(RECORD_WINDOW_PAGE_SIZE / 2)) /
            RECORD_WINDOW_PAGE_SIZE,
        ) * RECORD_WINDOW_PAGE_SIZE,
      );
      if (emptyRecordWindowOffsetsRef.current.has(requestedOffset)) return;

      const fetchWindow = (offset: number) => {
        if (inFlightRecordWindowOffsetRef.current !== null) {
          if (inFlightRecordWindowOffsetRef.current !== offset) {
            queuedRecordWindowOffsetRef.current = offset;
          }
          setIsFetchingRecordsWindow(true);
          return;
        }

        inFlightRecordWindowOffsetRef.current = offset;
        setIsFetchingRecordsWindow(true);

        utils.client.table.records
          .query({
            ...recordsQueryInput,
            limit: RECORD_WINDOW_PAGE_SIZE,
            offset,
          })
          .then((page) => {
            if (page.records.length === 0) {
              emptyRecordWindowOffsetsRef.current.add(offset);
              return;
            }

            if (
              queuedRecordWindowOffsetRef.current !== null &&
              queuedRecordWindowOffsetRef.current !== offset
            ) {
              return;
            }

            const nextWindow = {
              offset: page.offset,
              records: page.records,
            };

            recordsWindowRef.current = nextWindow;
            setRecordsWindow(nextWindow);
          })
          .catch(() => undefined)
          .finally(() => {
            inFlightRecordWindowOffsetRef.current = null;
            const queuedOffset = queuedRecordWindowOffsetRef.current;
            queuedRecordWindowOffsetRef.current = null;

            if (queuedOffset !== null && queuedOffset !== offset) {
              window.setTimeout(() => fetchWindow(queuedOffset), 0);
              return;
            }

            setIsFetchingRecordsWindow(false);
          });
      };

      fetchWindow(requestedOffset);
    },
    [
      RECORD_WINDOW_PAGE_SIZE,
      records.length,
      recordsQueryInput,
      utils.client.table.records,
    ],
  );

  const createTable = api.table.create.useMutation({
    onMutate: async ({ name }) => {
      const tempId = "temp-table-" + Date.now();

      const optimistic = {
        id: tempId,
        name: name ?? "New Table",
      };

      const previous = tablesState;

      setTablesState((prev) => [...prev, optimistic]);
      setActiveTableId(tempId);

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

      const optimisticCell = buildOptimisticCell(
        variables.recordId,
        variables.fieldId,
        variables.value as CellValue,
      );
      applyCellToCache(variables.recordId, optimisticCell);

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous && recordsQueryInput) {
        utils.table.records.setInfiniteData(recordsQueryInput, context.previous);
      }
      applyCellToCache(
        variables.recordId,
        buildOptimisticCell(variables.recordId, variables.fieldId, variables.value as CellValue),
      );
    },
    onSuccess: (cell) => {
      const key = makePendingKey(cell.recordId, cell.fieldId);
      const queued = cellUpdateQueuesRef.current.get(key);
      const normalize = (val: CellValue | undefined) =>
        val === null || val === undefined
          ? null
          : typeof val === "number" || typeof val === "boolean"
            ? val
            : String(val);
      const queuedVal = normalize(queued?.pending);
      const serverVal = normalize(cell.valueBoolean ?? cell.valueNumber ?? cell.valueText);
      const desiredVal = normalize(lastLocalCellValueRef.current.get(key));

      if (queued && queuedVal !== serverVal) {
        logPendingState("server-update-skipped-stale", {
          recordId: cell.recordId,
          fieldId: cell.fieldId,
          serverVal,
          queuedVal,
        });
        return;
      }

      if (desiredVal !== null && desiredVal !== serverVal) {
        logPendingState("server-update-skipped-outdated", {
          recordId: cell.recordId,
          fieldId: cell.fieldId,
          serverVal,
          desiredVal,
        });
        return;
      }

      applyCellToCache(cell.recordId, cell);
      dirtyCellKeysRef.current.delete(key);
      schedulePersistLocalEdits();
      logPendingState("server-update-success", {
        recordId: cell.recordId,
        fieldId: cell.fieldId,
        valueText: cell.valueText,
        valueNumber: cell.valueNumber,
        valueBoolean: cell.valueBoolean,
      });
    },
  });

  const processCellUpdateQueue = useCallback(
    (recordId: string, fieldId: string) => {
      const key = makePendingKey(recordId, fieldId);
      const current = cellUpdateQueuesRef.current.get(key);
      if (!current || current.inFlight || current.pending === undefined) return;

      const valueToSend = current.pending;
      cellUpdateQueuesRef.current.set(key, { ...current, inFlight: true });
      logPendingState("cell-update-send", { recordId, fieldId, value: valueToSend });

      updateCell.mutate(
        { recordId, fieldId, value: valueToSend },
        {
          onError: (error) => {
            // Leave the pending value so it can be retried or overwritten by a newer edit.
            cellUpdateQueuesRef.current.set(key, { pending: valueToSend, inFlight: false });
            logPendingState("cell-update-error", {
              recordId,
              fieldId,
              message: error?.message,
            });
            window.setTimeout(() => processCellUpdateQueue(recordId, fieldId), 1500);
          },
          onSettled: () => {
            const next = cellUpdateQueuesRef.current.get(key);
            if (!next) return;
            const hasNewerValue = next.pending !== valueToSend;
            cellUpdateQueuesRef.current.set(key, {
              pending: hasNewerValue ? next.pending : valueToSend,
              inFlight: false,
            });
            if (hasNewerValue) {
              processCellUpdateQueue(recordId, fieldId);
            } else {
              cellUpdateQueuesRef.current.delete(key);
            }
            logPendingState("cell-update-settled", {
              recordId,
              fieldId,
              sentValue: valueToSend,
              hasNewerValue,
              remaining: cellUpdateQueuesRef.current.get(key)?.pending,
            });
          },
        },
      );
    },
    [logPendingState, updateCell],
  );

  const enqueueCellUpdate = useCallback(
    (recordId: string, fieldId: string, value: CellValue) => {
      const key = makePendingKey(recordId, fieldId);
      const current = cellUpdateQueuesRef.current.get(key);
      cellUpdateQueuesRef.current.set(key, { pending: value, inFlight: current?.inFlight ?? false });
      const normalized =
        value === null
          ? null
          : typeof value === "number" || typeof value === "boolean"
            ? value
            : String(value);
      lastLocalCellValueRef.current.set(key, normalized);
      applyCellToCache(recordId, buildOptimisticCell(recordId, fieldId, value));
      logPendingState("cell-update-queued", {
        recordId,
        fieldId,
        value,
        prevPending: current?.pending,
        inFlight: current?.inFlight ?? false,
      });
      if (!current?.inFlight) {
        processCellUpdateQueue(recordId, fieldId);
      }
    },
    [applyCellToCache, logPendingState, processCellUpdateQueue],
  );

  const handleLocalEditValue = useCallback(
    (recordId: string, fieldId: string, value: CellValue | undefined) => {
      const key = makePendingKey(recordId, fieldId);
      const normalized = normalizeLocalValue(value);
      lastLocalCellValueRef.current.set(key, normalized);
      const serverValue = getCachedCellValue(recordId, fieldId);
      if (serverValue !== undefined && serverValue === normalized) {
        dirtyCellKeysRef.current.delete(key);
      } else {
        dirtyCellKeysRef.current.add(key);
      }
      if (typeof normalized === "boolean") {
        persistLocalEditsToStorage();
      } else {
        schedulePersistLocalEdits();
      }
    },
    [getCachedCellValue, normalizeLocalValue, persistLocalEditsToStorage, schedulePersistLocalEdits],
  );

  useEffect(() => {
    if (!activeTableId) return;
    if (hydratedPendingEditsRef.current.has(activeTableId)) return;
    if (!recordsQuery.data?.pages) return;
    hydratedPendingEditsRef.current.add(activeTableId);
    if (typeof window === "undefined") return;
    const storageKey = buildPendingEditsStorageKey(activeTableId);
    let stored: { recordId: string; fieldId: string; value: CellValue }[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as typeof stored;
      if (!Array.isArray(parsed)) return;
      stored = parsed;
    } catch {
      return;
    }
    if (!stored.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.removeItem(storageKey);
    stored.forEach(({ recordId, fieldId, value }) => {
      if (!recordId || !fieldId) return;
      if (isOptimisticRecordId(recordId) || isOptimisticFieldId(fieldId)) return;
      const key = makePendingKey(recordId, fieldId);
      const normalized = normalizeLocalValue(value);
      lastLocalCellValueRef.current.set(key, normalized);
      dirtyCellKeysRef.current.add(key);
      applyCellToCache(recordId, buildOptimisticCell(recordId, fieldId, normalized));
      enqueueCellUpdate(recordId, fieldId, normalized);
    });
    persistLocalEditsToStorage();
  }, [
    activeTableId,
    applyCellToCache,
    enqueueCellUpdate,
    normalizeLocalValue,
    persistLocalEditsToStorage,
    recordsQuery.data?.pages,
  ]);

  const resolveRecordId = useCallback(
    (recordId: string) => optimisticRecordIdMapRef.current.get(recordId) ?? recordId,
    [],
  );
  const resolveFieldId = useCallback(
    (fieldId: string) => optimisticFieldIdMapRef.current.get(fieldId) ?? fieldId,
    [],
  );

  const rekeyPendingEdits = useCallback(
    (transform: (edit: PendingCellEdit) => PendingCellEdit | null) => {
      const next = new Map<string, PendingCellEdit>();
      pendingCellEditsRef.current.forEach((edit) => {
        const updated = transform(edit);
        if (!updated) return;
        next.set(makePendingKey(updated.recordId, updated.fieldId), updated);
      });
      pendingCellEditsRef.current = next;
      logPendingState("rekey-pending", { count: next.size });
    },
    [logPendingState],
  );

  const queuePendingCellEdit = useCallback(
    (recordId: string, fieldId: string, value: CellValue) => {
      pendingCellEditsRef.current.set(makePendingKey(recordId, fieldId), {
        recordId,
        fieldId,
        value,
      });
      const optimisticCell = buildOptimisticCell(recordId, fieldId, value);
      applyCellToCache(recordId, optimisticCell);
      logPendingState("queued-edit", { recordId, fieldId, value });
    },
    [applyCellToCache, logPendingState],
  );

  const flushPendingCellEdits = useCallback(() => {
    logPendingState("flush-start");
    pendingCellEditsRef.current.forEach((edit, key) => {
      const recordId = resolveRecordId(edit.recordId);
      const fieldId = resolveFieldId(edit.fieldId);
      if (isOptimisticRecordId(recordId) || isOptimisticFieldId(fieldId)) {
        logPendingState("flush-skip-optimistic", { recordId, fieldId });
        return;
      }

      pendingCellEditsRef.current.delete(key);

      logPendingState("flush-commit", { recordId, fieldId, value: edit.value });
      enqueueCellUpdate(recordId, fieldId, edit.value);
    });
  }, [enqueueCellUpdate, logPendingState, resolveFieldId, resolveRecordId]);

  const handleCellChange = useCallback(
    (recordId: string, fieldId: string, value: CellValue) => {
      if (!activeTableId) return;

      const resolvedRecordId = resolveRecordId(recordId);
      const resolvedFieldId = resolveFieldId(fieldId);
      logPendingState("handleCellChange", {
        recordId,
        resolvedRecordId,
        fieldId,
        resolvedFieldId,
        value,
      });

      if (isOptimisticRecordId(resolvedRecordId) || isOptimisticFieldId(resolvedFieldId)) {
        logPendingState("handleCellChange-queue", {
          recordId,
          resolvedRecordId,
          fieldId,
          resolvedFieldId,
          value,
        });
        queuePendingCellEdit(resolvedRecordId, resolvedFieldId, value);
        return;
      }

      logPendingState("immediate-updateCell", {
        recordId: resolvedRecordId,
        fieldId: resolvedFieldId,
        value,
      });
      enqueueCellUpdate(resolvedRecordId, resolvedFieldId, value);
      flushPendingCellEdits();
    },
    [
      activeTableId,
      enqueueCellUpdate,
      flushPendingCellEdits,
      logPendingState,
      queuePendingCellEdit,
      resolveFieldId,
      resolveRecordId,
    ],
  );

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
      logPendingState("add-field-optimistic", { optimisticFieldId });

      return { previous, tableId: variables.tableId, optimisticFieldId };
    },
    onError: (_err, _variables, context) => {
      if (!context?.previous || !context.tableId) return;
      utils.table.byId.setData({ id: context.tableId }, context.previous);
      if (context.optimisticFieldId) {
        optimisticFieldIdMapRef.current.delete(context.optimisticFieldId);
        rekeyPendingEdits((edit) =>
          edit.fieldId === context.optimisticFieldId ? null : edit,
        );
        logPendingState("add-field-error-cleared", { optimisticFieldId: context.optimisticFieldId });
      }
    },
    onSuccess: ({ field }, _variables, context) => {
      if (!context?.tableId) return;
      if (context.optimisticFieldId && cancelledOptimisticFieldIds.current.has(context.optimisticFieldId)) {
        cancelledOptimisticFieldIds.current.delete(context.optimisticFieldId);
        return;
      }
      if (context.optimisticFieldId) {
        optimisticFieldIdMapRef.current.set(context.optimisticFieldId, field.id);
        rekeyPendingEdits((edit) =>
          edit.fieldId === context.optimisticFieldId ? { ...edit, fieldId: field.id } : edit,
        );
        logPendingState("add-field-resolved", {
          optimisticFieldId: context.optimisticFieldId,
          realFieldId: field.id,
        });
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
      void utils.table.byId.invalidate({ id: context.tableId });
      flushPendingCellEdits();
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
          valueBoolean: null,
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

      logPendingState("add-record-optimistic", { optimisticId });
      setTotalDelta((d) => d + 1);
      return { previous, optimisticId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        if (!recordsQueryInput) return { previous: undefined };
        utils.table.records.setInfiniteData(recordsQueryInput, ctx.previous);
      }
      if (ctx?.optimisticId) {
        optimisticRecordIdMapRef.current.delete(ctx.optimisticId);
        rekeyPendingEdits((edit) =>
          edit.recordId === ctx.optimisticId ? null : edit,
        );
        logPendingState("add-record-error-cleared", { optimisticRecordId: ctx.optimisticId });
      }
      setTotalDelta((d) => d - 1);
    },

    onSuccess: ({ record }, _vars, ctx) => {
      if (!recordsQueryInput) return { previous: undefined };
      if (ctx?.optimisticId) {
        optimisticRecordIdMapRef.current.set(ctx.optimisticId, record.id);
        rekeyPendingEdits((edit) =>
          edit.recordId === ctx.optimisticId ? { ...edit, recordId: record.id } : edit,
        );
        logPendingState("add-record-resolved", {
          optimisticRecordId: ctx.optimisticId,
          realRecordId: record.id,
        });
      }
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
      flushPendingCellEdits();
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

      setTotalDelta((d) => d - recordIds.length);

      return { previous, removed: recordIds.length };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback if failed
      if (ctx?.previous && recordsQueryInput) {
        utils.table.records.setInfiniteData(recordsQueryInput, ctx.previous);
      }
      if (ctx?.removed) {
        setTotalDelta((d) => d + ctx.removed);
      }
    },

    onSuccess: () => {
      // Optional: force refresh if server returns new pagination info
      if (recordsQueryInput) {
        void utils.table.records.invalidate(recordsQueryInput);
      } else if (activeTableId) {
        void utils.table.records.invalidate({ tableId: activeTableId });
      } else {
        void utils.table.records.invalidate();
      }
    },
  });

  const flushLocalEdits = useCallback(() => {
    if (!dirtyCellKeysRef.current.size) return;
    logPendingState("flush-local-edits", {
      count: dirtyCellKeysRef.current.size,
    });
    dirtyCellKeysRef.current.forEach((key) => {
      const val = lastLocalCellValueRef.current.get(key);
      const [recordId, fieldId] = key.split(":");
      if (!recordId || !fieldId) return;
      handleCellChange(recordId, fieldId, val ?? null);
    });
    // Force downstream views/queries to refetch so switches see latest data.
    void utils.table.records.invalidate();
  }, [handleCellChange, logPendingState, utils.table.records]);

  const handleAddTable = () => {
    const nextIndex = tablesState.length + 1;
    createTable.mutate({ baseId, name: `Table ${nextIndex}` });
  };

  const handleDeleteTable = (id: string) => {
    deleteTable.mutate({ tableId: id });
  };

  const handleSelectView = useCallback(
    (viewId: string | null) => {
      flushLocalEdits();
      setActiveViewId(viewId);
      if (activeTableId) {
        void utils.table.records.invalidate({ tableId: activeTableId, viewId: viewId ?? undefined });
      } else {
        void utils.table.records.invalidate();
      }
    },
    [activeTableId, flushLocalEdits, utils.table.records],
  );

  const handleChangeTable = useCallback(
    (tableId: string) => {
      flushLocalEdits();
      setActiveTableId(tableId);
      void utils.table.records.invalidate({ tableId });
    },
    [flushLocalEdits, utils.table.records],
  );

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

  const [activeCellIndex, setActiveCellIndex] = useState<[number, number] | null>(null);

  if (loading) {
    return (
      <div className="flex h-screen bg-white">
        {/* LEFT APP RAIL */}
        <AppRail userInitial={userInitial} />

        {/* RIGHT MAIN AREA */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* TOP BAR */}
          <div className="relative flex h-12 items-center justify-between border-b border-[#e6e8ef] bg-white px-4 text-[13px]">
            <div className="flex min-w-[200px] items-center gap-2">
            <Image
              src="/airtable-logo-white.png"
              alt="Airtable logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md bg-[#4b5563] p-1 cursor-pointer"
              onClick={() => (window.location.href = "/")}
              priority
            />
            <div className="text-[15px] font-semibold text-[#111827]">{baseName}</div>
          </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex items-center gap-1 text-[13px] text-[#667085]">
                <span className="relative px-2 pb-2 text-[#111827] font-medium after:absolute after:left-[8px] after:right-[8px] after:bottom-[-12px] after:h-[2px] after:bg-[#111827]">
                  Data
                </span>
                <span className="px-2 pb-2 hover:text-[#111827]">Automations</span>
                <span className="px-2 pb-2 hover:text-[#111827]">Interfaces</span>
                <span className="px-2 pb-2 hover:text-[#111827]">Forms</span>
              </div>
            </div>
          <div className="flex items-center gap-2 text-[12px] text-[#344054]">
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e8ef] bg-white text-[#4b5563] hover:bg-[#f2f4f8]">
              <RefreshCycleIcon className="h-4 w-4" />
            </button>
            <button className="inline-flex h-8 items-center rounded-full border border-[#e6e8ef] bg-[#f2f3f5] px-3 font-medium text-[#2c3b52]">
              Trial: Expires Soon
            </button>
            <button className="inline-flex h-8 items-center gap-1 rounded-md border border-[#e6e8ef] bg-white px-3 font-medium text-[#2c3b52] hover:bg-[#f2f4f8]">
              Launch
            </button>
            <button className="inline-flex h-8 items-center rounded-md border border-transparent bg-[#4b5563] px-3 font-semibold text-white hover:bg-[#3d4552]">
              Share
            </button>
          </div>
          </div>

          {/* TABLE TABS ONLY */}
            <TableTopBar
            tables={tablesState}
            activeTableId={activeTableId}
            onChangeTable={handleChangeTable}
            onAddTable={() => undefined}
            onRenameTable={() => undefined}
            onDeleteTable={() => undefined}
          />

          {/* LOADING BODY */}
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Loading base...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT APP RAIL */}
      <AppRail userInitial={userInitial} />

      {/* RIGHT MAIN AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP BAR = logo + base name + Data/Automations/Interfaces/Forms + right buttons */}
        <div className="relative flex h-14 items-center justify-between border-b border-[#e6e8ef] bg-white px-4 text-[13px]">
          {/* LEFT: logo + base name */}
            <div className="flex min-w-[200px] items-center gap-2">
              <Image
                src="/airtable-logo-white.png"
                alt="Airtable logo"
                width={24}
                height={24}
                className="h-8 w-8 rounded-md bg-[#4b5563] p-1 cursor-pointer"
                onClick={() => (window.location.href = "/")}
                priority
              />
              <div className="text-[16px] font-bold text-[#111827]">{baseName}</div>
              <div className="text-[18px] text-[#98a2b3]"><ChevronDown /></div>
            </div>

          {/* CENTER: Data / Automations / Interfaces / Forms */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-1 text-[13px] text-[#667085]">
              <button className="relative px-2 pb-2 text-[#111827] font-medium after:absolute after:left-[8px] after:right-[8px] after:bottom-[-14px] after:h-[2px] after:bg-[#111827]">
                Data
              </button>
              <button className="px-2 pb-2 hover:text-[#111827]">Automations</button>
              <button className="px-2 pb-2 hover:text-[#111827]">Interfaces</button>
              <button className="px-2 pb-2 hover:text-[#111827]">Forms</button>
            </div>
          </div>

          {/* RIGHT: trial / launch / share */}
          <div className="flex items-center gap-2 text-[12px] text-[#344054]">
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e8ef] bg-white text-[#4b5563] hover:bg-[#f2f4f8]">
              <RefreshCycleIcon className="h-4 w-4" />
            </button>
            <button className="inline-flex h-8 items-center rounded-full border border-[#e6e8ef] bg-[#f2f3f5] px-3 font-medium text-[#2c3b52]">
              Trial: Expires Soon
            </button>
            <button className="inline-flex h-8 items-center gap-1 rounded-md border border-[#e6e8ef] bg-white px-3 font-medium text-[#2c3b52] hover:bg-[#f2f4f8]">
              Launch
            </button>
            <button className="inline-flex h-8 items-center rounded-md border border-transparent bg-[#4b5563] px-3 font-semibold text-white hover:bg-[#3d4552]">
              Share
            </button>
          </div>
        </div>

        {/* TABLE HEADER STRIP = table switcher + toolbar */}
        <div className={loading ? "pointer-events-none opacity-60" : ""}>
            <TableTopBar
              tables={loading ? [] : tablesState}
              activeTableId={loading ? "" : activeTableId}
              onChangeTable={handleChangeTable}
              onAddTable={handleAddTable}
              onRenameTable={handleRenameTable}
              onDeleteTable={handleDeleteTable}
            />
        </div>

        <div className={loading ? "pointer-events-none opacity-60" : ""}>
          <TableToolbar
            viewName={activeView?.name ?? "Grid view"}
            views={viewListQuery.data ?? []}
            activeViewId={activeViewId ?? undefined}
            viewSidebarOpen={viewSidebarOpen}
            viewSidebarPinned={viewSidebarPinned}
            onToggleViewSidebar={toggleViewSidebarPinned}
            onViewSidebarHoverChange={handleViewSidebarHoverChange}
            onRenameViewAction={(viewId, name) => {
              if (!viewId) return;
              shouldRefetchRecordsRef.current = false;
              updateView.mutate({ viewId, name });
            }}
            onDeleteViewAction={(viewId) => {
              if (!viewId || deleteView.isPending) return;
              deleteView.mutate({ viewId });
            }}
            onDuplicateViewAction={(viewId) => duplicateView(viewId)}
            fields={loading ? [] : tableQuery.data?.fields ?? []}
            hiddenFieldIds={loading ? [] : hiddenFieldIds}
            filters={loading ? { connector: "and", conditions: [] } : filters}
            sorts={{ items: sortUi.items, auto: sortUi.auto }}

            onSeedRows={(count) => {
              if (loading) return;
              if (!activeTableId || seedRecords.isPending) return;
              const target = count || 100_000;
              seedRecords.mutate({
                tableId: activeTableId,
                count: target,
              });
            }}

            isSeedingRows={loading || seedRecords.isPending}

            onToggleField={(fieldId) => {
              if (loading) return;
              setHiddenFieldIds((prev) => {
                const next = prev.includes(fieldId)
                  ? prev.filter((id) => id !== fieldId)
                  : [...prev, fieldId];
                schedulePersistHidden(next);
                return next;
              });
            }}

            onHideAll={() => {
              if (loading) return;
              const ids = (tableQuery.data?.fields ?? []).map((f) => f.id);
              setHiddenFieldIds(ids);
              schedulePersistHidden(ids);
            }}

            onShowAll={() => {
              if (loading) return;
              setHiddenFieldIds([]);
              schedulePersistHidden([]);
            }}

            onFiltersChange={(next) => {
              if (loading) return;
              if (activeViewId) {
                lastFiltersByViewRef.current[activeViewId] = serializeFilters(next);
              }
              setFilters(next);
              if (filterDebounceHandleRef.current) {
                window.clearTimeout(filterDebounceHandleRef.current);
              }
              filterDebounceHandleRef.current = window.setTimeout(() => {
                setAppliedFilters(next);
                persistViewConfig({ filters: next }, { skipRecordRefresh: true });
              }, 300);
            }}

            onSortsChange={(next, commit) => {
              if (loading) return;
              setSortUi(next);
              const shouldApply = (commit ?? false) || next.auto;
              if (!shouldApply) {
                // Keep table in default order while the user edits manual sorts.
                setAppliedSorts([]);
                return;
              }
              setAppliedSorts(next.items);
              schedulePersistSorts(next.items);
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
          {viewSidebarOpen ? (
            <ViewSidebar
              loading={loading || viewListQuery.isLoading}
              views={viewListQuery.data ?? []}
              activeViewId={activeViewId}
              onSelectViewAction={(viewId) => handleSelectView(viewId)}
              onDeleteViewAction={(viewId) => {
                if (!viewId || deleteView.isPending) return;
                deleteView.mutate({ viewId });
              }}
              onDuplicateViewAction={(viewId) => duplicateView(viewId)}
              onReorderViewAction={(orderedIds) => {
                if (!activeTableId || reorderViews.isPending) return;
                reorderViews.mutate({ tableId: activeTableId, orderedIds });
              }}
              onCreateViewAction={() => {
                if (!activeTableId || createView.isPending) return;
                createView.mutate({
                  tableId: activeTableId,
                  name: "Grid view",
                  config: defaultViewConfig,
                });
              }}
            />
          ) : null}

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500"></div>
            ) : (
            <BaseTable
              fields={tableQuery.data?.fields ?? []}
              records={displayRecords}
              recordsStartIndex={displayRecordsStartIndex}
              hiddenFieldIds={hiddenFieldIds}
              filteredFieldIds={appliedFilters.conditions
                .filter((c) => {
                  const val = (c.value ?? "").trim();
                  const op = c.operator;
                  const isEmptyCheck = op === "is_empty" || op === "is_not_empty";
                  return isEmptyCheck || val.length > 0;
                })
                .map((c) => c.fieldId)}
              sortedFieldIds={appliedSorts.map((s) => s.fieldId)}
              searchTerm={globalSearch}
              isLoading={tableQuery.isLoading || isRecordsLoading}
              hasMore={hasMore}
              isFetchingMore={isFetchingMore || isFetchingRecordsWindow}
              onLoadMore={handleLoadMore}
              onRequestRange={handleRequestRecordRange}
              totalCount={totalCount}
              onCellChange={handleCellChange}
              onEditValueChange={handleLocalEditValue}
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
                    rekeyPendingEdits((edit) =>
                      edit.fieldId === fieldId ? null : edit,
                    );
                    optimisticFieldIdMapRef.current.delete(fieldId);
                    logPendingState("delete-optimistic-field-cleared", { fieldId });
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

export default function BaseClient(props: BaseClientProps) {
  const initialSession = useMemo<Session | null>(() => {
    if (!props.user) return null;
    return {
      user: props.user,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30-day placeholder expiry
    };
  }, [props.user]);

  return (
    <SessionProvider session={initialSession ?? undefined}>
      <BaseClientContent {...props} />
    </SessionProvider>
  );
}
import { RefreshCycleIcon } from "./components/icons/RefreshCycleIcon";
