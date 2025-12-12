import { z } from "zod";

/**
 * Shared schemas for saved view configuration.
 * Keep this in sync with table filtering/sorting logic.
 */
export const viewFilterConditionSchema = z.object({
  fieldId: z.string(),
  operator: z.enum([
    "contains",
    "not_contains",
    "is",
    "is_not",
    "is_empty",
    "is_not_empty",
    "greater_than",
    "less_than",
    "greater_than_or_equal",
    "less_than_or_equal",
  ]),
  value: z.string().default(""),
});

export const viewFiltersSchema = z.object({
  connector: z.enum(["and", "or"]).default("and"),
  conditions: z.array(viewFilterConditionSchema).default([]),
});

export const viewSortSchema = z.object({
  fieldId: z.string(),
  direction: z.enum(["asc", "desc"]),
});

export const viewConfigSchema = z.object({
  filters: viewFiltersSchema.default({ connector: "and", conditions: [] }),
  sorts: z.array(viewSortSchema).default([]),
  search: z.string().default(""),
  hiddenFieldIds: z.array(z.string()).default([]),
});

export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const defaultViewConfig: ViewConfig = {
  filters: { connector: "and", conditions: [] },
  sorts: [],
  search: "",
  hiddenFieldIds: [],
};

export const parseViewConfig = (config: unknown): ViewConfig =>
  viewConfigSchema.parse(config ?? {});
