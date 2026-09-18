import { AccessibilityInfo } from 'react-native';

// ─── ERR-001: Error Category Taxonomy ───────────────────────────────────────

export type ErrorCategory =
  | 'validation'
  | 'auth'
  | 'permission'
  | 'conflict'
  | 'payment'
  | 'network'
  | 'server'
  | 'maintenance';

// ─── ERR-002: Category → Display Treatment ──────────────────────────────────

export type ErrorTreatment = 'inline' | 'field' | 'banner' | 'errorbox' | 'toast' | 'redirect' | 'fullscreen';

export const CATEGORY_TREATMENT: Record<ErrorCategory, ErrorTreatment> = {
  validation: 'field',
  auth: 'redirect',
  permission: 'errorbox',
  conflict: 'errorbox',
  payment: 'errorbox',
  network: 'banner',
  server: 'toast',
  maintenance: 'banner',
};

// ─── ERR-018: Consistent Error Vocabulary (shared message catalog) ──────────

export const ERROR_MESSAGES: Record<ErrorCategory, Record<string, { title: string; action?: string }>> = {
  validation: {
    default: { title: 'Please check your input and try again.' },
    required: { title: 'This field is required.' },
    email: { title: 'Please enter a valid email address.' },
    minLength: { title: 'This field is too short.' },
    maxLength: { title: 'This field is too long.' },
    numeric: { title: 'Please enter a valid number.' },
    dateRange: { title: 'Check-out must be after check-in.' },
    guests: { title: 'Number of guests is not valid.' },
  },
  auth: {
    default: { title: 'Please sign in to continue.', action: 'Sign In' },
    expired: { title: 'Your session has expired. Please sign in again.', action: 'Sign In' },
    invalid: { title: 'Incorrect email or password.' },
    unverified: { title: 'Please verify your email first.' },
  },
  permission: {
    default: { title: 'This account is not active.' },
    adminOnly: { title: 'This action requires admin access.' },
    hotelScope: { title: "You don't have permission to access this hotel's data." },
  },
  conflict: {
    default: { title: 'This action could not be completed. Please try again.', action: 'Try Again' },
    roomUnavailable: { title: 'This room was just booked by someone else. Please choose another room.', action: 'Search Again' },
    bookingNotCancellable: { title: 'This booking can no longer be cancelled.' },
    cancellationOutsidePolicy: { title: 'This booking was cancelled outside the refundable period. No refund is available.' },
    alreadyCancelled: { title: 'This booking has already been cancelled.' },
    alreadyCheckedIn: { title: 'This booking has already been checked in.' },
    alreadyCheckedOut: { title: 'This booking has already been checked out.' },
    duplicateConfirmation: { title: 'This booking was already confirmed. No duplicate was created.' },
    roomMaintenance: { title: 'Your reserved room requires maintenance. Please contact reception for assistance.', action: 'Contact Support' },
    couponExpired: { title: 'This coupon has expired.', action: 'Remove Coupon' },
    priceChanged: { title: 'The price has changed since you started checkout. Please review and try again.', action: 'Review Changes' },
    notAvailable: { title: 'This room is no longer available for the selected dates.', action: 'Search Again' },
  },
  payment: {
    default: { title: 'Payment failed. Please try again.', action: 'Try Again' },
    declined: { title: 'Your payment was declined. Please try a different payment method.', action: 'Change Method' },
    timeout: { title: 'Payment timed out. Please try again.', action: 'Try Again' },
    cancelled: { title: 'Payment was cancelled.' },
  },
  network: {
    default: { title: "You're offline. Please check your connection and try again.", action: 'Try Again' },
    timeout: { title: 'The request took too long. Please try again.', action: 'Try Again' },
  },
  server: {
    default: { title: 'Something went wrong. Please try again.', action: 'Try Again' },
    unavailable: { title: 'The service is temporarily unavailable. Please try again shortly.', action: 'Try Again' },
    rateLimited: { title: 'Too many attempts. Please try again later.' },
  },
  maintenance: {
    default: { title: 'The platform is temporarily unavailable for maintenance. Please check back later.' },
    hotel: { title: 'This hotel is currently under maintenance and not accepting bookings.' },
  },
};

// ─── ERR-005/006: Plain-Language + Action Mapping ────────────────────────────

export function getErrorMessage(category: ErrorCategory, code?: string): { title: string; action?: string } {
  const messages = ERROR_MESSAGES[category];
  if (code && code in messages) return messages[code];
  return messages.default;
}

// ─── Error Classification ───────────────────────────────────────────────────

export interface ClassifiedError {
  category: ErrorCategory;
  code: string;
  title: string;
  action?: string;
  retryable: boolean;
  raw?: unknown;
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof Error && err.name === 'NetworkError') {
    return {
      category: 'network',
      code: 'default',
      ...getErrorMessage('network'),
      retryable: true,
      raw: err,
    };
  }

  if (isApiError(err)) {
    const status = err.status;
    const body = extractErrorBody(err.message);

    if (status === 401) {
      return {
        category: 'auth',
        code: 'expired',
        ...getErrorMessage('auth', 'expired'),
        retryable: false,
        raw: err,
      };
    }

    if (status === 403) {
      return {
        category: 'permission',
        code: 'default',
        ...getErrorMessage('permission'),
        retryable: false,
        raw: err,
      };
    }

    if (status === 402) {
      const code = body?.code ?? 'default';
      return {
        category: 'payment',
        code,
        ...getErrorMessage('payment', code),
        retryable: true,
        raw: err,
      };
    }

    if (status === 409) {
      const code = body?.code ?? 'default';
      return {
        category: 'conflict',
        code,
        ...getErrorMessage('conflict', code),
        retryable: true,
        raw: err,
      };
    }

    if (status === 422 || status === 400) {
      return {
        category: 'validation',
        code: body?.code ?? 'default',
        title: body?.message ?? getErrorMessage('validation').title,
        retryable: false,
        raw: err,
      };
    }

    if (status === 429) {
      return {
        category: 'server',
        code: 'rateLimited',
        ...getErrorMessage('server', 'rateLimited'),
        retryable: true,
        raw: err,
      };
    }

    if (status === 503) {
      return {
        category: 'maintenance',
        code: body?.code ?? 'default',
        ...getErrorMessage('maintenance', body?.code ?? 'default'),
        retryable: false,
        raw: err,
      };
    }

    if (status && status >= 500) {
      return {
        category: 'server',
        code: 'default',
        ...getErrorMessage('server'),
        retryable: true,
        raw: err,
      };
    }

    return {
      category: 'server',
      code: 'default',
      title: err.message || getErrorMessage('server').title,
      retryable: true,
      raw: err,
    };
  }

  return {
    category: 'server',
    code: 'default',
    ...getErrorMessage('server'),
    retryable: true,
    raw: err,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isApiError(err: unknown): err is { message: string; status?: number } {
  return err instanceof Error && 'status' in err && typeof (err as any).status === 'number';
}

function extractErrorBody(message: string): { code?: string; field?: string; message?: string } | null {
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch { /* ignore */ }
  return null;
}

// ─── ERR-017: Accessibility Announcements ───────────────────────────────────

export function announceError(title: string) {
  AccessibilityInfo.announceForAccessibility(title);
}

export function classifyAndAnnounce(err: unknown): ClassifiedError {
  const classified = classifyError(err);
  announceError(classified.title);
  return classified;
}
