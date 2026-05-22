import { faker } from "@faker-js/faker";
import { FieldType } from "../../../../generated/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  defaultViewConfig,
  parseViewConfig,
  viewConfigSchema,
  viewFiltersSchema,
  viewSortSchema,
} from "~/server/viewConfig";

const NUMERIC_REGEX = "^-?\\d+(\\.\\d+)?$";

type RecordCursor =
  | { type: "offset"; offset: number }
  | { type: "keyset"; position: number; id: string };

const decodeCursor = (cursor?: string | null): RecordCursor | null => {
  if (!cursor) return null;
  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const legacyOffset = Number(decoded);
  if (Number.isFinite(legacyOffset) && legacyOffset > 0) {
    return { type: "offset", offset: legacyOffset };
  }

  try {
    const parsed = JSON.parse(decoded) as Partial<RecordCursor>;
    if (
      parsed.type === "keyset" &&
      typeof parsed.position === "number" &&
      typeof parsed.id === "string"
    ) {
      return { type: "keyset", position: parsed.position, id: parsed.id };
    }
    if (
      parsed.type === "offset" &&
      typeof parsed.offset === "number" &&
      Number.isFinite(parsed.offset) &&
      parsed.offset > 0
    ) {
      return { type: "offset", offset: parsed.offset };
    }
  } catch {
    return null;
  }

  return null;
};

const encodeCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ type: "offset", offset }), "utf8").toString("base64");

const encodeKeysetCursor = (position: number, id: string) =>
  Buffer.from(
    JSON.stringify({
      type: "keyset",
      position,
      id,
    }),
    "utf8",
  ).toString("base64");

const buildTextValueExpr = (alias: string) =>
  `LOWER(COALESCE(
    ${alias}."valueText",
    ${alias}."valueNumber"::text,
    CASE
      WHEN ${alias}."valueBoolean" IS TRUE THEN '1'
      WHEN ${alias}."valueBoolean" IS FALSE THEN '0'
      ELSE NULL
    END,
    ''
  ))`;

const buildNumberValueExpr = (alias: string) =>
  `(
    CASE
      WHEN ${alias}."valueNumber" IS NOT NULL THEN ${alias}."valueNumber"
      WHEN ${alias}."valueText" ~ '${NUMERIC_REGEX}' THEN (${alias}."valueText")::double precision
      ELSE NULL
    END
  )`;

const buildFilterClause = (
  filters: z.infer<typeof viewFiltersSchema>,
  addParam: (val: unknown) => string,
  fieldLookup: Record<string, { type: FieldType }>,
) => {
  if (!filters?.conditions?.length) return "";

  const clauses: string[] = [];

  filters.conditions.forEach((condition) => {
    const field = fieldLookup[condition.fieldId];
    if (!field) return;

    const fieldParam = addParam(condition.fieldId);

    if (
      ["greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "is"].includes(
        condition.operator,
      ) &&
      field.type === FieldType.NUMBER
    ) {
      const parsed = Number(condition.value);
      if (!Number.isFinite(parsed)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid numeric filter value for field ${condition.fieldId}`,
        });
      }
      const valueParam = addParam(parsed);
      const numExpr = buildNumberValueExpr("c");

      switch (condition.operator) {
        case "greater_than":
          clauses.push(
            `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${numExpr} > ${valueParam})`,
          );
          break;
        case "less_than":
          clauses.push(
            `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${numExpr} < ${valueParam})`,
          );
          break;
        case "greater_than_or_equal":
          clauses.push(
            `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${numExpr} >= ${valueParam})`,
          );
          break;
        case "less_than_or_equal":
          clauses.push(
            `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${numExpr} <= ${valueParam})`,
          );
          break;
        case "is":
          clauses.push(
            `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${numExpr} = ${valueParam})`,
          );
          break;
      }
      return;
    }

    if (["is_empty", "is_not_empty"].includes(condition.operator)) {
      const notEmptyCheck =
        field.type === FieldType.NUMBER
          ? `${buildNumberValueExpr("c")} IS NOT NULL`
          : `(${buildTextValueExpr("c")} <> '' OR c."valueNumber" IS NOT NULL)`;

      if (condition.operator === "is_empty") {
        clauses.push(
          `NOT EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${notEmptyCheck})`,
        );
      } else {
        clauses.push(
          `EXISTS (SELECT 1 FROM "Cell" c WHERE c."recordId" = r.id AND c."fieldId" = ${fieldParam} AND ${notEmptyCheck})`,
        );
      }
      return;
    }

    const valueParam = addParam(condition.value ?? "");
    const textValueExpr = buildTextValueExpr("c"); 
    const comparator = `LOWER(${valueParam})`;

    switch (condition.operator) {
      case "contains":
        clauses.push(
          `EXISTS (
            SELECT 1
            FROM "Cell" c
            WHERE c."recordId" = r.id
              AND c."fieldId" = ${fieldParam}
              AND ${textValueExpr} LIKE '%' || ${comparator} || '%'
          )`
        );
        break;

      case "not_contains":
        clauses.push(
          `NOT EXISTS (
            SELECT 1
            FROM "Cell" c
            WHERE c."recordId" = r.id
              AND c."fieldId" = ${fieldParam}
              AND ${textValueExpr} LIKE '%' || ${comparator} || '%'
          )`
        );
        break;

      case "is":
        clauses.push(
          `EXISTS (
            SELECT 1
            FROM "Cell" c
            WHERE c."recordId" = r.id
              AND c."fieldId" = ${fieldParam}
              AND ${textValueExpr} = ${comparator}
          )`
        );
        break;

      case "is_not":
        clauses.push(
          `NOT EXISTS (
            SELECT 1
            FROM "Cell" c
            WHERE c."recordId" = r.id
              AND c."fieldId" = ${fieldParam}
              AND ${textValueExpr} = ${comparator}
          )`
        );
        break;
    }
  });

  if (!clauses.length) return "";

  const connector = filters.connector === "or" ? " OR " : " AND ";
  return clauses.map((c) => `(${c})`).join(connector);
};

const buildSortClause = (
  sorts: z.infer<typeof viewSortSchema>[],
  addParam: (val: unknown) => string,
  fieldLookup: Record<string, { type: FieldType }>,
) => {
  const joinSegments: string[] = [];
  const orderSegments: string[] = [];

  sorts.forEach((sort, idx) => {
    const field = fieldLookup[sort.fieldId];
    if (!field) return;
    const alias = `s${idx}`;
    const fieldParam = addParam(sort.fieldId);
    joinSegments.push(
      `LEFT JOIN "Cell" ${alias} ON ${alias}."recordId" = r.id AND ${alias}."fieldId" = ${fieldParam}`,
    );

    if (field.type === FieldType.NUMBER) {
      const numExpr = buildNumberValueExpr(alias);
      orderSegments.push(`${numExpr} ${sort.direction.toUpperCase()} NULLS LAST`);
    } else {
      const textExpr = buildTextValueExpr(alias);
      orderSegments.push(`${textExpr} ${sort.direction.toUpperCase()}`);
    }
  });

  orderSegments.push('r."position" ASC', "r.id ASC");

  return {
    joinClause: joinSegments.length ? joinSegments.join("\n") : "",
    orderClause: orderSegments.join(", "),
  };
};

const DEFAULT_FIELDS = [
  { name: "Name", type: FieldType.TEXT, order: 0 },
  { name: "Notes", type: FieldType.TEXT, order: 1 },
  { name: "Numbers", type: FieldType.NUMBER, order: 2 },
];
const DEFAULT_RECORD_COUNT = 5;

export const tableRouter = createTRPCRouter({
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        includeRecords: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const includeRecords = input.includeRecords ?? false;

      const table = await ctx.db.table.findFirst({
        where: {
          id: input.id,
          base: { ownerId: ctx.session.user.id },
        },
        select: {
          id: true,
          name: true,
          baseId: true,
          _count: { select: { records: true } },
          fields: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, type: true, order: true, isHidden: true },
          },
        },
      });

      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (!includeRecords) {
        return { ...table, records: [] };
      }

      const records = await ctx.db.record.findMany({
        where: { tableId: table.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cells: {
            select: {
              id: true,
              recordId: true,
              fieldId: true,
              valueText: true,
              valueNumber: true,
              valueBoolean:true,
            },
          },
        },
      });

      return { ...table, records };
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        include: { tables: true },
      });
      if (!base) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base not found" });
      }

      const nextIndex = base.tables.length + 1;
      const tableName = input.name?.trim() ?? `Table ${nextIndex}`;

      const fullTable = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: {
            name: tableName,
            baseId: base.id,
          },
        });

        const [fields, records] = await Promise.all([
          tx.field.createManyAndReturn({
            data: DEFAULT_FIELDS.map((f) => ({
              ...f,
              tableId: table.id,
            })),
            select: {
              id: true,
              name: true,
              type: true,
              order: true,
              isHidden: true,
            },
          }),
          tx.record.createManyAndReturn({
            data: Array.from({ length: DEFAULT_RECORD_COUNT }).map((_, index) => ({
              tableId: table.id,
              position: index,
            })),
            select: { id: true, position: true, createdAt: true },
          }),
        ]);

        const cells =
          records.length && fields.length
            ? await tx.cell.createManyAndReturn({
                data: records.flatMap((record) =>
                  fields.map((field) => ({
                    recordId: record.id,
                    fieldId: field.id,
                    valueText:
                      field.type === FieldType.NUMBER || field.type === FieldType.BOOLEAN
                        ? null
                        : field.name.toLowerCase().includes("name")
                          ? faker.person.fullName()
                          : faker.lorem.sentence(4),
                    valueNumber:
                      field.type === FieldType.NUMBER
                        ? faker.number.int({ min: 1, max: 1000 })
                        : null,
                    valueBoolean:
                      field.type === FieldType.BOOLEAN
                        ? faker.datatype.boolean()
                        :null,
                  })),
                ),
                select: {
                  id: true,
                  recordId: true,
                  fieldId: true,
                  valueText: true,
                  valueNumber: true,
                  valueBoolean:true,
                },
              })
            : [];

        const orderedFields = [...fields].sort((a, b) => a.order - b.order);
        const orderedRecords = [...records].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
        const recordsWithCells = orderedRecords.map(({ createdAt: _createdAt, ...record }) => ({
          ...record,
          cells: cells.filter((cell) => cell.recordId === record.id),
        }));

        return {
          ...table,
          _count: { records: records.length },
          fields: orderedFields,
          records: recordsWithCells,
        };
      });

      if (!fullTable) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return fullTable;
    }),

  records: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().int().min(1).max(1_000).default(100),
        cursor: z.string().nullish(),
        offset: z.number().int().min(0).optional(),
        filters: viewFiltersSchema.default({ connector: "and", conditions: [] }),
        sorts: z.array(viewSortSchema).default([]),
        globalSearch: z.string().optional(),
        viewId: z.string().optional(),
        viewConfig: viewConfigSchema.optional(),
        hiddenFieldIds: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const fields = await ctx.db.field.findMany({
        where: { tableId: input.tableId },
        select: { id: true, type: true },
      });
      const fieldLookup = fields.reduce<Record<string, { type: FieldType }>>(
        (acc, field) => ({ ...acc, [field.id]: { type: field.type } }),
        {},
      );
      const fieldIds = new Set(fields.map((f) => f.id));

      const baseConfig = {
        filters: input.filters ?? defaultViewConfig.filters,
        sorts: input.sorts ?? defaultViewConfig.sorts,
        search: input.globalSearch ?? defaultViewConfig.search,
        hiddenFieldIds: input.hiddenFieldIds ?? defaultViewConfig.hiddenFieldIds,
      };

      const providedConfig = input.viewConfig ? parseViewConfig(input.viewConfig) : null;
      let effectiveConfig = providedConfig ?? parseViewConfig(baseConfig);

      if (input.viewId && !providedConfig) {
        const view = await ctx.db.view.findFirst({
          where: {
            id: input.viewId,
            table: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
          },
          select: { id: true, config: true },
        });

        if (view) {
          const storedConfig = parseViewConfig(view.config);
          effectiveConfig = storedConfig;
        }
        // If view is missing or unauthorized, silently fall back to provided config/defaults.
      }

      const hiddenFieldIds = (effectiveConfig.hiddenFieldIds ?? []).filter((id) => fieldIds.has(id));

      const limit = input.limit ?? 100;
      const decodedCursor = decodeCursor(input.cursor);
      const canUseKeyset =
        input.offset === undefined &&
        decodedCursor?.type !== "offset" &&
        (effectiveConfig.sorts ?? []).length === 0;
      const keysetCursor =
        canUseKeyset && decodedCursor?.type === "keyset" ? decodedCursor : null;
      const offset = input.offset ?? (decodedCursor?.type === "offset" ? decodedCursor.offset : 0);
      const limitPlusOne = limit + 1;

      const baseParams: unknown[] = [input.tableId];
      const addBaseParam = (val: unknown) => {
        baseParams.push(val);
        return `$${baseParams.length}`;
      };

      const filterClause = buildFilterClause(effectiveConfig.filters, addBaseParam, fieldLookup);
      const searchTerm = (effectiveConfig.search ?? "").trim().toLowerCase();
      const searchClause = searchTerm
        ? (() => {
            const termParam = addBaseParam(searchTerm);
            const hiddenExclusion =
              hiddenFieldIds.length > 0
                ? `AND c."fieldId" NOT IN (${hiddenFieldIds.map((id) => addBaseParam(id)).join(", ")})`
                : "";
            return `EXISTS (
              SELECT 1
              FROM "Cell" c
              WHERE c."recordId" = r.id
                ${hiddenExclusion}
                AND ${buildTextValueExpr("c")} LIKE '%' || ${termParam} || '%'
            )`;
          })()
        : "";

      const fetchParams = [...baseParams];
      const addFetchParam = (val: unknown) => {
        fetchParams.push(val);
        return `$${fetchParams.length}`;
      };

      const { joinClause, orderClause } = buildSortClause(effectiveConfig.sorts, addFetchParam, fieldLookup);
      const limitParam = addFetchParam(limitPlusOne);
      const shouldCountTotal = offset === 0 && !keysetCursor;
      const keysetClause = keysetCursor
        ? (() => {
            const positionParam = addFetchParam(keysetCursor.position);
            const idParam = addFetchParam(keysetCursor.id);
            return `WHERE (r."position", r.id) > (${positionParam}, ${idParam})`;
          })()
        : "";
      const positionWindowClause =
        input.offset !== undefined && (effectiveConfig.sorts ?? []).length === 0
          ? `AND r."position" >= ${addFetchParam(offset)}`
          : "";
      const offsetParam = canUseKeyset || positionWindowClause ? null : addFetchParam(offset);
      const hiddenCellClause = hiddenFieldIds.length
        ? `AND c."fieldId" <> ALL(${addFetchParam(hiddenFieldIds)}::text[])`
        : "";

      const recordsSql = `
        WITH filtered AS (
          SELECT r.id, r."position"
          FROM "Record" r
          WHERE r."tableId" = $1
          ${positionWindowClause}
          ${filterClause ? `AND (${filterClause})` : ""}
          ${searchClause ? `AND (${searchClause})` : ""}
        )
        ${
          shouldCountTotal
            ? `,
        counted AS (
          SELECT COUNT(*)::int as total_count FROM filtered
        )`
            : ""
        },
        sorted AS (
          SELECT r.id, r."position", ${
            shouldCountTotal ? "counted.total_count" : "NULL::int as total_count"
          }
          FROM filtered r
          ${shouldCountTotal ? "CROSS JOIN counted" : ""}
          ${joinClause}
          ${keysetClause}
          ORDER BY ${orderClause}
          LIMIT ${limitParam}
          ${offsetParam && !positionWindowClause ? `OFFSET ${offsetParam}` : ""}
        )
        SELECT
          sorted.id,
          sorted."position",
          sorted.total_count,
          COALESCE(cells.cells, '[]'::json) AS cells
        FROM sorted
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'recordId', c."recordId",
              'fieldId', c."fieldId",
              'valueText', c."valueText",
              'valueNumber', c."valueNumber",
              'valueBoolean', c."valueBoolean"
            )
          ) AS cells
          FROM "Cell" c
          WHERE c."recordId" = sorted.id
          ${hiddenCellClause}
        ) cells ON TRUE;
      `;

      const rows = await ctx.db.$queryRawUnsafe<
        {
          id: string;
          position: number;
          total_count: number | null;
          cells: {
            id: string;
            recordId: string;
            fieldId: string;
            valueText: string | null;
            valueNumber: number | null;
            valueBoolean: boolean | null;
          }[];
        }[]
      >(recordsSql, ...fetchParams);

      const total = rows[0]?.total_count ?? 0;
      const sliced = rows.slice(0, limit);
      const lastRow = sliced.at(-1);
      const nextCursor =
        rows.length > limit && lastRow
          ? canUseKeyset
            ? encodeKeysetCursor(lastRow.position, lastRow.id)
            : encodeCursor(offset + limit)
          : null;
      const orderedRecords = sliced.map((row) => ({
        id: row.id,
        position: row.position,
        cells: row.cells,
      }));

      return {
        records: orderedRecords,
        nextCursor,
        total,
        offset,
      };
    }),

  addField: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().optional(),
        type: z.nativeEnum(FieldType).default(FieldType.TEXT),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: {
          id: true,
          fields: {
            select: { id: true, order: true, name: true, type: true, isHidden: true },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const order = table.fields.length;
      const fieldName = input.name?.trim() ?? `Field ${order + 1}`;

      const field = await ctx.db.field.create({
        data: {
          name: fieldName,
          type: input.type,
          order,
          tableId: table.id,
        },
        select: { id: true, name: true, type: true, order: true, isHidden: true },
      });

      return {
        field,
      };
    }),

  renameField: protectedProcedure
    .input(z.object({ fieldId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const field = await ctx.db.field.findFirst({
        where: { id: input.fieldId, table: { base: { ownerId: ctx.session.user.id } } },
        include: { table: { select: { id: true } } },
      });
      if (!field) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Field not found" });
      }
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Name cannot be empty" });
      }
      const updated = await ctx.db.field.update({
        where: { id: input.fieldId },
        data: { name: trimmed },
        select: { id: true, name: true, type: true, order: true, isHidden: true },
      });
      return { field: updated, tableId: field.table.id };
    }),

  addRecord: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const record = await ctx.db.record.create({
        data: {
          tableId: table.id,
          position: await ctx.db.record.count({ where: { tableId: table.id } }),
        },
        select: { id: true, position: true },
      });

      return { record: { id: record.id, position: record.position }, cells: [] };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        recordId: z.string(),
        fieldId: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.record.findFirst({
        where: { id: input.recordId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true },
      });
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      }

      const field = await ctx.db.field.findFirst({
        where: { id: input.fieldId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true, type: true },
      });
      if (!field) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Field not found" });
      }
      if (field.tableId !== record.tableId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Field does not belong to the same table as record",
        });
      }

      const asNumber = () => {
        if (input.value === null || input.value === undefined || input.value === "") return null;
        const num = typeof input.value === "number" ? input.value : Number(input.value);
        if (Number.isNaN(num)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid number" });
        }
        return num;
      };

      const asBoolean = () => {
        if (input.value === null || input.value === undefined || input.value === "") return null;
        if (input.value === true) return true;
        if (input.value === false) return false;
        if (input.value === 1 || input.value === "1") return true;
        if (input.value === 0 || input.value === "0") return false;

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Boolean fields only accept 1 or 0",
        });
      };

      const data =
        field.type === FieldType.NUMBER
          ? { valueNumber: asNumber(), valueText: null, valueBoolean: null }
          : field.type == FieldType.BOOLEAN
            ? { valueBoolean: asBoolean(), valueText: null, valueNumber: null }
            : {
                valueText:
                  input.value === null || input.value === undefined
                    ? null
                    : String(input.value),
                valueNumber: null,
                valueBoolean: null,
              };

      const cell = await ctx.db.cell.upsert({
        where: { recordId_fieldId: { recordId: record.id, fieldId: field.id } },
        update: data,
        create: {
          recordId: record.id,
          fieldId: field.id,
          ...data,
        },
      });

      return cell;
    }),

  deleteField: protectedProcedure
    .input(z.object({ fieldId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const field = await ctx.db.field.findFirst({
        where: {
          id: input.fieldId,
          table: { base: { ownerId: ctx.session.user.id } },
        },
        include: { table: { select: { id: true } } },
      });
      if (!field) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Field not found" });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.cell.deleteMany({ where: { fieldId: input.fieldId } });
        await tx.field.delete({ where: { id: input.fieldId } });
      });

      return { fieldId: input.fieldId, tableId: field.table.id };
    }),

  delete: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        include: { base: true },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      await ctx.db.$transaction(async (tx) => {
        const recordIds = await tx.record.findMany({
          where: { tableId: input.tableId },
          select: { id: true },
        });
        const fieldIds = await tx.field.findMany({
          where: { tableId: input.tableId },
          select: { id: true },
        });

        const BATCH = 30000;
        const recordIdList = recordIds.map((r) => r.id);
        const fieldIdList = fieldIds.map((f) => f.id);

        if (recordIdList.length) {
          for (let i = 0; i < recordIdList.length; i += BATCH) {
            const slice = recordIdList.slice(i, i + BATCH);
            await tx.cell.deleteMany({ where: { recordId: { in: slice } } });
            await tx.record.deleteMany({ where: { id: { in: slice } } });
          }
        }

        if (fieldIdList.length) {
          await tx.cell.deleteMany({ where: { fieldId: { in: fieldIdList } } });
          await tx.field.deleteMany({ where: { id: { in: fieldIdList } } });
        }
        await tx.table.delete({ where: { id: input.tableId } });
      },
      { timeout: 20000 },
    );

      return { tableId: input.tableId, baseId: table.baseId };
    }),

  deleteRecords: protectedProcedure
    .input(z.object({ recordIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const records = await ctx.db.record.findMany({
        where: {
          id: { in: input.recordIds },
          table: { base: { ownerId: ctx.session.user.id } },
        },
        select: { id: true, tableId: true },
      });

      if (!records.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Record(s) not found" });
      }

      const tableId = records[0]!.tableId;

      await ctx.db.$transaction(async (tx) => {
        await tx.cell.deleteMany({ where: { recordId: { in: input.recordIds } } });
        await tx.record.deleteMany({ where: { id: { in: input.recordIds } } });
      });

      return { recordIds: input.recordIds, tableId };
    }),

  seedRecords: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().int().min(1).max(100_000).default(100_000),
        // Kept for older callers; bulk seeding now happens in a single DB statement.
        chunkSize: z.number().int().min(1).max(5_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, name: true },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const fields = await ctx.db.field.findMany({
        where: { tableId: table.id },
        select: { id: true, name: true, type: true },
      });
      if (!fields.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot seed records without fields",
        });
      }

      const totalToInsert = Math.min(input.count, 100_000);
      const result = await ctx.db.$queryRawUnsafe<{ inserted: number; cells: number }[]>(
        `
          WITH existing AS (
            SELECT COUNT(*)::integer AS count
            FROM "Record"
            WHERE "tableId" = $1
          ),
          inserted_records AS (
            INSERT INTO "Record" ("id", "tableId", "position", "createdAt", "updatedAt")
            SELECT
              'rec_' || substr(md5($1 || ':' || gs.n::text || ':' || clock_timestamp()::text || ':' || random()::text), 1, 24),
              $1,
              existing.count + gs.n - 1,
              NOW(),
              NOW()
            FROM generate_series(1, $2::integer) AS gs(n)
            CROSS JOIN existing
            RETURNING id
          ),
          inserted_cells AS (
            INSERT INTO "Cell" (
              "id",
              "recordId",
              "fieldId",
              "valueText",
              "valueNumber",
              "valueBoolean",
              "createdAt",
              "updatedAt"
            )
            SELECT
              'cell_' || substr(md5(ir.id || ':' || f.id || ':' || random()::text), 1, 24),
              ir.id,
              f.id,
              CASE
                WHEN f.type = 'NUMBER' THEN NULL
                WHEN lower(f.name) LIKE '%name%' THEN 'Seed Name ' || substr(ir.id, 5, 8)
                ELSE 'Seed value ' || substr(md5(ir.id || ':' || f.id), 1, 12)
              END,
              CASE
                WHEN f.type = 'NUMBER' THEN floor(random() * 1000 + 1)::double precision
                ELSE NULL
              END,
              CASE
                WHEN f.type = 'BOOLEAN' THEN random() < 0.5
                ELSE NULL
              END,
              NOW(),
              NOW()
            FROM inserted_records ir
            CROSS JOIN "Field" f
            WHERE f."tableId" = $1
            ON CONFLICT ("recordId", "fieldId") DO NOTHING
            RETURNING 1
          )
          SELECT
            (SELECT COUNT(*)::int FROM inserted_records) AS inserted,
            (SELECT COUNT(*)::int FROM inserted_cells) AS cells;
        `,
        table.id,
        totalToInsert,
      );

      const inserted = Number(result[0]?.inserted ?? 0);

      const remaining = Math.max(totalToInsert - inserted, 0);

      return { inserted, remaining };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        tableId: z.string(), 
        name:z.string()
      }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: {ownerId: ctx.session.user.id}
        }
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }
      const updated = await ctx.db.table.update({
        where: { id: input.tableId },
        data: { name: input.name }
      });
      return updated;
    }),
});
