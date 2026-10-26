import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { corsOrigins } from './core/origins';
import { DatabaseService } from './data/database.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // `docker stop` sends SIGTERM; without this Prisma's pool is never closed
  // and in-flight requests are cut rather than drained.
  app.enableShutdownHooks();
  // Nothing on the wire needs to announce the framework.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // JSON only, so helmet's defaults (nosniff, frame-deny, a locked-down CSP,
  // HSTS) cost nothing and cover anything that ever renders a response.
  app.use(helmet());
  // Behind Coolify's proxy and a Cloudflare Tunnel every request arrives from
  // the proxy. TRUST_PROXY is the number of hops to believe, so rate limits
  // and lockouts key on the visitor's IP instead of the proxy's. 0 = direct.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));
  // The largest page body is ~20 KB. 256 KB leaves room to grow and still
  // refuses a payload meant to exhaust memory.
  app.useBodyParser('json', { limit: '256kb' });

  /**
   * Global validation. `whitelist` strips properties with no DTO decorator and
   * `forbidNonWhitelisted` rejects them outright, so a frontend cannot smuggle
   * an unexpected field (a role, a paid_at) into a write by appending it to the
   * request body. This is step 1 of the required write sequence for every
   * mutating endpoint.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // The admin and the public site (its enquiry forms) are separate origins,
  // so CORS is required rather than incidental. Origins come from env so a
  // deployment can lock this down without a code change.
  const origins = corsOrigins();

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  logger.log(`Enzo Interiors API listening on http://localhost:${port}`);
  logger.log(`Database: ${app.get(DatabaseService).target}`);
  logger.log(`CORS origins: ${origins.join(', ')}`);
}

void bootstrap();
