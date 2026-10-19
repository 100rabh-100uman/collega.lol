import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

/**
 * GET /api/shops/public
 * Returns public shop directory listings for campus shop discovery.
 * Strictly public read-only; never exposes roles, tokens, or private settings.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campusId = searchParams.get("campusId") || undefined;
    const shops = await CatalogService.listPublicShops(campusId);
    return apiSuccess(shops);
  } catch (error) {
    return apiError(error);
  }
}
