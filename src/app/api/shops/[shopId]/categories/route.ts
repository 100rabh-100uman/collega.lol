import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * GET /api/shops/[shopId]/categories
 * Retrieves all categories and their products for shop menu management.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    const categories = await CatalogService.listManagerCategories(session, shopId);
    return apiSuccess(categories);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/shops/[shopId]/categories
 * Creates a new category under the shop.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function POST(
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
    const category = await CatalogService.createCategory(session, shopId, body);
    return apiSuccess(category, 201);
  } catch (error) {
    return apiError(error);
  }
}
