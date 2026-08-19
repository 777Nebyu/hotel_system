/**
 * Postman Collection Export Script
 * ─────────────────────────────────
 * Fetches the live OpenAPI spec from the running API, converts it to a
 * Postman collection v2.1, and writes it to the repo root.
 *
 * Usage:
 *   pnpm run export:postman
 *
 * Prerequisites:
 *   The API must be running locally on port 3001 (pnpm dev --filter=api)
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Converter } = require('openapi-to-postmanv2') as {
  Converter: {
    convert(
      input: { type: 'json'; data: unknown },
      options: Record<string, unknown>,
      callback: (err: unknown, result: { result: boolean; output: { data: unknown }[] }) => void,
    ): void;
  };
};

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const OUTPUT_PATH = resolve(process.cwd(), 'postman_collection.json');

async function main() {
  console.log(`\n📡 Fetching OpenAPI spec from ${API_URL}/api/docs-json …`);

  let openapi: unknown;
  try {
    const res = await fetch(`${API_URL}/api/docs-json`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — Is the API running at ${API_URL}?`);
    }
    openapi = await res.json();
  } catch (err) {
    console.error(`\n❌ Could not reach the API: ${err}`);
    console.error('   Start it with: pnpm dev --filter=api\n');
    process.exit(1);
  }

  console.log('🔄 Converting to Postman Collection v2.1 …');

  await new Promise<void>((resolve, reject) => {
    Converter.convert(
      { type: 'json', data: openapi },
      {
        folderStrategy: 'Tags',          // group by Swagger tag (e.g. identity, bookings)
        requestParametersResolution: 'Example',
        optimizeConversion: false,
        includeAuthInfoInExample: true,
      },
      (err, result) => {
        if (err || !result.result || !result.output?.[0]?.data) {
          reject(err ?? new Error('Converter returned no output'));
          return;
        }
        const collection = result.output[0].data;
        writeFileSync(OUTPUT_PATH, JSON.stringify(collection, null, 2), 'utf8');
        resolve();
      },
    );
  });

  console.log(`\n✅  postman_collection.json written to:\n   ${OUTPUT_PATH}`);
  console.log('\n   Import it in Postman Desktop:\n   File → Import → select the file\n');
}

void main();
