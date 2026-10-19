import { cookies } from "next/headers";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * GET /api/staff/session
 * Validates the caller's staff session token.
 * Used by mobile staff view for heartbeat checks and detecting manager revocation.
 */
export async function GET(request: Request) {
  try {
    let staffToken: string | undefined;

    staffToken = request.headers.get("x-collega-staff-token") || undefined;
    const authHeader = request.headers.get("authorization");
    if (!staffToken && authHeader?.startsWith("Bearer ")) {
      staffToken = authHeader.slice(7).trim();
    }

    if (!staffToken) {
      try {
        const cookieStore = await cookies();
        staffToken = cookieStore.get("collega_staff_token")?.value;
      } catch {
        // Fallback for tests
      }
    }

    if (!staffToken) {
      return apiSuccess({ active: false, staffSession: null });
    }

    const sessionData = await StaffAccessService.validateStaffSessionToken(staffToken);

    if (!sessionData) {
      return apiSuccess({ active: false, staffSession: null });
    }

    return apiSuccess({
      active: true,
      staffSession: sessionData,
    });
  } catch (error) {
    return apiError(error);
  }
}
