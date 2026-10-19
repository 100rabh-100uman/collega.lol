import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { OrderService, CatalogService } from "@/modules/smart-ordering";
import { ValidationError } from "@/core/errors";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(new ValidationError("Invalid JSON request body"));
    }
    const order = await OrderService.createOrder(session, body);
    return apiSuccess(order, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const orders = await CatalogService.listStudentOrders(session, activeOnly);
    return apiSuccess(orders);
  } catch (error) {
    return apiError(error);
  }
}
