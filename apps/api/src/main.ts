import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

const parseOrigins = (value?: string | null): string[] | undefined => {
  if (!value) return undefined;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);
  const corsConfig: CorsOptions = {
    origin: corsOrigins ?? true,
    credentials: true,
  };
  app.enableCors(corsConfig);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('Nest failed to start', error);
  process.exit(1);
});
