import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";
import { z } from "zod";

const patchShopSchema = z.object({
  isOpen: z.boolean({ message: "isOpen boolean is required" }),
});

/**
 * PATCH /api/shops/[shopId]
 * Allows shop OWNER or MANAGER to toggle the shop open/closed status (pause/resume ordering).
 * Strictly checked against server-side shop memberships.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }
    const validated = patchShopSchema.parse(body);
    const updatedShop = await CatalogService.toggleShopOpen(session, shopId, validated.isOpen);
    return apiSuccess(updatedShop);
  } catch (error) {
    return apiError(error);
  }
}
