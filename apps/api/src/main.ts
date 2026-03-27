import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'https://boardman.live',
    'https://www.boardman.live',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) and listed origins
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Boardman API')
    .setDescription('P2P bet escrow platform API')
    .setVersion('1.0')
    .addCookieAuth('boardman_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { withCredentials: true },
  });

  const PORT = process.env.PORT || 3002;

  await app.listen(PORT);
}
bootstrap();
