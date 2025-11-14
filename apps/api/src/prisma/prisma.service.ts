import { INestApplication, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  enableShutdownHooks<TApp extends INestApplication>(app: TApp): void {
    const shutdown = async () => {
      await app.close();
    };

    process.once('beforeExit', () => {
      void shutdown();
    });
    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });
  }
}
