import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * GET /api/shops/public/[slug]
 * Returns public metadata for a single shop by slug or ID.
 * Strictly public read-only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const shop = await CatalogService.getPublicShopBySlug(slug);
    return apiSuccess(shop);
  } catch (error) {
    return apiError(error);
  }
}
