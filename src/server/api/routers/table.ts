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

const decodeCursor = (cursor?: string | null) => {
  if (!cursor) return 0;
  const decoded = Number(Buffer.from(cursor, "base64").toString("utf8"));
  return Number.isFinite(decoded) && decoded > 0 ? decoded : 0;
};

const encodeCursor = (offset: number) =>
  Buffer.from(String(offset), "utf8").toString("base64");

const buildTextValueExpr = (alias: string) =>
  `LOWER(COALESCE(${alias}."valueText", ${alias}."valueNumber"::text, ''))`;

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

  orderSegments.push('r."createdAt" ASC', "r.id ASC");

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
            data: Array.from({ length: DEFAULT_RECORD_COUNT }).map(() => ({
              tableId: table.id,
            })),
            select: { id: true, createdAt: true },
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
                      field.type === FieldType.NUMBER
                        ? null
                        : field.name.toLowerCase().includes("name")
                          ? faker.person.fullName()
                          : faker.lorem.sentence(4),
                    valueNumber:
                      field.type === FieldType.NUMBER
                        ? faker.number.int({ min: 1, max: 1000 })
                        : null,
                  })),
                ),
                select: {
                  id: true,
                  recordId: true,
                  fieldId: true,
                  valueText: true,
                  valueNumber: true,
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
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().nullish(),
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

      let effectiveConfig = parseViewConfig(input.viewConfig ?? baseConfig);

      if (input.viewId) {
        const view = await ctx.db.view.findFirst({
          where: {
            id: input.viewId,
            table: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
          },
          select: { id: true, config: true },
        });

        if (view) {
          effectiveConfig = parseViewConfig(view.config);
        }
        // If view is missing or unauthorized, silently fall back to provided config/defaults.
      }

      const hiddenFieldIds = (effectiveConfig.hiddenFieldIds ?? []).filter((id) => fieldIds.has(id));

      const limit = input.limit ?? 50;
      const offset = decodeCursor(input.cursor) ?? 0;
      const limitPlusOne = limit + 1;

      const baseParams: unknown[] = [ctx.session.user.id, input.tableId];
      const addBaseParam = (val: unknown) => {
        baseParams.push(val);
        return `$${baseParams.length}`;
      };

      let filterClause = buildFilterClause(effectiveConfig.filters, addBaseParam, fieldLookup);

      if (effectiveConfig.search && effectiveConfig.search.trim() !== "") {
        const searchParam = addBaseParam(effectiveConfig.search.toLowerCase());

        // MATCHES ANY CELL IN THE TABLE
        const globalSearchClause = `
          EXISTS (
            SELECT 1
            FROM "Cell" gc
            WHERE gc."recordId" = r.id
              AND LOWER(COALESCE(gc."valueText", gc."valueNumber"::text, ''))
                  LIKE '%' || ${searchParam} || '%'
          )
        `;

        // Combine with existing filter clause
        if (filterClause) {
          filterClause = `(${filterClause}) AND (${globalSearchClause})`;
        } else {
          filterClause = globalSearchClause;
        }
      }

      const fetchParams = [...baseParams];
      const addFetchParam = (val: unknown) => {
        fetchParams.push(val);
        return `$${fetchParams.length}`;
      };

      const { joinClause, orderClause } = buildSortClause(effectiveConfig.sorts, addFetchParam, fieldLookup);
      const limitParam = addFetchParam(limitPlusOne);
      const offsetParam = addFetchParam(offset);

      const recordsSql = `
        WITH filtered AS (
          SELECT r.id, r."createdAt"
          FROM "Record" r
          JOIN "Table" t ON t.id = r."tableId"
          JOIN "Base" b ON b.id = t."baseId"
          WHERE b."ownerId" = $1 AND r."tableId" = $2
          ${filterClause ? `AND (${filterClause})` : ""}
        ),
        sorted AS (
          SELECT r.id, COUNT(*) OVER() as total_count
          FROM filtered r
          ${joinClause}
          ORDER BY ${orderClause}
          LIMIT ${limitParam}
          OFFSET ${offsetParam}
        )
        SELECT id, total_count FROM sorted;
      `;

      const rows = await ctx.db.$queryRawUnsafe<{ id: string; total_count: number }[]>(
        recordsSql,
        ...fetchParams,
      );

      const total = rows[0]?.total_count ?? 0;
      const sliced = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? encodeCursor(offset + limit) : null;
      const recordIds = sliced.map((row) => row.id);

      const records = await ctx.db.record.findMany({
        where: { id: { in: recordIds } },
        select: {
          id: true,
          cells: {
            where: hiddenFieldIds.length ? { fieldId: { notIn: hiddenFieldIds } } : undefined,
            select: {
              id: true,
              recordId: true,
              fieldId: true,
              valueText: true,
              valueNumber: true,
            },
          },
        },
      });
      const recordMap = new Map(records.map((r) => [r.id, r]));
      const orderedRecords = recordIds
        .map((id) => recordMap.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));

      return {
        records: orderedRecords,
        nextCursor,
        total,
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
        },
        select: { id: true },
      });

      return { record: { id: record.id }, cells: [] };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        recordId: z.string(),
        fieldId: z.string(),
        value: z.union([z.string(), z.number(), z.null()]).optional(),
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

      const data =
        field.type === FieldType.NUMBER
          ? { valueNumber: asNumber(), valueText: null }
          : {
              valueText:
                input.value === null || input.value === undefined
                  ? null
                  : String(input.value),
              valueNumber: null,
            };

      const existing = await ctx.db.cell.findFirst({
        where: { recordId: record.id, fieldId: field.id },
        select: { id: true },
      });

      const cell = existing
        ? await ctx.db.cell.update({ where: { id: existing.id }, data })
        : await ctx.db.cell.create({
            data: {
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
      const chunkSize = Math.min(input.chunkSize ?? 1_000, 5_000);
      const batchSize = Math.min(totalToInsert, chunkSize);

      const newRecords = await ctx.db.record.createManyAndReturn({
        data: Array.from({ length: batchSize }).map(() => ({
          tableId: table.id,
        })),
        select: { id: true },
      });

      const cellsPayload = newRecords.flatMap((record) =>
        fields.map((field) => ({
          recordId: record.id,
          fieldId: field.id,
          valueText:
            field.type === FieldType.NUMBER
              ? null
              : field.name.toLowerCase().includes("name")
                ? faker.person.fullName()
                : faker.lorem.sentence(4),
          valueNumber:
            field.type === FieldType.NUMBER
              ? faker.number.int({ min: 1, max: 1000 })
              : null,
        })),
      );

      if (cellsPayload.length) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < cellsPayload.length; i += CHUNK_SIZE) {
          const chunk = cellsPayload.slice(i, i + CHUNK_SIZE);
          await ctx.db.cell.createMany({ data: chunk, skipDuplicates: true });
        }
      }

      const inserted = newRecords.length;
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
