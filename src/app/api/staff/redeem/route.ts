import { cookies } from "next/headers";
import { apiSuccess, apiError } from "@/core/api/response";
import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

/**
 * POST /api/staff/redeem
 * Validates and redeems a dual-factor staff invitation (URL token + 10-digit code).
 * Creates a server-persisted staff session and sets an HTTP-only session cookie.
 */
export async function POST(request: Request) {
  try {
    let body: { token?: string; code?: string } = {};
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }

    const { token, code } = body;
    if (!token || !code) {
      return apiError(new Error("Both invitation token and 10-digit code are required"));
    }

    const result = await StaffAccessService.redeemStaffInvitation(token, code);

    // Persist staff session cookie
    try {
      const cookieStore = await cookies();
      cookieStore.set("collega_staff_token", result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 60 * 60, // 8-hour shift expiry
      });
    } catch {
      // In test environments where cookieStore may not be available
    }

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
