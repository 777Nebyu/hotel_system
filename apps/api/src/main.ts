import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>('nodeEnv');

  const isProd = nodeEnv === 'production';

  // Voice uploads post base64 audio as JSON, which the '100kb' default rejects
  // after ~2s of speech. Registering here (rawBody is forwarded, so webhook
  // signature verification keeps its verify hook) also makes Nest skip its own
  // default parser, which would otherwise win the middleware race.
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '25mb' });

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      hsts: isProd
        ? {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  const allowedOrigins = (config.get<string>('webOrigin') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllDevelopmentOrigins = !isProd && allowedOrigins.length === 0;
  const isAllowedOrigin = (origin?: string) =>
    !origin || allowAllDevelopmentOrigins || allowedOrigins.includes(origin);

  // Reject browser state-changing requests from untrusted origins before a
  // controller can perform a side effect. Native mobile requests normally have
  // no Origin header and continue through the bearer-token guards.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const method = request.method.toUpperCase();
    const origin = request.headers.origin;
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
      origin &&
      !isAllowedOrigin(origin)
    ) {
      response.status(403).json({
        statusCode: 403,
        error: 'FORBIDDEN',
        message: 'Request origin is not allowed',
      });
      return;
    }
    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('CORS origin is not allowed'), false);
    },
    credentials: true,
  });

  if (!isProd) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
    });
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('YayeTech Hotel API')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));

  await app.listen(config.get<number>('port') ?? 3001, '0.0.0.0');
}

void bootstrap();
