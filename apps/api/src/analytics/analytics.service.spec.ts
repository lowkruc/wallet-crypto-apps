import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService & {
    transaction: {
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    wallet: { findMany: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            wallet: {
              findMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    prisma = module.get(PrismaService);
  });

  describe('getUserTopTransactions', () => {
    it('returns signed transactions ordered by amount', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-2',
          type: 'TRANSFER',
          amount: decimal(200),
          currency: 'IDR',
          createdAt: new Date('2024-01-02T00:00:00Z'),
          fromWallet: {
            id: 'wallet-1',
            userId: 'user-1',
            user: { id: 'user-1', email: 'me@example.com', name: 'Me' },
          },
          toWallet: {
            id: 'wallet-2',
            userId: 'user-2',
            user: { id: 'user-2', email: 'friend@example.com', name: 'Friend' },
          },
        },
        {
          id: 'tx-1',
          type: 'DEPOSIT',
          amount: decimal(150),
          currency: 'IDR',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          fromWallet: null,
          toWallet: {
            id: 'wallet-1',
            userId: 'user-1',
            user: { id: 'user-1', email: 'me@example.com', name: 'Me' },
          },
        },
      ]);

      const result = await service.getUserTopTransactions('user-1', 5);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toMatchObject({
        id: 'tx-2',
        direction: 'OUT',
        amount: '-200',
        counterparty: { email: 'friend@example.com' },
      });
      expect(result.transactions[1]).toMatchObject({
        id: 'tx-1',
        direction: 'IN',
        amount: '150',
      });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { amount: 'desc' },
        }),
      );
    });

    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserTopTransactions('missing')).rejects.toThrow(
        'User not found',
      );
    });
    it('applies date filters when provided', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.transaction.findMany.mockResolvedValue([]);

      const start: Date = new Date('2024-01-01');
      const end: Date = new Date('2024-01-31');

      await service.getUserTopTransactions('user-1', undefined, {
        start,
        end,
      });

      const lastFindCall = prisma.transaction.findMany.mock.calls.at(-1) as
        | [Prisma.TransactionFindManyArgs]
        | undefined;
      const callArgs = lastFindCall?.[0];

      expect(callArgs?.where?.createdAt).toEqual({
        gte: start,
        lte: end,
      });
    });
  });

  describe('getTopUsers', () => {
    it('aggregates outbound totals per user', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        {
          fromWalletId: 'wallet-a',
          _sum: { amount: decimal(300) },
        },
        {
          fromWalletId: 'wallet-b',
          _sum: { amount: decimal(100) },
        },
        {
          fromWalletId: 'wallet-c',
          _sum: { amount: decimal(50) },
        },
      ]);
      prisma.wallet.findMany.mockResolvedValue([
        {
          id: 'wallet-a',
          user: { id: 'user-a', email: 'a@example.com', name: 'User A' },
        },
        {
          id: 'wallet-b',
          user: { id: 'user-a', email: 'a@example.com', name: 'User A' },
        },
        {
          id: 'wallet-c',
          user: { id: 'user-b', email: 'b@example.com', name: 'User B' },
        },
      ]);

      const result = await service.getTopUsers(2);

      expect(result.users).toEqual([
        {
          userId: 'user-a',
          email: 'a@example.com',
          name: 'User A',
          totalOutbound: '400',
        },
        {
          userId: 'user-b',
          email: 'b@example.com',
          name: 'User B',
          totalOutbound: '50',
        },
      ]);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { amount: true },
        }),
      );
    });

    it('returns empty list when no transactions exist', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getTopUsers();
      expect(result.users).toHaveLength(0);
      expect(prisma.wallet.findMany).not.toHaveBeenCalled();
    });

    it('applies date filter to group query', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const start: Date = new Date('2024-01-01');
      const end: Date = new Date('2024-02-01');

      await service.getTopUsers(undefined, { start, end });

      const lastGroupCall = prisma.transaction.groupBy.mock.calls.at(-1) as
        | [Prisma.TransactionGroupByArgs]
        | undefined;
      const callArgs = lastGroupCall?.[0];
      expect(callArgs?.where?.createdAt).toEqual({
        gte: start,
        lte: end,
      });
    });
  });
});
