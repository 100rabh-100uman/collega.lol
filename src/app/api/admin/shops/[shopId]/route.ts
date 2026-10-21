import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { AdminShopService } from "@/modules/smart-ordering";

/**
 * GET /api/admin/shops/[shopId]
 * Returns administrative shop details by shopId regardless of active status.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    const shop = await AdminShopService.getShopById(session, shopId);
    return apiSuccess(shop);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * PATCH /api/admin/shops/[shopId]
 * Updates shop metadata, configuration, or administrative activation.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
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

    const updatedShop = await AdminShopService.updateShop(session, shopId, body);
    return apiSuccess(updatedShop);
  } catch (error) {
    return apiError(error);
  }
}
