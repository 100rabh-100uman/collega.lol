import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * POST /api/shops/[shopId]/products
 * Creates a new product in the shop's catalog.
 * Strictly requires OWNER or MANAGER shop role and enforces category belongs to the shop.
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
    const product = await CatalogService.createProduct(session, shopId, body);
    return apiSuccess(product, 201);
  } catch (error) {
    return apiError(error);
  }
}
