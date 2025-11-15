import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { Prisma, User, Wallet } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

class InMemoryPrismaService {
  private users: User[] = [];
  private wallets: Wallet[] = [];

  user = {
    create: ({
      data,
      include,
    }: Prisma.UserCreateArgs): Promise<User & { wallets?: Wallet[] }> => {
      const email = (data.email ?? '').toLowerCase();
      if (this.users.some((existing) => existing.email === email)) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: 'in-memory',
            meta: { target: ['User_email_key'] },
          },
        );
      }

      const now = new Date();
      const user: User = {
        id: randomUUID(),
        email,
        name: data.name ?? null,
        passwordHash: data.passwordHash ?? '',
        createdAt: now,
        updatedAt: now,
      };
      this.users.push(user);

      if (data.wallets?.create) {
        const payloads = Array.isArray(data.wallets.create)
          ? data.wallets.create
          : [data.wallets.create];
        payloads.forEach((walletInput) => {
          const wallet: Wallet = {
            id: randomUUID(),
            userId: user.id,
            currency: walletInput.currency ?? 'IDR',
            balance: new Prisma.Decimal(walletInput.balance ?? 0),
            createdAt: now,
            updatedAt: now,
          };
          this.wallets.push(wallet);
        });
      }

      const createdWallets =
        include?.wallets && typeof include.wallets !== 'boolean'
          ? this.resolveWallets(user.id, include.wallets)
          : undefined;

      return Promise.resolve({ ...user, wallets: createdWallets });
    },
    findUnique: ({
      where,
      include,
    }: Prisma.UserFindUniqueArgs): Promise<
      (User & { wallets?: Wallet[] }) | null
    > => {
      const user = this.users.find(
        (candidate) => candidate.email === where?.email?.toLowerCase(),
      );
      if (!user) {
        return Promise.resolve(null);
      }
      const wallets =
        include?.wallets && typeof include.wallets !== 'boolean'
          ? this.resolveWallets(user.id, include.wallets)
          : undefined;
      return Promise.resolve({ ...user, wallets });
    },
  };

  wallet = {
    findMany: ({
      where,
      orderBy,
    }: Prisma.WalletFindManyArgs): Promise<Wallet[]> => {
      let wallets = this.wallets.filter(
        (wallet) => wallet.userId === where?.userId,
      );
      if (!Array.isArray(orderBy) && orderBy?.createdAt) {
        wallets = wallets.sort((a, b) => {
          const diff = a.createdAt.getTime() - b.createdAt.getTime();
          return orderBy.createdAt === 'asc' ? diff : -diff;
        });
      }
      return Promise.resolve(wallets);
    },
  };

  enableShutdownHooks(): void {}

  private resolveWallets(
    userId: string,
    include: Prisma.WalletFindManyArgs,
  ): Wallet[] {
    let wallets = this.wallets.filter((wallet) => wallet.userId === userId);
    if (!Array.isArray(include.orderBy) && include.orderBy?.createdAt) {
      wallets = wallets.sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return include.orderBy.createdAt === 'asc' ? diff : -diff;
      });
    }
    if (include.take) {
      wallets = wallets.slice(0, include.take);
    }
    return wallets;
  }
}

const getAuthBody = (response: Response) =>
  response.body as {
    accessToken: string;
    user: { email: string; walletId: string };
  };

describe('Auth flows (e2e)', () => {
  let app: INestApplication;
  type SuperTestServer = Parameters<typeof request>[0];
  let server: SuperTestServer;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new InMemoryPrismaService())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as SuperTestServer;
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers and provisions default wallet', async () => {
    const payload = {
      email: 'flow@example.com',
      password: 'Password1',
      name: 'Flow',
    };

    const response = await request(server)
      .post('/auth/register')
      .send(payload)
      .expect(201);
    const body = getAuthBody(response);

    expect(body.user.email).toBe(payload.email);
    expect(body.user.walletId).toBeDefined();
    expect(body.accessToken).toBeDefined();
  });

  it('logs in with existing credentials', async () => {
    const creds = { email: 'tester@example.com', password: 'Password1' };
    await request(server)
      .post('/auth/register')
      .send({ ...creds, name: 'Tester' })
      .expect(201);

    const response = await request(server)
      .post('/auth/login')
      .send(creds)
      .expect(200);
    const body = getAuthBody(response);

    expect(body.user.email).toBe(creds.email);
    expect(body.accessToken).toBeDefined();
  });

  it('rejects invalid password', async () => {
    const creds = { email: 'reject@example.com', password: 'Password1' };
    await request(server).post('/auth/register').send(creds).expect(201);

    await request(server)
      .post('/auth/login')
      .send({ email: creds.email, password: 'WrongPassword1' })
      .expect(401);
  });
});
