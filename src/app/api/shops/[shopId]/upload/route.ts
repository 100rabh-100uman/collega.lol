import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { CatalogService } from "@/modules/smart-ordering";
import { ValidationError } from "@/core/errors";

/**
 * POST /api/shops/[shopId]/upload
 * Uploads a product photo to Supabase Storage.
 * Strictly requires OWNER or MANAGER shop role.
 * Validates file presence, format (JPEG, PNG, WebP, GIF), and size (<5MB).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await requireSession(request);
    const { shopId } = await params;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError(new ValidationError("Invalid form data submission"));
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return apiError(new ValidationError("An image file must be provided under the 'file' field"));
    }

    const blob = file as Blob;
    const mimeType = blob.type;

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await CatalogService.uploadProductImage(
      session,
      shopId,
      buffer,
      mimeType
    );

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
