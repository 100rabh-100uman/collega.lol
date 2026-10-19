import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * POST /api/shops/[shopId]/staff/sessions/[sessionId]/revoke
 * Immediately revokes an active staff session.
 * Subsequent API requests using this session will fail with 401 Unauthorized.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shopId: string; sessionId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId, sessionId } = await params;

    const result = await StaffAccessService.revokeStaffSession(
      session,
      shopId,
      sessionId
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
