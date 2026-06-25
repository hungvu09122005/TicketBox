import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  app.setGlobalPrefix('api/v1');

  // ── Logging ─────────────────────────────────────────────────────────────
  const logger = app.get(Logger);
  app.useLogger(logger);

  // ── Global Pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Filters & Interceptors ────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: true,
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
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);

  const server = app.getHttpServer();
  const router = server._events.request._router;
  const availableRoutes = router.stack
    .filter((r: any) => r.route)
    .map((r: any) => ({
      method: Object.keys(r.route.methods)[0].toUpperCase(),
      path: r.route.path,
    }));
  console.table(availableRoutes);
}

bootstrap();
