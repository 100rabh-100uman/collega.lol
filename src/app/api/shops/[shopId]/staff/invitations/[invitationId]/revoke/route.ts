import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * POST /api/shops/[shopId]/staff/invitations/[invitationId]/revoke
 * Revokes a pending staff invitation before redemption.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shopId: string; invitationId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId, invitationId } = await params;

    const result = await StaffAccessService.revokeStaffInvitation(
      session,
      shopId,
      invitationId
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
