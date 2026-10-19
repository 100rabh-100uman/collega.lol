import assert from "node:assert/strict";
import {
  canTransitionOrder,
  assertValidOrderTransition,
  InvalidOrderStateTransitionError,
  ALLOWED_ORDER_TRANSITIONS,
} from "../src/modules/smart-ordering/services/order-state-machine";
import {
  createOrderInputSchema,
  cancelOrderInputSchema,
  rejectOrderInputSchema,
} from "../src/modules/smart-ordering/validation/order.schema";
import {
  PriceMismatchError,
  ShopClosedError,
  ProductUnavailableError,
} from "../src/modules/smart-ordering/errors";
import {
  parsePriceToPaise,
  formatPriceINR,
  formatPaiseToINR,
  calculateSubtotalPaise,
} from "../src/lib/currency";

console.log("=== Running Smart Ordering State Machine & Validation Unit Tests ===");

// 1. Primary Happy Path
{
  assert.equal(canTransitionOrder("PLACED", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("CONFIRMED", "PREPARING"), true);
  assert.equal(canTransitionOrder("PREPARING", "READY"), true);
  assert.equal(canTransitionOrder("READY", "PICKED_UP"), true);
  assert.equal(canTransitionOrder("PICKED_UP", "COMPLETED"), true);
  console.log("✔ Primary happy path transitions verified.");
}

// 2. Canonical Exceptional Outcomes from PLACED
{
  assert.equal(canTransitionOrder("PLACED", "REJECTED"), true);
  assert.equal(canTransitionOrder("PLACED", "CANCELLED"), true);
  assert.equal(canTransitionOrder("PLACED", "EXPIRED"), true);
  assert.equal(canTransitionOrder("PLACED", "FAILED"), true);
  console.log("✔ PLACED exceptional outcomes verified.");
}

// 3. Strict Cancellation & Rejection Guards
{
  // Student CANNOT cancel once order is accepted or in preparation
  assert.equal(canTransitionOrder("CONFIRMED", "CANCELLED"), false);
  assert.equal(canTransitionOrder("PREPARING", "CANCELLED"), false);
  assert.equal(canTransitionOrder("READY", "CANCELLED"), false);

  // Shop CANNOT reject once order is accepted
  assert.equal(canTransitionOrder("CONFIRMED", "REJECTED"), false);
  assert.equal(canTransitionOrder("PREPARING", "REJECTED"), false);

  // Illegal skips
  assert.equal(canTransitionOrder("PLACED", "READY"), false);
  assert.equal(canTransitionOrder("PLACED", "PICKED_UP"), false);
  assert.equal(canTransitionOrder("CONFIRMED", "COMPLETED"), false);

  console.log("✔ Illegal state jumps and post-acceptance cancellation/rejection blocked.");
}

// 4. Terminal State Immutability
{
  const terminalStates = ["COMPLETED", "REJECTED", "CANCELLED", "EXPIRED", "FAILED"] as const;
  for (const term of terminalStates) {
    assert.deepEqual(ALLOWED_ORDER_TRANSITIONS[term], []);
    assert.equal(canTransitionOrder(term, "PLACED"), false);
    assert.equal(canTransitionOrder(term, "CONFIRMED"), false);
    assert.throws(
      () => assertValidOrderTransition(term, "CONFIRMED"),
      InvalidOrderStateTransitionError
    );
  }
  console.log("✔ Terminal states are strictly immutable.");
}

// 5. Validation Schemas
{
  // Valid Create Order Input
  const validOrder = {
    shopId: "550e8400-e29b-41d4-a716-446655440000",
    items: [
      {
        productId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        quantity: 2,
        expectedUnitPrice: "45.00",
        specialInstructions: "Extra crispy",
      },
    ],
  };
  assert.doesNotThrow(() => createOrderInputSchema.parse(validOrder));

  // Invalid quantity (negative or 0)
  assert.throws(
    () =>
      createOrderInputSchema.parse({
        ...validOrder,
        items: [{ ...validOrder.items[0], quantity: 0 }],
      }),
    /Quantity must be greater than zero/
  );

  // Invalid expected price format
  assert.throws(
    () =>
      createOrderInputSchema.parse({
        ...validOrder,
        items: [{ ...validOrder.items[0], expectedUnitPrice: "free" }],
      }),
    /Invalid expected price format/
  );

  // Valid Create Order with multiple distinct product IDs
  const validMultiItemOrder = {
    shopId: "550e8400-e29b-41d4-a716-446655440000",
    items: [
      {
        productId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        quantity: 2,
        expectedUnitPrice: "45.00",
      },
      {
        productId: "7ca7b810-9dad-11d1-80b4-00c04fd430c9",
        quantity: 1,
        expectedUnitPrice: "25.00",
      },
    ],
  };
  assert.doesNotThrow(() => createOrderInputSchema.parse(validMultiItemOrder));

  // Reject duplicate product IDs in items array
  const duplicateItemOrder = {
    shopId: "550e8400-e29b-41d4-a716-446655440000",
    items: [
      {
        productId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        quantity: 2,
        expectedUnitPrice: "45.00",
      },
      {
        productId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", // Duplicate
        quantity: 1,
        expectedUnitPrice: "45.00",
      },
    ],
  };
  assert.throws(
    () => createOrderInputSchema.parse(duplicateItemOrder),
    /Order cannot contain duplicate items; please consolidate quantities for each product/
  );

  // Cancellation Schema requires valid enum
  assert.doesNotThrow(() =>
    cancelOrderInputSchema.parse({ cancellationReason: "WAIT_TIME_TOO_LONG" })
  );
  assert.throws(() =>
    cancelOrderInputSchema.parse({ cancellationReason: "INVALID_REASON" })
  );

  // Rejection Schema requires valid enum
  assert.doesNotThrow(() =>
    rejectOrderInputSchema.parse({ rejectionReason: "OUT_OF_STOCK" })
  );
  assert.throws(() =>
    rejectOrderInputSchema.parse({ rejectionReason: "NOT_FEELING_IT" })
  );

  console.log("✔ Validation schemas enforced input constraints.");
}

// 6. Domain Error Classes
{
  const priceErr = new PriceMismatchError([
    {
      productId: "prod-1",
      productName: "Masala Dosa",
      expectedPrice: "40.00",
      actualPrice: "50.00",
    },
  ]);
  assert.equal(priceErr.statusCode, 409);
  assert.equal(priceErr.mismatches.length, 1);
  assert.equal(priceErr.mismatches[0].productName, "Masala Dosa");

  const closedErr = new ShopClosedError("Central Canteen");
  assert.equal(closedErr.statusCode, 409);
  assert.ok(closedErr.message.includes("closed"));

  const unavailErr = new ProductUnavailableError("Cold Coffee");
  assert.equal(unavailErr.statusCode, 409);
  assert.ok(unavailErr.message.includes("unavailable"));

  console.log("✔ Domain error types and mismatch structures verified.");
}

// 7. Currency and Precision Validation
{
  // Valid price parsing
  assert.equal(parsePriceToPaise("150.00"), 15000);
  assert.equal(parsePriceToPaise("90"), 9000);
  assert.equal(parsePriceToPaise(120), 12000);
  assert.equal(parsePriceToPaise("90.50"), 9050);

  // Formatting
  assert.equal(formatPaiseToINR(15000), "₹150.00");
  assert.equal(formatPriceINR("150.00"), "₹150.00");
  assert.equal(formatPriceINR(90), "₹90.00");

  // Subtotal without float drift
  const subtotal = calculateSubtotalPaise([
    { quantity: 2, expectedUnitPrice: "120.00" },
    { quantity: 1, expectedUnitPrice: "90.00" },
  ]);
  assert.equal(subtotal, 33000);
  assert.equal(formatPaiseToINR(subtotal), "₹330.00");

  // Invariant: Missing or invalid prices must throw TypeError and NEVER silently convert to ₹0
  assert.throws(
    () => parsePriceToPaise(undefined as unknown as string),
    { name: "TypeError", message: /Cannot parse price to paise: received undefined/ }
  );
  assert.throws(
    () => parsePriceToPaise(null as unknown as string),
    { name: "TypeError", message: /Cannot parse price to paise: received null/ }
  );
  assert.throws(
    () => parsePriceToPaise(""),
    { name: "TypeError", message: /Cannot parse price to paise: received empty string/ }
  );
  assert.throws(
    () => parsePriceToPaise("not-a-number"),
    { name: "TypeError", message: /invalid numeric string/ }
  );
  assert.throws(
    () => formatPriceINR(undefined as unknown as string),
    { name: "TypeError" }
  );

  console.log("✔ Currency calculations, formatting, and strict non-zero error guards verified.");
}

console.log("=== All State Machine & Validation Unit Tests Passed! ===");
