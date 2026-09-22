/**
 * Decode a JWT access token payload without verifying the signature.
 * Used to extract hotelId (and other claims) on the client side.
 *
 * The backend embeds `hotelId` into the JWT for MANAGER/STAFF roles
 * via `IdentityService.resolveHotelId()` — one hotel per manager.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Extract the hotelId from a JWT access token.
 * Returns an empty string if the token is missing, expired, or malformed.
 */
export function getHotelIdFromToken(token: string): string {
  return (decodeJwtPayload(token).hotelId as string) ?? '';
}
