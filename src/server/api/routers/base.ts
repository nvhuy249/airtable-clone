import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

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
      return ctx.db.base.create({
        data: {
          name: input.name,
          ownerId: ctx.session.user.id,
        },
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
