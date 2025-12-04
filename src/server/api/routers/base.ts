import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";

export const baseRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  create: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.base.create({
        data: { name: input.name, ownerId: ctx.session?.user.id! },
      });
    }),
});
