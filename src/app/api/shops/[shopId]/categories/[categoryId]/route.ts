import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * PATCH /api/shops/[shopId]/categories/[categoryId]
 * Updates category details (name, slug, sortOrder, isAvailable).
 * Strictly requires OWNER or MANAGER shop role and enforces shop tenant isolation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shopId: string; categoryId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId, categoryId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }
    const updatedCategory = await CatalogService.updateCategory(session, shopId, categoryId, body);
    return apiSuccess(updatedCategory);
  } catch (error) {
    return apiError(error);
  }
}
