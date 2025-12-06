import { FieldType } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

const DEFAULT_FIELDS = [
  { name: "Name", type: FieldType.TEXT, order: 0 },
  { name: "Notes", type: FieldType.TEXT, order: 1 },
];
const DEFAULT_RECORD_COUNT = 5;

export const baseRouter = createTRPCRouter({
  // Fetch all bases (owned by the logged-in user)
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Fetch a single base by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.base.findUnique({
        where: { id: input.id },
        include: {
          tables: true, 
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

        // seed default fields
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

        // seed default records + cells
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

        return tx.base.findUniqueOrThrow({
          where: { id: base.id },
          include: { tables: true },
        });
      });
    }),

  // Delete a base owned by the current user
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.base.deleteMany({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      return { deleted: result.count };
    }),
});
