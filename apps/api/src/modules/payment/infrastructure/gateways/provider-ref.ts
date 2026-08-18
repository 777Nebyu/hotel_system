export function providerRefFor(method: string, reference: string): string {
  return `mock_${method.toLowerCase()}_${Date.now().toString(36)}_${reference
    .replace(/[^\w]/g, '')
    .slice(0, 8)}`;
}

export const simulateProviderLatency = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 25));
