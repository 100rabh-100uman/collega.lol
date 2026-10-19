import type { OrderStatus } from "@prisma/client";
import { ConflictError } from "@/core/errors";

/**
 * Deterministic State Transition Matrix for Smart Ordering.
 *
 * Primary Happy Path:
 *   PLACED -> CONFIRMED -> PREPARING -> READY -> PICKED_UP -> COMPLETED
 *
 * Canonical Exceptional Outcomes from PLACED:
 *   - REJECTED: Kiosk staff explicitly declined (requires RejectionReason).
 *   - CANCELLED: Student cancelled before acceptance (requires CancellationReason).
 *   - EXPIRED: Unanswered manual-acceptance order exceeded 5-minute threshold.
 *   - FAILED: Technical or unrecoverable processing fault (see semantics below).
 *
 * SEMANTICS OF `OrderStatus.FAILED`:
 * `FAILED` represents an exceptional, unrecoverable technical or operational fault,
 * such as an unhandled payment gateway settlement failure, kitchen hardware failure
 * during active preparation, or unrecoverable order state corruption.
 * `FAILED` must NEVER be used as a substitute for ordinary student cancellation (`CANCELLED`),
 * shop rejection (`REJECTED`), or timer expiration (`EXPIRED`).
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED", "FAILED"],
  CONFIRMED: ["PREPARING", "FAILED"],
  PREPARING: ["READY", "FAILED"],
  READY: ["PICKED_UP", "FAILED"],
  PICKED_UP: ["COMPLETED", "FAILED"],
  // Terminal states (no further transitions permitted)
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

export class InvalidOrderStateTransitionError extends ConflictError {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Illegal order state transition: Cannot transition from '${from}' to '${to}'.`
    );
  }
}

/**
 * Checks whether transitioning from `currentStatus` to `nextStatus` is legal.
 */
export function canTransitionOrder(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Asserts that a state transition is legal. Throws InvalidOrderStateTransitionError if illegal.
 */
export function assertValidOrderTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): void {
  if (!canTransitionOrder(currentStatus, nextStatus)) {
    throw new InvalidOrderStateTransitionError(currentStatus, nextStatus);
  }
}
