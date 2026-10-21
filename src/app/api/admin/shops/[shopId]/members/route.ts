import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { AdminShopService } from "@/modules/smart-ordering";

/**
 * GET /api/admin/shops/[shopId]/members
 * Lists all active and inactive members of a shop.
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    const members = await AdminShopService.listShopMembers(session, shopId);
    return apiSuccess(members);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/admin/shops/[shopId]/members
 * Assigns or updates a user's role on a shop (OWNER, MANAGER, STAFF).
 * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
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

    const member = await AdminShopService.assignShopMember(session, shopId, body);
    return apiSuccess(member, 201);
  } catch (error) {
    return apiError(error);
  }
}
