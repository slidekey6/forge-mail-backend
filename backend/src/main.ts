import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable CORS — CORS_ORIGIN env var extends (not replaces) the base list
  const baseOrigins = [
    'http://localhost:5173',
    'http://localhost:4200',
    'http://localhost:3000',
    'https://mailser-acba7.web.app',       // Firebase Hosting (primary)
    'https://mailser-acba7.firebaseapp.com', // Firebase Hosting (alternate)
    'null', // Allow file:// opened index.html (origin is "null")
  ];
  const allowedOrigins = process.env.CORS_ORIGIN
    ? [...new Set([...baseOrigins, ...process.env.CORS_ORIGIN.split(',')])]
    : baseOrigins;

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Global validation pipe — whitelist strips unknown properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🔥 Forge Mail backend is running on http://localhost:${port}`);
  console.log(`📬 Mail endpoint: POST http://localhost:${port}/api/mail/send\n`);
}

bootstrap();
