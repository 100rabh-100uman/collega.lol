import { ConflictError } from "@/core/errors";
import type { PriceMismatchDetail } from "../types";

export class PriceMismatchError extends ConflictError {
  public readonly mismatches: PriceMismatchDetail[];

  constructor(mismatches: PriceMismatchDetail[]) {
    super(
      `Price mismatch detected on ${mismatches.length} item(s). Explicit client confirmation of updated prices is required.`
    );
    this.name = "PriceMismatchError";
    this.mismatches = mismatches;
  }
}

export class ShopClosedError extends ConflictError {
  constructor(shopName: string) {
    super(`Cannot place order: '${shopName}' is currently closed.`);
    this.name = "ShopClosedError";
  }
}

export class ProductUnavailableError extends ConflictError {
  constructor(productName: string) {
    super(`Cannot place order: Item '${productName}' is currently out of stock / unavailable.`);
    this.name = "ProductUnavailableError";
  }
}
