import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const openapiToPostman = require('openapi-to-postmanv2') as {
  convert(
    input: { type: 'json'; data: unknown },
    options: Record<string, unknown>,
    callback: (err: unknown, result: { result: boolean; output: { data: unknown }[] }) => void,
  ): void;
};

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const OUTPUT_PATH = resolve(process.cwd(), 'postman_collection.json');

async function getOpenApiSpec(): Promise<unknown> {
  // 1. Try fetching from live HTTP server
  try {
    const res = await fetch(`${API_URL}/api/docs-json`);
    if (res.ok) {
      console.log(`📡 Fetched OpenAPI spec from running server at ${API_URL}/api/docs-json`);
      return await res.json();
    }
  } catch {
    // Live server not running
  }

  // 2. Generate directly in-memory via NestFactory & SwaggerModule
  console.log('⚙️  Server not running locally — bootstrapping NestJS app in-memory to generate OpenAPI spec...');
  const { NestFactory } = await import('@nestjs/core');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const { cleanupOpenApiDoc } = await import('nestjs-zod');
  const { AppModule } = await import('../src/app.module.js');

  // Provide mock env vars if missing to pass ConfigModule Zod validation
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mock:mock@127.0.0.1:5433/hotel_system?schema=public';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'mock-access-secret-at-least-32-chars-long';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mock-refresh-secret-at-least-32-chars-long';

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('YayeTech Hotel API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  await app.close();

  console.log('✅ Generated OpenAPI spec in-memory');
  return document;
}

async function main() {
  const openapi = await getOpenApiSpec();

  console.log('🔄 Converting OpenAPI spec to Postman Collection v2.1 …');

  await new Promise<void>((resolvePromise, reject) => {
    openapiToPostman.convert(
      { type: 'json', data: openapi },
      {
        folderStrategy: 'Tags',
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
        resolvePromise();
      },
    );
  });

  console.log(`\n✅  postman_collection.json successfully generated and written to:\n   ${OUTPUT_PATH}\n`);
}

main().catch((err) => {
  console.error('❌ Failed to export Postman collection:', err);
  process.exit(1);
});
