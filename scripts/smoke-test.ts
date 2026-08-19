/**
 * Post-Deploy Smoke Test Script
 * ──────────────────────────────
 * Runs automated HTTP health & sanity checks against a deployed API instance
 * (Staging or Production) to verify database connectivity, Redis connection,
 * and key public endpoints.
 *
 * Usage:
 *   API_URL=https://your-api.onrender.com pnpm run smoke-test
 */

import 'dotenv/config';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

interface SmokeTestResult {
  endpoint: string;
  status: number;
  ok: boolean;
  durationMs: number;
}

async function checkEndpoint(path: string, expectedStatus = 200): Promise<SmokeTestResult> {
  const start = Date.now();
  const url = `${API_URL}${path}`;
  try {
    const res = await fetch(url);
    const durationMs = Date.now() - start;
    const ok = res.status === expectedStatus;
    return { endpoint: path, status: res.status, ok, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`  ❌ Failed to fetch ${url}: ${err}`);
    return { endpoint: path, status: 0, ok: false, durationMs };
  }
}

async function main() {
  console.log(`\n🔥 Running Production Smoke Test against ${API_URL} …\n`);

  const tests = [
    { path: '/health', name: 'Health Check (Postgres & Redis)' },
    { path: '/api/docs', name: 'Swagger UI Documentation' },
    { path: '/api/docs-json', name: 'OpenAPI JSON Spec' },
    { path: '/hotels', name: 'Catalog Hotel Search' },
    { path: '/catalog/countries', name: 'Catalog Country List' },
    { path: '/catalog/amenities', name: 'Catalog Amenities List' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const res = await checkEndpoint(test.path);
    if (res.ok) {
      console.log(`  ✅ [${res.status}] ${test.name} (${res.endpoint}) — ${res.durationMs}ms`);
      passed++;
    } else {
      console.log(`  ❌ [${res.status}] ${test.name} (${res.endpoint}) — FAILED (${res.durationMs}ms)`);
      failed++;
    }
  }

  console.log(`\n📊 Smoke Test Summary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n❌ Smoke test failed! Deployment contains issues.\n');
    process.exit(1);
  }

  console.log('\n✨ All smoke tests passed! Backend deployment is verified and green.\n');
}

main().catch((err) => {
  console.error('❌ Smoke test runner error:', err);
  process.exit(1);
});
