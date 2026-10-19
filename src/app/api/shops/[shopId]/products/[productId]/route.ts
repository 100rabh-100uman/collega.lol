import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * PATCH /api/shops/[shopId]/products/[productId]
 * Updates product details, prices, category, availability, or images.
 * Strictly requires OWNER or MANAGER shop role and enforces shop tenant isolation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shopId: string; productId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId, productId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }
    const updatedProduct = await CatalogService.updateProduct(session, shopId, productId, body);
    return apiSuccess(updatedProduct);
  } catch (error) {
    return apiError(error);
  }
}
