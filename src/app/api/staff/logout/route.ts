import { cookies } from "next/headers";
import { apiSuccess, apiError } from "@/core/api/response";

/**
 * POST /api/staff/logout
 * Clears the mobile counter staff session cookie.
 */
export async function POST() {
  try {
    try {
      const cookieStore = await cookies();
      cookieStore.delete("collega_staff_token");
    } catch {
      // Ignored outside cookie context
    }

    return apiSuccess({ success: true, loggedOut: true });
  } catch (error) {
    return apiError(error);
  }
}
