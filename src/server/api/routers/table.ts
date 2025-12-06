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
        include: {
          fields: { orderBy: { order: "asc" } },
          records: {
            orderBy: { createdAt: "asc" },
            include: { cells: true },
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
      const tableName = input.name?.trim() || `Table ${nextIndex}`;

      const fullTable = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: {
            name: tableName,
            baseId: base.id,
          },
        });

        await tx.field.createMany({
          data: DEFAULT_FIELDS.map((f) => ({
            ...f,
            tableId: table.id,
          })),
        });
        const fields = await tx.field.findMany({
          where: { tableId: table.id },
          orderBy: { order: "asc" },
        });

        const records = await Promise.all(
          Array.from({ length: DEFAULT_RECORD_COUNT }).map(() =>
            tx.record.create({
              data: {
                tableId: table.id,
              },
            }),
          ),
        );

        await Promise.all(
          records.map((record) =>
            tx.cell.createMany({
              data: fields.map((field) => ({
                recordId: record.id,
                fieldId: field.id,
                valueText: null,
                valueNumber: null,
              })),
            }),
          ),
        );

        return tx.table.findUnique({
          where: { id: table.id },
          include: {
            fields: { orderBy: { order: "asc" } },
            records: {
              orderBy: { createdAt: "asc" },
              include: { cells: true },
            },
          },
        });
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
        include: {
          fields: true,
          records: { select: { id: true } },
        },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const order = table.fields.length;
      const fieldName = input.name?.trim() || `Field ${order + 1}`;

      const { field, cells } = await ctx.db.$transaction(async (tx) => {
        const newField = await tx.field.create({
          data: {
            name: fieldName,
            type: input.type,
            order,
            tableId: table.id,
          },
        });

        if (table.records.length) {
          await tx.cell.createMany({
            data: table.records.map((record) => ({
              recordId: record.id,
              fieldId: newField.id,
              valueText: null,
              valueNumber: null,
            })),
          });
        }

        const cells = await tx.cell.findMany({
          where: { fieldId: newField.id },
        });

        return { field: newField, cells };
      });

      return {
        field,
        cells,
      };
    }),

  addRecord: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        include: { fields: { orderBy: { order: "asc" } } },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const record = await tx.record.create({
          data: {
            tableId: table.id,
            cells: {
              create: table.fields.map((field) => ({
                fieldId: field.id,
                valueText: null,
                valueNumber: null,
              })),
            },
          },
        });

        const cells = await tx.cell.findMany({
          where: { recordId: record.id },
        });

        return { record, cells };
      });

      return result;
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
        include: { table: true },
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
});
