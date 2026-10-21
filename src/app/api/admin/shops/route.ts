import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { AdminShopService } from "@/modules/smart-ordering";

/**
 * GET /api/admin/shops
 * Lists shops for administration including inactive ones.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const { searchParams } = new URL(request.url);
    const campusId = searchParams.get("campusId") || undefined;
    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status");
    const status = statusParam === "active" || statusParam === "inactive" ? statusParam : "all";

    const shops = await AdminShopService.listShops(session, {
      campusId,
      search,
      status,
    });
    return apiSuccess(shops);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/admin/shops
 * Provisions a new shop under an authorized campus.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }

    const shop = await AdminShopService.createShop(session, body);
    return apiSuccess(shop, 201);
  } catch (error) {
    return apiError(error);
  }
}
