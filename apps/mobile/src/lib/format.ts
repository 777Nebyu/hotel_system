/**
 * Format a booking ID into the YTH-YYYY-NNNNNN reference format.
 * Falls back to truncated UUID if createdAt is not available.
 */
export function formatBookingRef(id: string, createdAt?: string): string {
  if (createdAt) {
    const year = new Date(createdAt).getFullYear();
    const seq = id.replace(/-/g, '').slice(-6).toUpperCase();
    return `YTH-${year}-${seq}`;
  }
  return `YTH-${id.replace(/-/g, '').slice(-8).toUpperCase()}`;
}
