import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ── Global Pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Filters ───────────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      process.env.FRONTEND_AUDIENCE_URL ?? 'http://localhost:3000',
      process.env.FRONTEND_ADMIN_URL ?? 'http://localhost:3002',
    ],
    credentials: true,
  });

  // ── OpenAPI / Swagger ────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TicketBox API')
      .setDescription('TicketBox — Concert Ticketing System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger UI available at /api/docs');
  }

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  logger.log(`API listening on port ${port}`);
}

bootstrap();
