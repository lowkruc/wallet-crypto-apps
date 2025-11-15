import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from './wallets.service';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: PrismaService & {
    wallet: { findMany: jest.Mock; findFirst: jest.Mock };
    transaction: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: {
            wallet: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            transaction: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WalletsService);
    prisma = module.get(PrismaService);
  });

  it('returns wallets for current user', async () => {
    const wallets = [
      {
        id: 'w1',
        userId: 'u1',
        currency: 'IDR',
        balance: decimal(100),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    prisma.wallet.findMany.mockResolvedValue(wallets);

    const result = await service.listMine('u1');
    expect(prisma.wallet.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(wallets);
  });

  it('throws when wallet not found for user', async () => {
    prisma.wallet.findFirst.mockResolvedValue(null);

    await expect(
      service.listTransactions('wallet-1', 'user-1', 10),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns wallet + transactions', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const txs = [
      {
        id: 'tx1',
        type: 'DEPOSIT',
        amount: decimal(50),
        currency: 'IDR',
        fromWalletId: null,
        toWalletId: 'wallet-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.transaction.findMany.mockResolvedValue(txs);

    const result = await service.listTransactions('wallet-1', 'user-1', 10);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ fromWalletId: 'wallet-1' }, { toWalletId: 'wallet-1' }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(result).toEqual({ wallet, transactions: txs });
  });

  it('rejects non-positive deposits', async () => {
    await expect(
      service.deposit('wallet-1', 'user-1', 0, 'IDR'),
    ).rejects.toThrow(BadRequestException);
  });

  it('deposits and records transaction', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.$transaction.mockImplementation(
      async (
        callback: (tx: any) => Promise<[typeof wallet, { id: string }]>,
      ) => {
        const ctx = {
          wallet: {
            update: jest.fn().mockResolvedValue({
              ...wallet,
              balance: wallet.balance.plus(50),
            }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'tx1',
              type: 'DEPOSIT',
              amount: decimal(50),
              currency: 'IDR',
              createdAt: new Date(),
            }),
          },
        };
        return await callback(ctx);
      },
    );

    const result = await service.deposit('wallet-1', 'user-1', 50, 'IDR');
    expect(result.wallet.balance.toString()).toBe('150');
    expect(result.transaction.id).toBe('tx1');
  });
});
