import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { OrderService } from "@/modules/smart-ordering";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(request);
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new Error("Invalid JSON request body"));
    }
    const order = await OrderService.rejectOrder(session, id, body);
    return apiSuccess(order);
  } catch (error) {
    return apiError(error);
  }
}
