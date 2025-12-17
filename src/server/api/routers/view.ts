import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { Prisma } from "../../../../generated/prisma";
import {
  defaultViewConfig,
  parseViewConfig,
  viewConfigSchema,
} from "~/server/viewConfig";

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      let views = await ctx.db.view.findMany({
        where: { tableId: input.tableId, table: { base: { ownerId: ctx.session.user.id } } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          config: true,
          tableId: true,
          order: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (views.length === 0) {
        const created = await ctx.db.view.create({
          data: {
            tableId: input.tableId,
            name: "Grid view",
            config: defaultViewConfig as Prisma.InputJsonValue,
            order: 0,
          },
          select: {
            id: true,
            name: true,
            config: true,
            tableId: true,
            order: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        views = [created];
      }

      return views.map((view, idx) => ({
        ...view,
        config: parseViewConfig(view.config),
        order: view.order ?? idx,
        isDefault: idx === 0,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().optional(),
        config: viewConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const existingViews = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        select: { name: true, order: true },
      });

      const existingNames = new Set(existingViews.map((v) => v.name));
      const rawName = input.name?.trim() ?? "";

      const deriveName = () => {
        if (rawName.length > 0 && !existingNames.has(rawName)) return rawName;
        if (existingViews.length === 0) return "Grid view";

        let maxGridNum = 1;
        existingViews.forEach((v) => {
          const normalized = v.name.trim().toLowerCase();
          if (normalized === "grid view" || normalized === "grid") {
            maxGridNum = Math.max(maxGridNum, 1);
            return;
          }
          const match = /^Grid\s+(\d+)$/i.exec(v.name);
          if (match) {
            const num = Number(match[1]);
            if (Number.isFinite(num)) {
              maxGridNum = Math.max(maxGridNum, num);
            }
          }
        });

        let nextNum = maxGridNum + 1;
        let candidate = `Grid ${nextNum}`;
        while (existingNames.has(candidate)) {
          nextNum += 1;
          candidate = `Grid ${nextNum}`;
        }
        return candidate;
      };

      const name = deriveName();

      const config = parseViewConfig(input.config ?? defaultViewConfig);
      const maxExistingOrder = existingViews.reduce(
        (max, v, idx) => Math.max(max, v.order ?? idx),
        -1,
      );
      const nextOrder = maxExistingOrder + 1;

      const view = await ctx.db.view.create({
        data: {
          tableId: input.tableId,
          name,
          config: config as Prisma.InputJsonValue,
          order: nextOrder,
        },
      });

      return { ...view, config, isDefault: existingViews.length === 0 };
    }),

  update: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        name: z.string().optional(),
        config: viewConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, config: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }

      const data: Prisma.ViewUpdateInput = {};

      if (input.name !== undefined) {
        const trimmed = input.name.trim();
        data.name = trimmed.length ? trimmed : "Untitled view";
      }

      if (input.config !== undefined) {
        data.config = parseViewConfig(input.config) as Prisma.InputJsonValue;
      }

      if (!data.name && !data.config) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to update" });
      }

      const view = await ctx.db.view.update({
        where: { id: input.viewId },
        data,
      });

      return { ...view, config: parseViewConfig(view.config) };
    }),

  delete: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true },
      });

      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }

      await ctx.db.view.delete({ where: { id: input.viewId } });

      return { viewId: input.viewId, tableId: view.tableId };
    }),

  reorder: protectedProcedure
    .input(z.object({ tableId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const views = await ctx.db.view.findMany({
        where: { tableId: input.tableId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true },
      });

      const existingIds = new Set(views.map((v) => v.id));
      const providedIds = new Set(input.orderedIds);

      if (existingIds.size === 0 || input.orderedIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No views to reorder" });
      }

      if (
        existingIds.size !== providedIds.size ||
        input.orderedIds.some((id) => !existingIds.has(id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ordered ids must include every view exactly once",
        });
      }

      await ctx.db.$transaction(
        input.orderedIds.map((id, idx) =>
          ctx.db.view.update({
            where: { id },
            data: { order: idx },
          }),
        ),
      );

      return { tableId: input.tableId, orderedIds: input.orderedIds };
    }),
});
