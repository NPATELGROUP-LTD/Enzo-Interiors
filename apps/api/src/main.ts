import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DatabaseService } from './data/database.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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

  // apps/admin and apps/portal are separate origins, so CORS is required
  // rather than incidental. Origins come from env so a deployment can lock
  // this down without a code change.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5175')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

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
