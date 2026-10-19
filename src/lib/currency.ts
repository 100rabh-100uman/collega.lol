/**
 * Currency and monetary utility helpers using integer paise (cents)
 * to guarantee zero floating-point precision errors across cart & checkout calculations.
 */

/**
 * Converts a numeric or decimal string price into integer paise (1 INR = 100 paise).
 * e.g., "120.00" -> 12000, 150 -> 15000, "90.50" -> 9050.
 */
export function parsePriceToPaise(price: string | number): number {
  if (price === undefined || price === null) {
    throw new TypeError(`Cannot parse price to paise: received ${String(price)}`);
  }
  if (typeof price === "number") {
    if (Number.isNaN(price)) {
      throw new TypeError("Cannot parse price to paise: received NaN");
    }
    return Math.round(price * 100);
  }
  if (typeof price !== "string") {
    throw new TypeError(`Cannot parse price to paise: expected string or number, received ${typeof price}`);
  }
  const clean = price.trim();
  if (clean.length === 0) {
    throw new TypeError("Cannot parse price to paise: received empty string");
  }
  const num = parseFloat(clean);
  if (Number.isNaN(num)) {
    throw new TypeError(`Cannot parse price to paise: invalid numeric string "${clean}"`);
  }
  return Math.round(num * 100);
}

/**
 * Formats integer paise into standard Indian Rupee currency string.
 * e.g., 12000 -> "₹120.00", 9050 -> "₹90.50".
 */
export function formatPaiseToINR(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Formats a decimal string or number price into standard INR string.
 */
export function formatPriceINR(price: string | number): string {
  const paise = parsePriceToPaise(price);
  return formatPaiseToINR(paise);
}

/**
 * Calculates line total in paise: quantity * unitPaise.
 */
export function calculateLineTotalPaise(quantity: number, unitPrice: string | number): number {
  const unitPaise = parsePriceToPaise(unitPrice);
  return Math.max(0, quantity) * unitPaise;
}

/**
 * Calculates sum of line totals across cart items in paise without float rounding.
 */
export function calculateSubtotalPaise(
  items: Array<{ quantity: number; expectedUnitPrice: string | number }>
): number {
  return items.reduce((acc, item) => acc + calculateLineTotalPaise(item.quantity, item.expectedUnitPrice), 0);
}
