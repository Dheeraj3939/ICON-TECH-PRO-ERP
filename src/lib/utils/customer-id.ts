import type { Customer } from '@/types/customer';

/**
 * Atomic Customer ID generator: ICONYYXXXX (e.g. ICON260001, ICON260002)
 */
export function generateNextCustomerCode(customers: Customer[]): string {
  const currentYY = new Date().getFullYear().toString().slice(-2);
  const prefix = `ICON${currentYY}`;
  let maxSeq = 0;
  for (const c of customers) {
    if (c.customer_code && c.customer_code.startsWith(prefix)) {
      const numPart = parseInt(c.customer_code.slice(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }
  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}
