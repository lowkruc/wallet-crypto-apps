import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}
bootstrap().catch((error) => {
  console.error('Nest failed to start', error);
  process.exit(1);
});
