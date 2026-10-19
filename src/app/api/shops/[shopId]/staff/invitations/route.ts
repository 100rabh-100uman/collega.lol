import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * POST /api/shops/[shopId]/staff/invitations
 * Generates a single-use staff invitation with a QR link token and 10-digit PIN.
 * Strictly requires OWNER or MANAGER shop role.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;
    let body: { expiryMinutes?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional, default 15 minutes
    }

    const expiryMinutes = body?.expiryMinutes && typeof body.expiryMinutes === "number" && body.expiryMinutes > 0
      ? Math.min(body.expiryMinutes, 120)
      : 15;

    const invitation = await StaffAccessService.generateStaffInvitation(
      session,
      shopId,
      expiryMinutes
    );

    return apiSuccess(invitation, 201);
  } catch (error) {
    return apiError(error);
  }
}
