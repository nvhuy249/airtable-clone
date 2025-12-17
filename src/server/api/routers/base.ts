import { faker } from "@faker-js/faker";
import { FieldType } from "../../../../generated/prisma";
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
      orderBy: { createdAt: "desc" },
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
                  field.type === FieldType.NUMBER
                    ? null
                    : field.name.toLowerCase().includes("name")
                      ? faker.person.fullName()
                      : faker.lorem.sentence(4),
                valueNumber:
                  field.type === FieldType.NUMBER ? faker.number.int({ min: 1, max: 1000 }) : null,
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
      return ctx.db.$transaction(
        async (tx) => {
          const base = await tx.base.findFirst({
            where: { id: input.id, ownerId: ctx.session.user.id },
            select: { id: true },
          });
          if (!base) {
            return { deleted: 0 };
          }

          const tables = await tx.table.findMany({
            where: { baseId: base.id },
            select: { id: true },
          });
          const tableIds = tables.map((t) => t.id);

          if (tableIds.length) {
            const recordIds = await tx.record.findMany({
              where: { tableId: { in: tableIds } },
              select: { id: true },
            });
            const fieldIds = await tx.field.findMany({
              where: { tableId: { in: tableIds } },
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

            await tx.table.deleteMany({ where: { id: { in: tableIds } } });
          }

          const result = await tx.base.deleteMany({
            where: { id: base.id, ownerId: ctx.session.user.id },
          });

          return { deleted: result.count };
        },
        { timeout: 20000 },
      );
    }),
});
