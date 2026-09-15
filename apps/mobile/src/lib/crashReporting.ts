/**
 * Crash reporting service abstraction.
 * Integrates with Sentry in production when configured,
 * and logs in development.
 * Uses dynamic import so the app works in Expo Go (no native Sentry module).
 */

type ErrorContext = Record<string, unknown>;
type SentryModule = {
  init: (config: Record<string, unknown>) => void;
  captureException: (error: unknown, options?: { extra?: Record<string, unknown> }) => void;
  captureMessage: (message: string, options?: { extra?: Record<string, unknown> }) => void;
  setUser: (user: { id: string; email?: string; username?: string } | null) => void;
};

class CrashReporter {
  private initialized = false;
  private sentry: SentryModule | null = null;

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (__DEV__) return;

    try {
      const importSentry = new Function('return import("@sentry/react-native")') as () => Promise<SentryModule>;
      const sentryModule = await importSentry().catch(() => null);
      if (!sentryModule) throw new Error('Sentry package not installed');

      this.sentry = sentryModule;
      this.sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
        tracesSampleRate: 0.2,
        enableAutoSessionTracking: true,
        attachStacktrace: true,
      });

      const globalAny = global as any;
      if (typeof globalAny?.ErrorUtils !== 'undefined') {
        const defaultHandler = globalAny.ErrorUtils.getGlobalHandler();
        globalAny.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          this.captureException(error, { isFatal });
          if (defaultHandler) {
            defaultHandler(error, isFatal);
          }
        });
      }
    } catch {
      console.warn('[CrashReporter] Sentry not available (Expo Go or missing DSN)');
    }
  }

  captureException(error: unknown, context?: ErrorContext) {
    if (__DEV__ || !this.sentry) {
      console.warn('[CrashReporter] Exception captured:', error, context);
      return;
    }
    this.sentry.captureException(error, { extra: context });
  }

  captureMessage(message: string, context?: ErrorContext) {
    if (__DEV__ || !this.sentry) {
      console.info('[CrashReporter] Message captured:', message, context);
      return;
    }
    this.sentry.captureMessage(message, { extra: context });
  }

  setUser(user: { id: string; email?: string; username?: string }) {
    if (!__DEV__ && this.sentry) this.sentry.setUser(user);
  }

  clearUser() {
    if (!__DEV__ && this.sentry) this.sentry.setUser(null);
  }
}

export const crashReporter = new CrashReporter();
