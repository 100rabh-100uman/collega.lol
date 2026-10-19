import { z } from "zod";

export const createCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(60, "Category name cannot exceed 60 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Category slug is required")
    .max(60, "Category slug cannot exceed 60 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric characters separated by hyphens (e.g. 'hot-meals')"
    ),
  sortOrder: z.number().int().min(0).default(0),
  isAvailable: z.boolean().default(true),
});

export const updateCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(60, "Category name cannot exceed 60 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Category slug is required")
    .max(60, "Category slug cannot exceed 60 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric characters separated by hyphens"
    )
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
});

export const createProductInputSchema = z.object({
  categoryId: z.string().uuid("A valid category must be selected"),
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(100, "Product name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  price: z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Price must be a valid positive amount with up to 2 decimal places (e.g. '120.00')"
    )
    .refine((val) => Number(val) > 0, "Price must be greater than zero"),
  imageUrl: z
    .string()
    .trim()
    .url("Image URL must be a valid URL")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  isAvailable: z.boolean().default(true),
  preparationTimeMins: z
    .number()
    .int("Preparation time must be a whole number of minutes")
    .min(1, "Preparation time must be at least 1 minute")
    .max(180, "Preparation time cannot exceed 180 minutes")
    .default(10),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateProductInputSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID").optional(),
  name: z
    .string()
    .trim()
    .min(1, "Product name cannot be empty")
    .max(100, "Product name cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  price: z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Price must be a valid positive amount with up to 2 decimal places"
    )
    .refine((val) => Number(val) > 0, "Price must be greater than zero")
    .optional(),
  imageUrl: z
    .string()
    .trim()
    .url("Image URL must be a valid URL")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  isAvailable: z.boolean().optional(),
  preparationTimeMins: z
    .number()
    .int("Preparation time must be a whole number")
    .min(1, "Preparation time must be at least 1 minute")
    .max(180, "Preparation time cannot exceed 180 minutes")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
