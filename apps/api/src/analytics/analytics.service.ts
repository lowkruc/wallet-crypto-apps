import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TOP_TRANSACTIONS_DEFAULT = 10;
const TOP_TRANSACTIONS_MAX = 50;
const TOP_USERS_DEFAULT = 10;
const TOP_USERS_MAX = 25;

type DateRange = {
  start?: Date;
  end?: Date;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private clampLimit(
    value: number | undefined,
    defaultValue: number,
    maxValue: number,
  ): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return defaultValue;
    }
    return Math.min(Math.floor(value), maxValue);
  }

  private buildDateFilter(range?: DateRange) {
    if (!range?.start && !range?.end) {
      return undefined;
    }
    const filter: Prisma.DateTimeFilter = {};
    if (range.start) {
      filter.gte = range.start;
    }
    if (range.end) {
      filter.lte = range.end;
    }
    return filter;
  }

  async getUserTopTransactions(
    userId: string,
    limit?: number,
    range?: DateRange,
  ) {
    const take = this.clampLimit(
      limit,
      TOP_TRANSACTIONS_DEFAULT,
      TOP_TRANSACTIONS_MAX,
    );
    const dateFilter = this.buildDateFilter(range);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ fromWallet: { userId } }, { toWallet: { userId } }],
        createdAt: dateFilter,
      },
      include: {
        fromWallet: {
          select: {
            id: true,
            userId: true,
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        toWallet: {
          select: {
            id: true,
            userId: true,
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
      orderBy: { amount: 'desc' },
      take,
    });

    const mapped = transactions.map((tx) => {
      const outgoing = tx.fromWallet?.userId === userId;
      const counterparty = outgoing
        ? tx.toWallet?.user
        : (tx.fromWallet?.user ?? null);
      const direction: 'IN' | 'OUT' = outgoing ? 'OUT' : 'IN';
      const signedAmount = outgoing
        ? tx.amount.times(-1)
        : new Prisma.Decimal(tx.amount);
      return {
        id: tx.id,
        type: tx.type,
        currency: tx.currency,
        amount: signedAmount.toString(),
        direction,
        counterparty: counterparty
          ? {
              id: counterparty.id,
              email: counterparty.email,
              name: counterparty.name,
            }
          : null,
        createdAt: tx.createdAt,
      };
    });

    return { userId, transactions: mapped };
  }

  async getTopUsers(limit?: number, range?: DateRange) {
    const take = this.clampLimit(limit, TOP_USERS_DEFAULT, TOP_USERS_MAX);
    const dateFilter = this.buildDateFilter(range);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['fromWalletId'],
      where: {
        type: 'TRANSFER',
        fromWalletId: { not: null },
        createdAt: dateFilter,
      },
      _sum: { amount: true },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: take * 5,
    });

    const walletIds = grouped
      .map((item) => item.fromWalletId)
      .filter((id): id is string => Boolean(id));

    if (walletIds.length === 0) {
      return { users: [] };
    }

    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds } },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const walletMap = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    const totals = new Map<
      string,
      {
        userId: string;
        email: string;
        name?: string | null;
        amount: Prisma.Decimal;
      }
    >();

    grouped.forEach((bucket) => {
      if (!bucket.fromWalletId || !bucket._sum.amount) {
        return;
      }
      const wallet = walletMap.get(bucket.fromWalletId);
      if (!wallet || !wallet.user) {
        return;
      }
      const existing = totals.get(wallet.user.id);
      const sumAmount = new Prisma.Decimal(bucket._sum.amount);
      if (existing) {
        existing.amount = existing.amount.plus(sumAmount);
      } else {
        totals.set(wallet.user.id, {
          userId: wallet.user.id,
          email: wallet.user.email,
          name: wallet.user.name,
          amount: sumAmount,
        });
      }
    });

    const ordered = Array.from(totals.values())
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .slice(0, take)
      .map((entry) => ({
        userId: entry.userId,
        email: entry.email,
        name: entry.name,
        totalOutbound: entry.amount.toString(),
      }));

    return { users: ordered };
  }
}
