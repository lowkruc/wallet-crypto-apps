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
    user: { findUnique: jest.Mock };
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
            user: {
              findUnique: jest.fn(),
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
        callback: (
          tx: Prisma.TransactionClient,
        ) => Promise<[typeof wallet, { id: string }]>,
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
        } as unknown as Prisma.TransactionClient;
        return await callback(ctx);
      },
    );

    const result = await service.deposit('wallet-1', 'user-1', 50, 'IDR');
    expect(result.wallet.balance.toString()).toBe('150');
    expect(result.transaction.id).toBe('tx1');
  });

  it('rejects transfers to self', async () => {
    await expect(
      service.transfer('user-1', 'userone', 'wallet-1', 'userone', 10),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.wallet.findFirst).not.toHaveBeenCalled();
  });

  it('throws when recipient is missing', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.transfer('user-1', 'userone', 'wallet-1', 'frienduser', 50),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when recipient wallet is missing', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      username: 'frienduser',
      email: 'friend@example.com',
      wallets: [],
    });

    await expect(
      service.transfer('user-1', 'userone', 'wallet-1', 'frienduser', 50),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws on insufficient funds', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      username: 'frienduser',
      email: 'friend@example.com',
      wallets: [
        {
          id: 'wallet-2',
          userId: 'user-2',
          currency: 'IDR',
          balance: decimal(0),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const ctx = {
          wallet: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        } as unknown as Prisma.TransactionClient;
        return await callback(ctx);
      },
    );

    await expect(
      service.transfer('user-1', 'userone', 'wallet-1', 'frienduser', 150),
    ).rejects.toThrow(BadRequestException);
  });

  it('transfers funds and logs transaction', async () => {
    const wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const recipientWallet = {
      id: 'wallet-2',
      userId: 'user-2',
      currency: 'IDR',
      balance: decimal(30),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.wallet.findFirst.mockResolvedValue(wallet);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      username: 'frienduser',
      email: 'friend@example.com',
      wallets: [recipientWallet],
    });

    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const ctx = {
          wallet: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              ...wallet,
              balance: wallet.balance.minus(25),
            }),
            update: jest.fn().mockResolvedValue({
              ...recipientWallet,
              balance: recipientWallet.balance.plus(25),
            }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'tx-1',
              type: 'TRANSFER',
              amount: decimal(25),
              currency: 'IDR',
              fromWalletId: 'wallet-1',
              toWalletId: 'wallet-2',
              createdAt: new Date(),
            }),
          },
        } as unknown as Prisma.TransactionClient;
        return await callback(ctx);
      },
    );

    const result = await service.transfer(
      'user-1',
      'userone',
      'wallet-1',
      'frienduser',
      25,
    );

    expect(result.fromWallet.balance.toString()).toBe('75');
    expect(result.toWallet.balance.toString()).toBe('55');
    expect(result.transaction.type).toBe('TRANSFER');
  });
});

describe('WalletsService transfer concurrency', () => {
  it('prevents double spending when two transfers race', async () => {
    const now = new Date();
    const senderWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      currency: 'IDR',
      balance: decimal(100),
      createdAt: now,
      updatedAt: now,
    };
    const recipientWallet = {
      id: 'wallet-2',
      userId: 'user-2',
      currency: 'IDR',
      balance: decimal(10),
      createdAt: now,
      updatedAt: now,
    };
    const transactions: {
      id: string;
      type: string;
      amount: Prisma.Decimal;
      currency: string;
      fromWalletId: string | null;
      toWalletId: string | null;
      createdAt: Date;
    }[] = [];

    const prismaStub = {
      wallet: {
        findFirst: jest.fn((args: Prisma.WalletFindFirstArgs) => {
          const wallet =
            args.where?.id === senderWallet.id &&
            args.where?.userId === senderWallet.userId
              ? senderWallet
              : null;
          return Promise.resolve(wallet);
        }),
      },
      user: {
        findUnique: jest.fn((args: Prisma.UserFindUniqueArgs) => {
          if (args.where?.username === 'frienduser') {
            return Promise.resolve({
              id: 'user-2',
              username: 'frienduser',
              email: 'friend@example.com',
              wallets: [recipientWallet],
            });
          }
          return Promise.resolve(null);
        }),
      },
      $transaction: jest.fn(
        async (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) => {
          const tx = {
            wallet: {
              updateMany: jest.fn((args: Prisma.WalletUpdateManyArgs) => {
                const scopedArgs = args as Prisma.WalletUpdateManyArgs & {
                  where?: {
                    balance?: Prisma.DecimalFilter<'Wallet'>;
                  };
                  data?: {
                    balance?: Prisma.DecimalFieldUpdateOperationsInput;
                  };
                };
                if (
                  scopedArgs.where?.id !== senderWallet.id ||
                  senderWallet.userId !== scopedArgs.where?.userId
                ) {
                  return Promise.resolve({ count: 0 });
                }
                const minBalance = decimal(
                  (scopedArgs.where?.balance?.gte ?? 0) as Prisma.Decimal.Value,
                );
                if (senderWallet.balance.lt(minBalance)) {
                  return Promise.resolve({ count: 0 });
                }
                senderWallet.balance = senderWallet.balance.minus(
                  decimal(
                    (scopedArgs.data?.balance?.decrement ??
                      0) as Prisma.Decimal.Value,
                  ),
                );
                return Promise.resolve({ count: 1 });
              }),
              findUniqueOrThrow: jest.fn(
                (args: Prisma.WalletFindUniqueOrThrowArgs) => {
                  if (args.where.id === senderWallet.id) {
                    return Promise.resolve(senderWallet);
                  }
                  return Promise.reject(new Error('Wallet not found'));
                },
              ),
              update: jest.fn((args: Prisma.WalletUpdateArgs) => {
                const scopedArgs = args as Prisma.WalletUpdateArgs & {
                  data: {
                    balance?: Prisma.DecimalFieldUpdateOperationsInput;
                  };
                };
                if (args.where.id === recipientWallet.id) {
                  recipientWallet.balance = recipientWallet.balance.plus(
                    decimal(
                      (scopedArgs.data.balance?.increment ??
                        0) as Prisma.Decimal.Value,
                    ),
                  );
                  return Promise.resolve(recipientWallet);
                }
                return Promise.reject(new Error('Wallet not found'));
              }),
            },
            transaction: {
              create: jest.fn((args: Prisma.TransactionCreateArgs) => {
                const txRecord = {
                  id: `tx-${transactions.length + 1}`,
                  type: 'TRANSFER',
                  amount: decimal(args.data.amount as Prisma.Decimal.Value),
                  currency: args.data.currency as string,
                  fromWalletId: args.data.fromWalletId ?? null,
                  toWalletId: args.data.toWalletId ?? null,
                  createdAt: new Date(),
                };
                transactions.push(txRecord);
                return Promise.resolve(txRecord);
              }),
            },
          } as unknown as Prisma.TransactionClient;
          return await callback(tx);
        },
      ),
    } as unknown as PrismaService;

    const service = new WalletsService(prismaStub);

    const [first, second] = await Promise.allSettled([
      service.transfer('user-1', 'userone', 'wallet-1', 'frienduser', 80),
      service.transfer('user-1', 'userone', 'wallet-1', 'frienduser', 80),
    ]);

    const failures = [first, second].filter(
      (result) => result.status === 'rejected',
    );
    const successes = [first, second].filter(
      (result) => result.status === 'fulfilled',
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBeInstanceOf(BadRequestException);
    expect(senderWallet.balance.toString()).toBe('20');
    expect(recipientWallet.balance.toString()).toBe('90');
    expect(transactions).toHaveLength(1);
  });
});
