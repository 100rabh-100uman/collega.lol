import { z } from "zod";

export const createShopInputSchema = z
  .object({
    campusId: z.string().uuid("Invalid campus UUID"),
    name: z.string().trim().min(2, "Shop name must be at least 2 characters").max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(60)
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must only contain lowercase alphanumeric characters and hyphens"
      ),
    description: z.string().trim().max(500).optional().nullable(),
    location: z.string().trim().min(2, "Location is required").max(200),
    autoAcceptOrders: z.boolean().default(false),
    isOpen: z.boolean().default(false),
    isActive: z.boolean().default(true),
    logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
    bannerUrl: z.string().url("Invalid banner URL").optional().nullable(),
    initialOwnerUserId: z.string().min(1, "Initial owner user ID cannot be empty").optional(),
  })
  .strict();

export type CreateShopInput = z.input<typeof createShopInputSchema>;

export const updateShopInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().trim().max(500).nullable().optional(),
    location: z.string().trim().min(2).max(200).optional(),
    isActive: z.boolean().optional(),
    isOpen: z.boolean().optional(),
    autoAcceptOrders: z.boolean().optional(),
    logoUrl: z.string().url().nullable().optional(),
    bannerUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Request body cannot be empty",
  });

export type UpdateShopInput = z.infer<typeof updateShopInputSchema>;

export const assignShopMemberInputSchema = z
  .object({
    userId: z.string().min(1, "User ID is required"),
    role: z.enum(["OWNER", "MANAGER", "STAFF"], {
      message: "Role must be OWNER, MANAGER, or STAFF",
    }),
  })
  .strict();

export type AssignShopMemberInput = z.infer<typeof assignShopMemberInputSchema>;
