import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * GET /api/shops
 * Returns all active shops within the authenticated student's campus.
 * Strictly enforces campus isolation at the database layer.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const shops = await CatalogService.listShops(session);
    return apiSuccess(shops);
  } catch (error) {
    return apiError(error);
  }
}
