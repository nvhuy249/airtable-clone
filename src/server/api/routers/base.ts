import { faker } from "@faker-js/faker";
import { FieldType } from "../../../../generated/prisma";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

const DEFAULT_FIELDS = [
  { name: "Name", type: FieldType.TEXT, order: 0 },
  { name: "Notes", type: FieldType.TEXT, order: 1 },
  { name: "Numbers", type: FieldType.NUMBER, order: 2 },
];
const DEFAULT_RECORD_COUNT = 5;

export const baseRouter = createTRPCRouter({
  // Fetch all bases (owned by the logged-in user)
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      include: { tables: true}
    });
  }),

  // Fetch a single base by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
        select: {
          id: true,
          name: true,
          tables: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),

  markOpened: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.base.update({
        where: { id: input.id },
        data: { updatedAt: new Date() },
        select: { id: true, updatedAt: true },
      });
    }),

  // Create new base
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const base = await tx.base.create({
          data: {
            name: input.name,
            ownerId: ctx.session.user.id,
          },
        });

        const table = await tx.table.create({
          data: {
            name: "Table 1",
            baseId: base.id,
          },
        });

        // seed default fields and faker data
        const [fields, records] = await Promise.all([
          tx.field.createManyAndReturn({
            data: DEFAULT_FIELDS.map((f) => ({
              ...f,
              tableId: table.id,
            })),
            select: { id: true, name: true, type: true },
          }),
          tx.record.createManyAndReturn({
            data: Array.from({ length: DEFAULT_RECORD_COUNT }).map(() => ({
              tableId: table.id,
            })),
            select: { id: true },
          }),
        ]);

        if (records.length && fields.length) {
          await tx.cell.createMany({
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
                  field.type === FieldType.NUMBER ? faker.number.int({ min: 1, max: 1000 }) : null,
                valueBoolean:
                  field.type === FieldType.BOOLEAN ? faker.datatype.boolean() : null,
              })),
            ),
          });
        }

        return {
          ...base,
          tables: [table],
        };
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
        select: { id: true },
      });

      if (!base) {
        return { id: input.id, name: input.name, updatedAt: new Date() };
      }

      return ctx.db.base.update({
        where: { id: base.id },
        data: { name: input.name },
        select: { id: true, name: true, updatedAt: true },
      });
    }),

  // Delete a base owned by the current user
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) {
        return { deleted: 0 };
      }

      const tables = await ctx.db.table.findMany({
        where: { baseId: base.id },
        select: { id: true },
      });
      const tableIds = tables.map((t) => t.id);

      const BATCH = 10_000;
      const deleteInChunks = async <T>(
        ids: T[],
        chunkSize: number,
        action: (chunk: T[]) => Promise<void>,
      ) => {
        for (let i = 0; i < ids.length; i += chunkSize) {
          const slice = ids.slice(i, i + chunkSize);
          if (slice.length) {
            await action(slice);
          }
        }
      };

      if (tableIds.length) {
        const recordIds = await ctx.db.record.findMany({
          where: { tableId: { in: tableIds } },
          select: { id: true },
        });
        const fieldIds = await ctx.db.field.findMany({
          where: { tableId: { in: tableIds } },
          select: { id: true },
        });

        const recordIdList = recordIds.map((r) => r.id);
        const fieldIdList = fieldIds.map((f) => f.id);

        // Delete cells and records in batches to avoid long-running transactions.
        await deleteInChunks(recordIdList, BATCH, async (chunk) => {
          await ctx.db.cell.deleteMany({ where: { recordId: { in: chunk } } });
          await ctx.db.record.deleteMany({ where: { id: { in: chunk } } });
        });

        // Clean up any remaining cells tied to fields, then delete fields.
        await deleteInChunks(fieldIdList, BATCH, async (chunk) => {
          await ctx.db.cell.deleteMany({ where: { fieldId: { in: chunk } } });
          await ctx.db.field.deleteMany({ where: { id: { in: chunk } } });
        });

        // Delete tables in one go (table count is typically small).
        await ctx.db.table.deleteMany({ where: { id: { in: tableIds } } });
      }

      const result = await ctx.db.base.deleteMany({
        where: { id: base.id, ownerId: ctx.session.user.id },
      });

      return { deleted: result.count };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), copyRecords: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const originalBase = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
        include: {
          tables: {
            include: {
              fields: true,
              records: { include: { cells: true }}
            },
          },
        },
      });
      if (!originalBase) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.$transaction(async (tx) => {
        const newBase = await tx.base.create({
          data: {
            name: input.name ?? `${originalBase.name} Copy`,
            ownerId: ctx.session.user.id,
          },
        });

        for (const table of originalBase.tables) {
          const newTable = await tx.table.create({
            data: {
              name: table.name,
              baseId: newBase.id,
            },
          });

          const newFields = await tx.field.createManyAndReturn({
            data: table.fields.map((f) => ({
              name: f.name,
              type: f.type,
              order: f.order,
              tableId: newTable.id,
            })),
            select: { id: true, name: true, type: true, order: true },
          });
          const fieldIdMap = Object.fromEntries(
            newFields.map((nf, idx) => [table.fields[idx]!.id, nf.id]),
          );

          if (input.copyRecords) {
            const newRecords = await tx.record.createManyAndReturn({
              data: table.records.map(() => ({ tableId: newTable.id })),
                select: { id: true },
              });
            const recordIdMap = Object.fromEntries(
              table.records.map((r, idx) => [r.id, newRecords[idx]!.id]),
            );

            const cellsPayload = table.records.flatMap((r) =>
              r.cells.map((c) => {
                const recordId = recordIdMap[r.id];
                const fieldId = fieldIdMap[c.fieldId];
                if (!recordId || !fieldId) return null; // skip/guard
                return {
                  recordId,
                  fieldId,
                  valueText: c.valueText,
                  valueNumber: c.valueNumber,
                  valueBoolean: c.valueBoolean,
                };
              }),
            ).filter(Boolean) as {
              recordId: string;
              fieldId: string;
              valueText: string | null;
              valueNumber: number | null;
              valueBoolean: boolean | null;
            }[];

            const CHUNK = 1000;
            for (let i = 0; i < cellsPayload.length; i += CHUNK) {
              const chunk = cellsPayload.slice(i, i + CHUNK);
              await tx.cell.createMany({ data: chunk });
            }
          }
          else {
            const DEFAULT_RECORD_COUNT = 5;
            const newRecords = await tx.record.createManyAndReturn({
              data: Array.from({ length: DEFAULT_RECORD_COUNT }).map(() => ({
                tableId: newTable.id,
              })),
              select: { id: true },
            });

            const cellsPayload = newRecords.flatMap((record) =>
              newFields.map((f) => ({
                recordId: record.id,
                fieldId: f.id,
                valueText:
                  f.type === FieldType.NUMBER || f.type === FieldType.BOOLEAN
                    ? null
                    : f.name.toLowerCase().includes("name")
                      ? faker.person.fullName()
                      : faker.lorem.sentence(4),
                valueNumber:
                  f.type === FieldType.NUMBER ? faker.number.int({ min: 1, max: 1000 }) : null,
                valueBoolean:
                  f.type === FieldType.BOOLEAN ? faker.datatype.boolean() : null,
              })),
            );

            const CHUNK = 1000;
            for (let i = 0; i < cellsPayload.length; i += CHUNK) {
              await tx.cell.createMany({ data: cellsPayload.slice(i, i + CHUNK) });
            }
          }
        }

        return newBase;
      });
    }),
});
