import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "../errors";
import {
  PriceMismatchError,
  ShopClosedError,
  ProductUnavailableError,
} from "@/modules/smart-ordering/errors";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  mismatches?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(err: unknown): NextResponse<ApiErrorResponse> {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: err.issues[0]?.message || "Input validation failed",
          details: err.flatten(),
        },
      },
      { status: 400 }
    );
  }

  if (err instanceof PriceMismatchError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PRICE_MISMATCH",
          message: err.message,
          mismatches: err.mismatches,
        },
      },
      { status: 409 }
    );
  }

  if (err instanceof ShopClosedError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SHOP_CLOSED",
          message: err.message,
        },
      },
      { status: 409 }
    );
  }

  if (err instanceof ProductUnavailableError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PRODUCT_UNAVAILABLE",
          message: err.message,
        },
      },
      { status: 409 }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      { status: err.statusCode }
    );
  }

  // Fallback for unexpected internal errors (safe - no secrets leaked)
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An internal server error occurred.",
      },
    },
    { status: 500 }
  );
}
