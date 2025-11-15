import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request, { Response } from 'supertest';
import { Prisma, User, Wallet } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

class InMemoryPrismaService {
  private users: User[] = [];
  private wallets: Wallet[] = [];

  user = {
    create: ({
      data,
      include,
    }: Prisma.UserCreateArgs): Promise<User & { wallets?: Wallet[] }> => {
      const normalizedEmail = (data.email ?? '').toLowerCase();
      if (this.users.some((u) => u.email === normalizedEmail)) {
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
        email: normalizedEmail,
        name: data.name ?? null,
        passwordHash: data.passwordHash ?? '',
        createdAt: now,
        updatedAt: now,
      };
      this.users.push(user);

      if (data.wallets?.create) {
        const walletsToCreate = Array.isArray(data.wallets.create)
          ? data.wallets.create
          : [data.wallets.create];
        walletsToCreate.forEach((walletInput) => {
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
          ? this.getUserWallets(user.id, include.wallets)
          : undefined;
      return Promise.resolve({
        ...user,
        wallets: createdWallets,
      });
    },
    findUnique: ({
      where,
      include,
    }: Prisma.UserFindUniqueArgs): Promise<
      (User & { wallets?: Wallet[] }) | null
    > => {
      const user = this.users.find(
        (u) => u.email === where?.email?.toLowerCase(),
      );
      if (!user) {
        return Promise.resolve(null);
      }
      const wallets =
        include?.wallets && typeof include.wallets !== 'boolean'
          ? this.getUserWallets(user.id, include.wallets)
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

  enableShutdownHooks(): void {
    // no-op for tests
  }

  private getUserWallets(
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

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  type SuperTestServer = Parameters<typeof request>[0];
  let server: SuperTestServer;

  const getAuthBody = (res: Response) =>
    res.body as {
      user: { email: string; walletId: string };
      accessToken: string;
    };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new InMemoryPrismaService())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as SuperTestServer;
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user and provisions a wallet', async () => {
    const payload = {
      email: 'user@example.com',
      password: 'Password1',
      name: 'Wallet Reviewer',
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
    const payload = { email: 'hello@example.com', password: 'Password1' };
    await request(server)
      .post('/auth/register')
      .send({ ...payload, name: 'Name' })
      .expect(201);

    const response = await request(server)
      .post('/auth/login')
      .send(payload)
      .expect(200);

    const body = getAuthBody(response);
    expect(body.user.email).toBe(payload.email);
    expect(body.accessToken).toBeDefined();
  });

  it('rejects invalid credentials', async () => {
    const payload = { email: 'invalid@example.com', password: 'Password1' };
    await request(server).post('/auth/register').send(payload).expect(201);

    await request(server)
      .post('/auth/login')
      .send({ email: payload.email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('enforces JWT guard on wallets endpoint', async () => {
    await request(server).get('/wallets/me').expect(401);

    const registerResponse = await request(server)
      .post('/auth/register')
      .send({ email: 'guard@example.com', password: 'Password1' });

    const token = getAuthBody(registerResponse).accessToken;
    const walletsResponse = await request(server)
      .get('/wallets/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(walletsResponse.body).toHaveLength(1);
  });
});
