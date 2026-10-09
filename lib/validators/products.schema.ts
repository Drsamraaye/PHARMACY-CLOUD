import { z } from "zod";

const nonNegativeAmount = z.coerce.number().finite().min(0, "Value cannot be negative");
const optionalText = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(160).optional());

/** Validates catalog creation, including optional opening stock and its expiry date. */
export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(160),
  category: optionalText,
  barcode: optionalText,
  type: z.enum(["PHARMACY", "LAB", "SERVICE"]).default("PHARMACY"),
  reorderPoint: z.coerce.number().int().finite().min(0).default(0),
  salePrice: nonNegativeAmount.default(0),
  costPrice: nonNegativeAmount.default(0),
  quantity: z.coerce.number().int().finite().min(0).default(0),
  expiryDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Expiry date is invalid"),
});

/** Validates partial catalog edits and archive/reactivate requests. */
export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(160).nullable().optional(),
  barcode: z.string().trim().max(160).nullable().optional(),
  type: z.enum(["PHARMACY", "LAB", "SERVICE"]).optional(),
  reorderPoint: z.coerce.number().int().finite().min(0).optional(),
  salePrice: nonNegativeAmount.optional(),
  costPrice: nonNegativeAmount.optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one product field to update");

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
