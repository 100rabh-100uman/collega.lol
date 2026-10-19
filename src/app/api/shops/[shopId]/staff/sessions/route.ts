import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * GET /api/shops/[shopId]/staff/sessions
 * Returns currently connected active staff sessions, pending invitations, and active count.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;

    const data = await StaffAccessService.listStaffSessions(session, shopId);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
