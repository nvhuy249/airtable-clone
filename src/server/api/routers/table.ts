import { FieldType } from "../../../../generated/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const DEFAULT_FIELDS = [
  { name: "Name", type: FieldType.TEXT, order: 0 },
  { name: "Notes", type: FieldType.TEXT, order: 1 },
];
const DEFAULT_RECORD_COUNT = 5;

export const tableRouter = createTRPCRouter({
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.id,
          base: { ownerId: ctx.session.user.id },
        },
        select: {
          id: true,
          name: true,
          baseId: true,
          fields: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, type: true, order: true, isHidden: true },
          },
          records: {
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
          },
        },
      });

      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return table;
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
                    valueText: null,
                    valueNumber: null,
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
          fields: orderedFields,
          records: recordsWithCells,
        };
      });

      if (!fullTable) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return fullTable;
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

        if (recordIds.length) {
          await tx.cell.deleteMany({
            where: { recordId: { in: recordIds.map((r) => r.id) } },
          });
          await tx.record.deleteMany({ where: { tableId: input.tableId } });
        }
        if (fieldIds.length) {
          await tx.field.deleteMany({ where: { tableId: input.tableId } });
        }
        await tx.table.delete({ where: { id: input.tableId } });
      });

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
    })
});
