import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextValue {
  requestId: string;
  startedAt: number;
}

export const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function getRequestContext(): RequestContextValue | undefined {
  return requestContext.getStore();
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
