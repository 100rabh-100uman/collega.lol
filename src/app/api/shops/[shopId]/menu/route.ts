import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    const menu = await CatalogService.getShopMenu(session, shopId);
    return apiSuccess(menu);
  } catch (error) {
    return apiError(error);
  }
}
