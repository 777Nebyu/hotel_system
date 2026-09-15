/**
 * Simple client-side text sanitization.
 * Strips HTML tags and dangerous characters as defense-in-depth.
 * Backend still applies full sanitization via sanitize-html.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/javascript:/gi, '')      // Strip javascript: protocol
    .replace(/on\w+=/gi, '')           // Strip event handlers
    .replace(/&/g, '&amp;')           // Escape ampersands
    .replace(/"/g, '&quot;')          // Escape quotes
    .replace(/'/g, '&#x27;')          // Escape single quotes
    .trim();
}

/**
 * Light sanitization for display-only text (less aggressive).
 */
export function displayText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}
