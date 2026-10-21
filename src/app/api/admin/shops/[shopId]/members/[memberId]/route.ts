import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { AdminShopService } from "@/modules/smart-ordering";

/**
 * DELETE /api/admin/shops/[shopId]/members/[memberId]
 * Revokes a user's membership from a shop.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
 * Enforces concurrency-safe last active owner protection.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shopId: string; memberId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId, memberId } = await params;
    const result = await AdminShopService.revokeShopMember(session, shopId, memberId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
