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
