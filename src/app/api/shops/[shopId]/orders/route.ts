import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";
import type { OrderStatus } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const statusFilter = statusParam
      ? (statusParam.split(",").map((s) => s.trim()) as OrderStatus[])
      : undefined;

    const orders = await CatalogService.listShopOrderQueue(
      session,
      shopId,
      statusFilter
    );
    return apiSuccess(orders);
  } catch (error) {
    return apiError(error);
  }
}
