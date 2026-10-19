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
    const order = await OrderService.acceptOrder(session, id);
    return apiSuccess(order);
  } catch (error) {
    return apiError(error);
  }
}
